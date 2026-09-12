import type { CareerId } from "../data";

// Reserved draft markers survive autosave; unfinished scaffolds are not submissions.
export const hasWritingBlanks = (value: string) => /〔채우기:[^〕]*〕/.test(value);
export const writingReady = (value: string) => value.trim().length >= 10 && !hasWritingBlanks(value);
export const writingFrames = [
  { labels: ["자료", "문제"], parts: ["나는 ", "을(를) 살펴봤어요. 발견한 문제는 ", "이에요."] },
  { labels: ["제안", "이유"], parts: ["저는 ", "을(를) 제안해요. ", " 때문이에요."] },
  { labels: ["확인 방법", "성공 기준"], parts: ["", "으로 확인할 거예요. ", "이면 개선됐다고 볼 거예요."] },
];
export function composeWriting(index: number, fields: string[]) {
  const frame = writingFrames[index];
  return frame.parts[0] + (fields[0]?.trim() ? fields[0] : `〔채우기:${frame.labels[0]}〕`) + frame.parts[1] + (fields[1]?.trim() ? fields[1] : `〔채우기:${frame.labels[1]}〕`) + frame.parts[2];
}
export function readWriting(index: number, value: string): string[] | null {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = writingFrames[index].parts;
  const match = value.match(new RegExp(`^${escape(parts[0])}(.*?)${escape(parts[1])}(.*?)${escape(parts[2])}$`, "s"));
  return match ? match.slice(1).map(text => hasWritingBlanks(text) ? "" : text) : null;
}
// Authored practice examples, not observations taken from the student's activity.
export const writingExamples: Record<CareerId, string[][]> = {
  developer: [
    ["로그인 오류 화면", "다음에 누를 버튼이 없다는 점"],
    ["다시 시도 버튼 추가", "입력을 처음부터 반복하지 않고 다시 시도할 수 있기"],
    ["같은 오류를 만든 뒤 버튼을 눌러 보는 방법", "입력이 유지되고 다시 로그인을 시도할 수 있는 상태"],
  ],
  nurse: [
    ["가상 병동의 인계 보드", "끝난 준비와 남은 준비가 섞여 있다는 점"],
    ["완료와 확인 필요 칸을 나눈 보드", "다음 동료가 남은 준비를 빠르게 찾을 수 있기"],
    ["동료 역할의 친구에게 보드를 읽어 달라고 하는 방법", "남은 준비를 빠짐없이 찾은 상태"],
  ],
  farmer: [
    ["온실의 온도 기록", "온도가 높아진 구역을 바로 알기 어렵다는 점"],
    ["구역별 센서 위치와 확인 순서를 표시한 지도", "다음 교대자도 확인할 위치를 알 수 있기"],
    ["같은 위치의 온도와 작물 상태를 전후로 기록하는 방법", "온도가 안정되고 잎의 상태도 나빠지지 않은 상태"],
  ],
  engineer: [
    ["차량의 가상 시험 기록", "시험 조건이 달라 진동 수치를 비교하기 어렵다는 점"],
    ["같은 조건에서 점검 전후를 비교하는 시험표", "조건 차이로 생긴 변화를 구분할 수 있기"],
    ["같은 시험 조건으로 반복 측정하는 방법", "여러 번 측정해도 진동이 줄어든 상태"],
  ],
  researcher: [
    ["두 식품 시료의 실험 기록", "배합과 측정 시간이 함께 달라졌다는 점"],
    ["측정 시간을 맞추고 배합만 바꾸는 실험표", "어떤 조건이 차이를 만들었는지 비교할 수 있기"],
    ["같은 조건으로 반복 실험해 결과를 비교하는 방법", "여러 번 실험해도 같은 경향이 나타나는 상태"],
  ],
};

// Sentence openings, not completed answers: students add their own observations.
export const writingStarters: Record<CareerId, string[][]> = {
  developer: [
    ["사용자가 막힌 곳은 ", "오류 안내에는 "],
    ["다시 시도하려면 ", "이 버튼은 "],
    ["친구가 화면을 보면 ", "성공했는지 보려면 "],
  ],
  nurse: [
    ["교대 기록에는 ", "빠진 정보는 "],
    ["다음 동료를 위해 ", "인계 보드에는 "],
    ["함께 확인할 것은 ", "빠짐없이 전달됐는지 "],
  ],
  farmer: [
    ["센서에서 본 것은 ", "작물의 상태는 "],
    ["환기 장치 옆에 ", "이렇게 배치한 이유는 "],
    ["전후 온도를 보면 ", "다시 관찰할 것은 "],
  ],
  engineer: [
    ["시험 기록에는 ", "이 조건에서 진동이 "],
    ["비교할 조건은 ", "점검 순서를 바꿔 "],
    ["같은 조건으로 ", "안정됐는지 보려면 "],
  ],
  researcher: [
    ["두 시료의 차이는 ", "기록에서 빠진 것은 "],
    ["같게 유지할 조건은 ", "바꿔볼 조건은 "],
    ["반복해서 측정하면 ", "차이를 비교하려면 "],
  ],
};
