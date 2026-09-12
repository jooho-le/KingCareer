# KingCareer 소개 페이지와 이미지 출처

소개 페이지 `/`는 제공된 `SeedPath Experience.dc.html`을 기반으로 한다. 학생 앱 `/app/`과 HTML 문서 및 React 런타임을 분리했다. 소개 페이지의 체험은 페이지 메모리에서만 동작하며 계정이나 경험 이벤트 API를 호출하지 않는다.

## 원본 보존

원본 위치는 `C:\Users\high2\Downloads\UI 목업 및 데모 페이지 설계\SeedPath Experience.dc.html`이다. 수정 전 파일과 제공된 런타임은 `public/landing/source/`에 바이트 그대로 보관했다. 실제 서비스에 쓰는 `public/landing/support.js` 역시 원본과 동일하다.

| 파일 | SHA-256 |
| --- | --- |
| `source/SeedPath Experience.dc.html` | `e8fbcaf8445d208079e6e5fc4087bb1f24ceca8e85bb8cf3abf41af580d8e578` |
| `source/support.js`, `support.js` | `8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe` |

실제 소개 페이지는 저장소 루트 `index.html`이다. 원본의 여섯 면 CSS 3D 큐브 색·크기·변환, 자동 회전과 스크롤 연동, 고정 문장, 가로 직업 트랙, 선택형 체험 예시, 경험지도, 전북 지역 순서를 유지했다. 원본에 별도 비트맵 직업 이미지는 없으며 큐브는 CSS 요소다.

추가한 내용은 KingCareer 서비스명·메타데이터, 학생 앱 연결, 소형 안내 캐릭터와 마지막 섹션의 확정 캐릭터, 가상 데이터 표시, 모바일 메뉴 처리 및 움직임 줄이기 대응이다. 소개 페이지 자체의 기존 색상은 보존하고 신규 UI 그라데이션을 추가하지 않았다.

`prefers-reduced-motion: reduce`에서는 큐브를 고정하고 자동 문구 변경·대기 연출·스크롤 애니메이션을 중지한다. 고정 문장과 직업 트랙은 문서 흐름으로 표시해 모든 콘텐츠를 읽을 수 있다. 브라우저 설정을 변경하면 페이지를 새로고침하지 않아도 적용한다.

## 실행 자산

소개 페이지의 `support.js`는 원래 React 18.3.1 UMD를 CDN에서 로드한다. 네트워크 상태 때문에 핵심 3D·스크롤 동작이 누락되지 않도록 같은 버전의 UMD 파일을 `public/landing/vendor/`에서 먼저 로드한다. React 전역 객체가 이미 있으면 원본 런타임이 CDN 요청을 생략한다. 학생 앱의 React 버전과는 서로 다른 페이지에서 실행된다.

| 로컬 파일 | 공식 패키지 배포본 | SHA-256 |
| --- | --- | --- |
| `react-18.3.1.production.min.js` | [react 18.3.1 UMD](https://unpkg.com/react@18.3.1/umd/react.production.min.js) | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` |
| `react-dom-18.3.1.production.min.js` | [react-dom 18.3.1 UMD](https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js) | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` |

각 MIT 라이선스 전문은 같은 폴더의 `REACT-LICENSE.txt`, `REACT-DOM-LICENSE.txt`에 포함했다. 원본의 Pretendard·IBM Plex Mono 글꼴은 기존 외부 링크를 유지하며, 연결되지 않으면 시스템 글꼴로 표시한다. 지원 런타임은 신뢰할 수 있는 로컬 템플릿 코드만 해석한다.

## 브랜드 이미지

제공된 `reference_image/KingCareerLLM_assets_v1`에서 다음 폴더를 `public/brand/`로 복사했다. SVG와 PNG는 원본 파일 바이트를 유지하며 실제 UI는 HTML 버튼·입력창을 사용한다.

| 용도 | 경로 |
| --- | --- |
| 브랜드 아바타 | `/brand/00_brand/brand_avatar.png` |
| 큰 캐릭터 | `/brand/01_mascots/mascot_00_original.png` |
| 작은 포즈·표정 | `/brand/01_mascots/mascot_01_explore.png` ~ `mascot_08_guide.png`, `/brand/02_expressions/` |
| 기능 아이콘 | `/brand/03_icons/` |
| 기능 소개 그림 | `/brand/04_feature_illustrations/` |
| 직업 그림 | `/brand/05_career_illustrations/` |
| 작은 직업 썸네일 | `/brand/06_generated_card_art/` |
| 상태·배지 | `/brand/07_status/`, `/brand/08_badges/` |
| 배경 | `/brand/11_backgrounds/` |

캐릭터 옷과 원본 이미지 안의 `KingCareerLLM` 문구는 그대로 보존한다. 앱의 문서 제목·메뉴·텍스트 서비스명은 KingCareer를 사용한다. 파비콘은 제공된 `10_decorations/crown_blue.svg` 원본이다. 원본 에셋 설명과 전체 목록은 `public/brand/README_KO.md`, `manifest.json`에 함께 보관했으며 시안용 UI 이미지·일반 장식 폴더는 앱 배포 자산에서 제외했다.

## 링크와 사용자 확인

소개 페이지의 시작하기는 `/app/#onboarding`, 계정 연결은 `/app/#auth`, 직업 둘러보기는 `/app/#discovery`, 각 직업 체험은 `/app/#simulation?career=<id>`, 내 지도는 `/app/#map`, 지역 목록은 `/app/#region`으로 연결한다. 기존 `/#home`, `/#diagnosis` 등 알려진 학생 앱 북마크는 경로와 쿼리를 보존해 `/app/`으로 이동한다. 소개 페이지 내부 이동 버튼은 기존 스크롤 동작을 유지한다.

테스트는 사용자 확인으로 남긴다. 원본과 큐브·스크롤·섹션 순서를 비교하고, 다섯 직업 CTA, 학생 앱 이동 후 뒤로 가기, 모바일 폭, 운영체제의 움직임 줄이기 설정을 확인한다. 소개 페이지에서 체험을 진행해도 로그인 계정의 포트폴리오에 활동이 생기지 않아야 한다.
