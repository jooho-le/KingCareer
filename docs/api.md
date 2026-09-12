# KingCareer API 계약

기본 경로는 `/api/v1`입니다. FastAPI 실행 후 `/docs`와 `/openapi.json`에서 현재 입력 제약조건을 확인할 수 있습니다. 구현 기준은 [요청 모델](../backend/models.py), [라우트](../backend/main.py), [프론트 타입](../src/api.ts)입니다.

## 인증과 요청

등록·로그인 응답은 프로필과 `kingcareer_session` 쿠키를 제공합니다. 쿠키는 HttpOnly·SameSite=Lax이며 운영 HTTPS에서는 Secure를 켭니다. 브라우저 요청은 `credentials: "include"`로 보냅니다. 사용자 ID·배우 정보는 서버 세션에서 정합니다. 학생이 다른 학생의 체험 ID를 요청하면 404를 반환합니다.

JSON 본문에는 `Content-Type: application/json`을 사용합니다. 등록 입력은 `username`, `password`, `name`이며 선택 필드는 `school`, `grade`, `region`, `interests`입니다. 아이디는 영문·숫자·밑줄·점·하이픈 3~32자, 새 비밀번호는 8~128자입니다. 아이디는 소문자로 저장합니다. 프로필의 `name`이 화면의 닉네임입니다.

## 엔드포인트

객관식 현장 체험: 다섯 직업의 `compare/act/verify/handover` 명령은 `optionId`를 보내고, 서버의 `fieldwork.options`에서 문장을 결정합니다. 임의의 문장을 선택 기록으로 제출할 수 없습니다. `act`에는 `actionId`도 필요합니다. 회고는 `options.reflection/liked/disliked`에 있는 문장을 선택해 기존 완료 필드로 보냅니다. 읽기 응답에 옵션을 보충하므로 기존 스마트팜 세션도 이어서 사용할 수 있습니다. 이벤트에 선택 ID와 `responseType=choice`를 보관합니다. `fieldwork.visual`은 조치 결과 표현값이고 `coachMode`는 현재 서버의 코치 설정입니다.

다섯 직업 공통 현장 체험 계약입니다. 나머지 경로는 기존 계약을 유지합니다.

| 경로 | 추가 계약 |
| --- | --- |
| `POST /simulations` | 새 세션 모두 `fieldwork` 포함. 동일 직업의 활성 현장 체험을 반환. 이전 텍스트 세션은 별도 보존 |
| `POST /simulations/{id}/turn` | `kind`: `inspect/compare/act/verify/handover` 추가. 조사에는 `objectId`, 조치에는 `actionId`와 `optionId`, 나머지 선택에는 `optionId`. 버전·요청 ID 필수 |
| `GET /simulations/{id}` | `fieldwork`: 단계, 조사 대상·조치, 조사 ID, 시간·자원·온도, 비교·조치·검증·인계, 일지·엔딩 |
| `PUT /projects/{id}/draft` | 선택 `scene: {elements, appState}`. 생략은 기존 그림 유지, 명시한 `null`은 제거. 텍스트와 같은 버전으로 저장 |
| `GET /projects/{id}/revisions` | 각 버전의 `answers`, `scene`, `date` |
| `POST /projects/{careerId}/submit` | 세 설명 각각 10자 이상과 배치도 요소 필요. 활동에 제출 당시 scene과 배지 저장 |
| `GET /achievements` | 본인의 `{certificates, badges, availableBadges}`. 획득 배지에 `criteriaVersion/evidenceSources` 포함 |
| `GET /portfolio/{activityId}/artifact` | 본인 활동 JSON 다운로드, 제출 배치도 포함 |
| `POST /portfolio/{activityId}/evaluate` | `{clientRequestId}`. 본인 제출 프로젝트의 Gemini 텍스트 피드백. 실패는 503, 제출 기록 보존. 이미 성공한 활동은 기존 피드백 반환 |

