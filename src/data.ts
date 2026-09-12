export type Page =
  | "home"
  | "diagnosis"
  | "map"
  | "simulation"
  | "projects"
  | "discovery"
  | "region"
  | "recommendation"
  | "portfolio"
  | "profile"
  | "onboarding"
  | "auth";
export type CareerId =
  "developer" | "nurse" | "farmer" | "engineer" | "researcher";
export type Tone = "orange" | "purple" | "blue" | "green" | "pink";
export type Scenario = {
  title: string;
  text: string;
  choices: string[];
  responses: string[];
  lesson: string;
};
export type Career = {
  id: CareerId;
  title: string;
  field: string;
  color: Tone;
  region: string;
  intro: string;
  skills: string[];
  majors: string[];
  related: string[];
  project: string;
  problem: string;
  missions: string[];
  scenarios: Scenario[];
};
export const fields = [
  "IT·소프트웨어",
  "의료·보건",
  "농업·스마트팜",
  "자동차·모빌리티",
  "식품·바이오",
  "아직 모르겠어요",
];
export const dimensions = [
  "직업 인식",
  "직무 이해",
  "활동 경험",
  "역량 이해",
  "학과 이해",
  "현직자 교류",
];
export const careers: Career[] = [
  {
    id: "developer",
    title: "앱 개발자",
    field: fields[0],
    color: "purple",
    region: "전주",
    intro: "일상의 작은 불편을, 쓸모 있는 서비스로.",
    skills: ["문제 해결", "사용자 이해", "논리적 사고"],
    majors: ["컴퓨터공학", "소프트웨어학"],
    related: ["UX 디자이너", "서비스 기획자", "데이터 분석가"],
    project: "우리 학교 급식 알리미 만들기",
    problem:
      "친구들이 매일 급식 메뉴를 찾아 헤매요. 한눈에 볼 수 있는 서비스를 기획해 볼까요?",
    missions: [
      "누가, 언제 불편한지 적어보세요.",
      "꼭 필요한 기능 3개와 화면 구성을 설명하세요.",
      "친구에게 어떤 질문으로 아이디어를 확인할까요?",
    ],
    scenarios: [
      {
        title: "회원가입 화면에서 무슨 일이?",
        text: "전주의 작은 앱 개발팀에 합류했어요. 100명 중 60명이 회원가입을 끝내지 않고 나간대요. 무엇부터 알아볼까요?",
        choices: [
          "사용자에게 불편한 점 물어보기",
          "화면을 더 예쁘게 바꿔보기",
          "이탈하는 단계를 데이터로 확인하기",
        ],
        responses: [
          "가상 인터뷰에서 20명 중 12명이 입력할 정보가 너무 많다고 했어요.",
          "색과 배치를 바꿨지만 가상 테스트에서 이탈은 비슷했어요. 사용성을 더 살펴볼까요?",
          "가상 로그를 보니 주소를 입력하는 단계에서 가장 많이 나갔어요.",
        ],
        lesson:
          "문제를 정의할 때 사용자 의견과 데이터를 함께 살펴볼 수 있어요.",
      },
      {
        title: "작은 변화부터 시작해 볼까?",
        text: "팀에 남은 시간은 이틀이에요. 회원가입을 쉽게 만들기 위해 어떤 개선안을 제안할까요?",
        choices: [
          "필수 입력 항목부터 줄이기",
          "모든 화면을 새로 만들기",
          "입력 예시와 안내 문구 추가하기",
        ],
        responses: [
          "꼭 필요한 항목만 남겼어요. 사용자에게 테스트해 볼 준비가 됐어요.",
          "팀에서 이틀 안에 모두 바꾸기는 어렵다고 해요. 핵심 화면 하나로 범위를 좁혔어요.",
          "안내를 추가하니 입력 방법이 명확해졌어요. 과정의 길이도 확인해 봐요.",
        ],
        lesson: "개발자는 일정과 효과를 생각해 작업의 우선순위를 정해요.",
      },
      {
        title: "정말 더 편해졌을까?",
        text: "개선안을 만들었어요. 어떻게 효과를 확인할까요?",
        choices: [
          "이전과 이후의 가입 완료율 비교하기",
          "팀원들의 취향 투표하기",
          "사용자 5명에게 써보게 하고 관찰하기",
        ],
        responses: [
          "같은 조건에서 비교해야 한다는 점을 팀과 확인했어요.",
          "팀의 의견도 좋지만 실제 사용자의 행동을 더 확인하기로 했어요.",
          "관찰하면서 예상하지 못한 불편도 발견했어요.",
        ],
        lesson:
          "좋은 서비스는 만들고, 확인하고, 다시 개선하는 과정에서 자라요.",
      },
    ],
  },
  {
    id: "nurse",
    title: "간호사",
    field: fields[1],
    color: "blue",
    region: "익산",
    intro: "사람의 하루를 가장 가까이에서 돌보는 일.",
    skills: ["공감과 소통", "세심한 관찰", "팀 협력"],
    majors: ["간호학"],
    related: ["보건교사", "작업치료사", "의료사회복지사"],
    project: "처음 방문하는 환자를 위한 안내서",
    problem:
      "병원이 낯선 청소년에게 접수부터 대기까지의 과정을 알려주는 안내서를 기획해요.",
    missions: [
      "처음 방문했을 때 궁금할 질문을 적어보세요.",
      "누구나 이해할 수 있는 안내 문장을 써보세요.",
      "어려운 말과 빠진 안내가 없는지 점검하세요.",
    ],
    scenarios: [
      {
        title: "처음 온 환자의 걱정",
        text: "가상의 지역 병원에서 안내 업무를 함께하고 있어요. 방문자가 접수 장소를 몰라 불안해하고 있어요. 어떻게 도울까요?",
        choices: [
          "무엇이 필요한지 차분하게 묻기",
          "안내문을 읽어보라고 하기",
          "담당 직원에게 함께 안내하기",
        ],
        responses: [
          "방문자가 처음 왔고 예약 확인이 필요하다고 말해요.",
          "안내문이 어려워 보이네요. 이해했는지 다시 물어봐요.",
          "담당 직원과 연결하니 방문자가 안심해요.",
        ],
        lesson: "상대의 상황을 듣고 이해하는 소통이 중요해요.",
      },
      {
        title: "안내 내용을 정리해요",
        text: "다음 교대 담당자에게 방문자의 요청을 전달해야 해요. 무엇을 기록할까요?",
        choices: [
          "요청과 확인한 사실만 간결하게 기록",
          "나의 추측을 자세하게 기록",
          "기억하고 있다가 나중에 말하기",
        ],
        responses: [
          "필요한 정보가 명확하게 정리됐어요.",
          "추측과 확인한 사실을 구분해 다시 정리해요.",
          "빠뜨리지 않도록 정해진 기록 방식으로 남겨요.",
        ],
        lesson: "정확한 기록과 인계는 팀 협력의 바탕이에요.",
      },
      {
        title: "내가 모르는 질문",
        text: "방문자가 약 복용법을 물었어요. 이 체험은 안내와 소통 연습이며 의학적 판단을 하지 않아요. 어떻게 연결할까요?",
        choices: [
          "담당 의료진에게 확인하도록 안내",
          "내 경험으로 답하기",
          "공식 안내를 담당자와 함께 확인",
        ],
        responses: [
          "담당 의료진에게 질문을 전달했어요.",
          "개인 경험을 적용하기보다 담당 의료진의 확인이 필요해요.",
          "담당자와 확인해 정확한 안내를 받을 수 있게 했어요.",
        ],
        lesson:
          "역할의 범위를 알고 적절한 전문가에게 연결하는 것도 역량이에요.",
      },
    ],
  },
  {
    id: "farmer",
    title: "스마트팜 전문가",
    field: fields[2],
    color: "green",
    region: "김제",
    intro: "초록의 가능성에 기술을 더하는 사람.",
    skills: ["데이터 관찰", "가설 세우기", "지속가능성"],
    majors: ["스마트농업학", "생명자원공학"],
    related: ["농업 데이터 분석가", "농업 로봇 개발자", "작물 연구원"],
    project: "우리 동네 스마트 온실 기획하기",
    problem:
      "온실을 자주 살피기 어려운 농부를 위해 어떤 정보를 보여주면 좋을까요?",
    missions: [
      "온실에서 확인할 환경 정보 3개를 골라보세요.",
      "이상한 수치를 발견했을 때 확인 순서를 적으세요.",
      "농부에게 보여줄 알림 메시지를 작성하세요.",
    ],
    scenarios: [
      {
        title: "온실의 숫자가 달라졌어요",
        text: "김제의 가상 스마트 온실이에요. 한 센서의 온도만 갑자기 높아졌어요. 무엇을 확인할까요?",
        choices: [
          "다른 센서와 실제 환경 비교",
          "바로 모든 장치 가동",
          "최근 며칠의 변화 확인",
        ],
        responses: [
          "다른 센서는 평소와 비슷해요. 센서 위치도 살펴봐요.",
          "센서 오류일 수도 있으니 실제 환경을 먼저 확인해요.",
          "오늘 한 센서에서만 급격한 변화가 보이네요.",
        ],
        lesson: "데이터를 해석하기 전에 신뢰할 수 있는지 살펴봐요.",
      },
      {
        title: "원인을 좁혀봐요",
        text: "센서 하나가 햇빛이 직접 닿는 곳으로 옮겨져 있었어요. 어떻게 확인할까요?",
        choices: [
          "위치를 바로잡고 다시 비교",
          "기록을 모두 삭제",
          "같은 위치에서 다른 센서와 비교",
        ],
        responses: [
          "설치 위치가 측정에 영향을 준다는 것을 확인했어요.",
          "기록은 원인을 이해하는 데 필요해요. 잘못된 측정임을 표시해요.",
          "같은 조건에서 비교하니 위치의 영향을 확인할 수 있어요.",
        ],
        lesson: "조건을 맞춰 비교하면 원인을 더 정확히 알아볼 수 있어요.",
      },
      {
        title: "다음에는 더 빨리 발견하도록",
        text: "농부가 같은 문제를 빠르게 알아차릴 수 있게 무엇을 제안할까요?",
        choices: [
          "센서 간 차이 알림 기획",
          "하루 종일 수동으로 살피기",
          "설치 위치 점검표 만들기",
        ],
        responses: [
          "한 센서만 다른 값을 보일 때 확인할 수 있겠어요.",
          "지속해서 하기 어려워요. 자동 알림과 점검을 함께 고민해요.",
          "설치와 관리의 실수를 줄일 수 있겠어요.",
        ],
        lesson: "기술과 현장의 관리 방법을 함께 설계해요.",
      },
    ],
  },
  {
    id: "engineer",
    title: "모빌리티 엔지니어",
    field: fields[3],
    color: "orange",
    region: "군산",
    intro: "더 안전하고 새로운 이동을 설계하는 일.",
    skills: ["설계 사고", "협업", "실험과 검증"],
    majors: ["기계공학", "자동차공학"],
    related: ["배터리 연구원", "로봇 엔지니어", "교통 서비스 기획자"],
    project: "등굣길을 바꾸는 작은 모빌리티",
    problem:
      "버스 정류장에서 학교까지 거리가 멀어요. 이동을 돕는 서비스 아이디어를 설계해요.",
    missions: [
      "등굣길의 불편과 이용자를 정하세요.",
      "이동 수단과 운영 방법을 설명하세요.",
      "보행자와 이용자의 안전을 어떻게 확인할까요?",
    ],
    scenarios: [
      {
        title: "새 이동수단의 첫 테스트",
        text: "가상의 이동수단 기획팀이에요. 이용자가 손잡이를 잡기 어렵다고 해요. 무엇부터 확인할까요?",
        choices: [
          "키가 다른 사용자들의 이용 모습 관찰",
          "손잡이 색 바꾸기",
          "기존 제품의 손잡이 크기 조사",
        ],
        responses: [
          "키에 따라 불편한 위치가 다르네요.",
          "보이는 것과 잡기 편한 것은 다를 수 있어요.",
          "기존 설계와 우리 이용자의 차이를 살펴봐요.",
        ],
        lesson: "설계는 실제 이용자의 조건을 이해하는 것에서 시작해요.",
      },
      {
        title: "아이디어를 골라요",
        text: "서로 다른 키의 이용자를 위한 개선이 필요해요. 어떤 아이디어를 검토할까요?",
        choices: [
          "높이를 조절할 수 있는 손잡이",
          "가장 큰 이용자에게 맞추기",
          "여러 위치에 손잡이 배치",
        ],
        responses: [
          "조절 방법과 고정 장치의 신뢰성도 검토해야 해요.",
          "다른 이용자들이 쓰기 어려울 수 있어요.",
          "잡는 위치와 주변 공간을 함께 검토해 봐요.",
        ],
        lesson: "편리함과 안전, 제작 조건을 함께 고려해요.",
      },
      {
        title: "설계를 확인하는 시간",
        text: "종이 모형을 만들었어요. 실제 제품을 만들기 전에 무엇을 할까요?",
        choices: [
          "사용 시나리오별 문제점 점검",
          "바로 제작 진행",
          "다양한 이용자의 피드백 수집",
        ],
        responses: [
          "예상 가능한 상황을 먼저 점검했어요.",
          "검증 없이 진행하면 문제를 늦게 발견할 수 있어요.",
          "처음 생각하지 못한 불편을 찾았어요.",
        ],
        lesson: "작은 모형과 반복 검증이 설계를 발전시켜요.",
      },
    ],
  },
  {
    id: "researcher",
    title: "식품 연구원",
    field: fields[4],
    color: "pink",
    region: "익산",
    intro: "맛있는 호기심을 새로운 가능성으로.",
    skills: ["실험 설계", "기록과 분석", "창의적 사고"],
    majors: ["식품공학", "식품영양학"],
    related: ["품질관리 전문가", "제품 기획자", "푸드테크 개발자"],
    project: "지역 농산물로 만드는 새로운 간식",
    problem:
      "지역 농산물을 활용한 청소년 간식 아이디어와 비교 실험 계획을 세워요. 실제 조리는 하지 않아요.",
    missions: [
      "사용할 농산물과 대상 소비자를 정하세요.",
      "비교할 제품 특성 한 가지를 골라보세요.",
      "같은 조건에서 의견을 모으는 방법을 적으세요.",
    ],
    scenarios: [
      {
        title: "어떤 간식을 만들까요?",
        text: "익산의 가상 식품 개발팀이에요. 지역 농산물로 학생용 간식을 기획해요. 첫 단계는?",
        choices: [
          "학생들이 원하는 간식 조사",
          "내가 좋아하는 맛으로 결정",
          "기존 제품과 지역 재료 조사",
        ],
        responses: [
          "휴대가 편한 간식을 원한다는 가상 의견이 모였어요.",
          "내 취향 외에 다른 학생들의 의견도 필요해요.",
          "기존 제품과 다른 특징을 고민할 수 있겠어요.",
        ],
        lesson: "제품을 사용할 사람을 이해하는 것이 연구의 출발점이에요.",
      },
      {
        title: "공정하게 비교해요",
        text: "두 가지 포장 디자인에 대한 선호를 비교하려 해요. 어떻게 조사할까요?",
        choices: [
          "같은 설명과 조건으로 비교",
          "한 디자인만 더 자세히 설명",
          "디자인을 보여주는 순서를 바꾸어 조사",
        ],
        responses: [
          "설명 차이가 결과에 영향을 주지 않게 했어요.",
          "설명의 차이가 선택에 영향을 줄 수 있어요.",
          "먼저 보는 순서의 영향도 고려했어요.",
        ],
        lesson: "비교할 요소 외의 조건을 맞추는 것이 중요해요.",
      },
      {
        title: "결과를 해석해요",
        text: "가상 조사에서 10명 중 6명이 첫 번째 디자인을 골랐어요. 어떻게 보고할까요?",
        choices: [
          "조사 인원과 조건, 한계를 함께 기록",
          "모든 학생이 좋아한다고 발표",
          "선택한 이유도 함께 정리",
        ],
        responses: [
          "작은 조사라는 점을 정확히 전달했어요.",
          "10명의 결과를 모든 학생에게 일반화하기는 어려워요.",
          "다음 개선에 활용할 수 있는 의견도 얻었어요.",
        ],
        lesson: "연구 결과는 근거와 한계를 함께 설명해요.",
      },
    ],
  },
];
export const getCareer = (id: string) =>
  careers.find((c) => c.id === id) ?? careers[0];
