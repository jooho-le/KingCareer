"""Explicit unfinished responses, not inferred student ability or visual blanks."""
import re


def support_context(context):
    needs = []
    graph = context.get("drawingGraph", {})

    def reason(value):
        text = str(value or "").strip()
        compact = re.sub(r"[\s.!?…]", "", text)
        if not compact:
            return "blank"
        if compact in {"모름", "모르겠어", "모르겠어요", "잘모르겠어", "잘모르겠어요", "아직모르겠어요", "몰라", "몰라요"}:
            return "unsure"
        if "〔채우기:" in text or re.fullmatch(r"[_＿]{2,}", text):
            return "placeholder"
        return None

    for node in graph.get("nodes", []):
        if node.get("type") != "text":
            continue
        why = reason(node.get("label"))
        if why:
            needs.append({"target": node["id"], "reason": why, "text": node.get("label", "")})
    # Legacy interactive designs use their controls rather than three essays.
    if not graph.get("authoredInteraction"):
        for index, answer in enumerate(context.get("answers", [])):
            why = reason(answer)
            if why:
                needs.append({"target": f"answer{index + 1}", "reason": why, "text": answer})
    authored = bool(graph.get("authoredInteraction")) or any(reason(a) is None for a in context.get("answers", [])) or any(
        n.get("type") == "text" and n.get("source") != "provided_guide" and reason(n.get("label")) is None
        for n in graph.get("nodes", []))
    return {**context, "supportNeeds": needs[:6], "needsStartingPoint": bool(needs) and not authored}


SUPPORT_INSTRUCTION = (
    " supportNeeds는 미작성·모름·제공된 도안의 빈칸 기록이며 능력 부족 판정이 아니다. "
    "항목이 있으면 하나에 집중해 해당 칸이 무엇을 묻는지 쉬운 질문으로 풀어 설명하고, "
    "example에 그 칸에 넣을 수 있는 짧은 예시 답안 1개(1~2문장)를 반드시 제공한다. "
    "예시는 학생이 작성하거나 실행한 사실로 인용하지 않는다. '참고 예시'로 제시하고 자기 상황에 맞게 바꾸도록 안내한다. "
    "도안의 제공 문구를 학생이 잘한 점으로 칭찬하지 않는다. 전부 모르거나 비어 있으면 억지 칭찬 대신 시작 질문을 제시한다. "
    "전체 과제를 대신 완성하지 말고 한 칸만 돕는다. 모름을 정답·완료로 인정하거나 제출 조건을 바꾸지 않는다. "
    "항목이 없으면 example은 빈 문자열로 둔다. 빈 도형의 존재만으로 미완성이라고 단정하지 않는다."
    " example은 실제 칸에 들어갈 수 있는 답안 문장 자체로 쓴다. '적어보세요', '설계해 보세요' 같은 지시문이나 '참고 예시:' 접두어는 넣지 않는다. "
    "칸을 특정할 때 node ID를 학생에게 노출하거나 시각적 순서를 추측하지 않는다. '모르겠어라고 적은 칸', '발견한 문제 설명칸'처럼 근거가 있는 이름으로 부른다. "
    "needsStartingPoint가 true면 '모름'을 칭찬하거나 노트를 열었다고 추정하지 말고 시작 질문을 준다."
)
