import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { CareerId } from "../data";
import { projectFor } from "./workplaces";

type Skeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>;
const ink = "#252525";
const fills = ["#fae3cf", "#e4d6fb", "#dce7ff", "#fae3cf"];
type Flow = {
  nodes: [string, string, string, string];
  branch: string;
  notes: [string, string, string];
  blanks: [string, string, string];
  examples: [string, string, string];
  description: string;
};
const flows: Record<CareerId, Flow> = {
  developer: {
    nodes: ["오류 발견", "원인 확인", "복구 안내", "다시 시작"],
    branch: "계속 실패한다면?",
    notes: ["사용자가 알 수 있게", "다른 길도 만들어 보기", "다시 시작한 뒤"],
    blanks: ["오류 안내", "도움받을 방법", "다시 확인할 것"],
    examples: ["연결이 잠시 끊겼어요.\n입력한 내용은\n남아 있어요.", "다시 시도해도 안 되면\n지원팀에 문의하는\n길을 연결해요.", "입력한 정보가 남는지,\n다시 로그인되는지\n직접 확인해요."],
    description: "오류 뒤에 어떤 길이 필요할까요? 네모 안의 안내와 화살표를 직접 고쳐 봐요.",
  },
  nurse: {
    nodes: ["호출 확인", "환경 준비", "팀 지원", "다음 교대"],
    branch: "아직 준비가 안 됐다면?",
    notes: ["먼저 알아볼 것", "남은 준비를 놓치지 않게", "다음 사람에게 남길 말"],
    blanks: ["확인할 정보", "남은 준비와 담당자", "인계 확인 방법"],
    examples: ["준비 물품 목록과\n비어 있는 물품함을\n먼저 확인해요.", "비어 있는 물품함은\n담당 동료에게\n준비를 부탁해요.", "남은 준비와 담당자를\n다음 교대자와\n함께 확인해요."],
    description: "가상 병동의 준비·인계 연습이에요. 남은 일과 담당자를 가지선과 메모로 연결해 봐요.",
  },
  farmer: {
    nodes: ["구역 살펴보기", "기록 비교", "환경 조정", "다시 관찰"],
    branch: "한 구역만 계속 덥다면?",
    notes: ["어디를 살펴볼까?", "다른 원인도 찾아보기", "바꾸기 전과 후"],
    blanks: ["관찰할 위치", "추가 점검", "비교할 기록"],
    examples: ["두 재배대 사이에서\n온도와 잎의 상태를\n살펴봐요.", "환기창이 열리는지,\n센서 위치가 적절한지\n살펴봐요.", "같은 시간에 온도와\n잎의 상태를\n다시 기록해요."],
    description: "온실에서 관찰하고 바꿀 일을 네모로 그려요. 확인이 더 필요한 곳은 가지선을 늘려 봐요.",
  },
  engineer: {
    nodes: ["진동 발견", "점검 위치", "조건 맞추기", "재시험·인계"],
    branch: "같은 진동이 남는다면?",
    notes: ["어디에서 생겼을까?", "추가로 점검할 곳", "비교할 수 있도록"],
    blanks: ["점검할 위치", "남은 점검", "같게 맞출 조건"],
    examples: ["뒷바퀴 주변의\n조립 상태와 기록을\n살펴봐요.", "미확인 부분을 표시해\n담당 동료에게\n점검을 요청해요.", "같은 노면과 속도에서\n점검 전후의 진동을\n비교해요."],
    description: "가상 차량 점검 계획이에요. 점검할 곳과 재시험 조건을 화살표·메모로 이어 봐요.",
  },
  researcher: {
    nodes: ["질문 정하기", "두 시료 준비", "같은 조건 실험", "기록·비교"],
    branch: "결과가 서로 다르다면?",
    notes: ["한 가지만 바꾸기", "조건을 다시 살펴보기", "무엇을 기록할까?"],
    blanks: ["바꿀 조건", "같게 유지할 조건", "측정과 반복 방법"],
    examples: ["시료 A와 B는\n재료의 배합 비율만\n다르게 해요.", "보관 온도와\n측정 시간이 같았는지\n확인해요.", "색과 농도를 기록하고\n같은 조건에서\n반복해 봐요."],
    description: "두 시료를 비교할 순서를 그려요. 바꿀 조건·같은 조건·반복할 일을 메모로 연결해 봐요.",
  },
};
export const drawingGuideDescriptions = Object.fromEntries(
  Object.entries(flows).map(([id, flow]) => [id, flow.description]),
) as Record<CareerId, string>;

