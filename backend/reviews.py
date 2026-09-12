"""Student-confirmed reflection; never awards objective coverage or ability scores."""
import json
import time
import uuid
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from .auth import user_for, profile_for
from .catalog import career
from .config import AI_MODE
from .db import transaction, dump, now
from .models import Input, RequestId, Version
from .inference import provider
from .records import ENGINE, all_activities, reports_for, add_event, replay, remember

router = APIRouter(prefix="/api/v1/career-reviews", tags=["경험 회고"])
OPTIONS = {
    "enjoyed": {"investigate": "원인 찾기", "decide": "해결책 고르기", "create": "결과물 만들기", "share": "동료에게 전달하기", "unsure": "아직 잘 모르겠어요"},
    "difficult": {"compare": "자료 비교", "decide": "결정하기", "tools": "도구 사용", "none": "크게 어렵지 않았어요"},
    "again": {"more": "더 해보고 싶어요", "other": "다른 역할도 궁금해요", "unsure": "아직 모르겠어요",
              **{f"interest_{i}": f"활동 후 관심 {i} / 5" for i in range(1, 6)}},
}
CORRECTIONS = {"not_me": "AI가 정리한 내용이 내 생각과 달라요.", "other": "지금은 다른 역할을 더 알아보고 싶어요.", "unsure": "경험을 더 해보고 생각을 정하고 싶어요."}


class Answers(Input):
    expectedVersion: Version
    clientRequestId: RequestId
    enjoyed: Literal["investigate", "decide", "create", "share", "unsure"]
    difficult: Literal["compare", "decide", "tools", "none"]
    again: Literal["more", "other", "unsure", "interest_1", "interest_2", "interest_3", "interest_4", "interest_5"]


class Generate(Input):
    expectedVersion: Version
    clientRequestId: RequestId


class Confirm(Generate):
    agreement: Literal["agree", "different"]
    correction: Literal["not_me", "other", "unsure"] = "not_me"
    note: str = Field(default="", max_length=1200)
    nextKey: str = Field(min_length=1, max_length=100)


def activity_for_review(con, uid, aid):
    row = con.execute("SELECT data FROM activities WHERE id=? AND user_id=?", (aid, uid)).fetchone()
    if not row:
        raise HTTPException(404, "회고할 활동을 찾을 수 없어요.")
    value = json.loads(row[0])
    if value["kind"] not in {"simulation", "project"}:
        raise HTTPException(422, "직무체험이나 프로젝트를 마친 뒤 회고해 주세요.")
    return value


def read_review(con, uid, aid):
    row = con.execute("SELECT data FROM career_reviews WHERE activity_id=? AND user_id=?", (aid, uid)).fetchone()
    if not row:
        return None
    value = json.loads(row[0])
    if value["status"] == "generating" and time.time() - value.get("startedAt", 0) > 75:
        value.update(status="draft", error="정리가 중단됐어요. 저장한 응답으로 다시 시도해 주세요.", version=value["version"] + 1)
        persist(con, uid, value)
    return value


def persist(con, uid, value):
    con.execute("INSERT INTO career_reviews VALUES (?,?,?,?) ON CONFLICT(activity_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
                (value["activityId"], uid, dump(value), now()))


def version_matches(value, expected):
    if (value["version"] if value else 0) != expected:
        raise HTTPException(409, "회고가 다른 화면에서 바뀌었어요. 저장된 내용을 다시 불러와 주세요.")


def confirmed_reviews(con, uid):
    return [json.loads(row[0]) for row in con.execute("SELECT data FROM career_reviews WHERE user_id=? ORDER BY updated_at DESC", (uid,))
            if json.loads(row[0])["status"] == "confirmed"]


def defaults_for(activity):
    """Reuse explicit answers only; an interest score never implies a career decision."""
    answers = {}
    enjoyed = {"단서 찾기": "investigate", "조치 선택하기": "decide", "동료에게 전달하기": "share", "아직 잘 모르겠어요": "unsure"}.get(activity.get("liked"))
    difficult = {"수치 비교가 어려웠어요": "compare", "조치 결정이 어려웠어요": "decide", "크게 어려운 점은 없었어요": "none"}.get(activity.get("disliked"))
    if enjoyed:
        answers["enjoyed"] = enjoyed
    if difficult:
        answers["difficult"] = difficult
    if activity.get("reflection") == "경험해 보니 다른 직업도 더 알아보고 싶어요.":
        answers["again"] = "other"
    elif type(activity.get("interest")) is int and 1 <= activity["interest"] <= 5:
        answers["again"] = f"interest_{activity['interest']}"
    return {"answers": answers, "source": {key: activity.get(key) for key in ("reflection", "liked", "disliked", "interest")}}


