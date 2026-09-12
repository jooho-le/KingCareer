"""Submission readiness for student-authored project explanations.

Guided drafts deliberately keep unfinished blanks so students can resume them.
These markers are drafting affordances, never completed submission evidence.
"""
import re
from .recovery_project import is_recovery_scene, design_issues


UNFILLED_BLANK = re.compile(r"〔채우기:[^〕]*〕")


def has_unfilled_blank(answer: str) -> bool:
    return UNFILLED_BLANK.search(answer) is not None


def answer_is_complete(answer: str) -> bool:
    return len(answer.strip()) >= 10 and not has_unfilled_blank(answer)


def drawing_is_complete(scene) -> bool:
    """A starter drawing alone (or its reserved blanks) isn't student evidence.

    This checks whether work was filled in, not its correctness or quality.
    Legacy student drawings remain valid without migration.
    """
    if is_recovery_scene(scene):
        # Revision summaries describe authored configuration, not check passes.
        # Submission additionally requires current server-run action traces.
        return not design_issues(scene["studio"])
    elements = [e for e in (scene or {}).get("elements", []) if not e.get("isDeleted")]
    if not elements or any(has_unfilled_blank(str(e.get("originalText", e.get("text", "")))) for e in elements):
        return False
    for element in elements:
        metadata = element.get("customData")
        guide = metadata.get("kingCareerGuide") if isinstance(metadata, dict) else None
        if not isinstance(guide, dict):
            return True
        text = str(element.get("originalText", element.get("text", ""))).strip()
        if element.get("type") == "text" and text and text != guide.get("originalText"):
            return True
    return False
