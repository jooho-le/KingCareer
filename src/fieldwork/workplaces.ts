import scenarios from "../../backend/data/workplaces.json";
import type { CareerId } from "../data";
export type Workplace = typeof scenarios.developer;
export function workplaceFor(id: CareerId): Workplace | undefined {
  return id === "farmer" ? undefined : scenarios[id];
}
export function projectFor(id: CareerId) {
  return (
    workplaceFor(id)?.project || {
      title: "내가 설계하는 더 나은 온실",
      brief:
        "A구역 과열을 빨리 발견하고 다음 교대자가 놓치지 않도록 센서 위치·동선·환기 확인 절차를 설계해 주세요.",
      nodes: ["A 재배대", "B 재배대", "환경 센서", "환기 확인"],
      hints: [
        "현장 자료에서 어떤 문제를 발견했나요?",
        "무엇을 어디에 바꿨고, 그 이유는 무엇인가요?",
        "어떤 수치와 관찰로 개선 효과를 확인할까요?",
      ],
    }
  );
}
