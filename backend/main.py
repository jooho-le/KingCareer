"""KingCareer API. Run: python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

SQLite + LangGraph uses one worker. All student writes use the same process lock
and an IMMEDIATE transaction. Never run this app with --workers greater than 1.
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
import sqlite3
import uuid
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, PlainTextResponse
from . import models as M
from .auth import (DUMMY_HASH, HASHER, check_login_rate, clear_cookie, create_session,
                   profile_for, token_hash, user_for, verify)
from .catalog import CAREERS, DIAGNOSIS_ANSWERS, FIELDS, REGIONS, catalog, career
from .config import ALLOWED_ORIGINS, COOKIE_NAME, ROOT
from .db import dump, initialize, now, transaction
from .records import (ENGINE, activity_for, add_event, all_activities, remember,
                      replay, reports_for, request_key, scores_for)
from .simulation import SimulationEngine, new_session

log = logging.getLogger("kingcareer")


@asynccontextmanager
async def lifespan(application):
    initialize()
    application.state.simulator = SimulationEngine()
    application.state.simulator.reconcile()
    try:
        yield
    finally:
        application.state.simulator.close()


app = FastAPI(title="KingCareer Student API", version="1.0.0", lifespan=lifespan,
              description="학생 소유 기록, 교육용 경험목표 충족률, 준비된 직무체험. API 인증은 HttpOnly 세션 쿠키입니다.")
app.add_middleware(CORSMiddleware, allow_origins=sorted(ALLOWED_ORIGINS), allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Content-Type"])


@app.middleware("http")
async def browser_boundaries(request, call_next):
    if request.url.path.startswith("/api/"):
        origin = request.headers.get("origin")
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            if (origin and origin.rstrip("/") not in ALLOWED_ORIGINS) or request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"detail": "허용되지 않은 출처의 요청이에요."}, status_code=403)
            try:
                if int(request.headers.get("content-length", "0")) > 65536:
                    return JSONResponse({"detail": "요청 내용이 너무 길어요."}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "잘못된 요청이에요."}, status_code=400)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response
    return await call_next(request)


@app.exception_handler(sqlite3.OperationalError)
async def database_unavailable(request, error):
    log.exception("SQLite operation failed", exc_info=error)
    return JSONResponse({"detail": "저장소에 연결하지 못했어요. 입력을 유지한 채 다시 시도해 주세요."}, status_code=503)


def validate_interests(values):
    if any(value not in FIELDS for value in values):
        raise HTTPException(422, "목록에 있는 관심분야를 선택해 주세요.")
    return list(dict.fromkeys(values))


def owned_simulation(con, uid, session_id):
    row = con.execute("SELECT * FROM simulations WHERE id=? AND user_id=?", (session_id, uid)).fetchone()
    if not row:
        raise HTTPException(404, "직무체험 기록을 찾을 수 없어요.")
    return dict(row), json.loads(row["state"])


def assert_version(actual, expected):
    if actual != expected:
        raise HTTPException(409, "다른 창에서 기록이 변경됐어요. 최신 내용을 다시 불러와 주세요.")


def persist_simulation(con, uid, session):
    con.execute("UPDATE simulations SET state=?,version=?,completed=?,checkpoint_version=? WHERE id=? AND user_id=?",
                (dump(session), session["version"], int(session["stage"] == "completed"), session["version"], session["id"], uid))


@app.get("/api/v1/catalog")
def get_catalog():
    return {"careers": catalog()}


@app.get("/api/v1/regions")
def get_regions():
    return {"regions": REGIONS, "note": "지역 연계는 교육용 편집 예시입니다. 실시간 채용·기업 제휴 정보가 아닙니다."}


@app.post("/api/v1/auth/register", status_code=201)
def register(body: M.Register, request: Request, response: Response):
    check_login_rate(request, "registration")
    uid = str(uuid.uuid4())
    profile = {"name": body.name, "school": body.school, "grade": body.grade, "region": body.region,
               "interests": validate_interests(body.interests), "notifications": True, "onboarded": True}
    password_hash = HASHER.hash(body.password)
    try:
        with transaction() as con:
            con.execute("INSERT INTO users VALUES (?,?,?,?,?)", (uid, body.username.lower(), password_hash, dump(profile), now()))
            create_session(con, uid, request, response)
    except sqlite3.IntegrityError as error:
        raise HTTPException(409, "이미 사용 중인 아이디예요.") from error
    return {**profile, "username": body.username.lower()}


@app.post("/api/v1/auth/login")
def login(body: M.Login, request: Request, response: Response):
    rate_key = check_login_rate(request, body.username)
    with transaction() as con:
        row = con.execute("SELECT * FROM users WHERE username=?", (body.username.lower(),)).fetchone()
        valid = verify(row["password_hash"] if row else DUMMY_HASH, body.password)
        if not valid or row is None:
            raise HTTPException(401, "아이디 또는 비밀번호를 확인해 주세요.")
        user = dict(row)
        if HASHER.check_needs_rehash(user["password_hash"]):
            con.execute("UPDATE users SET password_hash=? WHERE id=?", (HASHER.hash(body.password), user["id"]))
        con.execute("DELETE FROM login_attempts WHERE key=?", (rate_key,))
        create_session(con, user["id"], request, response)
        return profile_for(user)


@app.post("/api/v1/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        with transaction() as con:
            con.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(token),))
    clear_cookie(response)
    return {"ok": True}


@app.post("/api/v1/auth/password")
def change_password(body: M.PasswordChange, request: Request, response: Response, user=Depends(user_for)):
    check_login_rate(request, "password:" + user["id"])
    if not verify(user["password_hash"], body.currentPassword):
        raise HTTPException(400, "현재 비밀번호를 확인해 주세요.")
    with transaction() as con:
        con.execute("UPDATE users SET password_hash=? WHERE id=?", (HASHER.hash(body.newPassword), user["id"]))
        con.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))
        create_session(con, user["id"], request, response)
    return {"ok": True}


@app.delete("/api/v1/auth/account")
def delete_account(body: M.AccountDelete, request: Request, response: Response, user=Depends(user_for)):
    check_login_rate(request, "delete:" + user["id"])
    if not verify(user["password_hash"], body.password):
        raise HTTPException(400, "비밀번호를 확인해 주세요.")
    with transaction() as con:
        threads = [row[0] for row in con.execute("SELECT id FROM simulations WHERE user_id=?", (user["id"],))]
        con.execute("DELETE FROM users WHERE id=?", (user["id"],))
        # Main DB remains uncommitted until checkpoint cleanup succeeds. If the
        # checkpoint DB fails, the account remains usable and deletion can retry.
        request.app.state.simulator.delete_threads(threads)
    clear_cookie(response)
    return {"ok": True}


@app.patch("/api/v1/profile")
def update_profile(body: M.ProfilePatch, user=Depends(user_for)):
    changes = body.model_dump(exclude_none=True)
    if "interests" in changes:
        changes["interests"] = validate_interests(changes["interests"])
    with transaction() as con:
        row = con.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        if not row:
            raise HTTPException(401, "다시 로그인해 주세요.")
        profile = {**json.loads(row["profile"]), **changes}
        con.execute("UPDATE users SET profile=? WHERE id=?", (dump(profile), user["id"]))
    return {**profile, "username": user["username"]}


@app.put("/api/v1/saved/{career_id}")
def update_saved(career_id: str, body: M.Saved, user=Depends(user_for)):
    career(career_id)
    with transaction() as con:
        if body.saved:
            con.execute("INSERT OR IGNORE INTO saved VALUES (?,?)", (user["id"], career_id))
            add_event(con, user["id"], career_id, "saved", "saved:" + career_id)
        else:
            con.execute("DELETE FROM saved WHERE user_id=? AND career_id=?", (user["id"], career_id))
    return {"saved": body.saved}


@app.get("/api/v1/state")
def get_state(user=Depends(user_for)):
    with transaction() as con:
        activities = all_activities(con, user["id"])
        reports = reports_for(con, user["id"])
        interests = {}
        for item in activities:
            if "interest" in item and item["careerId"] not in interests:
                interests[item["careerId"]] = item["interest"]
        return {"profile": profile_for(user),
                "saved": [row[0] for row in con.execute("SELECT career_id FROM saved WHERE user_id=?", (user["id"],))],
                "activities": activities, "scores": {cid: report["scores"] for cid, report in reports.items()},
                "interests": interests,
                "drafts": {row["career_id"]: json.loads(row["answers"]) for row in con.execute("SELECT * FROM projects WHERE user_id=?", (user["id"],))},
                "gaps": reports, "recommendations": ENGINE.recommend(reports, profile_for(user)["interests"])}


@app.get("/api/v1/experience-map")
def experience_map(user=Depends(user_for)):
    with transaction() as con:
        return reports_for(con, user["id"])


@app.get("/api/v1/recommendations")
def recommendations(user=Depends(user_for)):
    with transaction() as con:
        return ENGINE.recommend(reports_for(con, user["id"]), profile_for(user)["interests"])


@app.delete("/api/v1/records")
def delete_records(request: Request, user=Depends(user_for)):
    with transaction() as con:
        threads = [row[0] for row in con.execute("SELECT id FROM simulations WHERE user_id=?", (user["id"],))]
        for table in ("events", "activities", "diagnoses", "simulations", "projects", "project_revisions", "requests"):
            # Table names are a fixed allowlist, never client-supplied SQL.
            con.execute(f"DELETE FROM {table} WHERE user_id=?", (user["id"],))
        request.app.state.simulator.delete_threads(threads)
    return {"ok": True}


@app.post("/api/v1/experience-events")
def experience_event(body: M.ExperienceEvent, user=Depends(user_for)):
    key = request_key("event", body.clientRequestId)
    with transaction() as con:
        old = replay(con, user["id"], key, body.model_dump())
        if old is not None:
            return old
        if body.kind == "questioned" and not body.text:
            raise HTTPException(422, "질문 내용을 입력해 주세요.")
        event = add_event(con, user["id"], body.careerId, body.kind, key, text=body.text,
                          objectives=["explored"] if body.kind == "explored" else [])
        return remember(con, user["id"], key, body.model_dump(), event)


@app.post("/api/v1/diagnoses")
def diagnose(body: M.Diagnosis, user=Depends(user_for)):
    key = request_key("diagnosis", body.clientRequestId)
    with transaction() as con:
        old = replay(con, user["id"], key, body.model_dump())
        if old is not None:
            return old
        before = scores_for(con, user["id"], body.careerId)
        summaries = [f"{dimension}: {choices[answer]}" for (dimension, choices), answer in zip(DIAGNOSIS_ANSWERS, body.answers)]
        con.execute("INSERT INTO diagnoses VALUES (?,?,?,?,?)", (str(uuid.uuid4()), user["id"], body.careerId, dump(body.answers), now()))
        add_event(con, user["id"], body.careerId, "diagnosis", key,
                  text="\n".join(summaries), category="self_report", metadata={"answers": body.answers, "questionnaireVersion": "diagnosis-v1"})
        result = activity_for(con, user["id"], body.careerId, "diagnosis", key, before,
                              summaries, "",
                              "현재 알고 있거나 경험했다고 답한 내용을 저장했어요. 자기보고 기록은 실제 활동 근거와 구분하며 능력 점수로 바꾸지 않아요.",
                              extra={"evaluationStatus": "self_report", "selfReport": body.answers})
        return remember(con, user["id"], key, body.model_dump(), result)


@app.post("/api/v1/simulations")
def create_simulation(body: M.SimulationCreate, user=Depends(user_for)):
    with transaction() as con:
        row = con.execute("SELECT state FROM simulations WHERE user_id=? AND career_id=? AND completed=0", (user["id"], body.careerId)).fetchone()
        if row:
            return json.loads(row[0])
        session = new_session(str(uuid.uuid4()), body.careerId)
        session["initialScores"] = scores_for(con, user["id"], body.careerId)
        con.execute("INSERT INTO simulations (id,user_id,career_id,state,version,created_at) VALUES (?,?,?,?,?,?)",
                    (session["id"], user["id"], body.careerId, dump(session), session["version"], now()))
        return session


@app.get("/api/v1/simulations/{session_id}")
def get_simulation(session_id: str, user=Depends(user_for)):
    with transaction() as con:
        return owned_simulation(con, user["id"], session_id)[1]


@app.post("/api/v1/simulations/{session_id}/turn")
def simulation_turn(session_id: str, body: M.SimulationTurn, request: Request, user=Depends(user_for)):
    key = request_key("simulation:" + session_id, body.clientRequestId)
    with transaction() as con:
        old = replay(con, user["id"], key, body.model_dump())
        if old is not None:
            return old
        _, session = owned_simulation(con, user["id"], session_id)
        assert_version(session["version"], body.expectedVersion)
        updated = request.app.state.simulator.transition(session, body.model_dump())
        if body.kind in {"choice", "free"}:
            add_event(con, user["id"], session["careerId"], body.kind,
                      f"simulation:{session_id}:turn:{session['step']}",
                      text=updated["response"]["answer"], objectives=[f"scenario_{session['step']}"],
                      metadata={"sessionId": session_id, "step": session["step"], "mode": session["mode"]})
        elif body.kind == "question":
            add_event(con, user["id"], session["careerId"], "questioned", key, body.text,
                      metadata={"sessionId": session_id, "reply": updated["questionReply"]})
        persist_simulation(con, user["id"], updated)
        return remember(con, user["id"], key, body.model_dump(), updated)


@app.post("/api/v1/simulations/{session_id}/complete")
def complete_simulation(session_id: str, body: M.SimulationComplete, request: Request, user=Depends(user_for)):
    key = request_key("simulation-complete:" + session_id, body.clientRequestId)
    with transaction() as con:
        old = replay(con, user["id"], key, body.model_dump())
        if old is not None:
            return old
        _, session = owned_simulation(con, user["id"], session_id)
        if session["stage"] == "completed":
            row = con.execute("SELECT data FROM activities WHERE id=? AND user_id=?", (session["activityId"], user["id"])).fetchone()
            return remember(con, user["id"], key, body.model_dump(), {"session": session, "activity": json.loads(row[0])})
        assert_version(session["version"], body.expectedVersion)
        updated = request.app.state.simulator.transition(session, {**body.model_dump(), "kind": "complete"})
        cid = session["careerId"]
        add_event(con, user["id"], cid, "reflection", f"simulation:{session_id}:reflection", body.reflection,
                  objectives=["reflection"], category="artifact", metadata={"liked": body.liked, "disliked": body.disliked, "interest": body.interest})
        add_event(con, user["id"], cid, "simulation", f"simulation:{session_id}:completed", objectives=["simulation_done"])
        result = activity_for(con, user["id"], cid, "simulation", "simulation:" + session_id,
                              session["initialScores"], [turn["answer"] for turn in session["turns"]], body.reflection,
                              ("직무 상황의 선택과 회고를 저장했어요. AI와 나눈 내용은 관찰과 학습 안내이며 개인별 능력의 검증 점수가 아니에요."
                               if session["mode"] == "ai" else "직무 상황의 선택과 회고를 저장했어요. 아래 내용은 준비된 시나리오의 학습 포인트이며 AI의 개인별 능력 평가가 아니에요."),
                              body.interest, {"sessionId": session_id, "liked": body.liked, "disliked": body.disliked,
                                              "lessons": [turn["lesson"] for turn in session["turns"]], "mode": session["mode"]})
        updated["activityId"] = result["id"]
        persist_simulation(con, user["id"], updated)
        return remember(con, user["id"], key, body.model_dump(), {"session": updated, "activity": result})


def project_for(con, uid, cid):
    career(cid)
    row = con.execute("SELECT * FROM projects WHERE user_id=? AND career_id=?", (uid, cid)).fetchone()
    return {"careerId": cid, "answers": json.loads(row["answers"]) if row else ["", "", ""], "version": row["version"] if row else 0}


@app.get("/api/v1/projects/{career_id}")
def get_project(career_id: str, user=Depends(user_for)):
    with transaction() as con:
        return project_for(con, user["id"], career_id)


@app.get("/api/v1/projects/{career_id}/revisions")
def project_revisions(career_id: str, user=Depends(user_for)):
    career(career_id)
    with transaction() as con:
        return [{"version": row["version"], "answers": json.loads(row["answers"]), "date": row["created_at"]}
                for row in con.execute("SELECT * FROM project_revisions WHERE user_id=? AND career_id=? ORDER BY version DESC", (user["id"], career_id))]


@app.put("/api/v1/projects/{career_id}/draft")
def save_draft(career_id: str, body: M.Draft, user=Depends(user_for)):
    key = request_key("project-draft:" + career_id, body.clientRequestId)
    with transaction() as con:
        old = replay(con, user["id"], key, body.model_dump())
        if old is not None:
            return old
        project = project_for(con, user["id"], career_id)
        assert_version(project["version"], body.expectedVersion)
        if project["answers"] != body.answers:
            project = {"careerId": career_id, "answers": body.answers, "version": project["version"] + 1}
            timestamp = now()
            con.execute("INSERT INTO projects VALUES (?,?,?,?,?) ON CONFLICT(user_id,career_id) DO UPDATE SET answers=excluded.answers,version=excluded.version,updated_at=excluded.updated_at",
                        (user["id"], career_id, dump(body.answers), project["version"], timestamp))
            con.execute("INSERT INTO project_revisions VALUES (?,?,?,?,?)", (user["id"], career_id, project["version"], dump(body.answers), timestamp))
        return remember(con, user["id"], key, body.model_dump(), project)


@app.post("/api/v1/projects/{career_id}/submit")
def submit_project(career_id: str, body: M.Submit, user=Depends(user_for)):
    key = request_key("project-submit:" + career_id, body.clientRequestId)
    with transaction() as con:
        old = replay(con, user["id"], key, body.model_dump())
        if old is not None:
            return old
        project = project_for(con, user["id"], career_id)
        assert_version(project["version"], body.expectedVersion)
        if any(len(value.strip()) < 10 for value in project["answers"]):
            raise HTTPException(422, "세 가지 미션을 각각 10자 이상 작성한 뒤 제출해 주세요.")
        source_key = f"project:{career_id}:revision:{project['version']}"
        existing = con.execute("SELECT data FROM activities WHERE user_id=? AND source_key=?", (user["id"], source_key)).fetchone()
        if existing:
            return remember(con, user["id"], key, body.model_dump(), json.loads(existing[0]))
        before = scores_for(con, user["id"], career_id)
        for index, answer in enumerate(project["answers"]):
            add_event(con, user["id"], career_id, "project", source_key + f":mission:{index}", answer,
                      objectives=[f"mission_{index}"] if index in (1, 2) else [], category="artifact",
                      metadata={"revision": project["version"], "mission": index})
        add_event(con, user["id"], career_id, "project", source_key, objectives=["project_done"], category="artifact")
        result = activity_for(con, user["id"], career_id, "project", source_key, before, project["answers"], "",
                              "세 단계 결과물을 저장했어요. 기록 충족 여부만 반영했고, 내용의 정확성·완성도·역량에 대한 AI 평가는 아직 연결되지 않았어요.",
                              body.interest, {"projectVersion": project["version"], "completion": {"submittedMissions": 3, "totalMissions": 3}, "evaluationStatus": "not_connected"})
        return remember(con, user["id"], key, body.model_dump(), result)


@app.get("/api/v1/portfolio/export")
def export_portfolio(user=Depends(user_for)):
    with transaction() as con:
        activities = all_activities(con, user["id"])
        reports = reports_for(con, user["id"])
    lines = ["KingCareer 진로경험 포트폴리오", "닉네임: " + profile_for(user)["name"],
             "교육용 목표의 기록 충족률이며 직무 능력·적성 평가가 아닙니다.",
             "AI 내용 평가는 미연결 상태입니다.", ""]
    for cid, report in reports.items():
        lines.append(career(cid)["title"])
        lines.extend(f"  {d['name']}: 기록 {d['observed']}/{d['target']}" + (" (확인 근거 없음)" if d["unknown"] else "") for d in report["dimensions"])
    for activity in activities:
        lines.extend(["", activity["title"], activity["date"], *activity["answers"], activity["reflection"], activity["feedback"]])
    lines.extend(["", "출처: ESCO / European Commission; O*NET 31.0 / USDOL/ETA, CC BY 4.0.",
                  "한국어 교육용 목표와 활동은 KingCareer의 편집 내용입니다."])
    return PlainTextResponse("\n".join(lines), headers={"Content-Disposition": 'attachment; filename="KingCareer-portfolio.txt"'})


@app.get("/api/v1/experience-events/export")
def export_xapi(user=Depends(user_for)):
    with transaction() as con:
        statements = [json.loads(row[0]) for row in con.execute("SELECT statement FROM events WHERE user_id=? ORDER BY created_at", (user["id"],))]
    return JSONResponse({"statements": statements, "more": ""}, headers={"Content-Disposition": 'attachment; filename="KingCareer-xapi.json"'})


@app.get("/app", include_in_schema=False)
def app_redirect():
    return RedirectResponse("/app/")


@app.get("/{requested_path:path}", include_in_schema=False)
def website(requested_path: str):
    if requested_path == "api" or requested_path.startswith("api/"):
        raise HTTPException(404, "API 경로를 찾을 수 없어요.")
    dist = (ROOT / "dist").resolve()
    target = (dist / requested_path).resolve()
    if not target.is_relative_to(dist):
        raise HTTPException(404, "페이지를 찾을 수 없어요.")
    if target.is_dir():
        target = target / "index.html"
    if target.is_file():
        return FileResponse(target)
    if requested_path == "" or requested_path.startswith("app/"):
        fallback = dist / ("app/index.html" if requested_path.startswith("app/") else "index.html")
        if fallback.is_file():
            return FileResponse(fallback)
        return PlainTextResponse("프론트엔드를 먼저 빌드해 주세요: npm run build. 개발 중에는 Vite /app/ 페이지를 사용하세요.", status_code=503)
    raise HTTPException(404, "파일을 찾을 수 없어요.")
