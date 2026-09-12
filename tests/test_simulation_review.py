"""Authored incident and AI boundary regressions; no live accounts or model calls.

Run: .venv/Scripts/python.exe -m unittest discover -s tests -p test_simulation_review.py
"""
from copy import deepcopy
from pathlib import Path
import tempfile
import unittest
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Do not load the developer's model keys even during module initialization.
with patch("dotenv.load_dotenv"):
    from backend import simulation
    from backend.fieldwork import completion_badges, present


def step(session, kind, **kwargs):
    return simulation.apply_command({"session": session, "command": {"kind": kind, **kwargs}})["session"]


def reach_action(completed_count=0, action_id="rollback", farmer=False):
    session = simulation.new_session("unit-incident", "farmer" if farmer else "developer", completed_count)
    session = step(session, "start")
    required = session["fieldwork"].get("presentation", {}).get("required", ["sensor", "journal"])
    objects = session["fieldwork"]["objects"]
    inspect = list(dict.fromkeys([*required, *[o["id"] for o in objects]]))[:4]
    for object_id in inspect:
        session = step(session, "inspect", objectId=object_id)
    session = step(session, "compare", optionId="vent" if farmer else "0")
    return step(session, "act", actionId=action_id, optionId="records")


class SimulationReviewTests(unittest.TestCase):
    def test_rotation_changes_cause_and_successful_action(self):
        first = reach_action(0, "rollback")
        second = reach_action(1, "rollback")
        scaled = reach_action(1, "scale")
        self.assertEqual(first["fieldwork"]["incidentId"], "login-auth-config")
        self.assertEqual(second["fieldwork"]["incidentId"], "login-capacity")
        self.assertEqual(first["fieldwork"]["metricValue"], 3)
        self.assertEqual(second["fieldwork"]["metricValue"], 41)
        self.assertEqual(scaled["fieldwork"]["metricValue"], 4)
        self.assertNotEqual(first["scenario"]["title"], second["scenario"]["title"])
        self.assertEqual(simulation.new_session("repeat", "developer", 2)["fieldwork"]["incidentId"], "login-auth-config")

    def test_present_preserves_saved_variant_options_and_materials(self):
        canonical = simulation.new_session("persisted", "developer", 1)
        snapshot = deepcopy(canonical["fieldwork"])
        result = present(canonical)
        self.assertEqual(result["fieldwork"], snapshot)
        # Editing shared content cannot mutate already-created sessions.
        with patch.dict(simulation.WORKPLACES["developer"], title="Edited catalog"):
            self.assertEqual(present(canonical)["fieldwork"]["presentation"]["title"], snapshot["presentation"]["title"])

    def test_skipping_verification_leaves_pending_work(self):
        acted = reach_action(1, "scale")
        skipped = step(acted, "verify", optionId="1")
        checked = step(acted, "verify", optionId="0")
        self.assertEqual(skipped["fieldwork"]["verificationOutcome"]["status"], "unverified")
        self.assertEqual(checked["fieldwork"]["verificationOutcome"]["status"], "rechecked")
        self.assertEqual(skipped["fieldwork"]["minutes"], acted["fieldwork"]["minutes"])
        self.assertEqual(checked["fieldwork"]["minutes"], acted["fieldwork"]["minutes"] - 10)
        self.assertEqual(skipped["fieldwork"]["metricValue"], checked["fieldwork"]["metricValue"])
        self.assertNotEqual(skipped["fieldwork"]["verificationOutcome"]["remaining"], checked["fieldwork"]["verificationOutcome"]["remaining"])
        completed = step(skipped, "handover", optionId="full")
        self.assertIn("재확인 보류", completed["fieldwork"]["ending"])
        self.assertIn("같은 조건으로", completed["fieldwork"]["handover"])

    def test_smartfarm_also_keeps_skipped_measurement_pending(self):
        acted = reach_action(action_id="ventilate", farmer=True)
        skipped = step(acted, "verify", optionId="done")
        self.assertEqual(skipped["fieldwork"]["verificationOutcome"]["status"], "unverified")
        self.assertEqual(skipped["fieldwork"]["minutes"], acted["fieldwork"]["minutes"])
        handed = step(skipped, "handover", optionId="full")
        self.assertIn("재측정 보류", handed["fieldwork"]["ending"])

    def test_badge_reason_describes_record_and_does_not_claim_verification(self):
        session = step(reach_action(), "verify", optionId="1")
        session = step(session, "handover", optionId="full")
        badges = {badge["id"]: badge for badge in completion_badges(session)}
        self.assertIn("4곳 조사", badges["observer"]["earnedReason"])
        self.assertIn("이전 버전", badges["reasoner"]["earnedReason"])
        self.assertIn("재확인은 아직 남아", badges["handover"]["earnedReason"])
        self.assertTrue(badges["observer"]["evidenceSources"])

    def test_ai_generation_is_prepared_before_graph_and_snapshot_unchanged(self):
        canonical = present(step(simulation.new_session("ai-question", "developer"), "start"))
        canonical["coachMode"] = "ai"
        snapshot = deepcopy(canonical)
        mock_model = SimpleNamespace(generate=lambda context: SimpleNamespace(response="Saved AI explanation", lesson="Compare evidence"))
        with patch.object(simulation, "provider", return_value=mock_model) as call:
            command = simulation.prepare_command(canonical, {"kind": "question", "text": "What changed?"})
            call.assert_called_once()
        self.assertEqual(canonical, snapshot)
        with patch.object(simulation, "provider", side_effect=AssertionError("Network inside graph")):
            updated = simulation.apply_command({"session": canonical, "command": command})["session"]
        self.assertEqual(updated["questionReply"], "Saved AI explanation")
        self.assertEqual(updated["version"], canonical["version"] + 1)
        self.assertEqual(canonical, snapshot)

    def test_failed_generation_preserves_canonical_and_rejects_invalid_stage(self):
        canonical = simulation.new_session("failure", "developer")
        canonical["coachMode"] = "ai"
        with patch.object(simulation, "provider") as call:
            with self.assertRaises(simulation.HTTPException) as raised:
                simulation.prepare_command(canonical, {"kind": "question", "text": "Question"})
            self.assertEqual(raised.exception.status_code, 409)
            call.assert_not_called()
        canonical = step(canonical, "start")
        snapshot = deepcopy(canonical)
        with patch.object(simulation, "provider", side_effect=RuntimeError("offline")):
            with self.assertRaises(simulation.HTTPException) as raised:
                simulation.prepare_command(canonical, {"kind": "question", "text": "Question"})
            self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(canonical, snapshot)

    def test_variant_survives_checkpoint_restart(self):
        with tempfile.TemporaryDirectory(prefix="kingcareer-sim-test-") as directory:
            with patch.object(simulation, "DATA_DIR", Path(directory)):
                first = simulation.SimulationEngine()
                canonical = simulation.new_session("checkpoint-variant", "developer", 1)
                updated = first.transition(canonical, {"kind": "start"})
                first.close()
                second = simulation.SimulationEngine()
                try:
                    saved = second.graph.get_state({"configurable": {"thread_id": canonical["id"]}}).values["session"]
                    self.assertEqual(saved, updated)
                    self.assertEqual(saved["fieldwork"]["incidentId"], "login-capacity")
                    resumed = second.transition(updated, {"kind": "inspect", "objectId": "server"})
                    self.assertEqual(resumed["fieldwork"]["presentation"], updated["fieldwork"]["presentation"])
                finally:
                    second.close()


if __name__ == "__main__":
    unittest.main()
