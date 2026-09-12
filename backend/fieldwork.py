"""Authored, deterministic teaching scenario. All readings are fictional.

The game state is independent of the evidence graph. Inspecting an object is
never treated as proof of understanding. Gemini can explain, not set outcomes.
"""
from fastapi import HTTPException
from .config import AI_MODE
from .workplaces import WORKPLACES, options_for, initial_workplace, advance_workplace

OBJECTS = [
    {"id": "plants", "name": "토마토 재배대", "reading": "A구역 잎이 조금 말려 있어요. B구역은 정상이에요.", "detail": "두 구역 모두 오늘 아침 급수했어요. 잎만 보고 원인을 단정하기는 어려워요."},
    {"id": "sensor", "name": "환경 센서", "reading": "A구역 33°C · 습도 48% / B구역 27°C · 습도 62%", "detail": "교육용 목표 범위는 24–28°C예요. 지난 20분 동안 A구역 온도만 올랐어요."},
    {"id": "controller", "name": "환기 제어기", "reading": "A구역 창문: 닫힘 / 자동 환기: 점검 모드", "detail": "설정 변경은 담당자 승인 후 가능해요. 이 체험에서는 승인된 가상 조작만 해요."},
    {"id": "tank", "name": "급수 탱크", "reading": "잔량 80% · 펌프 정상 · 토양 수분 A 61% / B 60%", "detail": "이 시나리오의 수분 목표 범위는 55–65%예요. 급수 부족을 뒷받침하는 기록은 없어요."},
    {"id": "journal", "name": "교대 작업일지", "reading": "08:40 창문 모터 점검 완료. 자동 모드 복귀 여부 미기록.", "detail": "09:00 이후 A구역 온도가 상승했어요. 다음 교대자에게 설정과 확인 결과를 남겨야 해요."},
    {"id": "weather", "name": "기상 관측기", "reading": "맑음 · 외부 25°C · 강풍·강우 경보 없음", "detail": "한낮 일사량 증가가 예상돼요. 환기 이후에도 온도를 다시 확인해야 해요."},
]
ACTIONS = [
    {"id": "ventilate", "name": "승인된 자동 환기를 복구한다", "minutes": 15, "cost": 10, "temperature": 27,
     "result": "A구역 온도가 27°C로 내려왔어요. 다만 센서 한 번의 측정만으로 안정화를 확정할 수는 없어요."},
    {"id": "water", "name": "추가 급수를 실행한다", "minutes": 10, "cost": 25, "temperature": 32,
     "result": "수분은 74%로 올랐지만 온도는 32°C예요. 급수만으로 환기 문제를 해결하지 못했어요."},
    {"id": "escalate", "name": "담당자에게 점검을 요청한다", "minutes": 20, "cost": 0, "temperature": 29,
     "result": "담당자가 임시 환기를 도왔어요. 온도는 29°C이고 자동 설정 재확인이 필요해요."},
]
BADGES = {
    "observer": {"id": "observer", "name": "현장 탐색가", "description": "서로 다른 현장 자료 4곳 이상을 열람했어요.", "art": "01"},
    "reasoner": {"id": "reasoner", "name": "근거를 잇는 사람", "description": "가설과 조치 이유를 선택했어요. 내용의 정답 인증은 아니에요.", "art": "02"},
    "handover": {"id": "handover", "name": "다음 교대의 동료", "description": "확인할 사항과 동료에게 전달할 내용을 선택했어요.", "art": "03"},
    "maker": {"id": "maker", "name": "개선 설계자", "description": "배치도와 개선 근거, 검증 계획을 제출했어요.", "art": "04"},
}