export type Activity = {
  id: string;
  careerId: CareerId;
  kind: "simulation" | "project" | "diagnosis";
  title: string;
  date: string;
  reflection: string;
  answers: string[];
  feedback: string;
  before: number[];
  after: number[];
  interest?: number;
  evaluationStatus?: string;
};
export type Profile = {
  name: string;
  school: string;
  grade: string;
  region: string;
  username?: string;
  interests: string[];
  onboarded: boolean;
  notifications: boolean;
};
export type AppState = {
  profile: Profile;
  saved: CareerId[];
  activities: Activity[];
  scores: Partial<Record<CareerId, number[]>>;
  interests: Partial<Record<CareerId, number>>;
  drafts: Partial<Record<CareerId, string[]>>;
  gaps: Partial<Record<CareerId, GapReport>>;
  recommendations: Recommendation[];
};
export type ExperienceEvidence = {
  id: string;
  careerId: CareerId;
  kind: string;
  category: "participation" | "self_report" | "artifact";
  objectives: string[];
  text: string;
  date: string;
  verified: boolean;
  verificationMeaning: string;
  metadata: Record<string, unknown>;
};
export type GapReport = {
  careerId: CareerId;
  scores: number[];
  dimensions: {
    name: string;
    observed: number;
    target: number;
    coverage: number;
    unknown: boolean;
    evidenceCount: number;
    missing: string[];
    missingObjectiveIds: string[];
  }[];
  evidence: ExperienceEvidence[];
  version: string;
  scoreMeaning: string;
  unavailableVerification: string[];
};
export type Recommendation = {
  careerId: CareerId;
  kind: "simulation" | "project" | "discovery";
  reason: string;
  missingObjectives: string[];
  path: string[];
};
export type SourceReference = {
  source: string;
  id: string;
  url: string;
  version?: string;
  license?: string;
  label?: string;
  [key: string]: unknown;
};
export const initialState: AppState = {
  profile: {
    name: "탐험가",
    school: "",
    grade: "",
    region: "",
    interests: [],
    onboarded: false,
    notifications: true,
  },
  saved: [],
  activities: [],
  scores: {},
  interests: {},
  drafts: {},
  gaps: {},
  recommendations: [],
};
export function scoreFor(state: AppState, id: CareerId) {
  return state.scores[id] ?? [0, 0, 0, 0, 0, 0];
}
export function nextCareer(state: AppState) {
  return getCareer(state.recommendations[0]?.careerId ?? "developer");
}
export function dateLabel(date: string) {
  return new Date(date).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}
