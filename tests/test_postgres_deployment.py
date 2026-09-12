"""Run only against a disposable PostgreSQL schema; never reads local dotenv keys."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
import uuid
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
if not os.getenv("KINGCAREER_DATABASE_URL") or not os.getenv("KINGCAREER_DATABASE_SCHEMA", "").endswith("_test"):
    raise SystemExit("Use a disposable database and a schema ending in _test.")
os.environ["KINGCAREER_AI_MODE"] = "template"
os.environ["KINGCAREER_AI_KEY"] = ""
with patch("dotenv.load_dotenv"):
    from backend import db
    from backend.config import POSTGRES_SCHEMA
    from backend.migrate_postgres import migrate
    from backend.operation_lock import OperationLock
    from backend.simulation import SimulationEngine, new_session


class DeploymentTests(unittest.TestCase):
    def test_serverless_request_initializes_without_lifespan(self):
        with patch("dotenv.load_dotenv"):
            from backend.main import app
            from fastapi.testclient import TestClient
        app.state.runtime_ready = False
        client = TestClient(app)
        try:
            response = client.get("/api/v1/health")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"status": "ok"})
            self.assertEqual(response.headers["cache-control"], "no-store")
            self.assertTrue(app.state.runtime_ready)
        finally:
            client.close()
            if getattr(app.state, "runtime_ready", False):
                app.state.simulator.close()
                app.state.runtime_ready = False

    def test_migration_idempotency_and_rls(self):
        migrate()
        migrate()
        db.initialize()
        with db.transaction() as con:
            rows = con.execute("SELECT relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname=? AND relkind='r'", (POSTGRES_SCHEMA,)).fetchall()
            self.assertTrue(rows)
            self.assertTrue(all(row[0] for row in rows))

    def test_lease_visible_to_another_process(self):
        key = "deployment-test-" + uuid.uuid4().hex
        first = OperationLock(key)
        self.assertTrue(first.acquire())
        code = "from backend.operation_lock import OperationLock; import sys; lock=OperationLock(sys.argv[1]); acquired=lock.acquire(); print(acquired); lock.release() if acquired else None"
        try:
            result = subprocess.run([sys.executable, "-c", code, key], capture_output=True, text=True, check=True)
            self.assertEqual(result.stdout.strip(), "False")
        finally:
            first.release()
        result = subprocess.run([sys.executable, "-c", code, key], capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout.strip(), "True")

    def test_canonical_state_survives_new_engine_and_rollback(self):
        uid = uuid.uuid4().hex
        sid = uuid.uuid4().hex
        engine = SimulationEngine()
        self.assertIsNone(engine.saver)
        try:
            with db.transaction() as con:
                con.execute("INSERT INTO users VALUES (?,?,?,?,?)", (uid, uid, "synthetic", "{}", db.now()))
                state = engine.transition(new_session(sid, "developer"), {"kind": "start"})
                con.execute("INSERT INTO simulations (id,user_id,career_id,state,version,created_at) VALUES (?,?,?,?,?,?)", (sid, uid, "developer", db.dump(state), state["version"], db.now()))
            engine.close()
            engine = SimulationEngine()
            engine.reconcile()
            with self.assertRaisesRegex(RuntimeError, "rollback"):
                with db.transaction() as con:
                    saved = json.loads(con.execute("SELECT state FROM simulations WHERE id=?", (sid,)).fetchone()[0])
                    next_state = engine.transition(saved, {"kind": "inspect", "objectId": saved["fieldwork"]["objects"][0]["id"]})
                    con.execute("UPDATE simulations SET state=?,version=? WHERE id=?", (db.dump(next_state), next_state["version"], sid))
                    raise RuntimeError("rollback")
            with db.transaction() as con:
                self.assertEqual(json.loads(con.execute("SELECT state FROM simulations WHERE id=?", (sid,)).fetchone()[0]), state)
        finally:
            engine.close()
            with db.transaction() as con:
                con.execute("DELETE FROM users WHERE id=?", (uid,))


if __name__ == "__main__":
    unittest.main(verbosity=2)
