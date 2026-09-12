import json
from fastapi import HTTPException
from .config import ROOT
from .workplaces import WORKPLACES

CAREERS = json.loads((ROOT / "backend/data/careers.json").read_text(encoding="utf-8"))
SOURCES = json.loads((ROOT / "backend/data/sources.json").read_text(encoding="utf-8"))
for item in CAREERS:
    if item["id"] in WORKPLACES:
        project = WORKPLACES[item["id"]]["project"]
        item["project"] = project["title"]
        item["problem"] = project["brief"]
        item["missions"] = project["hints"]
BY_ID = {c["id"]: c for c in CAREERS}
FIELDS = [c["field"] for c in CAREERS] + ["아직 모르겠어요"]
DIAGNOSIS_ANSWERS = [
    ("직업 인식", ["이름을 처음 들어봤어요", "이름과 하는 일을 조금 알아요", "다른 사람에게 하는 일을 설명할 수 있어요"]),
    ("직무 이해", ["아직 잘 모르겠어요", "영상이나 글에서 접해봤어요", "업무 과정과 판단의 이유를 설명할 수 있어요"]),
    ("활동 경험", ["아직 관련 활동을 해보지 않았어요", "짧은 체험이나 연습을 해봤어요", "직접 프로젝트 결과물을 만들어봤어요"]),
    ("역량 이해", ["어떤 역량이 필요한지 모르겠어요", "필요한 역량을 한두 가지 알아요", "역량을 실제 업무와 연결해서 설명할 수 있어요"]),
    ("학과 이해", ["관련 과목이나 전공을 아직 몰라요", "관련된 과목이나 전공 이름을 알아요", "관련 전공의 수업 내용을 살펴봤어요"]),
    ("현직자 교류", ["아직 직접 대화한 적은 없어요", "강연이나 온라인 만남에 참여했어요", "현직자에게 직접 질문하고 대화했어요"]),
]

def career(career_id):
    if career_id not in BY_ID:
        raise HTTPException(404, "존재하지 않는 직업이에요.")
    return BY_ID[career_id]


def catalog():
    result = []
    for c in CAREERS:
        details = SOURCES["careers"][c["id"]]
        esco, onet = details["esco"], details["onet"]
        result.append({**c, "sources": [
            {"source": "ESCO", "id": esco["uri"], "url": esco["sourceUrl"], "version": esco["version"],
             "license": "European Commission reuse policy", "label": esco["title"]},
            {"source": "O*NET", "id": onet["code"], "url": onet["sourceUrl"], "version": onet["version"],
             "license": onet["license"], "label": onet["occupation"].get("Title", onet["code"])}
        ], "sourceDetails": details})
    return result
