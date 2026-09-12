"""Local regression checks. Uses disposable SQLite, no dotenv keys or AI network.

Run from the repository root: .venv/Scripts/python.exe tests/backend_review_test.py
"""
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
import unittest
from unittest.mock import patch
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
temporary = tempfile.TemporaryDirectory(prefix="kingcareer-review-")
os.environ["KINGCAREER_DATA_DIR"] = temporary.name
os.environ["KINGCAREER_AI_MODE"] = "template"
os.environ["KINGCAREER_AI_KEY"] = ""
with patch("dotenv.load_dotenv", return_value=False):
    from fastapi import HTTPException, Request
    from fastapi.testclient import TestClient
    from backend import main, db
    from backend.auth import HASHER, user_for
    from backend.drawing_context import drawing_context
    from backend.inference import Evaluation, ProjectHint
    from backend.reviews import defaults_for


def shape(eid, kind="rectangle", **extra):
    return {"id": eid, "type": kind, "x": 0, "y": 0, "width": 100, "height": 60, **extra}


SCENE = {"elements": [shape("login"), shape("retry"),
    shape("login-label", "text", text="로그인 실패", containerId="login"),
    shape("retry-label", "text", text="다시 시도", containerId="retry"),
    shape("flow", "arrow", startBinding={"elementId": "login"}, endBinding={"elementId": "retry"}, endArrowhead="arrow"),
    shape("deleted", "text", text="DELETED_SHOULD_NOT_SEND", isDeleted=True)]}
ANSWERS = ["로그인 실패 뒤 다음 행동을 안내하지 않는 문제를 발견했어요.",
           "입력값을 유지하고 다시 시도하는 버튼으로 연결할 계획이에요.",
           "같은 실패 상황에서 사용자가 다시 시도할 수 있는지 확인해요."]


class BackendReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = HASHER.hash("review-test-password")
        cls.client_context = TestClient(main.app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        main.app.dependency_overrides.clear()
        cls.client_context.__exit__(None, None, None)

    def setUp(self):
        self.uid = str(uuid.uuid4())
        self.other_uid = str(uuid.uuid4())
        profile = {"name": "검사 학생", "school": "", "grade": "", "region": "", "interests": [], "notifications": True}
        with db.transaction() as con:
            for uid in (self.uid, self.other_uid):
                con.execute("INSERT INTO users VALUES (?,?,?,?,?)", (uid, uid, self.password_hash, db.dump(profile), db.now()))

        def authenticated(request: Request):
            uid = request.headers.get("x-test-user", self.uid)
            with db.transaction() as con:
                row = con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
                if not row:
                    raise HTTPException(401)
                return dict(row)
        main.app.dependency_overrides[user_for] = authenticated

    def body(self, **values):
        return {"clientRequestId": str(uuid.uuid4()), **values}

    def save(self, career="developer", **values):
        response = self.client.put(f"/api/v1/projects/{career}/draft", json=self.body(
            answers=values.pop("answers", ANSWERS), expectedVersion=values.pop("expectedVersion", 0),
            scene=values.pop("scene", SCENE), **values))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def artifact(self):
        draft = self.save(interest=5)
        response = self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=draft["version"]))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_interest_persistence_canonical_submit_and_compact_replay(self):
        empty = self.client.get("/api/v1/projects/developer").json()
        self.assertIsNone(empty["interest"])
        payload = self.body(answers=ANSWERS, scene=SCENE, expectedVersion=0, interest=5)
        saved = self.client.put("/api/v1/projects/developer/draft", json=payload)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["interest"], 5)
        self.assertEqual(self.client.get("/api/v1/projects/developer").json(), saved.json())
        self.assertEqual(self.client.put("/api/v1/projects/developer/draft", json=payload).json(), saved.json())
        self.assertEqual(self.client.put("/api/v1/projects/developer/draft", json={**payload, "interest": 2}).status_code, 409)
        with db.transaction() as con:
            replay = con.execute("SELECT response FROM requests WHERE user_id=?", (self.uid,)).fetchone()[0]
        self.assertIn("_projectRevision", replay)
        self.assertLess(len(replay), 120)
        no_op = self.save(interest=5, expectedVersion=1)
        self.assertEqual(no_op["version"], 1)
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=1, interest=2)).status_code, 409)
        submit_body = self.body(expectedVersion=1)
        result = self.client.post("/api/v1/projects/developer/submit", json=submit_body)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["interest"], 5)
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=submit_body).json()["id"], result.json()["id"])
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=1)).json()["id"], result.json()["id"])
        self.assertEqual(self.client.get("/api/v1/state").json()["activeActivities"], [])

    def test_revision_summary_detail_ownership_and_nullable_interest(self):
        self.save(interest=5)
        # Older clients that omit interest must not erase the saved choice.
        preserved = self.save(expectedVersion=1, answers=[ANSWERS[0] + " 보완", *ANSWERS[1:]])
        self.assertEqual(preserved["interest"], 5)
        cleared = self.save(expectedVersion=2, interest=None)
        self.assertIsNone(cleared["interest"])
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=3)).status_code, 422)
        revisions = self.client.get("/api/v1/projects/developer/revisions").json()
        self.assertEqual(len(revisions), 3)
        self.assertNotIn("scene", revisions[0])
        self.assertNotIn("answers", revisions[0])
        self.assertEqual(revisions[0]["completedAnswers"], 3)
        detail = self.client.get("/api/v1/projects/developer/revisions/1").json()
        self.assertEqual(detail["interest"], 5)
        self.assertEqual(detail["answers"], ANSWERS)
        self.assertEqual(self.client.get("/api/v1/projects/developer/revisions/1", headers={"x-test-user": self.other_uid}).status_code, 404)

    def test_step_cards_keep_editing_metadata_and_evidence_through_submission(self):
        scene = json.loads(json.dumps(SCENE))
        scene["appState"] = {"viewBackgroundColor": "#ffffff"}
        scene["elements"][0]["customData"] = {"kingCareerStep": {"schema": 1, "order": 0}}
        scene["elements"][1]["customData"] = {"kingCareerStep": {"schema": 1, "order": 1}}
        saved = self.save(scene=scene, interest=4)
        restored = self.client.get("/api/v1/projects/developer").json()
        self.assertEqual(restored["scene"], scene)
        revision = self.client.get(f"/api/v1/projects/developer/revisions/{saved['version']}").json()
        self.assertEqual(revision["scene"], scene)
        response = self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=saved["version"]))
        self.assertEqual(response.status_code, 200, response.text)
        artifact = self.client.get(f"/api/v1/portfolio/{response.json()['id']}/artifact").json()
        self.assertEqual(artifact["scene"], scene)
        graph = drawing_context(artifact["scene"])
        self.assertEqual([node["label"] for node in graph["nodes"][:2]], ["로그인 실패", "다시 시도"])
        self.assertEqual(graph["connections"][0]["to"], "node2")

    def test_active_progress_excludes_empty_and_brief_sessions(self):
        self.save(answers=["", "", ""], scene=None, interest=5)
        simulation = self.client.post("/api/v1/simulations", json={"careerId": "farmer"}).json()
        self.assertEqual(self.client.get("/api/v1/state").json()["activeActivities"], [])
        response = self.client.post(f"/api/v1/simulations/{simulation['id']}/turn", json=self.body(kind="start", expectedVersion=simulation["version"]))
        self.assertEqual(response.status_code, 200, response.text)
        self.save(expectedVersion=1, interest=5)
        active = self.client.get("/api/v1/state").json()["activeActivities"]
        self.assertEqual([item["kind"] for item in active], ["project", "simulation"])
        self.assertEqual(active[1]["sessionId"], simulation["id"])
        self.assertTrue(all(item["updatedAt"] for item in active))

    def test_diagram_structure_is_bounded_and_used_by_coach(self):
        graph = drawing_context(SCENE)
        self.assertEqual(graph["connections"][0]["from"], "node1")
        self.assertEqual(graph["connections"][0]["to"], "node2")
        self.assertNotIn("DELETED_SHOULD_NOT_SEND", json.dumps(graph))
        self.assertEqual(graph["nodes"][0]["label"], "로그인 실패")
        self.assertTrue(drawing_context({"elements": [shape(str(i)) for i in range(100)]})["truncated"])
        malformed = drawing_context({"elements": [shape("a", "text", containerId=[]), shape("b", "arrow", startBinding={"elementId": []}, endArrowhead={})]})
        self.assertIsNone(malformed["connections"][0]["from"])
        saved = self.save(interest=4)
        with patch.object(main, "AI_MODE", "ai"), patch.object(main, "provider") as factory:
            factory.return_value.help_project.return_value = ProjectHint(hint="실패 다음에 어떤 행동이 이어질까요?", nextAction="다시 시도하는 경로를 확인해요.")
            response = self.client.post("/api/v1/projects/developer/help", json=self.body(expectedVersion=saved["version"], mission=1, intent="improve"))
            self.assertEqual(response.status_code, 200, response.text)
            context = factory.return_value.help_project.call_args.args[0]
            self.assertEqual(context["drawingGraph"]["connections"][0]["to"], "node2")
            self.assertNotIn("drawingLabels", context)

    def slow_evaluation(self, operation):
        activity = self.artifact()
        started, release = threading.Event(), threading.Event()
        def evaluate(context):
            self.assertIn("drawingGraph", context)
            started.set()
            if not release.wait(8):
                raise RuntimeError("test timed out waiting for unrelated operation")
            return Evaluation(feedback="다시 시도하는 단계가 명시되어 있어요.", observations=["결과 확인도 연결해 보세요."])
        with patch.object(main, "AI_MODE", "ai"), patch.object(main, "provider") as factory, ThreadPoolExecutor(max_workers=2) as pool:
            factory.return_value.evaluate.side_effect = evaluate
            payload = self.body()
            pending = pool.submit(self.client.post, f"/api/v1/portfolio/{activity['id']}/evaluate", json=payload)
            self.assertTrue(started.wait(3))
            try:
                concurrent = pool.submit(operation, activity)
                concurrent.result(timeout=3)
            finally:
                release.set()
            response = pending.result(timeout=3)
            return activity, response, factory.return_value.evaluate.call_count

    def test_evaluation_does_not_block_other_student_saves_and_replays(self):
        def other_save(activity):
            response = self.client.patch("/api/v1/profile", headers={"x-test-user": self.other_uid}, json={"name": "동시 저장"})
            self.assertEqual(response.status_code, 200, response.text)
            duplicate = self.client.post(f"/api/v1/portfolio/{activity['id']}/evaluate", json=self.body())
            self.assertEqual(duplicate.status_code, 429)
        activity, result, calls = self.slow_evaluation(other_save)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(calls, 1)
        with patch.object(main, "AI_MODE", "ai"), patch.object(main, "provider") as factory:
            response = self.client.post(f"/api/v1/portfolio/{activity['id']}/evaluate", json=self.body())
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["evaluationStatus"], "ai_feedback")
            factory.assert_not_called()

    def test_record_delete_while_evaluation_is_pending_does_not_recreate_data(self):
        def delete_records(_):
            self.assertEqual(self.client.delete("/api/v1/records").status_code, 200)
        _, response, _ = self.slow_evaluation(delete_records)
        self.assertEqual(response.status_code, 404, response.text)
        with db.transaction() as con:
            for table in ("activities", "requests", "events", "projects", "project_revisions"):
                self.assertEqual(con.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id=?", (self.uid,)).fetchone()[0], 0)

    def test_account_delete_while_evaluation_is_pending_does_not_recreate_data(self):
        def delete_account(_):
            response = self.client.request("DELETE", "/api/v1/auth/account", json={"password": "review-test-password"})
            self.assertEqual(response.status_code, 200, response.text)
        _, response, _ = self.slow_evaluation(delete_account)
        self.assertEqual(response.status_code, 404, response.text)
        with db.transaction() as con:
            self.assertIsNone(con.execute("SELECT * FROM users WHERE id=?", (self.uid,)).fetchone())

    def test_failed_evaluation_preserves_artifact_for_retry(self):
        activity = self.artifact()
        with patch.object(main, "AI_MODE", "ai"), patch.object(main, "provider") as factory:
            factory.return_value.evaluate.side_effect = RuntimeError("offline fixture")
            payload = self.body()
            url = f"/api/v1/portfolio/{activity['id']}/evaluate"
            self.assertEqual(self.client.post(url, json=payload).status_code, 503)
            original = self.client.get(f"/api/v1/portfolio/{activity['id']}/artifact").json()
            self.assertEqual(original["evaluationStatus"], "not_connected")
            factory.return_value.evaluate.side_effect = None
            factory.return_value.evaluate.return_value = Evaluation(feedback="저장된 자료를 확인했어요.")
            self.assertEqual(self.client.post(url, json=payload).status_code, 200)

    def test_review_reuses_explicit_answers_without_inventing_career_decision(self):
        activity = {"liked": "단서 찾기", "disliked": "수치 비교가 어려웠어요", "interest": 2,
                    "reflection": "동료와 정보를 나누는 일이 중요하다는 걸 알았어요."}
        self.assertEqual(defaults_for(activity)["answers"], {"enjoyed": "investigate", "difficult": "compare", "again": "interest_2"})
        self.assertEqual(defaults_for({**activity, "reflection": "경험해 보니 다른 직업도 더 알아보고 싶어요."})["answers"]["again"], "other")
        self.assertEqual(defaults_for({"liked": "기록에 없는 답", "interest": None})["answers"], {})

    def test_legacy_submit_and_explicit_null_request_identity(self):
        # Legacy payload without interest is still supported; no default score.
        saved = self.save()
        self.assertIsNone(saved["interest"])
        submitted = self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=1, interest=4))
        self.assertEqual(submitted.status_code, 200, submitted.text)
        self.assertEqual(submitted.json()["interest"], 4)
        payload = self.body(answers=ANSWERS, expectedVersion=1)
        response = self.client.put("/api/v1/projects/developer/draft", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.put("/api/v1/projects/developer/draft", json={**payload, "scene": None}).status_code, 409)

    def test_coach_discards_reply_for_changed_draft(self):
        self.save(interest=4)
        started, release = threading.Event(), threading.Event()
        def help_project(_):
            started.set()
            if not release.wait(8):
                raise RuntimeError("draft save blocked behind coach")
            return ProjectHint(hint="원래 초안의 질문이에요.", nextAction="연결을 확인해요.")
        with patch.object(main, "AI_MODE", "ai"), patch.object(main, "provider") as factory, ThreadPoolExecutor(max_workers=2) as pool:
            factory.return_value.help_project.side_effect = help_project
            pending = pool.submit(self.client.post, "/api/v1/projects/developer/help", json=self.body(expectedVersion=1, mission=1, intent="check"))
            self.assertTrue(started.wait(3))
            try:
                saved = pool.submit(self.save, expectedVersion=1, interest=5)
                self.assertEqual(saved.result(timeout=3)["interest"], 5)
            finally:
                release.set()
            self.assertEqual(pending.result(timeout=3).status_code, 409)
        with db.transaction() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM requests WHERE user_id=? AND request_key LIKE 'project-help:%'", (self.uid,)).fetchone()[0], 0)


if __name__ == "__main__":
    try:
        unittest.main(verbosity=2)
    finally:
        temporary.cleanup()
