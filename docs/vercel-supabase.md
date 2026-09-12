# Vercel Hobby + Supabase 배포

소개 페이지와 학생 앱은 Vercel의 정적 파일로, `/api/v1`은 Python Function으로 실행한다. Supabase는 PostgreSQL 저장소로 사용한다. 기존 아이디·비밀번호·서버 세션 인증을 유지하며 Supabase Auth로 전환하지 않는다.

## 현재 확인 범위

2026-09-13: [공개 서비스](https://kingcareer.vercel.app), [학생 앱](https://kingcareer.vercel.app/app/) 배포 완료. Supabase 스키마 생성과 원격 빌드를 확인했다. 공개 URL에서 가입, 로그인·로그아웃, 두 계정의 기록 분리, 체험 이어하기, 프로젝트 초안 저장·복원 및 중복 요청 검사를 통과했다. 기존 Gemini 설정은 Vercel Production Secret으로 등록했다. 이 배포 검사에서는 유료/실시간 모델 응답을 별도로 호출하지 않았다. GitHub 자동 연결은 저장소 접근 권한 문제로 완료되지 않아 CLI로 배포했다.

로컬 PostgreSQL에서 백엔드 회귀 12개, 프로젝트 제출 기준 3개, 배포 전용 4개 검사를 통과했다. 배포 전용 검사는 마이그레이션 재실행, RLS 적용, 프로세스 간 AI 요청 잠금, 새 시뮬레이션 엔진에서 상태 복원 및 트랜잭션 롤백, lifespan 없이 들어오는 첫 요청의 초기화를 확인한다. SQLite 회귀 12개도 통과했다.

## 연결 순서

1. Vercel 개인 Hobby 계정에 로그인하고 이 저장소 루트에서 프로젝트를 연결한다. 프레임워크는 Vite다. Supabase에서는 Free 프로젝트를 생성한다.
2. `deployment.env.example`을 `deployment.env`로 복사한다. 이 파일은 Git과 Vercel 업로드에서 제외된다. Supabase의 Connect 화면에서 **Transaction pooler** 연결 문자열을 복사해 `KINGCAREER_DATABASE_URL`에 넣는다. 포트는 6543, `sslmode=require`를 사용한다. 비밀번호의 URL 특수문자는 인코딩한다.
3. 실제 Vercel 프로젝트 주소를 `KINGCAREER_PUBLIC_ORIGIN`과 `KINGCAREER_ALLOWED_ORIGINS`에 설정한다. 키와 DB 비밀번호는 채팅이나 `VITE_` 환경변수에 넣지 않는다.
4. 아래 명령으로 Supabase에 빈 스키마를 만든다. 기존 로컬 학생 계정·기록은 자동 업로드하지 않는다. 로컬 SQLite 파일은 유지된다.
5. Vercel 프로젝트의 Production 환경변수에 `deployment.env`의 설정을 등록한다. Preview도 사용하려면 별도 테스트 DB/스키마를 연결한다. 실사용 DB를 임의의 미리보기 코드와 공유하지 않는다.
6. `npx.cmd vercel@59.16.0 --prod`로 배포한다. 로컬에서 빌드한 `dist`만 업로드하면 백엔드는 배포되지 않는다. 프로젝트 루트에서 실행한다.

```powershell
npx.cmd vercel@59.16.0 login
npx.cmd vercel@59.16.0 link
Copy-Item deployment.env.example deployment.env
# deployment.env를 편집한 뒤 실행한다. 이미 있는 파일을 덮어쓰지 않는다.
.\.venv\Scripts\python.exe scripts/migrate_deployment.py
```

마이그레이션은 기존 테이블을 지우지 않으며 적용한 버전은 다시 실행하지 않는다. DB 생성·연결 설정은 자동으로 유료 플랜을 활성화하지 않는다. 프로젝트 계정과 플랜은 서비스 대시보드에서 확인한다.

## 환경변수

| 이름 | 용도 |
| --- | --- |
| `KINGCAREER_DATABASE_URL` | Supabase 서버 전용 PostgreSQL 연결 문자열. 공개 API 키가 아니다. |
| `KINGCAREER_DATABASE_SCHEMA` | 기본 `kingcareer`. 공개 Data API에 추가하지 않는다. |
| `KINGCAREER_PUBLIC_ORIGIN` | 실제 서비스의 `https://…vercel.app` 주소 |
| `KINGCAREER_ALLOWED_ORIGINS` | 허용할 서비스 주소. 여러 개면 쉼표로 구분 |
| `KINGCAREER_COOKIE_SECURE` | `true`. Vercel에서는 코드에서도 HTTPS 쿠키를 강제한다. |
| `KINGCAREER_AI_MODE` | `template` 또는 `ai` |
| `KINGCAREER_AI_PROVIDER` | `gemini` |
| `KINGCAREER_AI_MODEL` | `gemini-3.5-flash-lite` |
| `KINGCAREER_AI_KEY` | 실제 AI 연결 시 서버에만 등록 |

## 저장과 동시 요청

### 로컬 계정 이전

`python scripts/import_local_accounts.py`는 로컬 SQLite의 일관된 스냅샷을 읽어 실제 INSERT와 내용 대조를 수행한 뒤 롤백하는 사전 검사다. `--apply`를 붙이면 `.local/account-migration/`에 원본 SQLite와 대상 테이블 백업을 저장하고 한 트랜잭션으로 이전한다. 아이디·Argon2 비밀번호 해시·프로필·체험·프로젝트·활동 근거와 이력을 보존한다. 로그인 세션은 복사하지 않으므로 배포 사이트에서 다시 로그인한다. 같은 ID로 이미 이전된 계정은 건너뛰고, 다른 계정과 아이디가 충돌하면 전체 이전을 중단한다. 이후 로컬과 배포 데이터가 자동 동기화되는 것은 아니다.

2026-09-13 로컬 계정 1개와 체험 10개, 프로젝트 초안 5개, 활동 3개, 경험 이벤트 57개, 수정 이력 40개, 회고 2개, 중복 요청 기록 112개를 이전했다. 모든 이전 행의 내용 일치와 재실행 시 중복 삽입 방지를 확인했다.

- PostgreSQL에서는 `simulations.state`를 진행 상태의 기준으로 사용한다. LangGraph는 이 전체 상태를 입력받으며 별도의 SQLite 체크포인터를 만들지 않는다. 상태·버전·행동 근거·중복 요청 응답은 같은 DB 트랜잭션에 저장한다.
- 기존 로컬 실행은 SQLite와 SQLite 체크포인터를 계속 사용한다. 환경변수가 없으면 로컬 방식으로 실행되지만 Vercel에서는 DB 설정 누락 시 실행을 거부한다.
- Supabase transaction pooler에 맞춰 prepared statement를 끈다. 짧은 쓰기·읽기 트랜잭션을 advisory lock으로 직렬화해 기존 데이터 처리 순서를 보존한다. 동시 사용자가 많아지면 사용자별 잠금과 세밀한 트랜잭션으로 개선할 필요가 있다.
- AI 평가·힌트 요청은 DB에 만료되는 잠금을 저장해 여러 Function 인스턴스에서 중복 실행을 제한한다. 모델 응답을 기다리는 동안 DB 트랜잭션은 열어 두지 않는다.
- 비공개 스키마의 테이블에 RLS를 켜고 `anon`·`authenticated` 권한을 제거한다. 서버는 테이블 소유자 연결로 접근하고 기존 API의 사용자 소유권 검사를 수행한다. 브라우저에서 DB에 직접 접근하지 않는다.

## 배포 후 확인

소개 `/`, 앱 `/app/`, `/api/v1/health` 라우팅을 확인한다. 서로 다른 두 테스트 계정으로 가입·로그인·저장 직업·프로젝트 저장·중복 제출·로그아웃을 확인하고, 새로고침 후 체험 복원 및 타인 기록 접근 차단을 확인한다. AI 모드에서는 별도로 실제 힌트와 평가 요청을 확인한다. 확인용 계정과 기록은 검사가 끝난 뒤 삭제한다.

공식 문서: [Vercel Python Functions](https://vercel.com/docs/functions/runtimes/python), [Supabase PostgreSQL 연결](https://supabase.com/docs/guides/database/connecting-to-postgres).
