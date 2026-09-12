# OSS와 데이터 출처

## 실제 사용하는 구성

| 기술 | KingCareer에서의 역할 | 공식 자료 |
| --- | --- | --- |
| xAPI | 탐색·질문·선택·완료·회고를 Statement 형태로 기록·내보내기 | [공식 사양](https://github.com/adlnet/xAPI-Spec) |
| ESCO | 직업과 필수 역량의 원본 URI·라벨·관계 제공 | [공식 API](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api) |
| O*NET | 직업별 업무 설명과 실제 업무 항목의 출처 | [데이터베이스](https://www.onetcenter.org/database.html) |
| NetworkX | 직업·원본 자료·교육용 목표·활동·학생 기록을 그래프로 연결하고 공백·추천 경로 계산 | [공식 문서](https://networkx.org/documentation/stable/) |
| LangGraph | 직무체험의 분기·상태와 SQLite 체크포인트 관리 | [공식 문서](https://docs.langchain.com/oss/python/langgraph/overview) |
| FastAPI·SQLite | 학생 인증·API·서버 데이터 저장 | [FastAPI](https://github.com/fastapi/fastapi), [SQLite](https://sqlite.org/) |
| Argon2-cffi | 비밀번호 해시 | [공식 저장소](https://github.com/hynek/argon2-cffi) |

xAPI는 서버 제품을 설치한 것이 아니라 이벤트 표현 형식을 적용한 것입니다. 현재 출력은 `version: "1.0.3"`이며 최신 사양을 구현했다는 뜻이 아닙니다. ADL 저장소도 1.0.3과 후속 사양을 구분합니다. 외부 LRS와 완전한 LRS 적합성 검증은 포함하지 않습니다. [xAPI 버전 안내](https://github.com/adlnet/xAPI-Spec#specification-versions)

Python 의존성 범위는 [requirements.txt](../backend/requirements.txt), 프론트엔드 설치 버전은 [package-lock.json](../package-lock.json)이 기준입니다. 설치하지 않은 라이브러리를 사용 기술로 표시하지 않습니다. PostgreSQL·pgvector는 제외했고, BGE-M3·Qwen3·vLLM은 이후 모델 연동 후보로 남겼습니다.

## 포함된 데이터

[sources.json](../backend/data/sources.json)은 2026-09-12 수집 스냅샷입니다. ESCO 원본 직업 URI·필수 역량 URI, O*NET 직업 코드·업무 ID·원문, 수집 시각·출처·이용 조건을 저장합니다. [careers.json](../backend/data/careers.json)의 학생용 한국어 설명·시나리오·프로젝트와 [교육용 연결](../backend/experience_graph/mappings.py)은 KingCareer의 편집 내용입니다.

| 서비스 직업 | ESCO 원본 직업 | O*NET 31.0 코드 |
| --- | --- | --- |
| 앱 개발자 | software developer | `15-1252.00` |
| 간호사 | nurse responsible for general care | `29-1141.00` |
| 스마트팜 전문가 | agricultural engineer | `17-2021.00` |
| 모빌리티 엔지니어 | automotive engineer | `17-2141.02` |
| 식품 연구원 | food technologist | `19-1012.00` |

스마트팜과 agricultural engineer를 포함한 연결은 교육용 대응입니다. 미국·유럽의 직업 분류를 한국의 자격·학과·학생 능력 기준과 동일하게 취급하지 않습니다. 전북의 지역산업 연결 역시 교육용 콘텐츠이며 실시간 기업·채용·제휴 데이터가 아닙니다.

ESCO API 수집 응답에는 데이터 버전이 명시되지 않아 `API default snapshot; version not reported by response`로 기록했습니다. 공식 API 문서의 기본 버전 안내와 실제 수집 응답은 구분하며 스냅샷을 최신 데이터라고 표시하지 않습니다. 재사용 조건은 [Use ESCO](https://esco.ec.europa.eu/en/use-esco)에 따릅니다.

O*NET 스냅샷은 31.0을 사용하며 CC BY 4.0 이용 조건을 보관합니다. 자료 출처는 미국 노동부 USDOL/ETA이고, KingCareer가 수정한 내용은 USDOL/ETA가 승인·보증·시험한 내용이 아닙니다. 전체 원문 귀속 표시는 스냅샷의 `attribution`과 [백엔드 문서](../backend/README.md)에 있습니다. [O*NET 이용 조건](https://www.onetcenter.org/license_db.html)

## 데이터 준비와 갱신

5개 직업의 카탈로그와 출처 스냅샷이 저장소에 포함되어 있어 첫 실행에 데이터를 다운로드하지 않습니다. 학생 DB 초기화는 빈 계정·활동 저장 구조를 준비하며 가상 학생을 생성하지 않습니다.

```powershell
.\.venv\Scripts\python.exe -m backend.scripts.init_db
```

원본 자료를 다시 수집하려는 경우에만 아래 명령을 실행합니다. 인터넷 연결이 필요하며 저장소의 출처 스냅샷을 갱신하므로 변경된 원본 ID·버전·교육용 연결을 검토합니다. 학생 DB와 활동 기록은 이 명령의 갱신 대상이 아닙니다.

```powershell
.\.venv\Scripts\python.exe backend/scripts/fetch_sources.py
```

Gap Engine은 웹 서버와 분리한 [독립 패키지](../backend/experience_graph/README.md)입니다. 패키지 코드의 MIT 라이선스는 ESCO·O*NET이나 제공 이미지의 이용 조건을 바꾸지 않습니다. 그래프의 목표는 KingCareer가 정하며 제출물의 존재를 내용의 정확성으로 해석하지 않습니다.

## 소개 페이지와 브랜드 이미지

제공 HTML·`support.js`, 6면 CSS 3D 큐브와 원본 이미지 구성은 [원본 보존 문서](landing-source.md)에 기록했습니다. 앱의 제공 이미지 목록과 크기별 사용 기준은 [브랜드 에셋 안내](../public/brand/README_KO.md)를 따릅니다. 큰 캐릭터는 확정 원본을 쓰고 작은 포즈·표정은 안내용으로 사용합니다. 이미지에 들어 있는 `KingCareerLLM` 글자는 원본 그대로 유지합니다.
