"""Transparent educational record coverage, never a psychometric ability score.

Inputs are trusted server-validated evidence dictionaries. Self-reports are kept
visible but never treated as demonstrated skill or verified offline contact.
"""
import networkx as nx
from .mappings import CONTEXT

DIMENSIONS = ["직업 인식", "직무 이해", "활동 경험", "역량 이해", "학과 이해", "현직자 교류"]
GOALS = [
    ("explored", 0, "직업 소개를 살펴본 기록", "discovery"),
    ("scenario_0", 1, "첫 직무 상황에 응답한 기록", "simulation"),
    ("scenario_1", 1, "후속 직무 상황에 응답한 기록", "simulation"),
    ("scenario_2", 1, "결과 확인 상황에 응답한 기록", "simulation"),
    ("reflection", 1, "경험 후 느낀 점을 작성한 기록", "simulation"),
    ("simulation_done", 2, "직무체험과 회고를 마친 기록", "simulation"),
    ("project_done", 2, "미니 프로젝트를 제출한 기록", "project"),
    ("mission_1", 3, "핵심 설계와 필요 역량을 작성한 기록", "project"),
    ("mission_2", 3, "확인 방법을 작성한 기록", "project"),
    ("major_verified", 4, "관련 전공을 직접 조사한 확인 자료", "discovery"),
    ("mentor_verified", 5, "실제 현직자와 교류한 확인 자료", "discovery"),
]


