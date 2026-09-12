"""Authored educational workplace scenarios; not professional procedures."""
import json
from pathlib import Path
from copy import deepcopy
from fastapi import HTTPException

WORKPLACES = json.loads((Path(__file__).parent / "data" / "workplaces.json").read_text(encoding="utf-8"))


def options_for(cid, common):
    config = WORKPLACES[cid]
    options = deepcopy(common)
    options["compare"] = [{"id": str(i), "label": label} for i, label in enumerate(config["hypotheses"])]
    options["act"] = [{"id": "records", "label": "현장에서 확인한 자료를 근거로 골랐어요."},
                      {"id": "resources", "label": "남은 시간과 자원을 고려했어요."},
                      {"id": "support", "label": "동료의 도움과 공동 확인이 필요하다고 생각했어요."}]
    options["verify"] = [{"id": str(i), "label": label} for i, label in enumerate(config["verify"])]
    options["handover"] = [{"id": "full", "label": "확인한 자료·조치 결과·남은 일을 모두 전달할래요."},
                           {"id": "result", "label": "현재 결과만 전달할래요."},
                           {"id": "ask", "label": "확신이 없는 점을 동료에게 함께 확인해 달라고 할래요."}]
    options["reflection"][0]["label"] = "현장을 살피고 근거로 판단하는 일이 흥미로웠어요."
    return options


def initial_workplace(cid, common):
    config = deepcopy(WORKPLACES[cid])
    return {"schema": f"{cid}-fieldwork-v1", "phase": "inspect", "minutes": 75, "budget": 100,
            "objects": config["objects"], "actions": config["actions"], "inspected": [], "comparison": "",
            "action": None, "verification": "", "handover": "", "log": [], "ending": None,
            "metricValue": config["before"], "options": options_for(cid, common), "presentation": config}


def advance_workplace(session, command):
    field = session["fieldwork"]
    config = field["presentation"]
    kind, phase = command["kind"], field["phase"]
    if session["stage"] != "play":
        raise HTTPException(409, "업무 안내를 확인하고 체험을 시작해 주세요.")
    if kind == "inspect":
        obj = next((o for o in field["objects"] if o["id"] == command.get("objectId")), None)
        if not obj:
            raise HTTPException(422, "현장의 대상을 골라 주세요.")
        if obj["id"] not in field["inspected"]:
            field["inspected"].append(obj["id"])
            field["minutes"] -= 3
            field["log"].append({"kind": kind, "text": obj["name"] + ": " + obj["reading"]})
        return
    expected = {"compare": "inspect", "act": "act", "verify": "verify", "handover": "handover"}
    if expected.get(kind) != phase:
        raise HTTPException(409, "현재 업무 단계부터 완료해 주세요.")
    option = next((o for o in field["options"][kind] if o["id"] == command.get("optionId")), None)
    if not option:
        raise HTTPException(422, "보기 중 하나를 선택해 주세요.")
    text = option["label"]
    if kind == "compare":
        if len(field["inspected"]) < 3 or not set(config["required"]).issubset(field["inspected"]):
            raise HTTPException(409, "필수 자료 두 곳을 포함해 세 곳 이상 조사해 주세요.")
        field.update(comparison=text, phase="act")
        response = "선택한 가설을 기록했어요. 자료와 맞는지 생각하며 다음 조치를 골라 봐요."
    elif kind == "act":
        action = next((a for a in field["actions"] if a["id"] == command.get("actionId")), None)
        if not action:
            raise HTTPException(422, "가능한 조치 중 하나를 골라 주세요.")
        field.update(action={**action, "rationale": text}, phase="verify", metricValue=action["metricValue"], visual={"action": action["effect"]})
        field["minutes"] -= action["minutes"]
        field["budget"] -= action["cost"]
        response = action["result"]
    elif kind == "verify":
        field.update(verification=text, phase="handover")
        field["minutes"] -= 10
        response = ("한 번의 표시로 완료를 단정하기 어려워요. 코치와 확인 항목을 살펴봤어요. " if option["id"] == "1" else "선택한 확인 방법을 기록했어요. ") + field["action"]["result"]
    else:
        if option["id"] == "full":
            text += f" 인계 카드: {field['action']['name']} / {config['metric']} {field['metricValue']}{config['unit']} / 남은 확인과 한계 공유."
        field.update(handover=text, phase="done", ending=field["action"]["ending"])
        session["stage"] = "reflection"
        response = "교대 업무를 마쳤어요. 어떤 순간이 좋았는지 골라 봐요."
    lesson = "선택·조사·확인 기록은 직무를 알아가는 경험이에요. 결과 수치는 가상 상황이며 직무 능력 점수가 아니에요."
    field["log"].append({"kind": kind, "text": text, "optionId": option["id"], "result": response})
    session["turns"].append({"answer": text, "response": response, "lesson": lesson})
    session["step"] = len(session["turns"])
