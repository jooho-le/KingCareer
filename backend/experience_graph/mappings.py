"""Reviewed teaching context links, not official equivalence or skill assessment.

IDs come from data/sources.json. Korean labels are KingCareer paraphrases.
Each career uses three selected O*NET tasks and two selected ESCO skills.
"""
CONTEXT = {
    "developer": {
        "tasks": [("21662", "사용자 요구와 개발 조건 분석"), ("21664", "팀과 설계 조건 협의"), ("21669", "소프트웨어 검증 절차")],
        "skills": [("d9e5349e-8791-49c2-8ba4-839fdd1606c2", "필요한 기능과 조건 정의"), ("4fabca9a-7435-4f33-b1da-3cdb00340fdc", "근거를 통한 조사")],
    },
    "nurse": {
        "tasks": [("1843", "의료팀과 소통하고 협력"), ("1839", "정확한 기록과 인계"), ("1843", "적절한 담당자와 협의")],
        "skills": [("7110bf9f-b245-4adc-9159-5081013fd64d", "이해하기 쉬운 의료 소통"), ("a46743b7-ff8c-49b6-99f7-7fa5bc241771", "간호 기록의 활용")],
    },
    "farmer": {
        "tasks": [("5338", "농업 환경의 측정 장치"), ("5327", "장비 성능 확인"), ("5331", "현장 관계자와 개선안 협의")],
        "skills": [("42b23922-1c40-4dbe-9e0c-7a568dfdf06b", "설계 개선"), ("4fabca9a-7435-4f33-b1da-3cdb00340fdc", "근거를 통한 조사")],
    },
    "engineer": {
        "tasks": [("16437", "사용자 조건과 이동수단 설계"), ("16436", "요구 성능에 맞춘 설계 개선"), ("16433", "자동차 설계 검토")],
        "skills": [("42b23922-1c40-4dbe-9e0c-7a568dfdf06b", "설계 개선"), ("4fabca9a-7435-4f33-b1da-3cdb00340fdc", "근거를 통한 조사")],
    },
    "researcher": {
        "tasks": [("18611", "소비자 의견으로 식품 기획"), ("7485", "제품 특성 비교"), ("7489", "식품 특성 개선 연구")],
        "skills": [("486e0580-470f-42a2-bd6d-ec940c239a9b", "포장 요구 분석"), ("f6fcc895-3dfc-4b00-bb83-348e3c9c72e1", "식품 관련 데이터 해석")],
    },
}
