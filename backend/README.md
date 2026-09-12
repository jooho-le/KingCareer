# KingCareer 학생 백엔드

FastAPI, SQLite, Argon2, NetworkX, LangGraph로 동작합니다. GPU나 모델 설치는 필요하지 않습니다. 테스트와 서버 실행은 이번 작업에서 수행하지 않았으며 아래 절차는 사용자 실행용입니다.

## Windows 실행

저장소 루트의 PowerShell에서 실행합니다. Python 3.11 이상을 사용합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
if (-not (Test-Path -LiteralPath 'backend/.env')) {
    Copy-Item -LiteralPath 'backend/.env.example' -Destination 'backend/.env'
}
.\.venv\Scripts\python.exe -m backend.scripts.init_db
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

별도 PowerShell에서 `npm run dev`로 프론트엔드를 실행한 후 `http://127.0.0.1:5173/app/`에 접속합니다. 소개 페이지는 `/`, 앱은 `/app/`입니다. Vite `/api` 프록시를 통해 같은 출처의 HttpOnly 세션 쿠키를 사용합니다. `localhost`와 `127.0.0.1`을 섞어서 사용하지 않습니다.

배포용은 `npm run build` 후 위 FastAPI 명령으로 실행합니다. FastAPI는 `dist/index.html`, `dist/app/index.html`, 관련 에셋을 제공합니다. 운영 HTTPS 주소를 `KINGCAREER_PUBLIC_ORIGIN`, `KINGCAREER_ALLOWED_ORIGINS`에 설정하고 `KINGCAREER_COOKIE_SECURE=true`로 변경합니다. 와일드카드 출처는 사용하지 않습니다.

SQLite와 LangGraph 동기화를 위해 **한 worker로 실행**합니다. `--workers`를 늘리지 않습니다. `--reload`는 로컬 개발에만 사용합니다. 소규모 단일 서버를 위한 구현이며 분산 배포용 DB 구성은 포함하지 않습니다.

## 저장과 복원

- 기본 저장 위치는 `backend/storage/kingcareer.db`, `backend/storage/checkpoints.db`입니다. 최초 시작에서도 마이그레이션을 자동 적용합니다.
- 계정, 해시된 세션 토큰, 학생 프로필, 저장 직업, 진단, xAPI 이벤트, 활동, 프로젝트 초안·수정 이력, 멱등 요청, 시뮬레이션 상태를 저장합니다. 초기 가상 학생을 생성하지 않습니다.
- 비밀번호는 Argon2로 저장합니다. 세션은 HttpOnly·SameSite=Lax 쿠키로 전달하고 서버에서 만료·소유자를 확인합니다. 비밀번호 변경 시 기존 세션을 모두 무효화하고 현재 브라우저에 새 세션을 부여합니다.
- 모든 학생 데이터 쿼리는 로그인한 서버 계정 ID로 제한합니다. 배우 ID·점수·완료 상태를 클라이언트가 정할 수 없습니다.
- `kingcareer.db`의 세션 JSON이 최종 원본입니다. 그래프 체크포인트 저장 후 본 DB 트랜잭션이 실패하면 다음 명령에서 원본 상태를 다시 주입합니다. 서버 시작 시 원본으로 체크포인트를 복구하고 삭제된 세션의 고아 체크포인트를 정리합니다.
- 계정·기록 삭제는 본 DB의 트랜잭션 안에서 체크포인트 삭제를 먼저 완료한 뒤 본 DB를 커밋합니다. 체크포인트 삭제가 실패하면 본 DB 삭제도 롤백되어 같은 계정으로 재시도할 수 있습니다. 체크포인트만 지워진 뒤 본 DB 커밋이 실패한 경우에는 보존된 원본으로 다음 명령 또는 시작 시 복구합니다. 두 파일의 커밋이 완전히 원자적인 것은 아닙니다.
- 실행 중 두 DB를 파일 복사하지 않습니다. 서버를 종료하고 저장 디렉터리 전체를 백업합니다. 계정·기록 삭제는 되돌릴 수 없으며, 백업 사본에는 과거 기록이 남을 수 있습니다.
- 기존 `itda-career-v1` localStorage 데이터를 가져오거나 삭제하지 않습니다.

## API

실행 후 `/docs`의 OpenAPI 문서에 실제 입력 필드와 제약조건이 표시됩니다. 기본 경로는 `/api/v1`입니다.

