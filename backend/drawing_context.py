"""Bounded Excalidraw document structure for text-only coaching.

Bindings are authored document metadata, not computer vision or inferred links.
Deleted objects, external metadata, coordinates and image data are never sent.
"""
from .recovery_project import is_recovery_scene

NODE_LIMIT = 80
EDGE_LIMIT = 80
LABEL_LIMIT = 180


def drawing_context(scene):
    raw = scene.get("elements", []) if isinstance(scene, dict) else []
    if not isinstance(raw, list):
        raw = []
    elements = [e for e in raw if isinstance(e, dict) and not e.get("isDeleted")]
    nodes = [e for e in elements if e.get("type") not in {"arrow", "line"}][:NODE_LIMIT]
    identifiers = {e.get("id"): f"node{index + 1}" for index, e in enumerate(nodes) if isinstance(e.get("id"), str)}
    labels = {}
    for element in elements:
        if element.get("type") == "text" and isinstance(element.get("containerId"), str) and element["containerId"] in identifiers:
            container = element["containerId"]
            labels[container] = (labels.get(container, "") + " " + str(element.get("text", ""))).strip()[:LABEL_LIMIT]
    result_nodes = []
    for element in nodes:
        eid = element.get("id")
        if eid not in identifiers:
            continue
        node = {"id": identifiers[eid], "type": str(element.get("type", "unknown"))[:24]}
        metadata = element.get("customData")
        guide = metadata.get("kingCareerGuide") if isinstance(metadata, dict) else None
        if isinstance(guide, dict):
            text = str(element.get("originalText", element.get("text", ""))).strip()
            node["source"] = "student_edit" if element.get("type") == "text" and text and text != guide.get("originalText") else "provided_guide"
        label = labels.get(eid) or str(element.get("text", ""))[:LABEL_LIMIT]
        if label:
            node["label"] = label
        if isinstance(element.get("containerId"), str) and element["containerId"] in identifiers:
            node["container"] = identifiers[element["containerId"]]
        result_nodes.append(node)

    def endpoint(binding):
        if not isinstance(binding, dict) or not isinstance(binding.get("elementId"), str):
            return None
        return identifiers.get(binding.get("elementId"))

    edges = []
    for element in (e for e in elements if e.get("type") in {"arrow", "line"}):
        if len(edges) >= EDGE_LIMIT:
            break
        edge = {"type": element["type"], "from": endpoint(element.get("startBinding")),
                "to": endpoint(element.get("endBinding")),
                "startArrowhead": element.get("startArrowhead") in ("arrow", "triangle", "triangle_outline"),
                "endArrowhead": element.get("endArrowhead") in ("arrow", "triangle", "triangle_outline")}
        edge_text = " ".join(str(e.get("text", "")) for e in elements
                             if e.get("type") == "text" and e.get("containerId") == element.get("id"))[:LABEL_LIMIT]
        if edge_text:
            edge["label"] = edge_text
        edges.append(edge)
    result = {"nodes": result_nodes, "connections": edges,
            "truncated": len(nodes) < sum(e.get("type") not in {"arrow", "line"} for e in elements)
                         or len(edges) < sum(e.get("type") in {"arrow", "line"} for e in elements),
            "interpretation": "도형 유형, 작성된 글, 명시적 연결 정보만 제공. provided_guide는 제공한 도안이며 학생이 작성한 근거가 아님. student_edit는 도안에서 바꾼 글이며 정답 여부를 뜻하지 않음. null 끝점은 연결 정보 없음이며 연결 실패를 뜻하지 않음. 이미지·시각적 배치·완성도는 분석하지 않음."}
    if is_recovery_scene(scene):
        studio = scene["studio"]
        result["authoredInteraction"] = {
            "kind": "login-recovery", "message": studio["message"],
            "retry": {key: studio["retry"][key] for key in ("label", "target")} if studio["retry"] else None,
            "support": {key: studio["support"][key] for key in ("label", "target")} if studio["support"] else None,
            "preserveInput": studio["preserveInput"],
            "meaning": "학생이 저장한 안내 문구, 버튼 연결과 재시도 설정. 실행 검사 결과나 능력 점수가 아니며 비어 있는 내용은 미작성 상태."}
    return result