# IDs are the API contract; labels are resolved on the server, never supplied
# as purported evidence by the client. These are choices, not free-writing tasks.
OPTIONS = {
    "compare": [
        {"id": "vent", "label": "환기 설정이 점검 모드로 남아 온도가 오른 것 같아요."},
        {"id": "dry", "label": "물이 부족해서 온도가 오른 것 같아요."},
        {"id": "uncertain", "label": "아직 확신이 없어요. 센서와 실제 상태를 더 비교하고 싶어요."},
    ],
    "act": [
        {"id": "records", "label": "센서 수치와 교대 일지에서 단서를 찾았어요."},
        {"id": "resources", "label": "남은 시간과 운영 자원을 고려했어요."},
        {"id": "support", "label": "혼자 판단하기보다 담당자의 도움을 받고 싶어요."},
    ],
    "verify": [
        {"id": "trend", "label": "전후 온도와 수분을 비교하고 다시 측정해 볼래요."},
        {"id": "done", "label": "조치를 했으니 더 확인하지 않고 끝낼래요."},
        {"id": "more", "label": "온도만으로는 부족해요. 장치 설정도 다시 볼래요."},
    ],
    "handover": [
        {"id": "full", "label": "선택한 조치, 바뀐 수치, 남은 점검을 모두 전달할래요."},
        {"id": "result", "label": "현재 온도와 수분만 전달할래요."},
        {"id": "ask", "label": "확신이 없는 부분을 담당자에게 함께 확인해 달라고 할래요."},
    ],
    "reflection": [
        {"id": "observe", "label": "숫자와 현장을 함께 살피는 일이 흥미로웠어요."},
        {"id": "team", "label": "동료와 정보를 나누는 일이 중요하다는 걸 알았어요."},
        {"id": "different", "label": "경험해 보니 다른 직업도 더 알아보고 싶어요."},
    ],
    "liked": [
        {"id": "find", "label": "단서 찾기"}, {"id": "choose", "label": "조치 선택하기"},
        {"id": "share", "label": "동료에게 전달하기"}, {"id": "none", "label": "아직 잘 모르겠어요"},
    ],
    "disliked": [
        {"id": "numbers", "label": "수치 비교가 어려웠어요"}, {"id": "decide", "label": "조치 결정이 어려웠어요"},
        {"id": "none", "label": "크게 어려운 점은 없었어요"},
    ],
}


def present(session):
    if "fieldwork" in session:
        session["mode"] = "template"
        # Never replace a saved variant's options with the original incident.
        session["fieldwork"].setdefault("options", options_for(session["careerId"], OPTIONS, session["fieldwork"].get("presentation")) if session["careerId"] in WORKPLACES else OPTIONS)
        session["coachMode"] = "ai" if AI_MODE == "ai" else "template"
    return session


def choice_text(kind, choice_id):
    option = next((o for o in OPTIONS.get(kind, []) if o["id"] == choice_id), None)
    if not option:
        raise HTTPException(422, "보기 중에서 하나를 선택해 주세요.")
    return option["label"]


def initial_fieldwork(cid="farmer", presentation=None):
    if cid in WORKPLACES:
        return initial_workplace(cid, OPTIONS, presentation)
    return {"schema": "smartfarm-v1", "phase": "inspect", "minutes": 75, "budget": 100,
            "inspected": [], "objects": OBJECTS, "actions": ACTIONS, "comparison": "", "action": None,
            "verification": "", "handover": "", "temperature": 33, "log": [], "ending": None, "options": OPTIONS}