@router.get("")
def list_reviews(user=Depends(user_for)):
    with transaction() as con:
        ids = [row[0] for row in con.execute("SELECT activity_id FROM career_reviews WHERE user_id=? ORDER BY updated_at DESC", (user["id"],))]
        values = [read_review(con, user["id"], aid) for aid in ids]
        defaults = {a["id"]: defaults_for(a) for a in all_activities(con, user["id"]) if a["kind"] in {"simulation", "project"}}
    return {"reviews": values, "defaults": defaults, "options": OPTIONS, "mode": "ai" if AI_MODE == "ai" else "template"}


@router.put("/{aid}/answers")
def save_answers(aid: str, body: Answers, user=Depends(user_for)):
    uid, payload, key = user["id"], body.model_dump(), "review-answers:" + body.clientRequestId
    payload["activityId"] = aid
    with transaction() as con:
        activity = activity_for_review(con, uid, aid)
        previous = replay(con, uid, key, payload)
        if previous is not None:
            return previous
        old = read_review(con, uid, aid)
        version_matches(old, body.expectedVersion)
        value = {"activityId": aid, "careerId": activity["careerId"], "activityTitle": activity["title"],
                 "version": body.expectedVersion + 1, "status": "draft", "date": now(), "error": "",
                 "answers": {name: getattr(body, name) for name in OPTIONS}, "generated": None, "confirmation": None}
        persist(con, uid, value)
        return remember(con, uid, key, payload, value)


def context_for(con, uid, activity, answers, interests):
    reports = reports_for(con, uid)
    candidates = ENGINE.recommend(reports, interests)
    cid = activity["careerId"]
    candidates.sort(key=lambda c: (c["careerId"] == cid if answers["again"] == "other" else c["careerId"] != cid, -c["priority"]))
    candidates = candidates[:6]
    if not candidates:
        candidates = [{"careerId": cid, "kind": "discovery", "reason": "직업 정보를 다시 살펴보며 다음 관심을 정해 봐요.", "missingObjectives": []}]
    candidates = [{**c, "key": c["careerId"] + ":" + c["kind"], "title": career(c["careerId"])["title"] + " · " + {"simulation": "직무체험", "project": "미니 프로젝트", "discovery": "직업 탐색"}[c["kind"]]} for c in candidates]
    records = [activity] + [a for a in all_activities(con, uid) if a["id"] != activity["id"] and a["kind"] in {"simulation", "project"}][:6]
    sources = [{"ref": f"record{i+1}", "activityId": a["id"], "title": a["title"], "date": a["date"]} for i, a in enumerate(records)]
    context = {"records": [{"ref": f"record{i+1}", "career": career(a["careerId"])["title"], "kind": a["kind"],
                            "answers": [str(s)[:1800] for s in a.get("answers", [])[:6]],
                            "reflection": a.get("reflection", "")[:1200], "interest": a.get("interest"),
                            "choices": [{"text": str(v.get("text", ""))[:700]} for v in (a.get("fieldwork") or {}).get("log", [])[-8:]]}
                           for i, a in enumerate(records)],
               "reflection": {k: OPTIONS[k][v] for k, v in answers.items()},
               "missing": [m for d in reports[cid]["dimensions"] for m in d["missing"]],
               "candidates": [{k: c[k] for k in ("key", "title", "reason")} for c in candidates]}
    return context, candidates, sources


