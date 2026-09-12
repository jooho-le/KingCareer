import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";
import { Button } from "../components";
import { useApp } from "../store";
import "./activity-help.css";

type Topic = "simulation" | "projects";
type HelpContext = `${Topic}-${"lobby" | "entry" | "session" | "studio"}`;
type StudioStep = "brief" | "tools" | "writing" | "submit";
type Step = {
  selector: string;
  title: string;
  text: string;
  activate?: StudioStep;
};
const steps: Record<Topic, Step[]> = {
  simulation: [
    {
      selector: ".career-grid > :first-child h3, .career-entry-plan",
      title: "직업을 골라봐",
      text: "궁금한 직업의 카드를 눌러 현장에 들어가 봐.",
    },
    {
      selector: "[data-help='simulation-task'], .kc-task-panel h2",
      title: "먼저 오늘 할 일을 확인해",
      text: "지금 해결할 문제와 다음 행동을 읽어봐. 한 단계씩 진행하면 돼.",
    },
    {
      selector: "[data-help='simulation-materials'], .kc-scene-toolbar",
      title: "판단하기 전에 자료를 살펴봐",
      text: "물건이나 조사 목록을 눌러 단서를 찾아봐. 2D 목록으로도 같은 자료를 볼 수 있어.",
    },
    {
      selector: "[data-help='simulation-choice'], .kc-task-panel .kc-button",
      title: "어떻게 할지 골라봐",
      text: "확인한 단서를 바탕으로 조치를 선택해. 서술형 답변 없이 진행할 수 있어.",
    },
    {
      selector: "[data-help='simulation-result'], .kc-log summary",
      title: "내 선택이 만든 변화를 확인해",
      text: "조치의 결과와 남은 문제를 보고, 활동 기록에서 다시 확인할 수 있어.",
    },
    {
      selector: ".kc-next",
      title: "다음 경험으로 이어가",
      text: "수료한 체험을 돌아보고, 프로젝트로 생각을 결과물로 만들어봐.",
    },
  ],
  projects: [
    {
      selector: ".project-grid > :first-child h3, .career-entry-plan",
      title: "만들고 싶은 프로젝트를 골라",
      text: "직업별 과제를 눌러 작업실에 들어가 봐.",
    },
    {
      selector: ".kc-project-brief",
      title: "먼저 의뢰를 읽어봐",
      text: "무슨 문제를 해결하고 무엇을 만들지 확인해.",
    },
    {
      selector: ".kc-editor-panel",
      title: "여기에 생각을 그려봐",
      text: "도형과 화살표로 설계해. 위쪽 도안 넣기 버튼으로 시작해도 좋아.",
    },
    {
      selector: ".kc-project-coach",
      title: "막히면 크랩에게 물어봐",
      text: "도움받을 항목과 질문 버튼을 골라봐. 저장한 초안을 바탕으로 다음 작업을 도와줘.",
    },
    {
      selector: ".kc-writing-grid",
      title: "내 설계를 설명해",
      text: "발견한 문제, 바꾼 이유, 확인 방법을 짧게 적어봐.",
    },
    {
      selector: ".kc-save-bar",
      title: "저장 상태를 확인해",
      text: "저장 완료를 확인해. 필요하면 작업 백업으로 파일도 받을 수 있어.",
    },
    {
      selector: ".kc-submit-bar",
      title: "완성하면 제출해",
      text: "설계도와 세 설명을 채우면 포트폴리오에 남길 수 있어.",
    },
  ],
};
const studioSteps: Step[] = [
  {
    selector:
      "[data-help='studio-brief'], .brief-mission-heading, .studio-tabs",
    activate: "brief",
    title: "먼저 해결할 문제를 읽어봐",
    text: "어떤 문제를 해결하고 무엇을 만들지 확인해. 한 가지 아이디어부터 시작해도 좋아.",
  },
  {
    selector: "[data-help='studio-tools'], .kc-studio .kc-board-tools",
    activate: "tools",
    title: "편한 방법으로 아이디어를 만들어",
    text: "네모 안의 글을 두 번 눌러 고치고, 화살표와 메모를 덧붙여봐. 완성 예시도 같은 손그림 도안이야.",
  },
  {
    selector:
      "[data-help='studio-writing'], #studio-panel-writing label, .studio-tabs",
    activate: "writing",
    title: "내가 만든 생각을 설명해",
    text: "발견한 문제, 바꾼 이유, 확인 방법을 짧게 적어봐. 막히면 크랩 도움을 열어도 좋아.",
  },
  {
    selector: "[data-help='studio-submit'], .studio-topbar > .kc-button",
    activate: "submit",
    title: "마지막으로 확인하고 제출해",
    text: "설계도와 세 설명, 활동 후 관심을 채우면 제출할 수 있어. 저장한 결과물은 포트폴리오에 남아.",
  },
];
const recoverySteps: Step[] = [
  { selector: "[data-help='recovery-brief'], .recovery-sheet-toggle", title: "어디서 사용자가 막혔을까?", text: "편집 도구의 의뢰·참고에서 기존 화면과 사용자 이야기를 살펴봐. 이번에는 로그인 실패 뒤의 화면 하나를 고쳐볼 거야." },
  { selector: "[data-help='recovery-canvas']", title: "내 화면에 직접 놓아봐", text: "안내와 버튼을 놓고, 누르면 어디로 이동할지 연결해. 그림에서 고른 부분을 수정할 수 있어." },
  { selector: "[data-help='recovery-check']", title: "내 버튼을 눌러 확인해", text: "연결이 돌아온 때와 계속 실패할 때를 확인해 봐. 고칠 부분을 다듬고 마지막에 직접 제출해." },
];
const entrySteps: Step[] = [
  {
    selector: ".career-entry-plan h2",
    title: "오늘 맡을 일을 확인해",
    text: "어떤 순서로 진행하고 무엇을 남길지 먼저 살펴봐.",
  },
  {
    selector: ".career-entry-copy button",
    title: "준비됐다면 시작해 볼까?",
    text: "로그인하거나 가입하면 방금 고른 활동으로 이어져. 내 활동 기록도 저장할 수 있어.",
  },
];
const keyFor = (account: string, topic: Topic) =>
  `kingcareer:activity-help:v1:${encodeURIComponent(account)}:${topic}`;