def advance(session, command):
    if session["careerId"] in WORKPLACES:
        return advance_workplace(session, command)
    kind, field = command["kind"], session["fieldwork"]
    if session["stage"] != "play":
        raise HTTPException(409, "출근 안내를 확인하고 체험을 시작해 주세요.")
    text = command.get("text", "").strip()
    phase = field["phase"]
    if kind == "inspect":
        obj = next((item for item in OBJECTS if item["id"] == command.get("objectId")), None)
        if obj is None:
            raise HTTPException(422, "온실에 있는 대상을 골라 주세요.")
        if obj["id"] not in field["inspected"]:
            field["inspected"].append(obj["id"])
            field["minutes"] -= 3
            field["log"].append({"kind": kind, "text": obj["name"] + ": " + obj["reading"]})
        return
    text = choice_text(kind, command.get("optionId"))
    if kind == "compare":
        if phase != "inspect" or not {"sensor", "journal"}.issubset(field["inspected"]) or len(field["inspected"]) < 3:
            raise HTTPException(409, "환경 센서와 교대 일지를 포함한 세 곳 이상을 확인해 주세요.")
        field["comparison"] = text
        field["phase"] = "act"
        response = {"vent": "환기 설정과 교대 일지를 연결했네요. 어떤 조치를 할지 골라 봐요.",
                    "dry": "수분 센서는 목표 범위 안이에요. 물 부족 가설과 맞는지 생각하며 조치를 골라 봐요.",
                    "uncertain": "확신이 없을 때는 조건을 비교하거나 담당자의 도움을 받을 수 있어요."}[command["optionId"]]
        lesson = "선택한 가설을 기록했어요. 기록한 것과 원인이 확인된 것은 달라요."
    elif kind == "act":
        action = next((item for item in ACTIONS if item["id"] == command.get("actionId")), None)
        if phase != "act" or action is None:
            raise HTTPException(409, "자료 비교 후 가능한 조치를 골라 주세요.")
        field.update(action={**action, "rationale": text}, phase="verify", temperature=action["temperature"])
        field["minutes"] -= action["minutes"]
        field["budget"] -= action["cost"]
        field["visual"] = {"action": action["id"], "ventOpen": action["id"] != "water",
                           "watering": action["id"] == "water", "technician": action["id"] == "escalate",
                           "moisture": 74 if action["id"] == "water" else 61,
                           "tankLevel": 55 if action["id"] == "water" else 80}
        response, lesson = action["result"], "조치에는 시간과 자원이 들어요. 변화가 나타나도 다시 측정해야 해요."
    elif kind == "verify":
        if phase != "verify":
            raise HTTPException(409, "조치 결과를 먼저 확인해 주세요.")
        field.update(verification=text, phase="handover")
        lesson = "한 번의 수치보다 추세와 미해결 과제를 함께 기록해요."
        if command["optionId"] == "done":
            response = "재측정을 생략했어요. 현재 온도는 조치 직후의 기록이며 안정적으로 유지되는지는 아직 몰라요."
            remaining = ["온도·수분 다시 측정", "자동 환기 설정 확인"]
            status = "unverified"
        else:
            field["minutes"] -= 10
            response = f"10분 뒤 가상 재측정도 {field['temperature']}°C예요. "
            if command["optionId"] == "more":
                response += "장치 설정도 확인했어요. "
            remaining = {"ventilate": ["다음 시간대 온도 추세 확인"],
                         "water": ["환기 설정 복구 검토", "높아진 토양 수분 추적 관찰"],
                         "escalate": ["자동 환기 복구 여부 확인", "목표 온도 도달 여부 재측정"]}[field["action"]["id"]]
            status = "rechecked"
        field["verificationOutcome"] = {"status": status, "finding": response, "remaining": remaining}
        response += " 남은 일: " + " · ".join(remaining)
    elif kind == "handover":
        if phase != "handover":
            raise HTTPException(409, "결과를 재확인한 뒤 인계를 작성해 주세요.")
        if command["optionId"] == "full":
            text += f" 인계 카드: {field['action']['name']} / 현재 {field['temperature']}°C / 다음 교대에서 추세와 설정 재확인."
        elif command["optionId"] == "result":
            text += f" 인계 카드: 현재 {field['temperature']}°C. 조치 내용과 남은 점검은 아직 빠져 있어요."
        field.update(handover=text, phase="done", ending={
            "ventilate": "자동 환기 복구 · 추적 관찰로 인계",
            "water": "원인 재검토 · 추가 점검으로 인계",
            "escalate": "담당자 협업 · 설정 확인으로 인계",
        }[field["action"]["id"]])
        verification = field.get("verificationOutcome")
        if verification:
            if command["optionId"] in {"full", "ask"}:
                text += " 남은 일: " + " · ".join(verification["remaining"])
                field["handover"] = text
            if verification["status"] == "unverified":
                field["ending"] = "재측정 보류 · 다음 교대에 확인 필요"
        session["stage"] = "reflection"
        response, lesson = "교대 업무를 마쳤어요. 이번 경험이 나와 어떻게 맞았는지 돌아볼까요?", "해결되지 않은 일도 정확히 인계하면 다음 판단에 도움이 돼요."
    else:
        raise HTTPException(422, "지원하지 않는 현장 행동이에요.")
    field["log"].append({"kind": kind, "text": text, "optionId": command.get("optionId"), "result": response})
    session["turns"].append({"answer": text, "response": response, "lesson": lesson})
    session["step"] = len(session["turns"])


def completion_badges(session):
    field = session.get("fieldwork")
    if not field:
        return []
    ids = ["observer"] if len(field["inspected"]) >= 4 else []
    if field["comparison"] and field["action"]:
        ids.append("reasoner")
    if field["verification"] and field["handover"]:
        ids.append("handover")
    sources = {
        "observer": [f"simulation:{session['id']}:field:inspect:{obj}" for obj in field["inspected"]],
        "reasoner": [f"simulation:{session['id']}:field:{kind}:" for kind in ("compare", "act")],
        "handover": [f"simulation:{session['id']}:field:{kind}:" for kind in ("verify", "handover")],
    }
    names = [obj["name"] for obj in field["objects"] if obj["id"] in field["inspected"]]
    reasons = {
        "observer": f"{len(names)}곳 조사 · " + ", ".join(names[:2]) + (f" 외 {len(names) - 2}곳" if len(names) > 2 else ""),
        "reasoner": "가설을 세우고 ‘" + (field.get("action") or {}).get("name", "조치") + "’의 이유를 골랐어요.",
        "handover": "확인 방법과 동료에게 전달할 내용을 직접 골랐어요.",
    }
    if field.get("verificationOutcome", {}).get("status") == "unverified":
        reasons["handover"] = "재확인 보류 선택과 인계 내용을 기록했어요. 재확인은 아직 남아 있어요."
    return [{**BADGES[key], "earnedReason": reasons[key], "evidenceSources": sources[key], "criteriaVersion": session["fieldwork"]["schema"]} for key in ids]