`inspect`는 고유 대상별 한 번만 시간을 차감하며 이해 목표에 가산하지 않습니다. 비교·조치·재확인이 `scenario_0/1/2` 기록을 만듭니다. `fieldwork.schema`는 스마트팜의 `smartfarm-v1` 또는 `{careerId}-fieldwork-v1`입니다. 네 직업은 `presentation`에 필수 조사 대상·가상 지표·프로젝트 안내를, `metricValue`에 현재 가상 수치를 제공합니다. 스마트팜은 기존 `temperature`를 유지합니다. `003_simulation_variants.sql`은 `classic`과 `fieldwork` 활성 세션을 분리합니다. 그림 저장 본문 한도는 600KB, 배치도는 250개 요소·직렬화 500KB입니다. 평가 상태 `ai_feedback`는 텍스트 코치 응답이며 정답·직무 역량 인증이 아닙니다.

`공개`로 표시한 경로 외에는 학생 세션이 필요합니다. 로그아웃은 쿠키가 없어도 완료됩니다.

| 메서드·경로 | 본문 또는 응답 |
| --- | --- |
| `GET /catalog` · 공개 | `{careers: Career[]}`; 직업·프로젝트·시나리오·출처 |
| `POST /auth/register` · 공개 | 가입 입력; `201 Profile`과 세션 쿠키 |
| `POST /auth/login` · 공개 | `{username, password}`; `Profile`과 세션 쿠키 |
| `POST /auth/logout` | `{ok: true}`; 현재 세션 만료 |
| `POST /auth/password` | `{currentPassword, newPassword}`; 모든 기존 세션을 만료하고 현재 브라우저 세션 교체 |
| `DELETE /auth/account` | `{password}`; 본인 계정·기록·체크포인트 삭제 |
| `PATCH /profile` | 이름·학교·학년·지역·관심분야·`notifications` 중 변경할 필드; `Profile` |
| `PUT /saved/{careerId}` | `{saved: boolean}`; 최종 저장 상태 |
| `GET /state` | `AppState`; 프로필·저장 직업·활동·점수·관심도·초안·경험지도·추천 |
| `DELETE /records` | 본인 학습 기록·체크포인트 삭제; 프로필과 저장 직업 유지 |
| `POST /diagnoses` | `{careerId, answers: number[6], clientRequestId}`; `Activity` |
| `POST /experience-events` | `{careerId, kind, text?, clientRequestId}`; `ExperienceEvidence` |
| `GET /experience-map` | 직업 ID를 키로 한 `GapReport` 객체 |
| `GET /recommendations` | `Recommendation[]` |
| `POST /simulations` | `{careerId}`; 진행 중 세션 재사용 또는 새 `SimulationSession` |
| `GET /simulations/{id}` | 본인의 `SimulationSession` |
| `POST /simulations/{id}/turn` | `{kind, choiceIndex?, text?, expectedVersion, clientRequestId}`; 갱신된 세션 |
| `POST /simulations/{id}/complete` | `{reflection, liked?, disliked?, interest, expectedVersion, clientRequestId}`; `{session, activity}` |
| `GET /projects/{careerId}` | `{careerId, answers: string[3], version}` |
| `PUT /projects/{careerId}/draft` | `{answers: string[3], expectedVersion, clientRequestId}`; 갱신된 초안 |
| `POST /projects/{careerId}/submit` | `{interest, expectedVersion, clientRequestId}`; `Activity` |
| `GET /projects/{careerId}/revisions` | `{version, answers, date}[]`; 최신 수정부터 |
| `GET /portfolio/export` | 본인의 UTF-8 텍스트 포트폴리오 |
| `GET /experience-events/export` | 본인의 xAPI Statement JSON |

진단 응답은 질문 순서대로 0~2를 보냅니다. `interest`는 1~5이며 경험목표 충족률과 독립적으로 기록합니다. 공개 행동 API의 `kind`는 `explored`, `saved`, `questioned`로 제한합니다. 완료·목표 충족을 임의로 제출할 수 없습니다.

## 핵심 응답 타입

