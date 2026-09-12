"""Submission readiness for student-authored project explanations.

Guided drafts deliberately keep unfinished blanks so students can resume them.
These markers are drafting affordances, never completed submission evidence.
"""
import re


UNFILLED_BLANK = re.compile(r"〔채우기:[^〕]*〕")


def has_unfilled_blank(answer: str) -> bool:
    return UNFILLED_BLANK.search(answer) is not None


def answer_is_complete(answer: str) -> bool:
    return len(answer.strip()) >= 10 and not has_unfilled_blank(answer)