| 경로 | 메서드 | 동작 |
| --- | --- | --- |
| `/catalog`, `/regions` | GET | 공개 직업·출처 및 교육용 지역 연결 |
| `/auth/register`, `/auth/login`, `/auth/logout` | POST | 학생 계정과 세션 |
| `/auth/password` | POST | 비밀번호 변경과 세션 교체 |
| `/auth/account` | DELETE | 비밀번호 확인 후 본인 계정·기록 삭제 |
| `/profile` | PATCH | 프로필·관심분야·알림 설정 저장 |
| `/saved/{careerId}` | PUT | 직업 저장/해제 |
| `/state` | GET | 프로필·활동·기록 충족률·초안·추천 |
| `/records` | DELETE | 본인의 학습 기록 초기화, 프로필·저장 직업 유지 |
| `/diagnoses` | POST | 6개 진단 응답(0~2)을 자기보고 기록으로 저장 |
| `/experience-events` | POST | 탐색·저장·질문 이벤트 |
| `/experience-map`, `/recommendations` | GET | 근거가 있는 경험지도와 추천 이유 |
| `/simulations` | POST | 직업별 진행 중 체험 이어하기 또는 신규 시작 |
| `/simulations/{id}` | GET | 본인 체험 상태 조회 |
| `/simulations/{id}/turn` | POST | 시작·선택·자유 답변·질문·다음 상황 |
| `/simulations/{id}/complete` | POST | 회고와 관심도를 저장하고 완료 |
| `/projects/{careerId}` | GET | 서버 초안과 버전 |
| `/projects/{careerId}/draft` | PUT | 초안 자동 저장 및 수정 이력 |
| `/projects/{careerId}/submit` | POST | 현재 버전 결과물 제출 |
| `/projects/{careerId}/revisions` | GET | 본인 초안 수정 이력 |
| `/portfolio/export` | GET | UTF-8 텍스트 다운로드 |
| `/experience-events/export` | GET | 본인의 xAPI Statement JSON 다운로드 |

변경 요청에는 `clientRequestId`를 보냅니다(계정·프로필·저장직업 및 체험생성 제외). 같은 ID·본문의 재시도는 원래 응답을 반환하며 같은 ID에 다른 내용은 409입니다. 프로젝트·체험에는 `expectedVersion`도 보내고 버전 충돌은 409입니다. 같은 프로젝트 버전을 다른 요청 ID로 제출해도 동일 활동을 반환합니다. 체험 완료를 반복해도 새 활동을 만들지 않습니다.

진단 활동의 `answers`는 `직무 이해: 영상이나 글에서 접해봤어요`처럼 한국어 영역·응답을 저장해 포트폴리오와 내보내기에 표시합니다. 원래 0~2 정수 응답은 진단 테이블, 활동 `selfReport`, 이벤트 메타데이터에 별도로 보존합니다.

오류는 `{ "detail": "설명" }` 형식입니다. 401은 재로그인, 409는 버전/멱등 충돌, 422는 입력값 오류, 429는 요청 간격 제한, 503은 저장소/모델 재시도를 의미합니다. Pydantic 검증 오류의 `detail`은 필드별 목록일 수 있습니다.

프로필의 `notifications`는 환경설정만 저장합니다. 이메일·푸시 전송 기능은 없습니다. 아이디 찾기·이메일 복구·소셜 로그인·교사 권한은 포함하지 않습니다.

## 경험 분석과 AI 상태

`experience_graph`는 웹/DB 의존성이 없는 NetworkX 모듈입니다. 목표의 고유 기록 충족률을 계산하고 그래프 경로로 추천 이유를 반환합니다. 목표와 해석은 [Gap Engine 문서](experience_graph/README.md)를 참조합니다.

`KINGCAREER_AI_MODE=template`이 기본입니다. 시뮬레이션 응답은 카탈로그의 준비된 분기이고 자유 답변·질문은 기록합니다. 프로젝트 제출물과 자기보고를 내용 평가 점수로 바꾸지 않습니다. 활동에는 `evaluationStatus=not_connected`가 표시됩니다.

추후 `KINGCAREER_AI_MODE=ai`, `KINGCAREER_AI_URL=https://server/v1`, `KINGCAREER_AI_MODEL`, `KINGCAREER_AI_KEY`를 설정하면 `inference.py`의 생성 인터페이스를 사용합니다. vLLM 호환 Chat Completions 형식입니다. 직업·현재 상황·응답만 전달하며 계정/학교 정보는 전달하지 않습니다. 프로젝트 평가 인터페이스도 분리되어 있지만 자동 연결하지 않았습니다. 이 경로는 실모델로 검증하지 않았습니다. 실패 시 체험 진행·경험 이벤트를 확정하지 않고 503을 반환합니다.

