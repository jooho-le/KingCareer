"""Login-recovery v2 API contract, using disposable SQLite and no live models.

Run: .venv/Scripts/python.exe -m unittest discover -s tests -p test_recovery_project.py
"""
from contextlib import ExitStack
from copy import deepcopy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with patch("dotenv.load_dotenv", return_value=False):
    from fastapi.testclient import TestClient
    from backend import db, main, simulation, reviews
    from backend.auth import user_for
    from backend.drawing_context import drawing_context
    from backend.inference import Evaluation, CareerReflection


ELEMENT = {"id": "authored-login-screen", "type": "rectangle", "x": 0,
           "y": 0, "width": 320, "height": 480}
INITIAL_STUDIO = {"kind": "login-recovery", "version": 2, "message": "",
                  "messagePosition": {"x": 24, "y": 130}, "retry": None,
                  "support": None, "preserveInput": None}
FINISHED_STUDIO = {**INITIAL_STUDIO, "message": "연결이 잠시 끊겼어요. 다시 시도하고 계속 안 되면 도움받기를 눌러 주세요.",
                   "retry": {"label": "다시 시도", "target": "login", "x": 24, "y": 210},
                   "support": {"label": "도움받기", "target": "support", "x": 24, "y": 280},
                   "preserveInput": True}
LEGACY_ANSWERS = ["로그인 화면에서 다음 행동이 보이지 않는 문제를 발견했어요.",
                  "재시도와 도움받기 버튼을 넣어 이동할 수 있게 해요.",
                  "연결이 복구된 경우와 계속 실패하는 경우를 확인해요."]


class RecoveryProjectTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        directory = Path(self.stack.enter_context(tempfile.TemporaryDirectory(prefix="kingcareer-recovery-")))
        self.stack.enter_context(patch.object(db, "DATA_DIR", directory))
        self.stack.enter_context(patch.object(db, "DATABASE_URL", ""))
        self.stack.enter_context(patch.object(simulation, "DATA_DIR", directory))
        self.stack.enter_context(patch.object(main, "AI_MODE", "template"))
        self.stack.enter_context(patch.object(simulation, "AI_MODE", "template"))
        self.model = self.stack.enter_context(patch.object(main, "provider", side_effect=AssertionError("No live model calls")))
        self.stack.enter_context(patch.object(simulation, "provider", side_effect=AssertionError("No live model calls")))
        self.client = self.stack.enter_context(TestClient(main.app))
        self.users = [self.create_user(), self.create_user()]
        self.user = self.users[0]
        self.stack.enter_context(patch.dict(main.app.dependency_overrides, {user_for: lambda: self.user}))

    def create_user(self):
        uid = str(uuid.uuid4())
        profile = {"name": "작업실 검사 학생", "school": "", "grade": "", "region": "", "interests": [], "notifications": True}
        user = {"id": uid, "username": uid, "password_hash": "test-auth-overridden", "profile": db.dump(profile), "created_at": db.now()}
        with db.transaction() as con:
            con.execute("INSERT INTO users VALUES (?,?,?,?,?)", tuple(user.values()))
        return user

    def body(self, **values):
        return {"clientRequestId": str(uuid.uuid4()), **values}

    def save(self, studio=FINISHED_STUDIO, version=0, career="developer", answers=None, interest=4):
        scene = {"elements": [deepcopy(ELEMENT)], "studio": deepcopy(studio)}
        response = self.client.put(f"/api/v1/projects/{career}/draft", json=self.body(
            answers=answers or ["", "", ""], scene=scene, interest=interest, expectedVersion=version))
        return response

    def check(self, scenario, actions, version=1):
        return self.client.post("/api/v1/projects/developer/check", json=self.body(
            expectedVersion=version, scenario=scenario, actions=actions))

    def pass_both(self, version=1):
        recovered = self.check("recovered", ["retry"], version)
        self.assertEqual(recovered.status_code, 200, recovered.text)
        self.assertTrue(recovered.json()["checks"][0]["passed"])
        offline = self.check("offline", ["retry", "support"], version)
        self.assertEqual(offline.status_code, 200, offline.text)
        self.assertTrue(offline.json()["ready"], offline.text)
        return offline.json()

    def assert_no_achievements(self):
        with db.transaction() as con:
            for table in ("events", "activities"):
                self.assertEqual(con.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id=?", (self.user["id"],)).fetchone()[0], 0)
        self.model.assert_not_called()

    def test_initial_draft_roundtrip_and_schema_is_strict(self):
        saved = self.save(INITIAL_STUDIO)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["scene"]["studio"], INITIAL_STUDIO)
        self.assertEqual(self.client.get("/api/v1/projects/developer").json(), saved.json())
        self.assertEqual(self.client.get("/api/v1/projects/developer/revisions/1").json()["scene"], saved.json()["scene"])
        self.assertFalse(self.client.get("/api/v1/projects/developer/revisions").json()[0]["hasDrawing"])
        checks = self.client.get("/api/v1/projects/developer/checks").json()
        self.assertFalse(checks["ready"])
        self.assertEqual(checks["checks"], [])
        for patch_value in ({"checks": [{"passed": True}]}, {"kind": "other"}, {"version": 3},
                            {"message": "x" * 241}, {"preserveInput": "true"},
                            {"messagePosition": {"x": 301, "y": 2}},
                            {"messagePosition": {"x": True, "y": 2}},
                            {"retry": {"label": "x" * 41, "target": "login", "x": 20, "y": 20}},
                            {"support": {"label": "x", "target": "external", "x": 20, "y": 20}}):
            with self.subTest(patch=patch_value):
                rejected = self.save({**FINISHED_STUDIO, **patch_value}, version=1)
                self.assertEqual(rejected.status_code, 422, rejected.text)
        other_career = self.save(career="farmer")
        self.assertEqual(other_career.status_code, 422, other_career.text)
        forged = self.body(answers=["", "", ""], expectedVersion=1,
                           scene={"elements": [ELEMENT], "studio": FINISHED_STUDIO, "checks": [{"passed": True}]})
        self.assertEqual(self.client.put("/api/v1/projects/developer/draft", json=forged).status_code, 422)
        self.assert_no_achievements()

    def test_missing_links_empty_and_wrong_traces_never_pass(self):
        studio = deepcopy(FINISHED_STUDIO)
        studio["retry"]["target"] = None
        self.assertEqual(self.save(studio).status_code, 200)
        blocked = self.check("recovered", ["retry"])
        self.assertFalse(blocked.json()["checks"][0]["passed"])
        self.assertIn("연결되지", blocked.json()["checks"][0]["message"])
        self.assertEqual(self.save(version=1).status_code, 200)
        for scenario, actions in (("recovered", []), ("recovered", ["support"]),
                                  ("recovered", ["retry", "support"]), ("offline", ["support"]),
                                  ("offline", ["retry"]), ("offline", ["retry", "support", "retry"])):
            with self.subTest(scenario=scenario, actions=actions):
                response = self.check(scenario, actions, 2)
                self.assertEqual(response.status_code, 200, response.text)
                check = next(c for c in response.json()["checks"] if c["scenario"] == scenario)
                self.assertFalse(check["passed"])
                self.assertFalse(response.json()["ready"])
        forged = self.body(expectedVersion=2, scenario="offline", actions=["retry", "support"], passed=True)
        self.assertEqual(self.client.post("/api/v1/projects/developer/check", json=forged).status_code, 422)
        self.assertEqual(self.check("offline", ["retry"] * 9, 2).status_code, 422)
        self.assert_no_achievements()

    def test_saved_version_and_user_scope_and_idempotent_checks(self):
        self.assertEqual(self.save().status_code, 200)
        self.assertEqual(self.check("recovered", ["retry"], 0).status_code, 409)
        check_body = self.body(expectedVersion=1, scenario="recovered", actions=["retry"])
        first = self.client.post("/api/v1/projects/developer/check", json=check_body)
        self.assertTrue(first.json()["checks"][0]["passed"])
        self.assertEqual(self.client.post("/api/v1/projects/developer/check", json=check_body).json(), first.json())
        self.assertEqual(self.client.post("/api/v1/projects/developer/check", json={**check_body, "actions": []}).status_code, 409)
        self.user = self.users[1]
        self.assertEqual(self.client.get("/api/v1/projects/developer/checks").json()["checks"], [])
        self.assertEqual(self.client.post("/api/v1/projects/developer/check", json=check_body).status_code, 409)
        self.assertEqual(self.save().status_code, 200)
        self.assertFalse(self.client.get("/api/v1/projects/developer/checks").json()["ready"])
        second_user_check = self.client.post("/api/v1/projects/developer/check", json=check_body)
        self.assertEqual(second_user_check.status_code, 200, second_user_check.text)
        self.assert_no_achievements()

    def test_design_edit_invalidates_checks_but_reflection_edit_does_not(self):
        self.save()
        self.pass_both()
        changed = self.save(version=1, answers=["직접 연결해 보니 도움받을 곳이 필요했어요.", "", ""], interest=5)
        self.assertEqual(changed.status_code, 200, changed.text)
        self.assertEqual(changed.json()["version"], 2)
        self.assertTrue(self.client.get("/api/v1/projects/developer/checks").json()["ready"])
        studio = deepcopy(FINISHED_STUDIO)
        studio["messagePosition"]["x"] = 48
        self.assertEqual(self.save(studio, version=2).status_code, 200)
        checks = self.client.get("/api/v1/projects/developer/checks").json()
        self.assertFalse(checks["ready"])
        self.assertEqual(checks["checks"], [])
        self.assertEqual(checks["version"], 3)
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=3)).status_code, 422)
        self.assert_no_achievements()

    def test_failed_latest_attempt_replaces_success_without_changing_design(self):
        self.save()
        self.pass_both()
        failed = self.check("offline", ["retry"])
        self.assertFalse(failed.json()["ready"])
        fetched = self.client.get("/api/v1/projects/developer/checks").json()
        self.assertFalse(fetched["ready"])
        self.assertFalse(next(c for c in fetched["checks"] if c["scenario"] == "offline")["passed"])
        self.assert_no_achievements()

    def test_submit_requires_current_checks_and_interest_then_is_idempotent(self):
        self.save(interest=None)
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=1)).status_code, 422)
        self.save(version=1)
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=2)).status_code, 422)
        self.pass_both(2)
        self.assert_no_achievements()
        request = self.body(expectedVersion=2)
        submitted = self.client.post("/api/v1/projects/developer/submit", json=request)
        self.assertEqual(submitted.status_code, 200, submitted.text)
        artifact = submitted.json()
        self.assertEqual(artifact["answers"], ["", "", ""])
        self.assertEqual(artifact["studioKind"], "login-recovery")
        self.assertEqual(len(artifact["designSummary"]), 3)
        self.assertTrue(all(text.startswith("설계에서 정리한") for text in artifact["designSummary"]))
        self.assertEqual(artifact["evaluationStatus"], "not_connected")
        self.assertEqual(artifact["checkMode"], "rules")
        self.assertEqual(artifact["scene"]["studio"], FINISHED_STUDIO)
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=request).json()["id"], artifact["id"])
        self.assertEqual(self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=2)).json()["id"], artifact["id"])
        with db.transaction() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM events WHERE user_id=?", (self.user["id"],)).fetchone()[0], 4)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM activities WHERE user_id=?", (self.user["id"],)).fetchone()[0], 1)
        self.model.assert_not_called()

    def test_explicit_clear_input_choice_passes_and_coach_receives_saved_design(self):
        studio = {**FINISHED_STUDIO, "preserveInput": False}
        self.save(studio)
        report = self.pass_both()
        self.assertIn("비우도록", report["checks"][0]["message"])
        context = drawing_context({"elements": [], "studio": studio})
        self.assertFalse(context["authoredInteraction"]["preserveInput"])
        self.assertEqual(context["authoredInteraction"]["retry"]["target"], "login")
        self.assertNotIn("checks", context["authoredInteraction"])
        self.assert_no_achievements()

    def test_legacy_developer_and_other_careers_keep_original_submission_rules(self):
        for career in ("developer", "farmer"):
            with self.subTest(career=career):
                base = {"scene": {"elements": [ELEMENT]}, "interest": 3}
                unfinished = self.client.put(f"/api/v1/projects/{career}/draft", json=self.body(
                    answers=["", "", ""], expectedVersion=0, **base))
                self.assertEqual(unfinished.status_code, 200, unfinished.text)
                self.assertEqual(self.client.post(f"/api/v1/projects/{career}/submit", json=self.body(expectedVersion=1)).status_code, 422)
                finished = self.client.put(f"/api/v1/projects/{career}/draft", json=self.body(
                    answers=LEGACY_ANSWERS, expectedVersion=1, **base))
                self.assertEqual(finished.status_code, 200, finished.text)
                result = self.client.post(f"/api/v1/projects/{career}/submit", json=self.body(expectedVersion=2))
                self.assertEqual(result.status_code, 200, result.text)
                self.assertNotIn("studioKind", result.json())
                self.assertEqual(result.json()["answers"], LEGACY_ANSWERS)

    def test_portfolio_feedback_receives_design_and_rules_with_optional_answers_empty(self):
        self.save()
        self.pass_both()
        submitted = self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=1))
        self.assertEqual(submitted.status_code, 200, submitted.text)
        artifact = submitted.json()
        contexts = []

        class FakeProvider:
            def evaluate(self, context):
                contexts.append(context)
                return Evaluation(feedback="다시 시도와 도움받기로 이동하는 경로가 정리되어 있어요. 버튼 이름을 친구가 이해하는지 확인해 봐요.",
                                  observations=["저장한 설계에 두 버튼의 목적지가 있어요."])

        request = self.body()
        with patch.object(main, "AI_MODE", "ai"), patch.object(main, "provider", return_value=FakeProvider()):
            response = self.client.post(f"/api/v1/portfolio/{artifact['id']}/evaluate", json=request)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["evaluationStatus"], "ai_feedback")
            self.assertEqual(response.json()["scene"], artifact["scene"])
            self.assertEqual(response.json()["designSummary"], artifact["designSummary"])
            self.assertEqual(self.client.post(f"/api/v1/portfolio/{artifact['id']}/evaluate", json=request).json(), response.json())
        self.assertEqual(len(contexts), 1)
        self.assertEqual(contexts[0]["answers"], ["", "", ""])
        design = contexts[0]["drawingGraph"]["authoredInteraction"]
        self.assertEqual(design["message"], FINISHED_STUDIO["message"])
        self.assertEqual(design["retry"]["target"], "login")
        self.assertEqual(design["support"]["target"], "support")
        self.assertEqual(contexts[0]["interactionChecks"]["mode"], "rules")
        self.assertEqual(len(contexts[0]["interactionChecks"]["checks"]), 2)
        self.assertNotIn("profile", contexts[0])
        self.model.assert_not_called()

    def test_experience_update_receives_separate_design_summary_and_recorded_checks(self):
        self.save()
        self.pass_both()
        submitted = self.client.post("/api/v1/projects/developer/submit", json=self.body(expectedVersion=1))
        self.assertEqual(submitted.status_code, 200, submitted.text)
        artifact = submitted.json()
        aid = artifact["id"]
        saved = self.client.put(f"/api/v1/career-reviews/{aid}/answers", json=self.body(
            expectedVersion=0, enjoyed="create", difficult="tools", again="more"))
        self.assertEqual(saved.status_code, 200, saved.text)
        contexts = []

        class FakeProvider:
            def reflect(self, context):
                contexts.append(context)
                return CareerReflection(summary="저장한 설계에 다시 시도와 도움받기 경로가 있고, 두 상황에서 버튼을 눌러 봤어요.",
                                        evidenceRefs=["record1"], nextKey=context["candidates"][0]["key"],
                                        reason="다른 사용자에게 버튼 문구가 이해되는지 더 확인해 봐요.")

        with patch.object(reviews, "AI_MODE", "ai"), patch.object(reviews, "provider", return_value=FakeProvider()):
            generated = self.client.post(f"/api/v1/career-reviews/{aid}/generate", json=self.body(expectedVersion=saved.json()["version"]))
        self.assertEqual(generated.status_code, 200, generated.text)
        self.assertEqual(len(contexts), 1)
        record = contexts[0]["records"][0]
        self.assertEqual(record["answers"], ["", "", ""])
        self.assertEqual(record["designSummary"], artifact["designSummary"])
        self.assertEqual(record["designSummarySource"], "generated_from_authored_design")
        self.assertEqual(record["interactionChecks"]["mode"], "rules")
        self.assertEqual(record["interactionChecks"]["checks"], artifact["checks"])
        self.assertEqual(record["interactionChecks"]["checks"][1]["actions"], ["retry", "support"])
        self.assertNotIn("profile", contexts[0])
        self.model.assert_not_called()


if __name__ == "__main__":
    unittest.main()