/** One hand-drawn composition for both the starter and its worked example.
 * Only note contents change. Export always uses the student's stored elements. */
export function projectTemplate(careerId: CareerId, example = false, offsetX = 0) {
  const flow = flows[careerId];
  const elements: Skeleton = [];
  const ids = Array.from({ length: 7 }, () => crypto.randomUUID());
  const text = (x: number, y: number, value: string, fontSize = 22, color = ink) => elements.push({
    type: "text", x: x + offsetX, y, text: value, fontSize, fontFamily: 5,
    strokeColor: color, roughness: 1, seed: elements.length + 120,
  });
  const node = (id: string, x: number, y: number, width: number, height: number, label: string, fill: string, fontSize = 26) => elements.push({
    id, type: "rectangle", x: x + offsetX, y, width, height,
    backgroundColor: fill, strokeColor: ink, strokeWidth: 2.5,
    roughness: 1.5, fillStyle: "solid", roundness: null, seed: elements.length + 120,
    label: { text: label, fontSize, fontFamily: 5, strokeColor: ink, textAlign: "center", verticalAlign: "middle" },
  });
  const arrow = (from: string, to: string, x: number, y: number, points: [number, number][]) => elements.push({
    type: "arrow", x: x + offsetX, y, points,
    start: { id: from }, end: { id: to }, strokeColor: ink,
    strokeWidth: 2.5, roughness: 1.5, endArrowhead: "arrow", seed: elements.length + 120,
  });

  text(40, 22, projectFor(careerId).title, 32);
  text(40, 79, example ? "이렇게 생각을 이어갈 수 있어요. 나의 답은 달라도 좋아요." : "일의 흐름을 그리고, 필요한 곳에 내 생각을 덧붙여 봐요.", 21, "#60616d");
  const xs = [40, 336, 632, 928];
  xs.forEach((x, i) => node(ids[i], x, 160, 220, 108, flow.nodes[i], fills[i]));
  for (let i = 0; i < 3; i++) arrow(ids[i], ids[i + 1], xs[i] + 228, 214, [[0, 0], [60, 0]]);

  // Student ideas are attached to the drawing, not a separate step interface.
  const notes = [{ x: 40, y: 382, w: 300 }, { x: 440, y: 420, w: 320 }, { x: 848, y: 382, w: 300 }];
  notes.forEach(({ x, y, w }, i) => {
    text(x + 2, y + 138, flow.notes[i], 21, "#60616d");
    node(ids[4 + i], x, y, w, 126, example ? flow.examples[i] : `〔채우기:${flow.blanks[i]}〕`, "transparent", 22);
  });
  arrow(ids[0], ids[4], 150, 277, [[0, 0], [0, 52], [40, 52], [40, 96]]);
  arrow(ids[1], ids[5], 446, 277, [[0, 0], [0, 48], [154, 48], [154, 135]]);
  arrow(ids[3], ids[6], 1038, 277, [[0, 0], [0, 52], [-40, 52], [-40, 96]]);
  text(630, 300, flow.branch, 21, "#785438");
  text(40, 597, "연결, 배치, 안내를 바꾸고 나만의 해결 방법을 추가해 보세요.", 22, "#60616d");

  return convertToExcalidrawElements(elements, { regenerateIds: false }).map(element => ({
    ...element,
    customData: { kingCareerGuide: { careerId, style: "hand-flow", version: 3,
      originalText: element.type === "text" ? element.originalText : null } },
  }));
}
