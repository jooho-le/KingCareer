"""Self-reported starting points guide activities, never establish achievement."""


def starting_point(career_id, title, evidence):
    diagnoses = [e for e in evidence if e.get("kind") == "diagnosis"
                 and e.get("category") == "self_report"
                 and len(e.get("metadata", {}).get("answers", [])) == 6]
    if not diagnoses:
        return None
    latest = max(enumerate(diagnoses), key=lambda item: (item[1].get("date", ""), item[0]))[1]
    answers = latest["metadata"]["answers"]
    if answers[0] in (0, 3) or answers[1] in (0, 3):
        level, label = "guided", "함께 알아가는 첫 체험"
        summary = f"{title}의 하루를 차근차근 알아볼 차례야."
        reason = "직업이나 실제 업무가 아직 낯설다고 답했어. 역할 소개와 단계별 안내가 있는 체험부터 제안할게."
        first = "simulation"
    elif answers[2] == 2 and answers[3] not in (0, 3):
        level, label = "challenge", "내 경험으로 개선해 보기"
        summary = f"{title}에 대한 경험을 새로운 결과물로 이어가 보자."
        reason = "결과물을 만들어봤고 필요한 역량도 알고 있다고 답했어. 근거를 비교하고 개선안을 만드는 프로젝트를 제안할게."
        first = "project"
    else:
        level, label = "standard", "직접 선택하는 첫 출근"
        summary = f"{title}의 일을 직접 판단하고 선택해 볼 차례야."
        reason = "업무에 대해 알고 있다고 답했어. 현장에서 자료를 비교하고 조치를 선택하는 체험으로 이어가 보자."
        first = "simulation"
    return {"careerId": career_id, "diagnosisId": latest["id"], "date": latest.get("date", ""),
            "version": "starting-point-v1", "basis": "self_report", "answers": answers,
            "level": level, "label": label, "summary": summary, "reason": reason,
            "firstActivity": first,
            "followUp": "관련 과목과 전공도 찾아보자." if answers[4] in (0, 3)
                        else "궁금한 업무를 실제 현직자에게 물어볼 질문으로 남겨보자." if answers[5] in (0, 3)
                        else "체험 전 생각과 직접 해본 뒤의 생각을 비교해 보자.",
            "guidance": {
                "brief": "먼저 내 역할과 현장 목표를 읽어봐. 정답을 몰라도 괜찮아. 물체를 누르면 조사할 자료가 열려." if level == "guided"
                         else "이미 해본 경험과 이번 현장의 조건을 비교해 봐. 같은 조치가 언제나 맞는지 확인해 보자." if level == "challenge"
                         else "어떤 자료가 판단에 필요한지 골라봐. 선택한 조치의 이유를 기록과 연결해 보자.",
                "inspect": "필수 자료부터 열어보고 세 곳 이상 조사해 봐. 기록의 시간과 조건을 비교하면 원인을 찾는 데 도움이 돼." if level == "guided"
                           else "서로 다른 자료가 같은 원인을 가리키는지 비교해 봐. 처음 생각과 다른 근거도 찾아보자.",
                "act": "조치마다 예상 결과와 시간·비용을 읽고 하나를 골라봐." if level == "guided"
                       else "효과뿐 아니라 시간·비용과 남을 문제까지 비교해서 조치를 골라봐.",
                "verify": "조치 전후를 같은 조건에서 비교해 봐. 좋아진 점과 남은 문제를 확인하자.",
                "handover": "다음 담당자가 이어서 확인해야 할 내용을 골라봐.",
                "reflection": "직접 해보니 어땠어? 진단에서 답했던 생각과 달라져도 괜찮아.",
            }}