| 타입 | 주요 필드와 의미 |
| --- | --- |
| `SimulationSession` | `id`, `careerId`, `mode`, `stage`, `step`, `version`, `scenario`, `turns`, `response`, 선택적 `questionReply`·`activityId` |
| `ProjectDraft` | 직업 ID, 공백·줄바꿈을 보존한 세 답변, 서버 버전 |
| `Activity` | `id`, `careerId`, `kind`, `title`, `date`, `answers`, `reflection`, `feedback`, `before`, `after`, 선택적 `interest`·`evaluationStatus` |
| `ExperienceEvidence` | `id`, `careerId`, `kind`, `category`, `objectives`, `text`, `date`, `verified`, `verificationMeaning`, `metadata` |
| `GapReport` | `careerId`, `scores`, `dimensions`, `evidence`, `version`, `scoreMeaning`, `unavailableVerification` |
| `Recommendation` | `careerId`, `kind`, `reason`, `missingObjectives`, 사람이 읽는 `path`; 서버는 감사용 `sourcePath`도 제공 |

`SimulationSession.mode`는 `template` 또는 `ai`, `stage`는 `brief`, `play`, `reflection`, `completed`입니다. `scenario`는 `{title, text, choices}`이며 `response`는 답변 전 `null`, 답변 후 `{answer, response, lesson}`입니다. `turn.kind`는 `start`, `choice`, `free`, `question`, `continue`입니다. 질문은 단계를 진행시키지 않습니다.

경험지도 차원에는 `name`, `observed`, `target`, `coverage`, `unknown`, `evidenceCount`, `missing`, `missingObjectiveIds`가 있습니다. `verified`는 서버가 활동 기록의 존재를 확인했다는 뜻이며 답변의 정답·능력 검증을 뜻하지 않습니다. 현재 근거 분류는 `self_report`, `participation`, `artifact`입니다. 자기보고는 충족률 계산에서 제외합니다.

## 재시도와 버전

진단·행동 이벤트·체험 진행·완료·초안 저장·프로젝트 제출에 `clientRequestId`를 사용합니다. 새 작업에는 새 ID를 만들고, 응답 유실이나 연결 실패로 같은 작업을 재시도할 때는 **동일 ID와 동일 본문**을 다시 보냅니다. 서버는 이미 확정한 작업의 응답을 반환하며 중복 반영하지 않습니다. 같은 ID로 본문을 바꾸면 409입니다.

시뮬레이션 진행·완료와 프로젝트 저장·제출에는 마지막으로 받은 `version`을 `expectedVersion`으로 보냅니다. 재시도 응답 확인 후 버전을 검사하므로 이미 성공했던 같은 요청은 옛 버전으로 재시도해도 원래 응답을 받습니다. 새로운 요청의 버전이 다르면 409입니다. 입력을 유지한 채 최신 상태를 불러와 재시도합니다. 프로젝트 자동 저장은 요청을 직렬화하고 저장 응답을 받은 후 다음 버전을 보냅니다.

같은 프로젝트 버전이나 완료된 체험을 다른 ID로 다시 제출해도 활동을 추가하지 않습니다. 관심도나 내용을 수정한 새 프로젝트 기록은 초안의 새 버전을 제출합니다. 화면은 서버 저장 성공과 목록 새로고침 성공을 구분해야 합니다. 저장 후 목록 갱신이 실패한 경우 이미 저장한 작업을 새 ID로 다시 보내지 않습니다.

## 오류와 AI 상태

| 상태 | 처리 |
| --- | --- |
| 400 | 현재 비밀번호 등 요청 내용을 확인 |
| 401 | 세션·로그인 확인 |
| 403 | 허용된 브라우저 출처 확인 |
| 404 | 본인 기록인지, 직업·체험 ID가 유효한지 확인 |
| 409 | 같은 요청 ID의 본문 또는 최신 버전 확인 |
| 413 / 422 | 본문 크기·필드 제약조건 확인 |
| 429 | 로그인·가입 등 요청 간격 제한 후 재시도 |
| 503 | 저장소·모델 연결 재시도; 이전 입력·세션 상태 유지 |

일반 오류 본문은 `{ "detail": "설명" }`이며 필드 검증 오류의 `detail`은 목록일 수 있습니다. 기본 `template` 모드는 준비된 시나리오를 반환합니다. 자유 답변·제출물을 AI가 채점했다고 표시하지 않습니다. 모델 생성 인터페이스는 별도로 준비했지만 실제 모델 연결 검증과 프로젝트 자동 평가는 포함하지 않습니다.
