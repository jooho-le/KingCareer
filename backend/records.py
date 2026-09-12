import hashlib
import json
import uuid
from fastapi import HTTPException
from .catalog import CAREERS, SOURCES, career
from .config import PUBLIC_ORIGIN
from .db import dump, now
from .experience_graph import ExperienceGraph
from .project_readiness import answer_is_complete

ENGINE = ExperienceGraph(CAREERS, SOURCES)
VERBS = {"explored": "experienced", "saved": "preferred", "questioned": "asked", "choice": "answered",
         "free": "answered", "diagnosis": "answered", "project": "completed", "simulation": "completed", "reflection": "reflected"}


def request_key(scope, client_id):
    return f"{scope}:{client_id}"


def replay(con, uid, key, body):
    hashed = hashlib.sha256(dump(body).encode()).hexdigest()
    row = con.execute("SELECT * FROM requests WHERE user_id=? AND request_key=?", (uid, key)).fetchone()
    if row:
        if row["body_hash"] != hashed:
            raise HTTPException(409, "같은 요청 번호로 다른 내용을 보낼 수 없어요.")
        result = json.loads(row["response"])
        if isinstance(result, dict) and "_projectRevision" in result:
            reference = result["_projectRevision"]
            revision = con.execute("SELECT * FROM project_revisions WHERE user_id=? AND career_id=? AND version=?",
                                   (uid, reference["careerId"], reference["version"])).fetchone()
            if revision:
                return {"careerId": reference["careerId"], "version": revision["version"],
                        "answers": json.loads(revision["answers"]), "scene": json.loads(revision["scene"]) if revision["scene"] else None,
                        "interest": revision["interest"], "updatedAt": revision["created_at"]}
            if reference["version"] == 0:
                return {"careerId": reference["careerId"], "version": 0, "answers": ["", "", ""],
                        "scene": None, "interest": None, "updatedAt": None}
            raise HTTPException(409, "해당 저장 이력을 찾을 수 없어요. 최신 초안을 다시 불러와 주세요.")
        return result
    return None


def remember(con, uid, key, body, result):
    hashed = hashlib.sha256(dump(body).encode()).hexdigest()
    con.execute("INSERT INTO requests VALUES (?,?,?,?,?)", (uid, key, hashed, dump(result), now()))
    return result


def remember_project(con, uid, key, body, project):
    # Revisions remain the immutable source. Repeated autosaves no longer copy
    # an entire scene into every idempotency response; old responses still work.
    remember(con, uid, key, body, {"_projectRevision": {"careerId": project["careerId"], "version": project["version"]}})
    return project


def active_activities(con, uid):
    result = []
    for row in con.execute("SELECT * FROM simulations WHERE user_id=? AND completed=0", (uid,)):
        session = json.loads(row["state"])
        if session.get("stage") in {"brief", "completed"}:
            continue
        result.append({"id": row["id"], "sessionId": row["id"], "careerId": row["career_id"],
                       "kind": "simulation", "title": career(row["career_id"])["title"] + " 직무체험",
                       "updatedAt": row["updated_at"] or row["created_at"]})
    for row in con.execute("SELECT * FROM projects WHERE user_id=?", (uid,)):
        answers = json.loads(row["answers"])
        scene = json.loads(row["scene"]) if row["scene"] else {}
        if not any(answer.strip() for answer in answers) and not any(not e.get("isDeleted") for e in scene.get("elements", [])):
            continue
        source_key = f"project:{row['career_id']}:revision:{row['version']}"
        if con.execute("SELECT 1 FROM activities WHERE user_id=? AND source_key=?", (uid, source_key)).fetchone():
            continue
        result.append({"id": f"project:{row['career_id']}", "careerId": row["career_id"], "kind": "project",
                       "title": career(row["career_id"])["project"], "updatedAt": row["updated_at"],
                       "completedAnswers": sum(answer_is_complete(answer) for answer in answers)})
    return sorted(result, key=lambda item: item["updatedAt"], reverse=True)


def add_event(con, uid, cid, kind, source_key, text="", objectives=None, category="participation", metadata=None):
    previous = con.execute("SELECT evidence FROM events WHERE user_id=? AND source_key=?", (uid, source_key)).fetchone()
    if previous:
        return json.loads(previous[0])
    event_id, timestamp = str(uuid.uuid4()), now()
    evidence = {"id": event_id, "careerId": cid, "kind": kind, "category": category,
                "objectives": objectives or [], "text": text, "date": timestamp,
                "verified": category != "self_report", "verificationMeaning": "활동·제출 기록의 존재만 서버 확인; 내용의 정확성이나 능력 검증 아님",
                "metadata": metadata or {}}
    verb = VERBS.get(kind, kind)
    standard = verb in {"experienced", "answered", "completed"}
    statement = {"id": event_id, "actor": {"objectType": "Agent", "account": {"homePage": PUBLIC_ORIGIN, "name": uid}},
                 "verb": {"id": f"http://adlnet.gov/expapi/verbs/{verb}" if standard else f"{PUBLIC_ORIGIN}/xapi/verbs/{verb}", "display": {"en-US": verb}},
                 "object": {"objectType": "Activity", "id": f"{PUBLIC_ORIGIN}/activities/{cid}/{source_key}",
                            "definition": {"name": {"ko-KR": career(cid)["title"]}, "type": f"{PUBLIC_ORIGIN}/xapi/activity-types/{kind}"}},
                 "result": {"response": text, "extensions": {f"{PUBLIC_ORIGIN}/xapi/extensions/evidence": evidence}},
                 "timestamp": timestamp, "stored": timestamp, "version": "1.0.3"}
    con.execute("INSERT INTO events VALUES (?,?,?,?,?,?,?,?)", (event_id, uid, cid, kind, dump(statement), dump(evidence), timestamp, source_key))
    return evidence


def evidence_for(con, uid):
    return [json.loads(row[0]) for row in con.execute("SELECT evidence FROM events WHERE user_id=? ORDER BY created_at,id", (uid,))]


def reports_for(con, uid):
    evidence = evidence_for(con, uid)
    return {c["id"]: ENGINE.report(c["id"], evidence) for c in CAREERS}


def scores_for(con, uid, cid):
    return ENGINE.report(cid, evidence_for(con, uid))["scores"]


def activity_for(con, uid, cid, kind, source_key, before, answers, reflection, feedback, interest=None, extra=None):
    existing = con.execute("SELECT data FROM activities WHERE user_id=? AND source_key=?", (uid, source_key)).fetchone()
    if existing:
        return json.loads(existing[0])
    activity = {"id": str(uuid.uuid4()), "careerId": cid, "kind": kind,
                "title": f"{career(cid)['title']} { {'diagnosis':'경험 진단','simulation':'직무체험','project':'미니 프로젝트'}[kind] }",
                "date": now(), "reflection": reflection, "answers": answers,
                "feedback": feedback, "before": before, "after": scores_for(con, uid, cid),
                "evaluationStatus": "not_connected", "mode": "template", **(extra or {})}
    if interest is not None:
        activity["interest"] = interest
    con.execute("INSERT INTO activities VALUES (?,?,?,?,?,?,?)", (activity["id"], uid, cid, kind, dump(activity), activity["date"], source_key))
    return activity


def all_activities(con, uid):
    return [json.loads(row[0]) for row in con.execute("SELECT data FROM activities WHERE user_id=? ORDER BY created_at DESC,id DESC", (uid,))]