## 데이터 준비와 출처

5개 직업의 카탈로그와 실제 출처 스냅샷이 `data/careers.json`, `data/sources.json`에 포함되어 있어 첫 실행에 다운로드하지 않습니다. 카탈로그와 한국어 목표는 KingCareer의 교육용 편집 내용입니다. 기존 시나리오는 원래 프론트엔드의 작성 콘텐츠를 기계적으로 추출한 뒤 자체 데이터로 보관합니다.

명시적으로 출처를 새로 수집할 때만 실행합니다. 학생 DB에는 영향을 주지 않습니다.

```powershell
.\.venv\Scripts\python.exe backend/scripts/fetch_sources.py
```

| 서비스 직업 | ESCO 공식 직업 | O*NET 31.0 |
| --- | --- | --- |
| 앱 개발자 | software developer | 15-1252.00 |
| 간호사 | nurse responsible for general care | 29-1141.00 |
| 스마트팜 전문가 | agricultural engineer (교육용 연계) | 17-2021.00 |
| 모빌리티 엔지니어 | automotive engineer | 17-2141.02 |
| 식품 연구원 | food technologist | 19-1012.00 |

[ESCO API](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api)에서 실제 직업 URI와 필수 역량 관계를 수집했습니다. ESCO 버전 지정 요청은 수집 시 오류를 반환하여 기본 API 응답과 수집 시각을 저장했습니다. 응답에 버전이 없으므로 최신 버전으로 표시하지 않습니다. [공식 API 설명](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api)의 기본 버전 설명과 응답 버전은 구분합니다. 재사용 정책: [Use ESCO](https://esco.ec.europa.eu/en/use-esco).

O*NET OnLine by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. KingCareer has modified this information. USDOL/ETA has not approved, endorsed, or tested these modifications. [O*NET 31.0 다운로드](https://www.onetcenter.org/database.html), [이용 조건](https://www.onetcenter.org/license_db.html).

인용한 직업 데이터는 미국/유럽 분류입니다. 한국 지역산업·학과·학생 역량 기준에 대한 공식 인증이나 일대일 대응을 뜻하지 않습니다. 각 원본 ID·영문 라벨·수집 시각·업무 원문·이용 조건·한국어 편집 설명을 함께 보관합니다.

사용 OSS: [FastAPI](https://github.com/fastapi/fastapi) MIT, [NetworkX](https://github.com/networkx/networkx) BSD-3-Clause, [LangGraph](https://github.com/langchain-ai/langgraph) MIT, [Argon2-cffi](https://github.com/hynek/argon2-cffi) MIT. [xAPI](https://github.com/adlnet/xAPI-Spec)는 경험 기록의 표준으로 사용하며 외부 LRS나 완전한 LRS 적합성을 주장하지 않습니다. PostgreSQL·pgvector·임베딩·모델 가중치는 설치하지 않습니다.

## 사용자 확인 항목

테스트를 작성하거나 실행하지 않았습니다. 실행 후 두 개의 별도 브라우저 계정으로 다음을 확인합니다.

1. 가입·로그인·재접속, 프로필 저장, 비밀번호 변경 후 다른 세션 만료.
2. 다른 학생의 체험 ID를 입력했을 때 404, 두 계정의 기록·초안·다운로드 분리.
3. 같은 요청 번호 반복과 같은 프로젝트 버전 반복 제출에서 활동/점수 중복 없음.
4. 프로젝트 자동 저장 실패 시 완료 표시 금지, 충돌 시 사용자 입력 유지 및 최신 버전 재시도.
5. 선택 결과 표시 후 다음 상황, 질문은 같은 단계 유지, 새로고침/서버 재시작 후 이어하기.
6. 완료 후 회고·관심도 저장, 다시 체험 시 새 세션, 서버 저장 기록과 포트폴리오 일치.
7. 자기보고·제출물·가상체험·현직자 교류의 구분, AI 미연결 표시, 기록 충족률 근거.
8. 학습 기록 삭제 후 프로필 유지, 계정 삭제 후 로그인 차단 및 두 DB의 기록 제거.

기존 브라우저 테스트는 localStorage·가상 교사·루트 학생 앱·고정 점수 증가에 의존했다면 변경이 필요합니다. 새 경로 `/app/`, 실제 서버 계정, 세션 쿠키, 교육용 기록 충족률, 템플릿 체험으로 기대값을 변경해야 합니다.