class ExperienceGraph:
    version = "kingcareer-objectives-v1"

    def __init__(self, careers, sources):
        self.careers = {c["id"]: c for c in careers}
        self.graph = nx.DiGraph()
        self.goal_actions = {}
        for cid, c in self.careers.items():
            root = f"career:{cid}"
            self.graph.add_node(root, kind="career", label=c["title"])
            source = sources["careers"][cid]
            # Official relationships are retained separately from educational mappings.
            esco = source["esco"]
            self.graph.add_node(esco["uri"], kind="occupation", label=esco["title"], labelKo="ESCO 직업·역량 자료")
            self.graph.add_edge(root, esco["uri"], relation="editorial_crosswalk")
            skills = esco["skills"]
            for skill in skills:
                self.graph.add_node(skill["uri"], kind="skill", label=skill["title"])
                self.graph.add_edge(esco["uri"], skill["uri"], relation="essential_skill", source="ESCO")
            onet_root = "onet:" + source["onet"]["code"]
            self.graph.add_node(onet_root, kind="occupation", label=source["onet"]["code"], labelKo="O*NET 업무 자료")
            self.graph.add_edge(root, onet_root, relation="editorial_crosswalk")
            tasks = []
            for task in source["onet"]["tasks"]:
                task_id = next((str(v) for k, v in task.items() if k.lower().replace("_", " ") == "task id"), "")
                title = next((str(v) for k, v in task.items() if k.lower() in {"task", "task statement", "task_statement"}), task_id)
                node = f"onet:{source['onet']['code']}:task:{task_id}"
                tasks.append(node)
                self.graph.add_node(node, kind="task", label=title)
                self.graph.add_edge(onet_root, node, relation="has_task", source="O*NET")
            for key, dimension, label, activity in GOALS:
                objective = f"goal:{cid}:{key}"
                self.graph.add_node(objective, kind="objective", label=label, dimension=dimension)
                # Authored teaching objectives use occupation sources as background;
                # these edges expressly do not claim an official skill assessment.
                self.graph.add_edge(root, objective, relation="educational_target")
                selected = []
                if key.startswith("scenario_"):
                    task_id, korean = CONTEXT[cid]["tasks"][int(key[-1])]
                    selected = [(f"onet:{source['onet']['code']}:task:{task_id}", korean)]
                elif key in {"reflection", "simulation_done"}:
                    task_id, korean = CONTEXT[cid]["tasks"][2]
                    selected = [(f"onet:{source['onet']['code']}:task:{task_id}", korean)]
                elif key in {"mission_1", "mission_2"}:
                    skill_id, korean = CONTEXT[cid]["skills"][int(key[-1]) - 1]
                    selected = [(f"http://data.europa.eu/esco/skill/{skill_id}", korean)]
                elif key == "project_done":
                    selected = [(f"http://data.europa.eu/esco/skill/{sid}", ko) for sid, ko in CONTEXT[cid]["skills"]]
                for source_node, korean in selected:
                    if source_node not in self.graph:
                        raise ValueError(f"Educational mapping references missing source: {source_node}")
                    self.graph.nodes[source_node]["labelKo"] = korean
                    self.graph.add_edge(source_node, objective, relation="educational_context", editorial=True)
                action = f"activity:{cid}:{activity}:{key}"
                self.graph.add_node(action, kind="activity", label={"simulation": "직무체험", "project": "미니 프로젝트", "discovery": "직업 탐색"}[activity])
                self.graph.add_edge(objective, action, relation="practise_with")
                self.goal_actions[objective] = action

    def report(self, career_id, evidence):
        relevant = [e for e in evidence if e["careerId"] == career_id]
        # The student's evidence is a private overlay; the shared ontology never
        # retains a student's text or identity between requests.
        observed_graph = self.graph.copy()
        for e in relevant:
            if e["category"] != "self_report":
                for objective in e.get("objectives", []):
                    goal = f"goal:{career_id}:{objective}"
                    if goal in observed_graph and observed_graph.nodes[goal].get("kind") == "objective":
                        evidence_node = f"evidence:{e['id']}"
                        observed_graph.add_node(evidence_node, kind="evidence", evidence_id=e["id"])
                        observed_graph.add_edge(self.goal_actions[goal], evidence_node, relation="has_record")
        dimensions = []
        for index, name in enumerate(DIMENSIONS):
            goals = [(node.rsplit(":", 1)[-1], observed_graph.nodes[node]["label"])
                     for node in observed_graph.successors(f"career:{career_id}")
                     if observed_graph.nodes[node].get("kind") == "objective"
                     and observed_graph.nodes[node]["dimension"] == index]
            recorded = {key: [observed_graph.nodes[node]["evidence_id"]
                              for node in nx.descendants(observed_graph, f"goal:{career_id}:{key}")
                              if observed_graph.nodes[node].get("kind") == "evidence"] for key, _ in goals}
            observed = sum(bool(recorded[key]) for key, _ in goals)
            ids = {eid for key, _ in goals for eid in recorded[key]}
            dimensions.append({"name": name, "observed": observed, "target": len(goals),
                               "coverage": round(100 * observed / len(goals)),
                               "unknown": not bool(ids), "evidenceCount": len(ids),
                               "missing": [label for key, label in goals if not recorded[key]],
                               "missingObjectiveIds": [key for key, _ in goals if not recorded[key]]})
        return {"careerId": career_id, "scores": [d["coverage"] for d in dimensions],
                "dimensions": dimensions, "evidence": relevant, "version": self.version,
                "scoreMeaning": "교육용 목표의 기록 충족률입니다. 직무 능력·적성·이해도의 검증 점수가 아닙니다.",
                "unavailableVerification": ["전공 조사 확인", "실제 현직자 교류 확인"]}

    def recommend(self, reports, profile_interests):
        result = []
        for cid, report in reports.items():
            missing = {key for d in report["dimensions"] for key in d["missingObjectiveIds"]}
            for kind in ("simulation", "project", "discovery"):
                # No activity in this MVP can verify offline mentor or major evidence.
                candidates = [(key, label) for key, _, label, activity in GOALS
                              if activity == kind and key in missing and not key.endswith("_verified")]
                if not candidates:
                    continue
                goal = f"goal:{cid}:{candidates[0][0]}"
                # Also retain an auditable source route when this objective uses
                # imported task/skill context, without presenting it as scoring.
                source_paths = [nx.shortest_path(self.graph, f"career:{cid}", parent) + [goal]
                                for parent in self.graph.predecessors(goal)
                                if self.graph.nodes[parent].get("kind") in {"task", "skill"}]
                nodes = (source_paths[0] if source_paths else nx.shortest_path(self.graph, f"career:{cid}", goal)) + [self.goal_actions[goal]]
                result.append({"careerId": cid, "kind": kind,
                               "reason": f"{candidates[0][1]}이 아직 없어 이 활동을 제안해요.",
                               "missingObjectives": [label for _, label in candidates],
                               "path": [self.graph.nodes[node].get("labelKo", self.graph.nodes[node]["label"]) for node in nodes],
                               "sourcePath": source_paths[0] if source_paths else [],
                               "priority": len(candidates) + (3 if self.careers[cid]["field"] in profile_interests else 0)})
        return sorted(result, key=lambda item: (-item["priority"], item["careerId"], item["kind"]))
