# Gemini 3.5 Flash-Lite 배포 확인

2026-09-13, 코드 커밋 `ea7eae8`을 `main`에 푸시하고 Vercel production으로 배포했습니다. 로컬 `.env`, 운영 환경변수와 공개 설정 예시의 모델을 `gemini-3.5-flash-lite`로 맞췄습니다. 실제 키와 환경 파일은 공개하지 않습니다.

- 운영 주소: https://kingcareer.vercel.app/app/
- 배포 ID: `dpl_2SXjheKU2pZQw5P2vnQNvoEGbYiB`
- `npm.cmd run build` 성공. 큰 청크 경고는 남아 있습니다.
- `tests/backend_review_test.py`: 12개 통과. 임시 DB·모의 AI 회귀 검사입니다.

## 실제 앱 API 호출

가상 계정 가입→초안 저장→도움말→제출→평가→회고→초안 재조회→계정 삭제 순서로 진행했습니다. 아래 AI 요청은 모의 응답이 아닙니다.

| 검사 | 로컬 | 공개 운영 사이트 |
| --- | --- | --- |
| 프로젝트 도움말 | 200 / ai, 1.52초 | 200 / ai, 11.67초 |
| 포트폴리오 평가 | 200 / ai_feedback, 2.02초 | 200 / ai_feedback, 12.05초 |
| 진로 회고 생성 | 200 / ai, 2.00초 | 200 / ai, 8.04초 |
| 초안 글·그림 보존 | 확인 | 확인 |
| 임시 계정 삭제 | 200 | 200 |

운영 `/`, `/app/`, `/api/v1/health`도 HTTP 200을 반환했습니다. 시간은 앱 전체 요청 시간이며 모델 추론 시간만을 뜻하지 않습니다. 단일 가상 계정의 검사로 동시 부하나 장기 안정성을 보장하지 않습니다.

[운영 호출 로그](logs/flash-lite-rollout-qa.jsonl)에 HTTP 상태·시간·보존·삭제 결과를 공개합니다. 로그의 configuration 행은 검사 클라이언트의 로컬 설정입니다. 운영 모델 설정은 Vercel 환경변수 갱신 성공과 이후 production 배포로 확인했습니다. 로컬 호출 로그 파일은 운영 검사를 실행하며 덮어써졌으므로, 로컬 수치는 당시 도구 실행 결과를 정리한 것입니다.

새 제출물의 `mode=template`·`evaluationStatus=not_connected`는 기존 제출 상태 표현입니다. 평가 요청 이후 `evaluationStatus=ai_feedback`을 확인했으며 이 표시 문제는 별도 개선 항목으로 남아 있습니다.
