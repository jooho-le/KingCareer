import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { CareerId } from "../data";
import { projectFor } from "./workplaces";

type Skeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>;
const colors = ["#ffe1ce", "#e6d6ff", "#d6e7ff"];

export function projectTemplate(careerId: CareerId) {
  const project = projectFor(careerId);
  const elements: Skeleton = [
    {
      type: "text",
      x: 60,
      y: 40,
      text: project.title,
      fontSize: 26,
      strokeColor: "#262938",
    },
  ];
  if (careerId === "developer") {
    project.nodes.forEach((label, i) =>
      elements.push({
        type: "rectangle",
        id: `flow-${i}`,
        x: 60 + i * 220,
        y: 150,
        width: 170,
        height: 110,
        backgroundColor: colors[i % 3],
        fillStyle: "solid",
        label: { text: label },
      }),
    );
    for (let i = 0; i < project.nodes.length - 1; i++)
      elements.push({
        type: "arrow",
        x: 235 + i * 220,
        y: 205,
        width: 40,
        height: 0,
        start: { id: `flow-${i}` },
        end: { id: `flow-${i + 1}` },
        endArrowhead: "arrow",
      });
    elements.push({
      type: "text",
      x: 60,
      y: 320,
      text: "오류 뒤에 사용자가 갈 수 있는 길을 연결해 봐.",
      fontSize: 18,
    });
  } else if (careerId === "nurse") {
    ["확인한 상황", "다음 동료에게 전달", "함께 확인할 사항"].forEach(
      (label, i) => {
        elements.push({
          type: "rectangle",
          x: 60 + i * 250,
          y: 135,
          width: 225,
          height: 70,
          backgroundColor: colors[i],
          fillStyle: "solid",
          label: { text: label },
        });
        elements.push({
          type: "rectangle",
          x: 60 + i * 250,
          y: 225,
          width: 225,
          height: 210,
          backgroundColor: "#ffffff",
          fillStyle: "solid",
          label: { text: "직접 메모해 봐" },
        });
      },
    );
    elements.push({
      type: "text",
      x: 60,
      y: 490,
      text: "가상 체험 자료로 작성하는 인계 보드 · 실제 환자 정보는 적지 않아.",
      fontSize: 17,
    });
  } else {
    const research = careerId === "researcher";
    const headings = research
      ? ["비교할 항목", "시료 A", "시료 B"]
      : ["시험 조건", "변경 전", "변경 후"];
    const rows = research
      ? ["같게 유지할 조건", "바꿔볼 조건", "측정 결과 / 남은 질문"]
      : ["같은 조건으로 확인", "바꿔볼 점검 항목", "진동 / 남은 확인"];
    headings.forEach((label, i) =>
      elements.push({
        type: "rectangle",
        x: 60 + i * 260,
        y: 135,
        width: 245,
        height: 60,
        backgroundColor: colors[i],
        fillStyle: "solid",
        label: { text: label },
      }),
    );
    rows.forEach((label, row) =>
      headings.forEach((_, col) =>
        elements.push({
          type: "rectangle",
          x: 60 + col * 260,
          y: 210 + row * 100,
          width: 245,
          height: 85,
          backgroundColor: col === 0 ? "#f6f5f1" : "#ffffff",
          fillStyle: "solid",
          label: { text: col === 0 ? label : "기록해 봐" },
        }),
      ),
    );
    elements.push({
      type: "text",
      x: 60,
      y: 560,
      text: "같은 조건과 바꾼 조건을 구분하고, 아직 모르는 것은 질문으로 남겨봐.",
      fontSize: 17,
    });
  }
  return convertToExcalidrawElements(elements);
}
