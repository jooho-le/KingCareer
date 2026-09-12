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
from .config import AI_MODE, DATA_DIR
from .db import WRITE_LOCK, transaction
from .inference import OpenCompatibleProvider


class GraphState(TypedDict):
    session: dict
    command: dict


def dispatch(state):
    return state["command"]["kind"]


def apply_command(state: GraphState):
    session = deepcopy(state["session"])
    command = state["command"]
    kind = command["kind"]
    scenario = session["scenario"]
    source = career(session["careerId"])
    session.pop("questionReply", None)
    if kind == "start":
        if session["stage"] != "brief":
            raise HTTPException(409, "이미 체험을 시작했어요.")
        session["stage"] = "play"
    elif kind in {"choice", "free"}:
        if session["stage"] != "play" or session["response"] is not None:
            raise HTTPException(409, "현재 상황의 결과를 확인한 뒤 다음으로 이동해 주세요.")
        if kind == "choice":
            choice = command.get("choiceIndex")
            if choice is None or choice >= len(scenario["choices"]):
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
        if session["mode"] == "ai":
            try:
                generated = OpenCompatibleProvider().generate({"career": source["title"], "scenario": scenario, "answer": answer})
                response, lesson = generated.response, generated.lesson
            except Exception as error:
                raise HTTPException(503, "AI 응답을 받지 못했어요. 입력과 이전 진행 상태는 유지돼요. 다시 시도해 주세요.") from error
        result = {"answer": answer, "response": response, "lesson": lesson}
        session["turns"].append(result)
        session["response"] = result
    elif kind == "question":
        if session["stage"] != "play":
            raise HTTPException(409, "진행 중인 직무 상황에서 질문할 수 있어요.")
        text = command.get("text", "").strip()
        if not text:
            raise HTTPException(422, "궁금한 점을 적어 주세요.")
        reply = "질문을 기록했어요. 준비된 시나리오의 참고 내용: " + source["scenarios"][session["step"]]["lesson"]
        if session["mode"] == "ai":
            try:
                reply = OpenCompatibleProvider().generate({"career": source["title"], "scenario": scenario, "question": text}).response
            except Exception as error:
                raise HTTPException(503, "AI 응답을 받지 못했어요. 질문을 유지한 채 다시 시도해 주세요.") from error
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
        for name in ("start", "choice", "free", "question", "continue", "complete"):
            graph.add_node(name, apply_command)
            graph.add_edge(name, END)
        graph.add_conditional_edges(START, dispatch, {name: name for name in ("start", "choice", "free", "question", "continue", "complete")})
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


def new_session(session_id, cid):
    scenario = career(cid)["scenarios"][0]
    return {"id": session_id, "careerId": cid, "mode": "ai" if AI_MODE == "ai" else "template",
            "stage": "brief", "step": 0, "version": 0,
            "scenario": {key: scenario[key] for key in ("title", "text", "choices")},
            "turns": [], "questions": [], "response": None}
