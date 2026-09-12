"""Deterministic checks for the student's authored login-recovery prototype.

This is an interaction-rule runner, not an AI assessment or a competence score.
Only server-run traces matching the saved semantic document count as checks.
Excalidraw is a portable visual representation; the validated studio document
is the source of interactive behavior.
"""
import hashlib
import json


SCENARIOS = ("recovered", "offline")
CHECK_SCOPE = "project-check:developer:"


def is_recovery_scene(scene):
    studio = scene.get("studio") if isinstance(scene, dict) else None
    return isinstance(studio, dict) and studio.get("kind") == "login-recovery" and studio.get("version") == 2


def fingerprint(studio):
    encoded = json.dumps(studio, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode()).hexdigest()


def design_issues(studio):
    issues = []
    if not studio["message"].strip():
        issues.append("오류가 난 이유와 다음에 할 일을 안내 문구에 적어 주세요.")
    for name, label, target in (("retry", "다시 시도", "login"), ("support", "도움받기", "support")):
        button = studio[name]
        if button is None:
            issues.append(f"{label} 버튼을 그림에 놓아 주세요.")
        elif not button["label"].strip():
            issues.append(f"{label} 버튼에 보일 이름을 적어 주세요.")
        elif button["target"] != target:
            destination = "로그인 화면" if target == "login" else "도움 화면"
            issues.append(f"{label} 버튼을 {destination}에 연결해 주세요.")
    if studio["preserveInput"] is None:
        issues.append("다시 시도할 때 입력한 내용을 유지할지 선택해 주세요.")
    return issues


def run_check(studio, scenario, actions):
    """Replay actual button presses from the error screen for one scenario."""
    issues = []
    screen = "error"
    retried = False
    if not studio["message"].strip():
        issues.append("오류 화면의 안내 문구가 비어 있어요.")
    if studio["preserveInput"] is None:
        issues.append("입력 내용을 유지할지 선택한 뒤 다시 확인해 주세요.")
    if not actions:
        issues.append("미리보기의 버튼을 눌러 이동할 수 있는지 확인해 주세요.")
    for action in actions:
        if screen != "error":
            issues.append("도착한 화면에는 그 버튼이 없어요. 오류 화면에서 다시 확인해 주세요.")
            break
        button = studio[action]
        name = "다시 시도" if action == "retry" else "도움받기"
        expected = "login" if action == "retry" else "support"
        if button is None or not button["label"].strip():
            issues.append(f"{name} 버튼을 놓고 이름을 적어 주세요.")
            break
        if button["target"] != expected:
            destination = "로그인 화면" if expected == "login" else "도움 화면"
            issues.append(f"{name} 버튼이 {destination}으로 연결되지 않았어요.")
            break
        if action == "retry":
            retried = True
            screen = "login" if scenario == "recovered" else "error"
        else:
            if scenario == "offline" and not retried:
                issues.append("먼저 다시 시도해 보고, 계속 실패했을 때 도움받기로 이동해 주세요.")
            screen = "support"
    passed = not issues and retried and screen == ("login" if scenario == "recovered" else "support")
    if not passed and not issues:
        issues.append("연결이 복구된 뒤 다시 시도해 로그인 화면으로 이동해 주세요." if scenario == "recovered"
                      else "다시 시도해도 실패하면 도움받기 버튼으로 이동해 주세요.")
    if passed:
        effect = "입력한 내용을 유지하도록" if studio["preserveInput"] else "입력한 내용을 비우도록"
        message = (f"다시 시도해 로그인 화면에 도착했어요. {effect} 선택했어요." if scenario == "recovered"
                   else f"계속 연결되지 않을 때 다시 시도한 뒤 도움 화면으로 이동했어요. 재시도 시 {effect} 선택했어요.")
    else:
        message = " ".join(issues)
    return {"scenario": scenario, "passed": passed, "message": message, "actions": list(actions)}


def stored_checks(con, uid, studio):
    current = fingerprint(studio)
    found = {}
    # Request records are user-scoped and written atomically with their replay
    # response. Read only server-created evidence, never client scene metadata.
    rows = con.execute("SELECT response FROM requests WHERE user_id=? AND request_key LIKE ? ORDER BY created_at DESC,request_key DESC",
                       (uid, CHECK_SCOPE + "%"))
    for row in rows:
        saved = json.loads(row["response"])
        evidence = saved.get("_recoveryCheck") if isinstance(saved, dict) else None
        if not isinstance(evidence, dict) or evidence.get("fingerprint") != current:
            continue
        check = evidence.get("check")
        if isinstance(check, dict) and check.get("scenario") in SCENARIOS and check["scenario"] not in found:
            found[check["scenario"]] = check
        if len(found) == len(SCENARIOS):
            break
    return [found[scenario] for scenario in SCENARIOS if scenario in found]


def check_report(con, uid, project, latest=None):
    scene = project.get("scene")
    if not is_recovery_scene(scene):
        return {"version": project["version"], "mode": "rules", "checks": [],
                "issues": ["로그인 복구 작업실의 설계를 저장한 뒤 작동을 확인해 주세요."], "ready": False}
    studio = scene["studio"]
    by_scenario = {check["scenario"]: check for check in stored_checks(con, uid, studio)}
    if latest is not None:
        by_scenario[latest["scenario"]] = latest
    checks = [by_scenario[scenario] for scenario in SCENARIOS if scenario in by_scenario]
    issues = design_issues(studio)
    for scenario, name in (("recovered", "연결 복구"), ("offline", "연결 실패")):
        check = by_scenario.get(scenario)
        if check is None:
            issues.append(f"{name} 상황에서 만든 버튼을 눌러 작동을 확인해 주세요.")
        elif not check["passed"]:
            issues.append(check["message"])
    return {"version": project["version"], "mode": "rules", "checks": checks,
            "issues": list(dict.fromkeys(issues)), "ready": not issues}


def design_summary(studio):
    """Explicitly generated from saved design choices, never student prose."""
    preserved = "유지" if studio["preserveInput"] else "비우기"
    return [f"설계에서 정리한 안내 문구: {studio['message'].strip()}",
            f"설계에서 정리한 연결: ‘{studio['retry']['label'].strip()}’ → 로그인 화면, ‘{studio['support']['label'].strip()}’ → 도움 화면.",
            f"설계에서 정리한 재시도 설정: 입력 내용 {preserved}."]
