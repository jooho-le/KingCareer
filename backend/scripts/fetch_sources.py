"""Refresh a small, attributed source snapshot. No database/model is needed.

Run from the repository root: python backend/scripts/fetch_sources.py
This is deliberately an explicit maintenance command, never run on app startup.
"""
import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

TARGETS = {
    "developer": ("f2b15a0e-e65a-438a-affb-29b9d50b77d1", "15-1252.00", "사용자 요구 분석과 소프트웨어 개선 업무를 참고합니다."),
    "nurse": ("8d3e8aaa-791b-4c75-a465-f3f827028f50", "29-1141.00", "환자와의 소통·기록·협업 업무 중 비임상 활동을 참고합니다."),
    "farmer": ("4d5bd738-9202-4fd7-bd8c-7dbe914048de", "17-2021.00", "농업공학의 측정·환경·장비 업무를 스마트팜 교육 맥락으로 편집합니다. 스마트팜 전문가와 동일한 직업 분류는 아닙니다."),
    "engineer": ("8d410283-865d-4cbb-acae-ac7f69d9cf26", "17-2141.02", "자동차 설계·사용자 조건·검증 업무를 이동수단 기획 활동으로 편집합니다."),
    "researcher": ("4b709f9e-6112-4d58-81b0-2d6e6a69d61b", "19-1012.00", "식품 개발·조사·비교·기록 업무를 조리 없는 기획 활동으로 편집합니다."),
}


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "KingCareer-source-import/1.0"}), timeout=60) as result:
        return result.read().decode("utf-8-sig")


def main():
    base = "https://www.onetcenter.org/dl_files/database/db_31_0_csv/"
    tasks = list(csv.DictReader(io.StringIO(fetch(base + "task_statements.csv"))))
    occupations = list(csv.DictReader(io.StringIO(fetch(base + "occupation_data.csv"))))
    print("O*NET columns:", list(tasks[0]))
    collected = datetime.now(timezone.utc).isoformat()
    snapshot = {"collectedAt": collected, "schemaVersion": 1, "careers": {}}
    for career_id, (esco_id, onet_id, editorial) in TARGETS.items():
        uri = f"http://data.europa.eu/esco/occupation/{esco_id}"
        url = "https://ec.europa.eu/esco/api/resource/occupation?" + urlencode({"uri": uri, "language": "en"})
        raw = json.loads(fetch(url))
        skills = [{"uri": s["uri"], "title": s["title"], "relationship": "essential"}
                  for s in raw.get("_links", {}).get("hasEssentialSkill", [])]
        code_key = next(k for k in tasks[0] if "code" in k.lower())
        occupation_key = next(k for k in occupations[0] if "code" in k.lower())
        snapshot["careers"][career_id] = {
            "editorialKo": editorial,
            "mappingType": "KingCareer editorial crosswalk; not an official equivalence",
            "esco": {"uri": raw["uri"], "title": raw["title"], "code": raw.get("code"),
                     "version": "API default snapshot; version not reported by response",
                     "versionNote": "The documentation describes default v1.0.9; selectedVersion requests failed at collection. Do not infer latest version.",
                     "collectedAt": collected, "sourceUrl": url,
                     "licenseUrl": "https://esco.ec.europa.eu/en/use-esco",
                     "attribution": "European Commission, ESCO; English labels and essential-skill relations, edited educational mapping by KingCareer.",
                     "skills": skills},
            "onet": {"code": onet_id, "version": "31.0", "collectedAt": collected,
                     "sourceUrl": f"https://www.onetonline.org/link/summary/{onet_id}",
                     "downloadUrl": base + "task_statements.csv",
                     "license": "CC BY 4.0", "licenseUrl": "https://www.onetcenter.org/license_db.html",
                     "attribution": "O*NET OnLine by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. KingCareer has modified this information. USDOL/ETA has not approved, endorsed, or tested these modifications.",
                     "occupation": next(row for row in occupations if row[occupation_key] == onet_id),
                     "tasks": [row for row in tasks if row[code_key] == onet_id]},
        }
        print(career_id, len(skills), "ESCO skills;", len(snapshot["careers"][career_id]["onet"]["tasks"]), "O*NET tasks")
    path = Path(__file__).resolve().parents[1] / "data" / "sources.json"
    # Replace only after every source is successfully fetched, preserving a usable old snapshot on failure.
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


if __name__ == "__main__":
    main()
