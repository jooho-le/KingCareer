"""LangGraph branches with durable SQLite checkpoints.

kingcareer.db is authoritative. A checkpoint written before a main transaction
failure is repaired from its canonical session on the next command/startup.
No scoring or events are produced inside graph nodes.
"""
from copy import deepcopy
import json
import sqlite3
from typing import TypedDict
from fastapi import HTTPException
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from .catalog import career
from .workplaces import WORKPLACES, scenario_for
from .config import AI_MODE, DATA_DIR
from .db import WRITE_LOCK, transaction
from .inference import provider
from .fieldwork import initial_fieldwork, advance


class GraphState(TypedDict):
    session: dict
    command: dict


def dispatch(state):
    return state["command"]["kind"]


def prepare_command(canonical, command):
    """Generate against a read snapshot, before the caller acquires a write lock.

    The caller must recheck ownership, expectedVersion and request replay under
    its transaction before committing. These private fields never come from the
    API model and are not stored in the idempotency request fingerprint.
    """
    prepared = deepcopy(command)
    kind = command["kind"]
    if canonical.get("coachMode", canonical["mode"]) != "ai":
        return prepared
    source = career(canonical["careerId"])
    if kind == "question":
        if canonical["stage"] != "play":
            raise HTTPException(409, "진행 중인 직무 상황에서 질문할 수 있어요.")
        question = command.get("text", "").strip()
        if not question:
            raise HTTPException(422, "궁금한 점을 적어 주세요.")
        context = {"career": source["title"], "scenario": canonical["scenario"],
                   "question": question, "fieldwork": canonical.get("fieldwork")}
    elif kind in {"choice", "free"} and "fieldwork" not in canonical:
        if canonical["stage"] != "play" or canonical["response"] is not None:
            raise HTTPException(409, "현재 상황의 결과를 확인한 뒤 다음으로 이동해 주세요.")
        if kind == "choice":
            index = command.get("choiceIndex")
            if index is None or not 0 <= index < len(canonical["scenario"]["choices"]):
                raise HTTPException(422, "선택지를 골라 주세요.")
            answer = canonical["scenario"]["choices"][index]
        else:
            answer = command.get("text", "").strip()
            if not answer:
                raise HTTPException(422, "답변을 적어 주세요.")
        context = {"career": source["title"], "scenario": canonical["scenario"], "answer": answer}
    else:
        return prepared
    try:
        generated = provider().generate(context)
    except Exception as error:
        raise HTTPException(503, "AI 응답을 받지 못했어요. 입력과 이전 진행 상태는 유지돼요. 다시 시도해 주세요.") from error
    prepared["_generatedReply"] = generated.response
    prepared["_generatedLesson"] = generated.lesson
    return prepared


def apply_command(state: GraphState):
    session = deepcopy(state["session"])
    command = state["command"]
    kind = command["kind"]
    scenario = session["scenario"]
    source = career(session["careerId"])
    session.pop("questionReply", None)
    if "fieldwork" in session and kind in {"inspect", "compare", "act", "verify", "handover"}:
        advance(session, command)
        session["version"] += 1
        return {"session": session, "command": {}}
    if "fieldwork" in session and kind in {"choice", "free", "continue"}:
        raise HTTPException(409, "현장 조사와 업무 단계를 사용해 주세요.")
    if "fieldwork" not in session and kind in {"inspect", "compare", "act", "verify", "handover"}:
        raise HTTPException(422, "이 체험에서 지원하지 않는 행동이에요.")
    if kind == "start":
        if session["stage"] != "brief":
            raise HTTPException(409, "이미 체험을 시작했어요.")
        session["stage"] = "play"
    elif kind in {"choice", "free"}:
        if session["stage"] != "play" or session["response"] is not None:
            raise HTTPException(409, "현재 상황의 결과를 확인한 뒤 다음으로 이동해 주세요.")
        if kind == "choice":
            choice = command.get("choiceIndex")
            if choice is None or not 0 <= choice < len(scenario["choices"]):
                raise HTTPException(422, "선택지를 골라 주세요.")
            answer = scenario["choices"][choice]
            response = source["scenarios"][session["step"]]["responses"][choice]
            lesson = source["scenarios"][session["step"]]["lesson"]
        else:
            answer = command.get("text", "").strip()
            if not answer:
                raise HTTPException(422, "답변을 적어 주세요.")
            response = "답변을 기록했어요. 지금은 준비된 시나리오 모드라 자유 답변의 내용을 평가하지 않아요. 다음 상황에서 다른 관점도 살펴보세요."
            lesson = source["scenarios"][session["step"]]["lesson"]
        if session.get("coachMode", session["mode"]) == "ai":
            if "_generatedReply" not in command:
                raise HTTPException(503, "AI 응답을 준비하지 못했어요. 이전 진행 상태는 유지돼요.")
            response, lesson = command["_generatedReply"], command["_generatedLesson"]
        result = {"answer": answer, "response": response, "lesson": lesson}
        session["turns"].append(result)
        session["response"] = result
    elif kind == "question":
        if session["stage"] != "play":
            raise HTTPException(409, "진행 중인 직무 상황에서 질문할 수 있어요.")
        text = command.get("text", "").strip()
        if not text:
            raise HTTPException(422, "궁금한 점을 적어 주세요.")
        reply = ("온도만 보지 말고 수분, 환기 설정, 교대 일지의 시간도 함께 비교해 봐요. 조치 후에는 같은 조건에서 다시 측정하고 남은 일을 인계해요."
                 if "fieldwork" in session else "질문을 기록했어요. 준비된 시나리오의 참고 내용: " + source["scenarios"][min(session["step"], len(source["scenarios"]) - 1)]["lesson"])
        if session.get("fieldwork", {}).get("presentation"):
            field = session["fieldwork"]
            reply = "준비된 학습 안내: " + field["presentation"]["brief"] + " 서로 다른 기록을 비교하고, 조치 뒤 같은 조건에서 결과를 확인해 봐요."
            if field.get("action"):
                reply += " 선택한 조치의 결과: " + field["action"]["result"]
        if session.get("coachMode", session["mode"]) == "ai":
            if "_generatedReply" not in command:
                raise HTTPException(503, "AI 응답을 준비하지 못했어요. 질문을 유지한 채 다시 시도해 주세요.")
            reply = command["_generatedReply"]
        session.setdefault("questions", []).append({"question": text, "reply": reply, "step": session["step"]})
        session["questionReply"] = reply
    elif kind == "continue":
        if session["stage"] != "play" or session["response"] is None:
            raise HTTPException(409, "먼저 현재 상황에 답해 주세요.")
        session["response"] = None
        if session["step"] + 1 >= len(source["scenarios"]):
            session["stage"] = "reflection"
        else:
            session["step"] += 1
            next_scenario = source["scenarios"][session["step"]]
            session["scenario"] = {key: next_scenario[key] for key in ("title", "text", "choices")}
    elif kind == "complete":
        if session["stage"] != "reflection":
            raise HTTPException(409, "모든 상황을 마친 뒤 회고를 남겨 주세요.")
        session["stage"] = "completed"
        session["reflection"] = {key: command[key] for key in ("reflection", "liked", "disliked", "interest")}
    session["version"] += 1
    return {"session": session, "command": {}}


