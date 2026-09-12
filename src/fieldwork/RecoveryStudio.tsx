import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Grip,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { api, errorMessage, json, requestId } from "../api";
import type { CareerId } from "../data";
import { downloadFile, type DrawingScene } from "./types";
import ProjectCoach from "./ProjectCoach";
import {
  recoveryDesign,
  recoveryFingerprint,
  sceneFromRecovery,
  type RecoveryDesign,
  type RecoveryTarget,
} from "./recovery-model";
import "./recovery-studio.css";

export type RecoveryDraft = {
  careerId: CareerId;
  answers: string[];
  scene: DrawingScene | null;
  version: number;
  interest: number | null;
};
type Props = {
  draft: RecoveryDraft;
  status: string;
  busy: boolean;
  error: string;
  isSaved?: boolean;
  onChange: (change: Partial<RecoveryDraft>) => void;
  onSave: () => Promise<RecoveryDraft>;
  onSubmit: () => Promise<void>;
  onBack: () => void;
  onHistory: () => void;
  onBackup: () => void;
  onStartSketch: () => void;
};
type Part = "message" | "retry" | "support";
type Scenario = "recovered" | "offline";
type Checks = {
  version: number;
  mode: "rules";
  checks: {
    scenario: Scenario;
    passed: boolean;
    message: string;
    actions: string[];
  }[];
  issues: string[];
  ready: boolean;
};
const partNames: Record<Part, string> = {
  message: "안내 문구",
  retry: "다시 시도 버튼",
  support: "도움 요청 버튼",
};
const targetNames: Record<RecoveryTarget, string> = {
  login: "로그인 화면",
  support: "도움 요청 화면",
};

