"""SQLite transactional store. Start one uvicorn worker; writes are serialized."""
from contextlib import closing, contextmanager
from datetime import datetime, timezone
import json
import sqlite3
import threading
from .config import DATA_DIR, ROOT

WRITE_LOCK = threading.RLock()


def now():
    return datetime.now(timezone.utc).isoformat()


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def connect():
    connection = sqlite3.connect(DATA_DIR / "kingcareer.db", timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA busy_timeout=15000")
    return connection


@contextmanager
def transaction():
    with WRITE_LOCK:
        con = connect()
        try:
            con.execute("BEGIN IMMEDIATE")
            yield con
            con.commit()
        except BaseException:
            con.rollback()
            raise
        finally:
            con.close()


def initialize():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as con, con:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
        applied = {row[0] for row in con.execute("SELECT version FROM schema_migrations")}
        for migration in sorted((ROOT / "backend" / "migrations").glob("*.sql")):
            version = int(migration.name.split("_")[0])
            if version not in applied:
                con.executescript("BEGIN IMMEDIATE;\n" + migration.read_text(encoding="utf-8"))
                con.execute("INSERT INTO schema_migrations VALUES (?,?)", (version, now()))
                con.commit()
