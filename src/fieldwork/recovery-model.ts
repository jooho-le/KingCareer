import type { DrawingScene } from "./types";

export type RecoveryTarget = "login" | "support";
export type RecoveryControl = {
  label: string;
  target: RecoveryTarget | null;
  x: number;
  y: number;
};
export type RecoveryDesign = {
  kind: "login-recovery";
  version: 2;
  message: string;
  messagePosition: { x: number; y: number };
  retry: RecoveryControl | null;
  support: RecoveryControl | null;
  preserveInput: boolean | null;
};
export type RecoveryScene = DrawingScene & { studio: RecoveryDesign };

export function isRecoveryScene(
  scene: DrawingScene | null | undefined,
): scene is RecoveryScene {
  const studio = (scene as RecoveryScene | undefined)?.studio;
  return studio?.kind === "login-recovery" && studio.version === 2;
}

export function recoveryDesign(
  scene: DrawingScene | null | undefined,
): RecoveryDesign {
  if (isRecoveryScene(scene)) return scene.studio;
  return {
    kind: "login-recovery",
    version: 2,
    message: "",
    messagePosition: { x: 24, y: 130 },
    retry: null,
    support: null,
    preserveInput: null,
  };
}

export function recoveryFingerprint(design: RecoveryDesign) {
  return JSON.stringify(design);
}

/** A deterministic, portable drawing accompanies the editable interaction model.
 * It remains an ordinary Excalidraw scene in downloads and the portfolio. */
export function sceneFromRecovery(studio: RecoveryDesign): RecoveryScene {
  const elements: Record<string, unknown>[] = [];
  let index = 0;
  const shape = (
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
    extra: Record<string, unknown> = {},
  ) => {
    const id = `recovery-${++index}`;
    elements.push({
      id,
      type,
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: "#25263b",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: type === "rectangle" ? { type: 3 } : null,
      seed: index * 77,
      version: 1,
      versionNonce: index * 101,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      ...extra,
    });
    return id;
  };
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke = "transparent",
  ) =>
    shape("rectangle", x, y, w, h, {
      backgroundColor: fill,
      strokeColor: stroke,
    });
  const text = (
    value: string,
    x: number,
    y: number,
    w = 250,
    size = 16,
    color = "#25263b",
  ) => {
    const lines = value.split("\n").flatMap((line) => {
      const chars = Math.max(8, Math.floor(w / (size * 0.7)));
      return line.match(new RegExp(`.{1,${chars}}`, "gu")) ?? [""];
    });
    return shape("text", x, y, w, Math.max(1, lines.length) * size * 1.35, {
      text: lines.join("\n"),
      originalText: lines.join("\n"),
      fontSize: size,
      fontFamily: 2,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      autoResize: false,
      lineHeight: 1.35,
      strokeColor: color,
    });
  };
  rect(0, 0, 1080, 650, "#f6f5f1");
  text("로그인 복구 화면 · 나의 설계", 40, 28, 760, 28);
  text(
    "오류 안내와 다시 시작할 경로를 연결했어요.",
    40,
    70,
    760,
    15,
    "#626477",
  );
  const phone = (x: number, title: string, subtitle: string) => {
    text(title, x, 110, 300, 18);
    rect(x, 150, 300, 420, "#ffffff", "#d8d5e6");
    text("9:41", x + 20, 164, 60, 12);
    rect(x + 115, 163, 70, 10, "#25263b");
    text("CAMPUS CLUB", x + 24, 200, 240, 13, "#7c3aed");
    text(subtitle, x + 24, 234, 250, 24);
  };
  phone(40, "내가 만든 오류 화면", "잠깐, 연결이 끊겼어요");
  if (studio.message)
    text(
      studio.message,
      40 + studio.messagePosition.x,
      150 + studio.messagePosition.y,
      248,
      16,
    );
  else text("안내 문구를 넣을 자리", 64, 292, 245, 15, "#8b849d");
  for (const [kind, control] of [
    ["retry", studio.retry],
    ["support", studio.support],
  ] as const) {
    if (!control) continue;
    rect(
      40 + control.x,
      150 + control.y,
      252,
      46,
      kind === "retry" ? "#0967ff" : "#eee8fc",
    );
    text(
      control.label,
      55 + control.x,
      160 + control.y,
      226,
      16,
      kind === "retry" ? "#ffffff" : "#6534bf",
    );
  }
  phone(390, "연결 대상 · 로그인", "다시 만나 반가워요");
  text("아이디", 414, 304, 220, 13, "#626477");
  rect(414, 332, 252, 42, "#f6f5f9", "#e0dce9");
  text(studio.preserveInput === true ? "king_student" : "", 426, 343, 220);
  text("비밀번호", 414, 392, 220, 13, "#626477");
  rect(414, 420, 252, 42, "#f6f5f9", "#e0dce9");
  text(studio.preserveInput === true ? "••••••••" : "", 426, 431, 220);
  rect(414, 491, 252, 44, "#0967ff");
  text("로그인", 514, 502, 120, 16, "#ffffff");
  phone(740, "연결 대상 · 도움 요청", "도움을 요청해요");
  rect(764, 298, 252, 100, "#f1ebff");
  text(
    "연결 오류 문의\n고객지원팀에 보낼 내용을\n이 화면에서 확인해요.",
    780,
    316,
    220,
    15,
  );
  rect(764, 434, 252, 46, "#7c3aed");
  text("문의 보내기", 842, 446, 170, 16, "#ffffff");
  // Keep the support path in the gutter, outside the middle phone, in exports.
  for (const [kind, control] of [["retry", studio.retry], ["support", studio.support]] as const) {
    if (!control?.target) continue;
    const x = 40 + control.x + 252, y = 150 + control.y + 23;
    const targetX = control.target === "login" ? 390 : 740;
    const points = control.target === "login"
      ? [[0, 0], [targetX - x, 0]]
      : [[0, 0], [360 - x, 0], [360 - x, 587 - y], [720 - x, 587 - y], [720 - x, 457 - y], [740 - x, 457 - y]];
    shape("arrow", x, y, targetX - x, Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1])), {
      points, startBinding: null, endBinding: null, startArrowhead: null,
      endArrowhead: "arrow", elbowed: false,
      strokeColor: kind === "retry" ? "#0967ff" : "#7c3aed", strokeWidth: 2,
    });
  }
  text(
    studio.preserveInput === null
      ? "입력 정보 처리: 아직 선택하지 않았어요"
      : studio.preserveInput
        ? "입력 정보 처리: 이전 아이디와 비밀번호 유지"
        : "입력 정보 처리: 다시 입력",
    40,
    603,
    1000,
    16,
    "#626477",
  );
  return {
    studio: structuredClone(studio),
    elements,
    appState: { viewBackgroundColor: "#ffffff" },
  };
}

export function newRecoveryScene(): RecoveryScene {
  return sceneFromRecovery(recoveryDesign(null));
}
