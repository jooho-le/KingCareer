"""Guided project draft/submission regressions, using disposable SQLite only.

Run: .venv/Scripts/python.exe -m unittest discover -s tests -p test_project_readiness.py
"""
from contextlib import ExitStack
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Never read local model credentials. Each API test also patches all storage
# paths before application lifespan opens its database/checkpointer.
with patch("dotenv.load_dotenv", return_value=False):
    from fastapi.testclient import TestClient
    from backend import db, main, simulation
    from backend.auth import user_for
    from backend.project_readiness import answer_is_complete, drawing_is_complete
    from backend.drawing_context import drawing_context


ANSWERS = ["오류 안내에서 다음 행동을 찾기 어려운 문제를 발견했어요.",
           "다시 시도하는 버튼을 추가하고 이전 입력을 유지할 계획이에요.",
           "같은 오류 상황에서 버튼으로 다시 시도할 수 있는지 확인해요."]
SCENE = {"elements": [{"id": "student-design", "type": "rectangle", "x": 0,
                       "y": 0, "width": 180, "height": 80}]}


class ProjectReadinessTests(unittest.TestCase):
    def test_drawing_guide_is_not_completed_work_and_coach_distinguishes_template(self):
        from copy import deepcopy
        guide = {"elements": [{"id": "blank", "type": "text", "text": "〔채우기:버튼 이름〕", "originalText": "〔채우기:버튼 이름〕",
                  "customData": {"kingCareerGuide": {"careerId": "developer", "originalText": "〔채우기:버튼 이름〕"}}}]}
        self.assertFalse(drawing_is_complete(guide))
        self.assertEqual(drawing_context(guide)["nodes"][0]["source"], "provided_guide")
        filled = deepcopy(guide)
        filled["elements"][0].update(text="내 입력을 유지하고 다시 시도", originalText="내 입력을 유지하고 다시 시도")
        self.assertTrue(drawing_is_complete(filled))
        self.assertEqual(drawing_context(filled)["nodes"][0]["source"], "student_edit")
        unchanged = deepcopy(filled)
        unchanged["elements"][0]["customData"]["kingCareerGuide"]["originalText"] = "내 입력을 유지하고 다시 시도"
        self.assertFalse(drawing_is_complete(unchanged))
        self.assertTrue(drawing_is_complete(SCENE))
        self.assertFalse(drawing_is_complete({"elements": []}))

    def test_reserved_blanks_never_count_as_complete_explanations(self):
        for value in ("〔채우기:자료〕에서 오류를 확인했어요.",
                      "충분히 긴 설명 뒤에도 〔채우기:〕",
                      "중간의 〔채우기:문제\n자료〕 부분이 아직 비어 있어요.",
                      "  짧아요  "):
            with self.subTest(answer=value):
                self.assertFalse(answer_is_complete(value))
        self.assertTrue(answer_is_complete("  " + ANSWERS[0] + "  "))
        self.assertTrue(answer_is_complete("일반 문장에서 채우기라는 말을 사용하는 것은 괜찮아요."))

    def test_unfinished_draft_restores_without_evidence_then_filled_revision_submits(self):
        with ExitStack() as stack:
            directory = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="kingcareer-project-guide-")))
            stack.enter_context(patch.object(db, "DATA_DIR", directory))
            stack.enter_context(patch.object(simulation, "DATA_DIR", directory))
            stack.enter_context(patch.object(main, "AI_MODE", "template"))
            stack.enter_context(patch.object(simulation, "AI_MODE", "template"))
            model = stack.enter_context(patch.object(main, "provider", side_effect=AssertionError("No live model calls")))
            stack.enter_context(patch.object(simulation, "provider", side_effect=AssertionError("No live model calls")))
            client = stack.enter_context(TestClient(main.app))
            uid = str(uuid.uuid4())
            profile = {"name": "가이드 검사 학생", "school": "", "grade": "", "region": "", "interests": [], "notifications": True}
            user = {"id": uid, "username": uid, "password_hash": "test-auth-overridden", "profile": db.dump(profile), "created_at": db.now()}
            with db.transaction() as con:
                con.execute("INSERT INTO users VALUES (?,?,?,?,?)", tuple(user.values()))
            stack.enter_context(patch.dict(main.app.dependency_overrides, {user_for: lambda: user}))

            def payload(**values):
                return {"clientRequestId": str(uuid.uuid4()), **values}

            unfinished = [ANSWERS[0], "〔채우기:자료〕를 보고 〔채우기:문제〕를 바꿀 계획이에요.", "짧아요"]
            draft_body = payload(answers=unfinished, scene=SCENE, interest=4, expectedVersion=0)
            saved = client.put("/api/v1/projects/developer/draft", json=draft_body)
            self.assertEqual(saved.status_code, 200, saved.text)
            self.assertEqual(saved.json()["version"], 1)
            self.assertEqual(saved.json()["answers"], unfinished)
            self.assertEqual(client.get("/api/v1/projects/developer").json(), saved.json())
            self.assertEqual(client.get("/api/v1/projects/developer/revisions/1").json()["answers"], unfinished)
            self.assertEqual(client.get("/api/v1/projects/developer/revisions").json()[0]["completedAnswers"], 1)
            state = client.get("/api/v1/state").json()
            self.assertEqual(state["activeActivities"][0]["completedAnswers"], 1)
            self.assertEqual(state["activities"], [])

            rejected = client.post("/api/v1/projects/developer/submit", json=payload(expectedVersion=1))
            self.assertEqual(rejected.status_code, 422, rejected.text)
            self.assertIn("채우기", rejected.json()["detail"])
            self.assertEqual(client.get("/api/v1/projects/developer").json()["answers"], unfinished)
            with db.transaction() as con:
                for table in ("events", "activities"):
                    self.assertEqual(con.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id=?", (uid,)).fetchone()[0], 0)

            # Finished explanations do not bypass unfinished in-canvas blanks.
            blank_scene = {"elements": [{"id": "canvas-blank", "type": "text", "x": 0, "y": 0, "width": 200, "height": 30,
                                         "text": "〔채우기:버튼〕", "originalText": "〔채우기:버튼〕"}]}
            blocked = client.put("/api/v1/projects/farmer/draft", json=payload(answers=ANSWERS, scene=blank_scene, interest=4, expectedVersion=0))
            self.assertEqual(blocked.status_code, 200, blocked.text)
            rejected_drawing = client.post("/api/v1/projects/farmer/submit", json=payload(expectedVersion=1))
            self.assertEqual(rejected_drawing.status_code, 422, rejected_drawing.text)
            self.assertIn("그림 속", rejected_drawing.json()["detail"])
            self.assertFalse(client.get("/api/v1/projects/farmer/revisions").json()[0]["hasDrawing"])
            with db.transaction() as con:
                con.execute("DELETE FROM projects WHERE user_id=? AND career_id='farmer'", (uid,))

            completed = client.put("/api/v1/projects/developer/draft", json=payload(answers=ANSWERS, expectedVersion=1))
            self.assertEqual(completed.status_code, 200, completed.text)
            self.assertEqual(completed.json()["version"], 2)
            self.assertEqual(client.get("/api/v1/state").json()["activeActivities"][0]["completedAnswers"], 3)
            summaries = client.get("/api/v1/projects/developer/revisions").json()
            self.assertEqual([(item["version"], item["completedAnswers"]) for item in summaries], [(2, 3), (1, 1)])
            # Retrying an old autosave must preserve the exact unfinished
            # revision, without replacing the latest filled draft.
            self.assertEqual(client.put("/api/v1/projects/developer/draft", json=draft_body).json(), saved.json())
            self.assertEqual(client.get("/api/v1/projects/developer").json()["answers"], ANSWERS)
            submit_body = payload(expectedVersion=2)
            submitted = client.post("/api/v1/projects/developer/submit", json=submit_body)
            self.assertEqual(submitted.status_code, 200, submitted.text)
            self.assertEqual(submitted.json()["answers"], ANSWERS)
            self.assertEqual(client.post("/api/v1/projects/developer/submit", json=submit_body).json()["id"], submitted.json()["id"])
            self.assertEqual(client.get("/api/v1/state").json()["activeActivities"], [])
            with db.transaction() as con:
                self.assertEqual(con.execute("SELECT COUNT(*) FROM activities WHERE user_id=?", (uid,)).fetchone()[0], 1)
                self.assertEqual(con.execute("SELECT COUNT(*) FROM events WHERE user_id=?", (uid,)).fetchone()[0], 4)
            model.assert_not_called()


if __name__ == "__main__":
    unittest.main()