class SimulationEngine:
    def __init__(self):
        self.connection = sqlite3.connect(DATA_DIR / "checkpoints.db", check_same_thread=False, timeout=15)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.saver = SqliteSaver(self.connection)
        self.saver.setup()
        graph = StateGraph(GraphState)
        commands = ("start", "choice", "free", "question", "continue", "complete", "inspect", "compare", "act", "verify", "handover")
        for name in commands:
            graph.add_node(name, apply_command)
            graph.add_edge(name, END)
        graph.add_conditional_edges(START, dispatch, {name: name for name in commands})
        self.graph = graph.compile(checkpointer=self.saver)

    def transition(self, canonical, command):
        config = {"configurable": {"thread_id": canonical["id"]}}
        with WRITE_LOCK:
            # Supplying the entire canonical session explicitly also repairs a
            # checkpoint that was ahead when the application transaction failed.
            return self.graph.invoke({"session": deepcopy(canonical), "command": command}, config)["session"]

    def reconcile(self):
        with transaction() as con:
            rows = con.execute("SELECT id,state FROM simulations").fetchall()
            live_ids = {row["id"] for row in rows}
            for row in rows:
                canonical = json.loads(row["state"])
                config = {"configurable": {"thread_id": row["id"]}}
                saved = self.graph.get_state(config)
                if saved.values.get("session") != canonical:
                    self.graph.update_state(config, {"session": canonical, "command": {}}, as_node="complete")
            # Recover cleanup after account/record deletion interrupted between DBs.
            for (thread_id,) in self.connection.execute("SELECT DISTINCT thread_id FROM checkpoints").fetchall():
                if thread_id not in live_ids:
                    self.saver.delete_thread(thread_id)

    def delete_threads(self, ids):
        with WRITE_LOCK:
            for thread_id in ids:
                self.saver.delete_thread(thread_id)

    def close(self):
        self.connection.close()


def new_session(session_id, cid, completed_count=0):
    presentation = scenario_for(cid, completed_count) if cid in WORKPLACES else None
    scenario = {"title": presentation["title"], "text": presentation["brief"], "choices": []} if presentation else career(cid)["scenarios"][0]
    return {"id": session_id, "careerId": cid, "mode": "ai" if AI_MODE == "ai" else "template",
            "stage": "brief", "step": 0, "version": 0,
            "scenario": ({"title": "온실의 아침을 부탁해", "text": "가상의 김제 토마토 온실 A구역 과열을 조사하고 조치한 뒤 재측정하고 인계한다. 모든 수치와 결과는 교육용 가상 상황이다.", "choices": []}
                         if cid == "farmer" else {key: scenario[key] for key in ("title", "text", "choices")}),
            "turns": [], "questions": [], "response": None,
            "fieldwork": initial_fieldwork(cid, presentation=presentation)}