export default function RecoveryStudio({
  draft,
  status,
  busy,
  error,
  isSaved = false,
  onChange,
  onSave,
  onSubmit,
  onBack,
  onHistory,
  onBackup,
  onStartSketch,
}: Props) {
  const design = recoveryDesign(draft.scene);
  const fingerprint = recoveryFingerprint(design);
  const [selected, setSelected] = useState<Part | null>(null);
  const [panel, setPanel] = useState<"properties" | "reference" | "coach">(
    "reference",
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview" | "review">("edit");
  const [visibleScreen, setVisibleScreen] = useState<"error" | RecoveryTarget>(
    "error",
  );
  const [scenario, setScenario] = useState<Scenario>("recovered");
  const [runtimeScreen, setRuntimeScreen] = useState<"error" | RecoveryTarget>(
    "error",
  );
  const [actions, setActions] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [checkState, setCheckState] = useState<{
    fingerprint: string;
    value: Checks;
  } | null>(null);
  const [checkError, setCheckError] = useState("");
  const [checking, setChecking] = useState(false);
  const [dragDesign, setDragDesign] = useState<RecoveryDesign | null>(null);
  const artboard = useRef<HTMLDivElement>(null);
  const [connections, setConnections] = useState<
    { part: string; path: string }[]
  >([]);
  const mounted = useRef(true),
    lock = useRef(false),
    latest = useRef(fingerprint);
  latest.current = fingerprint;
  const drag = useRef<{
    part: Part;
    x: number;
    y: number;
    originX: number;
    originY: number;
    changed: boolean;
  } | null>(null);
  const keys = useRef(new Map<string, string>());
  const working = dragDesign ?? design;
  const verified =
    checkState?.fingerprint === fingerprint ? checkState.value : null;
  const disabled = busy || checking;

  useEffect(() => {
    const host = artboard.current;
    if (!host || mode !== "edit") return;
    const measure = () => {
      const origin = host.getBoundingClientRect();
      setConnections(
        (["retry", "support"] as const).flatMap((part) => {
          const control = working[part];
          if (!control?.target) return [];
          const from = host
            .querySelector(`.recovery-control-${part}`)
            ?.getBoundingClientRect();
          const to = host
            .querySelector(`[data-recovery-target="${control.target}"]`)
            ?.getBoundingClientRect();
          if (!from?.width || !to?.width) return [];
          const x = from.right - origin.left + 3,
            y = from.top + from.height / 2 - origin.top;
          const endX = to.left - origin.left - 5,
            endY = to.top + 45 - origin.top;
          return [
            {
              part,
              path: `M ${x} ${y} C ${x + 36} ${y}, ${endX - 30} ${endY}, ${endX} ${endY}`,
            },
          ];
        }),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [working, visibleScreen, mode]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (lock.current || !isSaved || draft.version === 0) return;
    const controller = new AbortController();
    const stamp = fingerprint;
    void api<Checks>("/projects/developer/checks", {
      signal: controller.signal,
    })
      .then((value) => {
        if (
          !controller.signal.aborted &&
          latest.current === stamp &&
          !lock.current
        ) {
          if (value.version !== draft.version) {
            setCheckState(null);
            setCheckError("다른 창에서 설계가 변경됐어요. 작업을 백업하고 다시 열어 주세요.");
            return;
          }
          setCheckState({ fingerprint: stamp, value });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setCheckError(errorMessage(e));
      });
    return () => controller.abort();
  }, [draft.version, fingerprint, isSaved]);

  function update(next: RecoveryDesign) {
    onChange({ scene: sceneFromRecovery(next) });
    setNotice("");
    setCheckError("");
  }
  function choose(part: Part) {
    setSelected(part);
    setPanel("properties");
    setPanelOpen(true);
    setVisibleScreen("error");
  }
  function add(part: Part) {
    if (disabled) return;
    if (part !== "message")
      update({
        ...design,
        [part]: {
          label: part === "retry" ? "다시 시도" : "도움 요청",
          target: null,
          x: 24,
          y: part === "retry" ? 264 : 324,
        },
      });
    choose(part);
  }
  function position(
    part: Part,
    x: number,
    y: number,
    source = design,
  ): RecoveryDesign {
    const next = {
      x: Math.round(Math.max(0, Math.min(48, x))),
      y: Math.round(Math.max(118, Math.min(part === "message" ? 258 : 346, y))),
    };
    if (part === "message") return { ...source, messagePosition: next };
    return { ...source, [part]: { ...source[part]!, ...next } };
  }
  function startDrag(event: PointerEvent<HTMLButtonElement>, part: Part) {
    if (disabled || mode !== "edit" || event.button !== 0) return;
    choose(part);
    const point = part === "message" ? design.messagePosition : design[part]!;
    drag.current = {
      part,
      x: event.clientX,
      y: event.clientY,
      originX: point.x,
      originY: point.y,
      changed: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x,
      dy = event.clientY - current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) current.changed = true;
    if (current.changed)
      setDragDesign(
        position(current.part, current.originX + dx, current.originY + dy),
      );
  }
  function endDrag(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const current = drag.current;
    if (current && current.changed && !cancel)
      update(
        position(
          current.part,
          current.originX + event.clientX - current.x,
          current.originY + event.clientY - current.y,
        ),
      );
    drag.current = null;
    setDragDesign(null);
  }
  function moveKey(event: KeyboardEvent<HTMLButtonElement>, part: Part) {
    if (
      disabled ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const point = part === "message" ? design.messagePosition : design[part]!;
    const delta = event.shiftKey ? 1 : 8;
    update(
      position(
        part,
        point.x +
          (event.key === "ArrowRight"
            ? delta
            : event.key === "ArrowLeft"
              ? -delta
              : 0),
        point.y +
          (event.key === "ArrowDown"
            ? delta
            : event.key === "ArrowUp"
              ? -delta
              : 0),
      ),
    );
  }
  function beginPreview() {
    setMode("preview");
    setActions([]);
    setRuntimeScreen("error");
    setNotice("");
    setPanelOpen(false);
  }
  function perform(part: "retry" | "support") {
    if (actions.length >= 8) {
      setNotice("이번 확인에서는 여덟 번 눌러 봤어요. ‘처음 화면에서 다시 누르기’로 새롭게 확인해 주세요.");
      return;
    }
    const control = design[part];
    setActions((current) => [...current, part]);
    if (!control?.target) {
      setNotice(
        "이 버튼의 이동할 화면이 연결되지 않았어요. 설계에서 연결해 주세요.",
      );
      return;
    }
    if (control.target === "login" && scenario === "offline") {
      setRuntimeScreen("error");
      setNotice("연결이 아직 돌아오지 않았어요. 다른 경로가 필요해요.");
      return;
    }
    setRuntimeScreen(control.target);
    setNotice(
      control.target === "support"
        ? "문의할 곳을 찾았어요. 연결이 돌아오지 않아도 도움을 요청할 수 있어요."
        : design.preserveInput === true
          ? "이전 입력이 남아 있어요."
          : design.preserveInput === false
            ? "입력 정보가 지워졌어요. 다시 입력해야 해요."
            : "이전 입력을 어떻게 처리할지 아직 정하지 않았어요.",
    );
  }
  async function verify() {
    if (lock.current || busy || !actions.length) return;
    lock.current = true;
    setChecking(true);
    setCheckError("");
    const stamp = fingerprint,
      trace = [...actions],
      chosenScenario = scenario;
    try {
      const snapshot = await onSave();
      const key = JSON.stringify([snapshot.version, chosenScenario, trace]);
      if (!keys.current.has(key)) keys.current.set(key, requestId());
      await api<Checks>(
        "/projects/developer/check",
        json("POST", {
          clientRequestId: keys.current.get(key),
          expectedVersion: snapshot.version,
          scenario: chosenScenario,
          actions: trace,
        }),
      );
      // A deliberate new check is a new attempt. Reuse a request ID only when
      // retrying a failed request, and fetch the current aggregate after replay.
      const value = await api<Checks>("/projects/developer/checks");
      keys.current.delete(key);
      if (value.version !== snapshot.version) {
        setCheckState(null);
        throw new Error("다른 창에서 설계가 변경됐어요. 작업을 백업하고 다시 열어 주세요.");
      }
      if (mounted.current && latest.current === stamp)
        setCheckState({ fingerprint: stamp, value });
    } catch (e) {
      if (mounted.current) setCheckError(errorMessage(e));
    } finally {
      lock.current = false;
      if (mounted.current) setChecking(false);
    }
  }
  async function exportDrawing() {
    try {
      const { sceneSvg } = await import("./ArtifactThumbnail");
      const svg = await sceneSvg(sceneFromRecovery(design));
      downloadFile(
        "KingCareer-로그인-복구-설계.svg",
        svg.outerHTML,
        "image/svg+xml;charset=utf-8",
      );
    } catch (e) {
      setCheckError(errorMessage(e));
    }
  }
  function phone(screen: "error" | RecoveryTarget, live = false) {
    return (
      <div className={`recovery-phone recovery-phone-${screen}`}>
        <div className="recovery-device-top">
          <span>9:41</span>
          <i />
          <span>● ▰</span>
        </div>
        <div className="recovery-phone-brand">
          CAMPUS CLUB <span>학생 커뮤니티</span>
        </div>
        {screen === "error" ? (
          <>
            <h2>잠깐, 연결이 끊겼어요</h2>
            {working.message ? (
              <button
                type="button"
                className={`recovery-message recovery-movable ${selected === "message" && !live ? "is-selected" : ""}`}
                style={{
                  left: working.messagePosition.x,
                  top: working.messagePosition.y,
                }}
                aria-label={live ? undefined : "안내 문구 편집"}
                disabled={live || disabled}
                onClick={() => choose("message")}
                onPointerDown={(e) => startDrag(e, "message")}
                onPointerMove={moveDrag}
                onPointerUp={(e) => endDrag(e)}
                onPointerCancel={(e) => endDrag(e, true)}
                onKeyDown={(e) => moveKey(e, "message")}
              >
                <span>{working.message}</span>
                {!live && <Grip size={13} />}
              </button>
            ) : (
              <button
                className="recovery-empty-message"
                disabled={live || disabled}
                onClick={() => add("message")}
                aria-label="그림 안 안내 문구 자리"
              >
                <MessageSquare size={22} />
                <span>
                  사용자가 상황을
                  <br />
                  이해할 수 있도록
                </span>
                <small>안내 문구를 놓아 보세요</small>
              </button>
            )}
            {(["retry", "support"] as const).map((part) => {
              const control = working[part];
              return control ? (
                <button
                  key={part}
                  type="button"
                  className={`recovery-control recovery-control-${part} ${!live ? "recovery-movable" : ""} ${selected === part && !live ? "is-selected" : ""}`}
                  style={{ left: control.x, top: control.y }}
                  aria-label={!live ? `${partNames[part]} 편집` : undefined}
                  disabled={disabled}
                  onClick={() => (live ? perform(part) : choose(part))}
                  onPointerDown={live ? undefined : (e) => startDrag(e, part)}
                  onPointerMove={live ? undefined : moveDrag}
                  onPointerUp={live ? undefined : (e) => endDrag(e)}
                  onPointerCancel={live ? undefined : (e) => endDrag(e, true)}
                  onKeyDown={live ? undefined : (e) => moveKey(e, part)}
                >
                  <span>{control.label || "이름 없는 버튼"}</span>
                  {!live && <Grip size={14} />}
                </button>
              ) : null;
            })}
            {!live && !working.retry && !working.support && (
              <div className="recovery-empty-controls">
                <span>여기서 어디로 갈까요?</span>
                <small>오른쪽 재료에서 버튼을 가져오세요.</small>
              </div>
            )}
            <div className="recovery-phone-foot">
              입력한 아이디: king_student
            </div>
          </>
        ) : screen === "login" ? (
          <>
            <h2>다시 만나 반가워요</h2>
            <div className="recovery-login-fields">
              <label>
                아이디
                <span>
                  {working.preserveInput === true
                    ? "king_student"
                    : "아이디를 입력하세요"}
                </span>
              </label>
              <label>
                비밀번호
                <span>
                  {working.preserveInput === true
                    ? "••••••••"
                    : "비밀번호를 입력하세요"}
                </span>
              </label>
              <div className="recovery-static-button">로그인</div>
              <small>
                {working.preserveInput === null
                  ? "입력 유지 여부는 내가 결정해요."
                  : working.preserveInput
                    ? "이전에 입력한 정보가 남아 있어요."
                    : "아이디와 비밀번호를 다시 입력해요."}
              </small>
            </div>
          </>
        ) : (
          <>
            <h2>도움을 요청해요</h2>
            <div className="recovery-support-content">
              <span className="recovery-avatar">K</span>
              <strong>고객지원팀</strong>
              <p>연결 오류로 로그인할 수 없어요.</p>
              <div>
                문의 종류 <b>로그인 · 연결 오류</b>
              </div>
              <div className="recovery-static-button">문의 보내기</div>
              <small>도움 요청 화면까지 연결하는 과제예요.</small>
            </div>
          </>
        )}
      </div>
    );
  }
  const selectedControl =
    selected && selected !== "message" ? design[selected] : null;
  return (
    <section
      className="kc-workshop kc-studio recovery-studio"
      aria-label="로그인 복구 화면 작업실"
    >
      <header className="studio-topbar recovery-topbar">
        <button
          className="recovery-icon"
          aria-label="프로젝트 목록"
          onClick={onBack}
          disabled={disabled}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="studio-title">
          <span className="recovery-kicker">개발자 · 화면 설계</span>
          <h1>다시 시작할 수 있는 로그인</h1>
          <span role="status">
            <Save size={12} /> {status}
          </span>
        </div>
        <details className="recovery-file-menu">
          <summary aria-label="파일 및 화면 안내">
            <MoreHorizontal size={22} />
          </summary>
          <div>
            <button
              onClick={() =>
                void onSave().catch((e) => setCheckError(errorMessage(e)))
              }
              disabled={disabled}
            >
              지금 저장
            </button>
            <button onClick={onHistory} disabled={disabled}>
              수정 이력
            </button>
            <button onClick={onBackup}>작업 백업</button>
            <button disabled={disabled} onClick={onStartSketch}>기존 초안 보관하고 새 손그림 시작</button>
            <button onClick={() => void exportDrawing()}>
              설계도 SVG 받기
            </button>
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("kingcareer:show-help", {
                    detail: { topic: "projects", context: "projects-studio" },
                  }),
                )
              }
            >
              화면 안내
            </button>
          </div>
        </details>
        {mode === "edit" ? (
          <button
            className="recovery-primary"
            data-help="recovery-check"
            disabled={disabled}
            onClick={beginPreview}
          >
            <Play size={17} /> 작동 확인
          </button>
        ) : mode === "preview" ? (
          <button
            className="recovery-primary"
            disabled={disabled || !verified?.ready}
            onClick={() => setMode("review")}
          >
            결과 검토 <ArrowRight size={17} />
          </button>
        ) : (
          <button
            className="recovery-primary"
            disabled={disabled || !verified?.ready || draft.interest === null}
            onClick={() =>
              void onSubmit().catch((e) => setCheckError(errorMessage(e)))
            }
          >
            포트폴리오에 제출 <ArrowRight size={17} />
          </button>
        )}
      </header>
      {(error || checkError) && (
        <div className="recovery-error" role="alert">
          {error || checkError}
          <span>작업과 눌러 본 경로는 그대로 남아 있어요.</span>
        </div>
      )}
      {mode === "edit" ? (
        <div className="recovery-workspace">
          <main className="recovery-board">
            <div className="recovery-board-heading" data-help="recovery-canvas">
              <div>
                <span className="recovery-label">MY DESIGN</span>
                <h2>막힌 화면에, 다음 길을 만들어요</h2>
              </div>
              <button
                className="recovery-sheet-toggle"
                onClick={() => setPanelOpen(!panelOpen)}
                aria-expanded={panelOpen}
              >
                <Settings2 size={17} /> {panelOpen ? "도구 접기" : "편집 도구"}
              </button>
            </div>
            <div className="recovery-screen-tabs" aria-label="설계 화면 보기">
              {(["error", "login", "support"] as const).map((screen) => (
                <button
                  key={screen}
                  aria-pressed={visibleScreen === screen}
                  onClick={() => setVisibleScreen(screen)}
                >
                  {screen === "error" ? "내 오류 화면" : targetNames[screen]}
                </button>
              ))}
            </div>
            <div className="recovery-artboard" ref={artboard}>
              <svg className="recovery-connections" aria-hidden="true">
                <defs>
                  <marker
                    id="recovery-arrow-blue"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0 0L6 3L0 6" fill="#0967ff" />
                  </marker>
                  <marker
                    id="recovery-arrow-purple"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0 0L6 3L0 6" fill="#7c3aed" />
                  </marker>
                </defs>
                {connections.map((line) => (
                  <path
                    key={line.part}
                    d={line.path}
                    fill="none"
                    stroke={line.part === "retry" ? "#0967ff" : "#7c3aed"}
                    strokeWidth="2"
                    markerEnd={`url(#recovery-arrow-${line.part === "retry" ? "blue" : "purple"})`}
                  />
                ))}
              </svg>
              <section
                className={`recovery-main-screen ${visibleScreen === "error" ? "is-visible" : ""}`}
              >
                <div className="recovery-frame-label">
                  <span>편집하는 화면</span>
                  <b>ERROR</b>
                </div>
                {phone("error")}
                <p className="recovery-move-hint">
                  <Grip size={13} /> 요소를 끌어서 배치해요. 방향키로도 이동할
                  수 있어요.
                </p>
              </section>
              <section
                className="recovery-destinations"
                aria-label="연결할 화면"
              >
                <div className="recovery-frame-label">
                  <span>연결할 화면</span>
                  <Link2 size={15} />
                </div>
                {(["login", "support"] as const).map((target) => (
                  <button
                    key={target}
                    data-recovery-target={target}
                    className={`recovery-target ${visibleScreen === target ? "is-active" : ""}`}
                    onClick={() => setVisibleScreen(target)}
                    aria-label={`${targetNames[target]} 살펴보기`}
                  >
                    <div className={`recovery-target-icon ${target}`}>
                      <span>{target === "login" ? "로그인" : "고객지원"}</span>
                      <i />
                      <i />
                      <b>{target === "login" ? "다시 시작" : "문의 보내기"}</b>
                    </div>
                    <strong>{targetNames[target]}</strong>
                    <small>
                      {target === "login"
                        ? "연결이 돌아오면 다시 로그인"
                        : "계속 막히면 도움받기"}
                    </small>
                    <div className="recovery-paths">
                      {(["retry", "support"] as const)
                        .filter((part) => working[part]?.target === target)
                        .map((part) => (
                          <span key={part} className={part}>
                            <Link2 size={12} />
                            {working[part]?.label}
                            <ArrowRight size={12} />
                          </span>
                        ))}
                      {![
                        working.retry?.target,
                        working.support?.target,
                      ].includes(target) && <em>아직 연결된 버튼이 없어요</em>}
                    </div>
                  </button>
                ))}
              </section>
              {visibleScreen !== "error" && (
                <section className="recovery-target-expanded">
                  <div className="recovery-frame-label">
                    <span>{targetNames[visibleScreen]}</span>
                    <button
                      onClick={() => setVisibleScreen("error")}
                      aria-label="내 오류 화면으로 돌아가기"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {phone(visibleScreen)}
                  <p className="recovery-move-hint">
                    이 화면은 연결 대상이에요. 오류 화면의 버튼과 연결해요.
                  </p>
                </section>
              )}
            </div>
          </main>
          <aside
            className={`recovery-inspector ${panelOpen ? "is-open" : ""}`}
            aria-label="설계 편집 도구"
          >
            <nav aria-label="설계 도구">
              <button
                aria-pressed={panel === "properties"}
                onClick={() => {
                  setPanel("properties");
                  setPanelOpen(true);
                }}
              >
                편집
              </button>
              <button
                data-help="recovery-brief"
                aria-pressed={panel === "reference"}
                onClick={() => {
                  setPanel("reference");
                  setPanelOpen(true);
                }}
              >
                의뢰 · 참고
              </button>
              <button
                aria-pressed={panel === "coach"}
                onClick={() => {
                  setPanel("coach");
                  setPanelOpen(true);
                }}
              >
                크랩 도움
              </button>
              <button
                className="recovery-sheet-close"
                aria-label="편집 도구 닫기"
                onClick={() => setPanelOpen(false)}
              >
                <X size={18} />
              </button>
            </nav>
            <div className="recovery-inspector-body">
              {panel === "reference" ? (
                <>
                  <div className="recovery-brief">
                    <img
                      src="/brand/12_career_kingcrabs/developer.png"
                      alt="개발자 크랩"
                    />
                    <span className="recovery-label">새로운 의뢰</span>
                    <h2>
                      로그인에 실패해도
                      <br />
                      길을 잃지 않도록
                    </h2>
                    <p>
                      학생 커뮤니티에 연결 오류가 생겼어요. 안내와 버튼을
                      배치하고, 다시 시도하거나 도움받을 경로를 직접 연결해
                      주세요.
                    </p>
                  </div>
                  <div className="recovery-user-request">
                    <MessageSquare size={18} />
                    <p>
                      “무슨 오류인지 모르겠어요.
                      <br />
                      다시 눌러도 되는 건가요?”<span>학생 사용자 · 지우</span>
                    </p>
                  </div>
                  <div className="recovery-user-request">
                    <MessageSquare size={18} />
                    <p>
                      “계속 안 돼요.
                      <br />
                      어디에 물어보죠?”<span>학생 사용자 · 민준</span>
                    </p>
                  </div>
                  <details className="recovery-broken-reference">
                    <summary>
                      문제가 있던 원래 화면 <ChevronDown size={15} />
                    </summary>
                    <div>
                      <small>CAMPUS CLUB</small>
                      <h3>오류가 발생했습니다.</h3>
                      <code>ERR_CONNECTION_503</code>
                      <span>확인</span>
                    </div>
                    <p>사용자는 원인도, 다음에 할 일도 알기 어려웠어요.</p>
                  </details>
                  <button
                    className="recovery-open-materials"
                    onClick={() => setPanel("properties")}
                  >
                    화면 재료 살펴보기 <ArrowRight size={17} />
                  </button>
                </>
              ) : panel === "coach" ? (
                <ProjectCoach
                  careerId="developer"
                  save={onSave}
                  disabled={disabled}
                />
              ) : (
                <>
                  <div className="recovery-materials">
                    <h2>화면에 놓을 재료</h2>
                    <p>필요한 것을 가져온 뒤, 그림에서 옮기고 연결해요.</p>
                    {(["message", "retry", "support"] as const).map((part) => {
                      const exists =
                        part === "message" ? !!design.message : !!design[part];
                      return (
                        <button
                          key={part}
                          className={exists ? "is-added" : ""}
                          disabled={disabled}
                          onClick={() => (exists ? choose(part) : add(part))}
                          aria-label={
                            exists
                              ? `${partNames[part]} 선택`
                              : `${partNames[part]} 추가`
                          }
                        >
                          {exists ? <Check size={16} /> : <Plus size={16} />}
                          <span>{partNames[part]}</span>
                          {exists && <small>배치됨</small>}
                        </button>
                      );
                    })}
                  </div>
                  {selected &&
                  (selected === "message" ? true : selectedControl) ? (
                    <section
                      className="recovery-properties"
                      aria-label={`${partNames[selected]} 속성`}
                    >
                      <div className="recovery-property-title">
                        <span>
                          <Grip size={15} />
                          {partNames[selected]}
                        </span>
                        <button
                          aria-label={`${partNames[selected]} 삭제`}
                          disabled={disabled}
                          onClick={() => {
                            update(
                              selected === "message"
                                ? { ...design, message: "" }
                                : { ...design, [selected]: null },
                            );
                            setSelected(null);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {selected === "message" ? (
                        <label>
                          안내 문구
                          <textarea
                            value={design.message}
                            disabled={disabled}
                            maxLength={160}
                            rows={4}
                            onChange={(e) =>
                              update({ ...design, message: e.target.value })
                            }
                          />
                          <small>
                            무슨 일이 생겼는지, 사용자가 무엇을 할 수 있는지
                            알려 주세요.
                          </small>
                        </label>
                      ) : (
                        <>
                          <label>
                            버튼 이름
                            <input
                              value={selectedControl!.label}
                              disabled={disabled}
                              maxLength={36}
                              onChange={(e) =>
                                update({
                                  ...design,
                                  [selected]: {
                                    ...selectedControl!,
                                    label: e.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            누르면 이동할 화면
                            <select
                              value={selectedControl!.target ?? ""}
                              disabled={disabled}
                              onChange={(e) =>
                                update({
                                  ...design,
                                  [selected]: {
                                    ...selectedControl!,
                                    target: e.target.value || null,
                                  },
                                })
                              }
                            >
                              <option value="">미연결</option>
                              <option value="login">로그인 화면</option>
                              <option value="support">도움 요청 화면</option>
                            </select>
                          </label>
                          <p className="recovery-link-note">
                            <Link2 size={14} />
                            {selectedControl!.target
                              ? `${selectedControl!.label} → ${targetNames[selectedControl!.target]}`
                              : "지금은 눌러도 갈 곳이 없어요."}
                          </p>
                        </>
                      )}
                      <div className="recovery-coordinates">
                        <span>
                          가로{" "}
                          {selected === "message"
                            ? design.messagePosition.x
                            : selectedControl!.x}
                        </span>
                        <span>
                          세로{" "}
                          {selected === "message"
                            ? design.messagePosition.y
                            : selectedControl!.y}
                        </span>
                      </div>
                    </section>
                  ) : (
                    <div className="recovery-selection-hint">
                      <Settings2 size={20} />
                      <p>
                        그림의 문구나 버튼을 선택하면
                        <br />
                        여기서 내용을 바꿀 수 있어요.
                      </p>
                    </div>
                  )}
                  <label className="recovery-input-rule">
                    이전 입력 정보
                    <select
                      value={
                        design.preserveInput === null
                          ? ""
                          : String(design.preserveInput)
                      }
                      disabled={disabled}
                      onChange={(e) =>
                        update({
                          ...design,
                          preserveInput:
                            e.target.value === ""
                              ? null
                              : e.target.value === "true",
                        })
                      }
                    >
                      <option value="">선택하기</option>
                      <option value="true">유지하기</option>
                      <option value="false">지우기</option>
                    </select>
                    <small>
                      다시 로그인할 때 아이디와 비밀번호를 어떻게 할까요?
                    </small>
                  </label>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : mode === "preview" ? (
        <div className="recovery-preview-layout">
          <section className="recovery-preview-stage">
            <div className="recovery-preview-heading">
              <button
                className="recovery-text-button"
                onClick={() => setMode("edit")}
                disabled={disabled}
              >
                <ArrowLeft size={16} /> 설계 수정
              </button>
              <span className="recovery-label">내가 만든 화면을 눌러 봐요</span>
            </div>
            <div className="recovery-scenarios" aria-label="확인할 상황">
              {(["recovered", "offline"] as const).map((value) => (
                <button
                  key={value}
                  disabled={disabled}
                  aria-pressed={scenario === value}
                  onClick={() => {
                    setScenario(value);
                    setRuntimeScreen("error");
                    setActions([]);
                    setNotice("");
                  }}
                >
                  {value === "recovered" ? (
                    <RotateCcw size={16} />
                  ) : (
                    <WifiOff size={16} />
                  )}
                  {value === "recovered"
                    ? "연결이 돌아왔을 때"
                    : "계속 연결되지 않을 때"}
                  {verified?.checks.some(
                    (check) => check.scenario === value && check.passed,
                  ) && <Check size={16} />}
                </button>
              ))}
            </div>
            <div
              className="recovery-live-phone"
              role="region"
              aria-label="내 설계 작동 화면"
            >
              {phone(runtimeScreen, true)}
            </div>
            <button
              className="recovery-text-button recovery-restart"
              disabled={disabled}
              onClick={() => {
                setRuntimeScreen("error");
                setActions([]);
                setNotice("");
              }}
            >
              <RotateCcw size={15} /> 처음 화면에서 다시 누르기
            </button>
          </section>
          <aside className="recovery-preview-notes">
            <span className="recovery-label">이 상황에서는</span>
            <h2>
              {scenario === "recovered"
                ? "다시 로그인할 수 있을까요?"
                : "계속 막혀도 길이 있을까요?"}
            </h2>
            <p>
              {scenario === "recovered"
                ? "연결이 돌아왔어요. 내가 만든 다시 시도 버튼을 눌러 로그인 화면까지 가 보세요."
                : "연결 오류가 계속되고 있어요. 다시 시도해 본 뒤, 도움받을 수 있는 곳을 찾아가 보세요."}
            </p>
            <div className="recovery-trace">
              <h3>눌러 본 경로</h3>
              {actions.length ? (
                <ol>
                  {actions.map((action, i) => (
                    <li key={i}>
                      {design[action as "retry" | "support"]?.label || action}
                      <ArrowRight size={14} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p>왼쪽 화면의 버튼을 직접 눌러 보세요.</p>
              )}
            </div>
            {notice && (
              <p className="recovery-runtime-notice" role="status">
                {notice}
              </p>
            )}
            <button
              className="recovery-check-route"
              disabled={disabled || !actions.length}
              onClick={() => void verify()}
            >
              {checking ? "경로 확인 중…" : "이 경로 확인"}
              <Check size={16} />
            </button>
            <div className="recovery-check-results" aria-live="polite">
              {verified?.checks.map((check) => (
                <div
                  key={check.scenario}
                  className={check.passed ? "is-passed" : "needs-edit"}
                >
                  <strong>
                    {check.passed ? "확인했어요" : "다시 살펴봐요"} ·{" "}
                    {check.scenario === "recovered" ? "연결 복구" : "계속 오류"}
                  </strong>
                  <p>{check.message}</p>
                </div>
              ))}
              {verified?.issues?.length ? (
                <ul>
                  {verified.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
              {verified?.ready ? (
                <p className="recovery-ready">
                  두 상황을 확인했어요. 위에서 결과를 검토하고 제출할 수 있어요.
                </p>
              ) : (
                <small>
                  두 상황을 직접 확인한 뒤 결과를 검토해요. 연결과 동작을
                  확인하며, 글의 완성도 평가는 아니에요.
                </small>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="recovery-review-layout">
          <section>
            <button
              className="recovery-text-button"
              onClick={() => setMode("edit")}
              disabled={disabled}
            >
              <ArrowLeft size={16} /> 설계 수정
            </button>
            <span className="recovery-label">MY PORTFOLIO</span>
            <h2>내가 만든, 다시 시작하는 방법</h2>
            <div className="recovery-review-preview">
              {phone("error", true)}
              <div className="recovery-review-links">
                {(["retry", "support"] as const).map((part) => (
                  <div key={part}>
                    <span>{design[part]?.label}</span>
                    <ArrowRight size={20} />
                    <strong>
                      {design[part]?.target
                        ? targetNames[design[part]!.target!]
                        : "미연결"}
                    </strong>
                  </div>
                ))}
                <p>
                  {design.preserveInput
                    ? "다시 입력하지 않도록 이전 정보를 유지했어요."
                    : "다시 로그인할 때 입력 정보를 새로 받아요."}
                </p>
              </div>
            </div>
          </section>
          <aside>
            <span className="recovery-label">제출 전 돌아보기</span>
            <h2>어떤 생각으로 바꿨나요?</h2>
            <label>
              바꾼 이유 한마디 (선택)
              <textarea
                maxLength={5000}
                rows={5}
                value={draft.answers[0] ?? ""}
                disabled={disabled}
                placeholder="예: 계속 실패해도 도움받을 수 있게 연결했어요."
                onChange={(e) =>
                  onChange({
                    answers: [
                      e.target.value,
                      draft.answers[1] ?? "",
                      draft.answers[2] ?? "",
                    ],
                  })
                }
              />
            </label>
            <fieldset>
              <legend>이 일을 더 해 보고 싶은가요?</legend>
              <div className="recovery-interest">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    key={value}
                    className={draft.interest === value ? "is-selected" : ""}
                  >
                    <input
                      type="radio"
                      name="recovery-interest"
                      value={value}
                      checked={draft.interest === value}
                      disabled={disabled}
                      onChange={() => onChange({ interest: value })}
                    />
                    {value}
                  </label>
                ))}
              </div>
              <div className="recovery-interest-labels">
                <span>별로예요</span>
                <span>더 해 보고 싶어요</span>
              </div>
            </fieldset>
            <div className="recovery-review-confirmed">
              <Check size={20} />
              <p>
                연결 복구와 계속 오류,
                <br />두 상황에서 내 경로를 확인했어요.
              </p>
            </div>
            <p className="recovery-review-copy">
              제출하면 이 설계도와 확인 기록이 포트폴리오에 남아요. 제출하기
              전까지는 초안이에요.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