@router.post("/{aid}/generate")
def generate_review(aid: str, body: Generate, user=Depends(user_for)):
    uid, payload, key = user["id"], {**body.model_dump(), "activityId": aid}, "review-generate:" + body.clientRequestId
    with transaction() as con:
        activity = activity_for_review(con, uid, aid)
        cached = replay(con, uid, key, payload)
        if cached is not None:
            return cached
        value = read_review(con, uid, aid)
        version_matches(value, body.expectedVersion)
        if not value or value["status"] not in {"draft", "ready"}:
            raise HTTPException(409, "회고 응답을 저장한 뒤 정리를 요청해 주세요.")
        context, candidates, sources = context_for(con, uid, activity, value["answers"], profile_for(user)["interests"])
        token = str(uuid.uuid4())
        value.update(status="generating", startedAt=time.time(), generationToken=token, error="", version=value["version"] + 1)
        persist(con, uid, value)
    try:
        if AI_MODE == "ai":
            generated = provider().reflect(context).model_dump()
            refs = {s["ref"] for s in sources}
            if "record1" not in generated["evidenceRefs"] or not set(generated["evidenceRefs"]) <= refs or generated["nextKey"] not in {c["key"] for c in candidates}:
                raise ValueError("Unknown evidence or recommendation")
            mode = "ai"
        else:
            generated = {"summary": f"{activity['title']}을 마쳤고, 이번 회고에서 '{context['reflection']['enjoyed']}', '{context['reflection']['difficult']}', '{context['reflection']['again']}'를 골랐어요. 이 응답을 다음 경험과 비교해 봐요.",
                         "evidenceRefs": ["record1"], "nextKey": candidates[0]["key"], "reason": candidates[0]["reason"]}
            mode = "template"
    except Exception:
        with transaction() as con:
            current = read_review(con, uid, aid)
            if current and current.get("generationToken") == token:
                current.update(status="draft", error="AI 정리를 받지 못했어요. 응답은 저장됐으니 잠시 후 다시 시도해 주세요.", version=current["version"] + 1)
                persist(con, uid, current)
        raise HTTPException(502, "AI 정리를 받지 못했어요. 저장된 응답으로 다시 시도해 주세요.") from None
    with transaction() as con:
        current = read_review(con, uid, aid)
        if not current or current.get("generationToken") != token or current["status"] != "generating":
            raise HTTPException(409, "회고 응답이 변경되어 이전 정리를 반영하지 않았어요.")
        current.update(status="ready", version=current["version"] + 1, mode=mode, date=now(),
                       generated=generated, candidates=candidates, sources=sources, missing=context["missing"], error="")
        persist(con, uid, current)
        return remember(con, uid, key, payload, current)


@router.put("/{aid}/confirm")
def confirm_review(aid: str, body: Confirm, user=Depends(user_for)):
    uid, payload, key = user["id"], {**body.model_dump(), "activityId": aid}, "review-confirm:" + body.clientRequestId
    with transaction() as con:
        activity_for_review(con, uid, aid)
        cached = replay(con, uid, key, payload)
        if cached is not None:
            return cached
        value = read_review(con, uid, aid)
        version_matches(value, body.expectedVersion)
        if not value or value["status"] not in {"ready", "confirmed"}:
            raise HTTPException(409, "경험 정리를 먼저 만들어 주세요.")
        candidate = next((c for c in value["candidates"] if c["key"] == body.nextKey), None)
        if candidate is None:
            raise HTTPException(422, "제안된 활동 중에서 다음 경험을 골라 주세요.")
        note = body.note.strip()
        existing = value.get("confirmation")
        if value["status"] == "confirmed" and existing and all((existing["agreement"] == body.agreement,
                existing["correction"] == body.correction, existing["note"] == note, existing["next"]["key"] == body.nextKey)):
            return remember(con, uid, key, payload, value)
        value.update(status="confirmed", date=now(), version=value["version"] + 1,
                     confirmation={"agreement": body.agreement, "correction": body.correction, "note": note,
                                   "summary": note or (value["generated"]["summary"] if body.agreement == "agree" else CORRECTIONS[body.correction]),
                                   "next": candidate, "date": now()})
        persist(con, uid, value)
        add_event(con, uid, value["careerId"], "reflection", "career-review:" + aid + ":" + str(value["version"]),
                  value["confirmation"]["summary"], category="self_report", objectives=[],
                  metadata={"reviewActivityId": aid, "mode": value["mode"], "studentConfirmed": True, "nextKey": body.nextKey})
        return remember(con, uid, key, payload, value)