const seenKeyFor = (account: string, context: HelpContext) =>
  `kingcareer:activity-help:seen:v2:${encodeURIComponent(account)}:${context}`;
const seenInMemory = new Set<string>();
function hidden(key: string) {
  try {
    return localStorage.getItem(key) === "hidden";
  } catch {
    return false;
  }
}
function seen(key: string) {
  try {
    return seenInMemory.has(key) || localStorage.getItem(key) === "seen";
  } catch {
    return seenInMemory.has(key);
  }
}
function rememberSeen(key: string) {
  seenInMemory.add(key);
  try {
    localStorage.setItem(key, "seen");
  } catch {
    /* This visit still remembers dismissal when storage is unavailable. */
  }
}
function visibleTarget(selector: string) {
  return (
    selector
      .split(",")
      .map((part) => document.querySelector<HTMLElement>(part.trim()))
      .find((el) => el && el.getClientRects().length) || null
  );
}
function Tour({
  topic,
  context,
  onClose,
  onShown,
}: {
  topic: Topic;
  context: HelpContext;
  onClose: () => void;
  onShown: () => void;
}) {
  const { user } = useApp();
  const key = keyFor(user?.username ? `user:${user.username}` : "guest", topic);
  const maskId = useId().replace(/:/g, "");
  const [suppressed, setSuppressed] = useState(() => hidden(key));
  const [error, setError] = useState("");
  const [targets, setTargets] = useState<{ step: Step; el: HTMLElement }[]>([]);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    vw: window.innerWidth,
    vh: window.innerHeight,
  });
  const dialog = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLElement>(null);
  const [sizes, setSizes] = useState({ caption: 150, controls: 100 });
  useEffect(() => {
    const sync = () => {
      const found = (
        context === "projects-studio"
          ? document.querySelector(".recovery-studio") ? recoverySteps : studioSteps
          : context.endsWith("-entry")
            ? entrySteps
            : steps[topic]
      ).flatMap((step) => {
        const el = visibleTarget(step.selector);
        return el ? [{ step, el }] : [];
      });
      setTargets((old) =>
        old.length === found.length &&
        old.every((item, i) => item.el === found[i].el)
          ? old
          : found,
      );
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden"],
    });
    return () => observer.disconnect();
  }, [topic, context]);
  const currentIndex = Math.min(index, Math.max(0, targets.length - 1));
  const target = targets[currentIndex];
  useEffect(() => {
    if (target) onShown();
  }, [target, onShown]);
  useEffect(() => {
    if (target?.step.activate)
      window.dispatchEvent(
        new CustomEvent("kingcareer:studio-help-step", {
          detail: { step: target.step.activate },
        }),
      );
  }, [target]);
  useEffect(
    () => () => {
      if (context === "projects-studio")
        window.dispatchEvent(
          new CustomEvent("kingcareer:studio-help-step", {
            detail: { step: "close" },
          }),
        );
    },
    [context],
  );
  useEffect(() => {
    if (!target) return;
    if (!target.el.closest(".kc-studio"))
      target.el.scrollIntoView({ block: "center", behavior: "instant" });
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = target.el.getBoundingClientRect(),
          vw = window.innerWidth,
          vh = window.innerHeight;
        const x = Math.max(8, r.left - 8),
          y = Math.max(8, r.top - 8);
        const next = {
          x,
          y,
          width: Math.max(0, Math.min(vw - 8, r.right + 8) - x),
          height: Math.max(0, Math.min(vh - 8, r.bottom + 8) - y),
          vw,
          vh,
        };
        setBox((old) =>
          JSON.stringify(old) === JSON.stringify(next) ? old : next,
        );
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target.el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [target]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const host = dialog.current;
    if (!host) return;
    const stopScroll = (event: WheelEvent) => event.preventDefault();
    host.addEventListener("wheel", stopScroll, { passive: false });
    return () => host.removeEventListener("wheel", stopScroll);
  }, [target]);
  useEffect(() => {
    if (!target || !caption.current || !controls.current) return;
    const captionElement = caption.current;
    const controlsElement = controls.current;
    const measure = () => {
      if (!captionElement.isConnected || !controlsElement.isConnected) return;
      const next = {
        caption: captionElement.getBoundingClientRect().height,
        controls: controlsElement.getBoundingClientRect().height,
      };
      setSizes((old) =>
        old.caption === next.caption && old.controls === next.controls
          ? old
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(captionElement);
    observer.observe(controlsElement);
    measure();
    return () => observer.disconnect();
  }, [target]);
  useEffect(() => {
    if (target) dialog.current?.focus({ preventScroll: true });
  }, [target]);
  if (!target) return null;
  let textWidth = Math.min(420, box.vw - 40);
  let left = Math.max(
    20,
    Math.min(box.x + box.width / 2 - textWidth / 2, box.vw - textWidth - 20),
  );
  const controlsTop = box.y + box.height / 2 > box.vh * 0.6;
  const areaStart = controlsTop ? sizes.controls + 16 : 16;
  const areaEnd = controlsTop ? box.vh - 16 : box.vh - sizes.controls - 16;
  const gap = box.vh < 640 ? 24 : 45;
  const below = box.y + box.height + gap;
  const fitsBelow = below + sizes.caption <= areaEnd;
  const fitsAbove = box.y - sizes.caption - gap >= areaStart;
  const sideWidth = Math.min(textWidth, 220);
  const side =
    !fitsBelow &&
    !fitsAbove &&
    (box.x >= sideWidth + 44
      ? "left"
      : box.vw - box.x - box.width >= sideWidth + 44
        ? "right"
        : null);
  let top = fitsBelow
    ? Math.max(areaStart, below)
    : Math.max(areaStart, box.y - sizes.caption - gap);
  if (side) {
    textWidth = Math.min(
      textWidth,
      side === "left" ? box.x - 44 : box.vw - box.x - box.width - 44,
    );
    left = side === "left" ? box.x - textWidth - 24 : box.x + box.width + 24;
    top = Math.max(
      areaStart,
      Math.min(
        box.y + box.height / 2 - sizes.caption / 2,
        areaEnd - sizes.caption,
      ),
    );
  }
  const endX = side
    ? side === "left"
      ? box.x - 5
      : box.x + box.width + 5
    : box.x + box.width / 2;
  const endY = side
    ? box.y + box.height / 2
    : top > box.y
      ? box.y + box.height + 5
      : box.y - 5;
  const startX = side
    ? side === "left"
      ? left + textWidth + 8
      : left - 8
    : left + textWidth * 0.55;
  const startY = side
    ? top + sizes.caption / 2
    : top > box.y
      ? top - 12
      : top + sizes.caption + 12;
  return createPortal(
    <div
      className="kc-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="화면 이용 안내"
      tabIndex={-1}
      ref={dialog}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
        if (
          [
            "PageDown",
            "PageUp",
            "Home",
            "End",
            "ArrowDown",
            "ArrowUp",
          ].includes(e.key) ||
          (e.key === " " && e.target === dialog.current)
        )
          e.preventDefault();
        if (e.key === "Tab") {
          const controls = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input",
            ) || [],
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === dialog.current)
          ) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <svg
        className="kc-help-shade"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx="16"
              fill="black"
            />
          </mask>
          <marker
            id={maskId + "arrow"}
            markerWidth="14"
            markerHeight="14"
            refX="11"
            refY="7"
            orient="auto"
          >
            <path
              d="M 2 2 L 11 7 L 2 12"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="#101426"
          fillOpacity=".86"
          mask={`url(#${maskId})`}
        />
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx="16"
          fill="none"
          stroke="#FF9A59"
          strokeWidth="3"
        />
        <path
          d={`M ${startX} ${startY} Q ${startX + 55} ${(startY + endY) / 2} ${endX} ${endY}`}
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd={`url(#${maskId}arrow)`}
        />
      </svg>
      <div
        className="kc-help-caption"
        ref={caption}
        style={{ left, top, width: textWidth }}
        aria-live="polite"
      >
        <small>여기, 이렇게 쓰면 돼</small>
        <h2>{target.step.title}</h2>
        <p>{target.step.text}</p>
      </div>
      <footer
        className={`kc-help-controls ${controlsTop ? "controls-top" : ""}`}
        ref={controls}
      >
        <label>
          <input
            type="checkbox"
            checked={suppressed}
            onChange={(e) => {
              try {
                if (e.target.checked) localStorage.setItem(key, "hidden");
                else localStorage.removeItem(key);
                setSuppressed(e.target.checked);
                setError("");
              } catch {
                setError(
                  "설정을 저장하지 못했어. 브라우저 저장 공간을 확인해줘.",
                );
              }
            }}
          />
          다시 보지 않기
        </label>
        {error && <p role="alert">{error}</p>}
        <div>
          <button
            className="kc-help-close"
            aria-label="안내 닫기"
            onClick={onClose}
          >
            <X size={22} />
          </button>
          <button
            disabled={currentIndex === 0}
            onClick={() => setIndex(currentIndex - 1)}
          >
            이전
          </button>
          <span>
            {currentIndex + 1} / {targets.length}
          </span>
          <button
            className="kc-help-next"
            onClick={() =>
              currentIndex + 1 < targets.length
                ? setIndex(currentIndex + 1)
                : onClose()
            }
          >
            {currentIndex + 1 < targets.length ? "다음 →" : "시작할게"}
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
export function ActivityHelp({ topic }: { topic?: Topic }) {
  const { user, loading } = useApp();
  const account = user?.username ? `user:${user.username}` : "guest";
  const route = location.hash;
  const hasCareer = !!new URLSearchParams(route.split("?")[1]).get("career");
  const context: HelpContext | undefined = topic
    ? `${topic}-${hasCareer ? (user ? (topic === "projects" ? "studio" : "session") : "entry") : "lobby"}`
    : undefined;
  const visitKey = context ? seenKeyFor(account, context) : "";
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const previousContext = useRef("");
  const open = !!visitKey && openedKey === visitKey;
  const shown = useCallback(() => {
    if (visitKey) rememberSeen(visitKey);
  }, [visitKey]);
  const close = useCallback(() => {
    if (visitKey) rememberSeen(visitKey);
    setOpenedKey(null);
  }, [visitKey]);
  useEffect(() => {
    const show = () => {
      if (topic && !loading) setOpenedKey(visitKey);
    };
    window.addEventListener("kingcareer:show-help", show);
    return () => window.removeEventListener("kingcareer:show-help", show);
  }, [topic, loading, visitKey]);
  useEffect(() => {
    if (!topic || loading) {
      previousContext.current = "";
      setOpenedKey(null);
      return;
    }
    const forced =
      new URLSearchParams(route.split("?")[1]).get("tab") === "help";
    if (forced) {
      const params = new URLSearchParams(route.split("?")[1]);
      params.delete("tab");
      history.replaceState(
        null,
        "",
        `${location.pathname}${location.search}${route.split("?")[0]}${params.size ? `?${params}` : ""}`,
      );
      setOpenedKey(visitKey);
    } else if (previousContext.current !== visitKey)
      setOpenedKey(
        !seen(visitKey) && !hidden(keyFor(account, topic)) ? visitKey : null,
      );
    previousContext.current = visitKey;
  }, [topic, account, loading, route, visitKey]);
  if (!topic || !context || loading) return null;
  return (
    <>
      <div className="activity-help-entry">
        <button onClick={() => (open ? close() : setOpenedKey(visitKey))}>
          <CircleHelp size={17} />
          {open ? "안내 닫기" : "화면 안내"}
        </button>
      </div>
      {open && (
        <Tour
          key={visitKey}
          topic={topic}
          context={context}
          onShown={shown}
          onClose={close}
        />
      )}
    </>
  );
}
export function ActivityHelpSettings() {
  const { go } = useApp();
  return (
    <div className="setting-row activity-help-settings">
      <div>
        <h3>활동 도움말</h3>
        <p>
          실제 화면에서 사용 방법을 다시 볼 수 있어요. 안내 안에서 ‘다시 보지
          않기’도 해제할 수 있어요.
        </p>
      </div>
      <div className="button-row">
        <Button
          kind="secondary"
          onClick={() => go("simulation", undefined, "help")}
        >
          직무체험 화면 안내
        </Button>
        <Button
          kind="secondary"
          onClick={() => go("projects", undefined, "help")}
        >
          프로젝트 화면 안내
        </Button>
      </div>
    </div>
  );
}
