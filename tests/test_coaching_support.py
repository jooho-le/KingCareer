import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.coaching_support import support_context
from backend.inference import OpenCompatibleProvider, SupportedProjectHint, SupportedEvaluation


class CoachingSupportTests(unittest.TestCase):
    def test_explicit_unknown_blank_and_template_are_supported(self):
        value = support_context({"answers": ["모르겠어", "", "로그를 확인해요."], "drawingGraph": {"nodes": [
            {"id": "node1", "type": "text", "label": "〔채우기: 확인할 것〕", "source": "provided_guide"},
            {"id": "decoration", "type": "rectangle"},
            {"id": "node3", "type": "text", "label": "모르는 사용자를 위해 안내해요."}]}})
        self.assertEqual([x["target"] for x in value["supportNeeds"]], ["node1", "answer1", "answer2"])

    def test_interactive_design_does_not_require_empty_essays(self):
        self.assertEqual(support_context({"answers": ["", "", ""], "drawingGraph": {"authoredInteraction": {"message": "안내"}}})["supportNeeds"], [])

    def test_both_providers_require_example_for_unknown(self):
        context = {"answers": ["모름"], "drawingGraph": {"nodes": []}}
        provider = OpenCompatibleProvider()
        with patch.object(provider, "_request", return_value=SupportedProjectHint(hint="누가 불편할까요?", nextAction="한 장면을 떠올려요.", example="오류 뒤에 다음 버튼을 찾기 어려워요.")) as request:
            result = provider.help_project(context)
            self.assertIs(request.call_args.args[1], SupportedProjectHint)
            self.assertTrue(result.example)
        with patch.object(provider, "_request", return_value=SupportedEvaluation(strength="함께 시작해요.", improvement="누가 불편할까요?", nextAction="한 장면을 적어요.", questions=["누구의 상황인가요?"], example="오류 뒤에 다음 버튼을 찾기 어려워요.")) as request:
            result = provider.evaluate(context)
            self.assertIs(request.call_args.args[1], SupportedEvaluation)
            self.assertIn("참고 예시", result.feedback)


if __name__ == '__main__':
    unittest.main()
