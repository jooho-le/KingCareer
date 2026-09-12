"""Authored educational workplace scenarios; not professional procedures."""
import json
from pathlib import Path
from copy import deepcopy
from fastapi import HTTPException

WORKPLACES = json.loads((Path(__file__).parent / "data" / "workplaces.json").read_text(encoding="utf-8"))
DEVELOPER_INCIDENTS = json.loads((Path(__file__).parent / "data" / "developer_incidents.json").read_text(encoding="utf-8"))["incidents"]


def scenario_for(cid, completed_count=0):
    """Choose an authored incident; persist its full snapshot in the session."""
    config = deepcopy(WORKPLACES[cid])
    config["incidentId"] = f"{cid}-original"
    if cid == "developer":
        index = max(0, completed_count) % (len(DEVELOPER_INCIDENTS) + 1)
        if index:
            config.update(deepcopy(DEVELOPER_INCIDENTS[index - 1]))
        else:
            config["incidentId"] = "login-auth-config"
            config["verificationOutcomes"] = {
                "rollback": {"finding": "로그인과 로그아웃 경로에서 실패가 줄었어요. 새 버전의 설정 누락 원인은 아직 남아 있어요.",
                             "remaining": ["새 버전 설정 누락 원인 조사", "수정 배포 전 로그인 경로 재검증"]},
                "scale": {"finding": "처리 서버가 늘어도 인증 설정 오류가 다시 나타났어요.",
                          "remaining": ["인증 설정 복구", "추가 서버 유지 필요성 확인"]},
                "patch": {"finding": "기본 로그인은 돌아왔지만 오래된 세션의 재로그인에서 오류가 남아 있어요.",
                          "remaining": ["기존 세션 재로그인 경로 확인", "수정 설정 공동 검토"]},
            }
    return config


def options_for(cid, common, presentation=None):
    config = presentation or WORKPLACES[cid]
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


def initial_workplace(cid, common, presentation=None):
    config = deepcopy(presentation or scenario_for(cid))
    return {"schema": f"{cid}-fieldwork-v1", "phase": "inspect", "minutes": 75, "budget": 100,
            "objects": config["objects"], "actions": config["actions"], "inspected": [], "comparison": "",
            "action": None, "verification": "", "handover": "", "log": [], "ending": None,
            "metricValue": config["before"], "options": options_for(cid, common, config), "presentation": config,
            "incidentId": config["incidentId"]}


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
        outcome = config.get("verificationOutcomes", {}).get(field["action"]["id"], {
            "finding": field["action"]["result"], "remaining": ["다음 교대에서 조건과 남은 일 확인"]})
        if option["id"] == "1":
            # No automatic coach rescue: skipping verification leaves it pending.
            finding = "재확인을 생략했어요. 현재 표시는 조치 직후의 결과이고, 다른 조건에서도 유지되는지는 아직 몰라요."
            remaining = ["조치 후 같은 조건으로 다시 확인", "확인하지 않은 경로와 조건 공유"]
            status = "unverified"
        else:
            field["minutes"] -= 10
            finding = ("동료와 함께 확인했어요. " if option["id"] == "2" else "선택한 조건에서 다시 확인했어요. ") + outcome["finding"]
            remaining = outcome["remaining"]
            status = "shared" if option["id"] == "2" else "rechecked"
        field["verificationOutcome"] = {"status": status, "finding": finding, "remaining": remaining}
        response = finding + " 남은 일: " + " · ".join(remaining)
    else:
        verification = field.get("verificationOutcome")
        if option["id"] == "full":
            text += f" 인계 카드: {field['action']['name']} / {config['metric']} {field['metricValue']}{config['unit']} / 남은 확인과 한계 공유."
            if verification:
                text += " 남은 일: " + " · ".join(verification["remaining"])
        elif option["id"] == "result":
            text += " 조치 근거와 아직 확인하지 않은 조건은 인계에서 빠져 있어요."
        elif verification:
            text += " 공동 확인 요청: " + " · ".join(verification["remaining"])
        ending = field["action"]["ending"]
        if verification and verification["status"] == "unverified":
            ending = "재확인 보류 · 다음 교대에 확인 필요"
        field.update(handover=text, phase="done", ending=ending)
        session["stage"] = "reflection"
        response = "교대 업무를 마쳤어요. 어떤 순간이 좋았는지 골라 봐요."
    lesson = "선택·조사·확인 기록은 직무를 알아가는 경험이에요. 결과 수치는 가상 상황이며 직무 능력 점수가 아니에요."
    field["log"].append({"kind": kind, "text": text, "optionId": option["id"], "result": response})
    session["turns"].append({"answer": text, "response": response, "lesson": lesson})
    session["step"] = len(session["turns"])
