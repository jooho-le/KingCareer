import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Coins,
  ChevronDown,
  RotateCcw,
  Search,
  Thermometer,
  NotebookPen,
  CircleHelp,
  X,
} from "lucide-react";
import { api, errorMessage, json, requestId } from "../api";
import { useApp } from "../store";
import { AwardsShelf } from "./Awards";
import type { SceneQuality } from "./SceneKit";
import type { FarmSession } from "./types";
import "./fieldwork.css";
import "./simulation-feedback.css";
import "./simulation-layout.css";
import "./shift-experience.css";
import ChoiceCards from "./ChoiceCards";
import ActionOutcome from "./ActionOutcome";
import CareerEntry from "./CareerEntry";
import {
  automaticQuality,
  readQualityPreference,
  saveQualityPreference,
  type QualityPreference,
} from "./scenePreferences";

import { workplaceFor, projectFor } from "./workplaces";
import { getCareer } from "../data";
const WorkplaceScene = lazy(() => import("./WorkplaceScene"));
const Greenhouse = lazy(() => import("./Greenhouse"));
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Smartfarm({ legacy }: { legacy: ReactNode }) {
  const {
    user,
    careerId: cid,
    go,
    refresh,
    registerNavigationGuard,
  } = useApp();
  const job = getCareer(cid);
  const [session, setSession] = useState<FarmSession | null>(null);
  const workplace = session?.fieldwork?.presentation || workplaceFor(cid);
  const required = workplace?.required || ["sensor", "journal"];
  const metric = workplace?.metric || "A구역 온도";
  const unit = workplace?.unit ?? "°C";
  const reduced = !!useReducedMotion();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [qualityPreference, setQualityPreference] = useState<QualityPreference>(
    readQualityPreference,
  );
  const [autoQuality, setAutoQuality] =
    useState<SceneQuality>(automaticQuality);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 1100px)").matches,
  );
  const quality =
    qualityPreference === "auto" ? autoQuality : qualityPreference;
  const calmScene = reduced || quality === "balanced";
  const [flat, setFlat] = useState(false),
    [selected, setSelected] = useState(""),
    [text, setText] = useState("");
  const [question, setQuestion] = useState(""),
    [action, setAction] = useState(workplace?.actions[0].id || "ventilate"),
    [interest, setInterest] = useState(3);
  const [liked, setLiked] = useState(""),
    [disliked, setDisliked] = useState("");
  const lock = useRef(false),
    keys = useRef(new Map<string, string>()),
    retryTask = useRef<(() => void) | null>(null),
    loadGeneration = useRef(0);
  const dirty = useRef(false);
  const missionHeading = useRef<HTMLHeadingElement>(null);
  const choicesHeading = useRef<HTMLHeadingElement>(null);
  const completedPanel = useRef<HTMLDivElement>(null);
  const materialsPanel = useRef<HTMLDetailsElement>(null);
  const resourcePanel = useRef<HTMLDivElement>(null);
  const [inspectChoiceOpen, setInspectChoiceOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const resourceTrigger = useRef<HTMLElement | null>(null);
  const closeResource = () => {
    setResourceOpen(false);
    resourceTrigger.current?.focus({ preventScroll: true });
  };
  const sceneViewport = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    // Orbit controls can mount after the canvas while scene assets are loading.
    // Contain wheel input on the whole viewport, including loading/fallback states.
    const containWheel = (event: WheelEvent) => event.preventDefault();
    node.addEventListener("wheel", containWheel, { passive: false });
    return () => node.removeEventListener("wheel", containWheel);
  }, []);
  const lastPhase = useRef("");
  const currentPhase = session
    ? `${session.id}:${session.stage}:${session.fieldwork?.phase}`
    : "";
  useEffect(() => {
    if (!resourceOpen) return;
    resourcePanel.current?.focus({ preventScroll: true });
    if (compact) resourcePanel.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [resourceOpen, selected, compact, reduced]);
  useEffect(() => {
    if (!currentPhase || lastPhase.current === currentPhase) return;
    setInspectChoiceOpen(false);
    setResourceOpen(false);
    if (lastPhase.current && lastPhase.current !== currentPhase) {
      const starting = lastPhase.current.includes(":brief:") && session?.stage === "play";
      const target = session?.stage === "completed" ? completedPanel.current : starting ? materialsPanel.current?.querySelector("summary") : missionHeading.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        block: compact ? "start" : "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
    }
    lastPhase.current = currentPhase;
  }, [currentPhase, reduced, compact]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const media = window.matchMedia(
      "(max-width: 900px), (prefers-reduced-motion: reduce)",
    );
    const update = () => setAutoQuality(automaticQuality());
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  dirty.current = !!(text || question || liked || disliked);
  useEffect(
    () =>
      registerNavigationGuard(
        async () =>
          !lock.current && (!dirty.current ||
          window.confirm(
            "아직 저장하지 않은 선택이나 질문이 있어요. 저장된 진행 상태는 유지돼요. 이동할까요?",
          )),
      ),
    [registerNavigationGuard],
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const load = useCallback(
    async (restart = false) => {
      if (!user) return;
      const generation = ++loadGeneration.current;
      setLoading(true);
      setError("");
      try {
        const id = restart
          ? null
          : new URLSearchParams(location.hash.split("?")[1] || "").get(
              "session",
            );
        const value = id
          ? await api<FarmSession>(`/simulations/${encodeURIComponent(id)}`)
          : await api<FarmSession>(
              "/simulations",
              json("POST", { careerId: cid }),
            );
        if (generation !== loadGeneration.current) return;
        if (value.careerId !== cid)
          throw new Error("선택한 직업의 체험 기록을 열어 주세요.");
        setSession(value);
        setAction(value.fieldwork?.actions[0]?.id || "ventilate");
        if (restart) {
          setSelected("");
          setText("");
          setQuestion("");
          setLiked("");
          setDisliked("");
          setInterest(3);
          keys.current.clear();
          retryTask.current = null;
        }
        history.replaceState(
          null,
          "",
          `${location.pathname}#simulation?career=${cid}&session=${value.id}`,
        );
      } catch (e) {
        if (generation === loadGeneration.current) setError(errorMessage(e));
      } finally {
        if (generation === loadGeneration.current) setLoading(false);
      }
    },
    [user?.username, cid],
  );
  useEffect(() => {
    void load();
    return () => {
      loadGeneration.current++;
    };
  }, [load]);
  const command = async (
    kind: string,
    extra: Record<string, unknown> = {},
    clear = false,
  ) => {
    if (!session || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const complete = kind === "complete";
    const body = {
      ...(complete ? {} : { kind }),
      ...extra,
      expectedVersion: session.version,
    };
    const fingerprint = JSON.stringify(body);
    if (!keys.current.has(fingerprint))
      keys.current.set(fingerprint, requestId());
    retryTask.current = () => void command(kind, extra, clear);
    try {
      const response = await api<FarmSession | { session: FarmSession }>(
        `/simulations/${session.id}/${complete ? "complete" : "turn"}`,
        json("POST", {
          ...body,
          clientRequestId: keys.current.get(fingerprint),
        }),
      );
      setSession("session" in response ? response.session : response);
      if (kind === "act")
        setSelected(
          workplace
            ? (
                {
                  rollback: "release",
                  scale: "server",
                  patch: "dashboard",
                  prepare: "cart",
                  silence: "call",
                  coordinate: "team",
                  align: "vehicle",
                  power: "battery",
                  review: "safety",
                  mix: "mixer",
                  change: "mixer",
                  repeat: "measurement",
                } as Record<string, string>
              )[String(extra.actionId)] || workplace.objects[3].id
            : extra.actionId === "water"
              ? "tank"
              : "controller",
        );
      if (clear) setText("");
      if (kind === "question") setQuestion("");
      if (complete) {
        setLiked("");
        setDisliked("");
      }
      retryTask.current = null;
      // Canonical save already succeeded; global summaries can refresh separately.
      void refresh().catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!user) return <CareerEntry mode="simulation" />;
  if (!session)
    return (
      <div className="kc-panel">
        <h1>{job.title} 출근 준비</h1>
        <p role="status">
          {loading
            ? "지난 업무 기록을 불러오는 중…"
            : "연결 상태를 확인해 주세요."}
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          className="kc-button"
          disabled={loading}
          onClick={() => void load()}
        >
          다시 불러오기
        </button>
      </div>
    );
  if (!session.fieldwork) return legacy;
  const field = session.fieldwork;
  const ongoing = session.stage === "play" || session.stage === "reflection";
  const scenarioBrief =
    workplace?.brief ||
    "센서의 숫자, 잎의 상태, 동료의 기록. 서로 다른 단서를 연결해 봐요.";
  const coachLabel =
    (session.coachMode ?? session.mode) === "ai"
      ? "시나리오 체험 · AI 코치 사용 가능"
      : "시나리오 체험 · 기본 학습 안내";
  const obj = field.objects.find((o) => o.id === selected);
  const inspected = obj && field.inspected.includes(obj.id);
  const readyToChoose =
    field.inspected.length >= 3 &&
    required.every((id) => field.inspected.includes(id));
  const missionTitle =
    session.stage === "brief"
      ? "먼저 오늘의 역할을 확인해요"
      : session.stage === "reflection"
        ? "오늘의 경험은 어땠나요?"
        : {
            inspect: "자료를 살펴보고 원인을 찾아요",
            act: "자료를 바탕으로 조치를 골라요",
            verify: "조치 뒤 무엇이 달라졌는지 확인해요",
            handover: "다음 동료에게 필요한 내용을 전해요",
            done: "오늘의 업무를 마쳤어요",
          }[field.phase];
  const missionDescription =
    session.stage === "brief"
      ? "필수 자료를 포함해 세 곳 이상을 살펴본 뒤, 원인과 조치를 골라요. 선택한 결과를 확인하면 수료 카드를 받을 수 있어요."
      : session.stage === "reflection"
        ? "맞았던 점과 어려웠던 점을 골라 남겨요. 관심이 줄어도 괜찮아요."
        : {
            inspect:
              "필수 자료를 포함해 세 곳 이상을 조사해요. 자료가 모이면 아래에서 가장 그럴듯한 원인을 골라요.",
            act: "사용할 시간과 자원을 비교하고, 이 조치를 고른 이유도 함께 골라요.",
            verify:
              "바뀐 수치와 조치 결과를 읽고, 다음에 확인할 내용을 골라요.",
            handover:
              "확인한 이상 징후, 수행한 조치와 아직 남은 일을 동료에게 알려요.",
            done: "선택한 과정은 작업일지에 저장되어 있어요.",
          }[field.phase];
  const inspect = (id: string) => {
    if (busy || session.stage === "brief") return;
    if (!resourceOpen || selected !== id) resourceTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(id);
    setResourceOpen(true);
    if (session.stage === "play" && !field.inspected.includes(id))
      void command("inspect", { objectId: id });
  };
  const phaseIndex =
    session.stage === "brief"
      ? 0
      : session.stage === "completed"
        ? 5
        : ["inspect", "act", "verify", "handover", "done"].indexOf(field.phase);
  const objectButtons = (
    <div className="kc-object-list">
      {field.objects.map((o, i) => (
        <button
          key={o.id}
          className={selected === o.id ? "is-selected" : ""}
          aria-pressed={selected === o.id}
          disabled={busy || session.stage === "brief"}
          onClick={() => inspect(o.id)}
        >
          <span>{String(i + 1).padStart(2, "0")}</span>
          <strong>{o.name}</strong>
          <small>
            {field.inspected.includes(o.id) ? "확인 완료" : required.includes(o.id) ? "필수 조사 · 3분" : "살펴보기 · 3분"}
          </small>
        </button>
      ))}
    </div>
  );
  return (
    <div className={`kc-fieldwork kc-shift-experience${ongoing ? " is-ongoing" : ""}`} data-stage={session.stage}>
      <header className="kc-topline">
        <button className="kc-text-button" onClick={() => go("simulation")}>
          <ArrowLeft size={16} /> 다른 직업
        </button>
        <span className="kc-room">
          {workplace?.room || "가상 스마트팜"} / 교육용 상황
        </span>
        <span className="kc-mode">{coachLabel}</span>
        <button className="kc-simulation-help" onClick={() => window.dispatchEvent(new Event("kingcareer:show-help"))}><CircleHelp size={17} /> 화면 안내</button>
      </header>
      <div className="kc-section-heading">
        <div>
          <span className="kc-eyebrow">{job.title} 직무체험</span>
          <h1>{workplace?.title || "온실의 아침을 부탁해."}</h1>
        </div>
      </div>
      {error && (
        <div className="kc-error" role="alert">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() =>
              retryTask.current ? retryTask.current() : void load()
            }
          >
            다시 시도
          </button>
          <button disabled={busy} onClick={() => void load()}>
            저장한 체험 다시 불러오기
          </button>
        </div>
      )}
      {session.stage === "completed" ? (
        <div ref={completedPanel} tabIndex={-1} className="kc-shift-completed" aria-label="직무체험 완료">
          <AwardsShelf activityId={session.activityId} />
          <div className="kc-note">
            <strong>이번 경험에서 어떤 나를 발견했나요?</strong>
            <p>
              방금 남긴 회고를 바탕으로 크랩이 경험을 정리해요. 내 생각과 맞는지
              확인하고 다음 활동을 골라 봐요.
            </p>
            <button
              className="kc-button"
              onClick={() =>
                go("review", cid, undefined, { activityId: session.activityId })
              }
            >
              크랩과 경험 돌아보기 <ArrowRight size={18} />
            </button>
          </div>
          <div className="kc-next">
            <div>
              <span className="kc-eyebrow">NEXT CHAPTER</span>
              <h2>{projectFor(cid).title}</h2>
              <p>
                오늘의 발견을 설계도와 개선 제안으로 남겨요. 나만의 첫
                포트폴리오가 돼요.
              </p>
            </div>
            <button className="kc-button" onClick={() => go("projects", cid)}>
              개선 프로젝트 만들기 <ArrowRight size={18} />
            </button>
          </div>
          <button
            className="kc-text-button"
            disabled={loading || busy}
            onClick={() => void load(true)}
          >
            <RotateCcw size={16} />{" "}
            {loading
              ? "다음 업무 준비 중…"
              : cid === "developer"
                ? "다른 사건으로 다시 출근"
                : "다시 출근하기"}
          </button>
        </div>
      ) : (
        <>
          <div
            className={`kc-workspace${session.stage === "brief" ? " is-brief" : ""}${ongoing && (field.phase !== "inspect" || inspectChoiceOpen) ? " has-decision" : ""}${flat ? " is-flat" : ""}`}
          >
            <details
              className="kc-scene-panel"
              ref={materialsPanel}
              open={session.stage !== "reflection"}
            >
              <summary
                className="kc-materials-heading"
                data-help="simulation-materials"
              >
                <span>
                  <strong>
                    {session.stage === "brief"
                      ? "현장 미리 보기"
                      : workplace?.room || "가상 스마트팜"}
                  </strong>
                  <small>
                    {session.stage === "brief"
                      ? "업무를 시작하면 자료를 조사할 수 있어요"
                      : `${field.inspected.length}곳 확인 · 언제든 다시 볼 수 있어요`}
                  </small>
                </span>
                <ChevronDown size={20} aria-hidden="true" />
              </summary>
              <div className="kc-resource-bar">
                <span>
                  <Clock3 size={17} /> 남은 시간 <b>{field.minutes}분</b>
                </span>
                <span>
                  <Coins size={17} /> 운영 자원 <b>{field.budget}</b>
                </span>
                <span>
                  <Thermometer size={17} /> {metric}{" "}
                  <b>
                    {field.metricValue ?? field.temperature}
                    {unit}
                  </b>
                </span>
              </div>
              <div className="kc-scene-toolbar">
                <span>{session.stage === "brief" ? "오늘 일할 곳을 둘러봐요" : "표시된 물건을 눌러 조사해요"}</span>
                <details className="kc-view-settings">
                <summary>화면 설정</summary>
                <div className="kc-scene-settings">
                  <button onClick={() => { setSelected(""); setResourceOpen(false); }}>전체 보기</button>
                  <label>
                    화질{" "}
                    <select
                      value={qualityPreference}
                      onChange={(e) => {
                        const value = e.target.value as QualityPreference;
                        setQualityPreference(value);
                        saveQualityPreference(value);
                      }}
                    >
                      <option value="auto">
                        자동 ({autoQuality === "balanced" ? "가벼움" : "높음"})
                      </option>
                      <option value="high">높음</option>
                      <option value="balanced">가벼움</option>
                    </select>
                  </label>
                </div>
                <small>드래그로 회전 · 휠로 확대</small>
                </details>
                <button onClick={() => setFlat((v) => !v)}>
                  {flat ? "3D 현장 보기" : "2D 목록 보기"}
                </button>
              </div>
              {!flat && (
                <div
                  className="kc-scene"
                  ref={sceneViewport}
                  aria-label="조사 가능한 직무 현장 3D 모형. 아래 목록에서도 같은 행동을 할 수 있습니다."
                >
                  <SceneBoundary
                    fallback={
                      <div className="kc-scene-fallback">
                        <img src={`/brand/12_career_kingcrabs/${cid}.png`} alt="" />
                        <p>
                        이 환경에서는 3D를 표시할 수 없어요. 아래 조사 목록으로
                        같은 체험을 이어갈 수 있어요.
                        </p>
                      </div>
                    }
                  >
                    <Suspense
                      fallback={
                        <div className="kc-scene-fallback">
                          <img src={`/brand/12_career_kingcrabs/${cid}.png`} alt="" />
                          <p role="status">현장 문을 여는 중… 아래 자료는 먼저 살펴볼 수 있어요.</p>
                        </div>
                      }
                    >
                      {cid === "farmer" ? (
                        <Greenhouse
                          field={field}
                          quality={quality}
                          selected={selected}
                          inspect={inspect}
                          reduced={calmScene}
                        />
                      ) : (
                        <WorkplaceScene
                          cid={cid}
                          field={field}
                          quality={quality}
                          selected={selected}
                          inspect={inspect}
                          reduced={calmScene}
                        />
                      )}
                    </Suspense>
                  </SceneBoundary>
                </div>
              )}
              <div className="kc-material-desk">
              <details className="kc-material-index" open={flat}>
                <summary><Search size={17} /> 자료 목록으로 살펴보기 <span>{field.inspected.length} / {field.objects.length}</span></summary>
                {objectButtons}
              </details>
              {resourceOpen && obj && <div ref={resourcePanel} tabIndex={-1} className="kc-material-reading" role="region" aria-label={`${obj.name} 조사 자료`} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); closeResource(); } }}>
                <motion.div
                  className="kc-inspection"
                  key={obj.id}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <button className="kc-resource-close" aria-label="조사 자료 닫기" onClick={closeResource}><X size={18} /></button>
                  <span className="kc-eyebrow">
                    <Search size={14} /> {obj.name}
                  </span>
                  <div aria-live="polite" aria-atomic="true">
                  {inspected ? (
                    <>
                      <h3>{obj.reading}</h3>
                      <p>{obj.detail}</p>
                    </>
                  ) : (
                    <>
                      <p>
                        {busy
                          ? "현장 자료를 기록하는 중…"
                          : "조사 기록이 아직 저장되지 않았어요."}
                      </p>
                      <button
                        disabled={busy || session.stage !== "play"}
                        onClick={() => inspect(obj.id)}
                      >
                        조사 다시 시도
                      </button>
                    </>
                  )}
                  </div>
                </motion.div>
              </div>}
              </div>
              {session.stage === "play" && field.phase === "inspect" && (
                <div className="kc-materials-next">
                  <p>
                    {readyToChoose
                      ? "판단에 필요한 자료를 모았어요."
                      : "필수 자료를 포함해 세 곳 이상 확인해 주세요."}
                  </p>
                  <button
                    className="kc-button"
                    disabled={!readyToChoose || busy}
                    onClick={() => {
                      setInspectChoiceOpen(true);
                      setResourceOpen(false);
                      requestAnimationFrame(() => {
                      choicesHeading.current?.focus({ preventScroll: true });
                      choicesHeading.current?.scrollIntoView({
                        block: "start",
                        behavior: reduced ? "auto" : "smooth",
                      });
                      });
                    }}
                  >
                    원인 선택으로 이동 <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </details>
          <div className="kc-mission-bar">

          <section
            className="kc-current-task"
            aria-labelledby="current-task-title"
          >
            <div className="kc-colleague"><img src={`/brand/12_career_kingcrabs/${cid}.png`} alt="" /><span>동료 크랩</span></div>
            <div className="kc-current-task-copy">
              {!ongoing && <span className="kc-eyebrow">
                {session.stage === "brief" ? "업무 안내" : "지금 할 일"}
              </span>}
              <h2
                id="current-task-title"
                data-help="simulation-task"
                ref={missionHeading}
                tabIndex={-1}
              >
                {missionTitle}
              </h2>
              <p className="kc-colleague-message">{session.stage === "brief" ? scenarioBrief : missionDescription}</p>
              {session.stage === "play" && field.phase === "inspect" && (
                <p className="kc-material-progress" role="status">
                  조사 {field.inspected.length}/{field.objects.length}곳 ·{" "}
                  {required
                    .map(
                      (id) =>
                        `${field.objects.find((o) => o.id === id)?.name}: ${field.inspected.includes(id) ? "확인" : "미확인"}`,
                    )
                    .join(" · ")}
                </p>
              )}
              {ongoing && (
                <details className="kc-scenario-context">
                  <summary>처음 상황 다시 보기</summary>
                  <p>{missionDescription}</p>
                  <p>{scenarioBrief}</p>
                  <small>
                    {workplace?.room || "가상 스마트팜"} / 교육용 상황 ·{" "}
                    {coachLabel}
                  </small>
                </details>
              )}
              {session.startingPoint && (
                <details className="diagnosis-guidance">
                  <summary>
                    {session.startingPoint.label} · 도움이 필요해요
                  </summary>
                  <p>
                    {
                      session.startingPoint.guidance[
                        session.stage === "play" ? field.phase : session.stage
                      ]
                    }
                  </p>
                  {session.stage === "brief" && (
                    <small>{session.startingPoint.reason}</small>
                  )}
                </details>
              )}
            </div>
            {session.stage === "brief" && (
              <button
                className="kc-button"
                data-help="simulation-choice"
                disabled={busy}
                onClick={() => void command("start")}
              >
                {busy ? "업무 준비 중…" : "업무 시작"} <ArrowRight size={18} />
              </button>
            )}
          </section>
          </div>
            {session.stage !== "brief" && (
              <aside className={`kc-task-panel${session.stage === "play" && field.phase === "inspect" && !inspectChoiceOpen ? " is-waiting-for-materials" : ""}`} aria-busy={busy}>
                {session.stage === "reflection" ? (
                  <>
                    <h2
                      ref={choicesHeading}
                      tabIndex={-1}
                      data-help="simulation-choice"
                    >
                      나의 회고
                    </h2>
                    <p>{field.ending}</p>
                    {field.action && <details className="kc-result-recap"><summary>내 조치와 결과 다시 보기</summary><ActionOutcome field={field} /></details>}
                    <details className="kc-reflection-extra"><summary>좋았던 점과 어려웠던 점 남기기 <small>선택</small></summary>
                    <ChoiceCards
                      legend="어떤 순간이 좋았어? (선택)"
                      options={field.options.liked}
                      value={liked}
                      onChange={setLiked}
                      disabled={busy}
                    />
                    <ChoiceCards
                      legend="어떤 점이 어려웠어? (선택)"
                      options={field.options.disliked}
                      value={disliked}
                      onChange={setDisliked}
                      disabled={busy}
                    />
                    </details>
                    <ChoiceCards
                      legend="오늘의 내 마음과 가까운 것은?"
                      options={field.options.reflection}
                      value={text}
                      onChange={setText}
                      disabled={busy}
                    />
                    <fieldset className="kc-reflection-interest" disabled={busy}>
                      <legend>체험 후 관심도 · {interest}/5</legend>
                      <div>{[1, 2, 3, 4, 5].map(value => <label key={value}><input type="radio" name="shift-interest" value={value} checked={interest === value} onChange={() => setInterest(value)} /><span>{value}</span></label>)}</div>
                      <p><span>다른 직업이 궁금해</span><span>더 해보고 싶어</span></p>
                    </fieldset>
                    <small>
                      관심이 줄어도 괜찮아요. 선택의 근거를 얻은 경험이에요.
                    </small>
                    <button
                      className="kc-button kc-decision-submit"
                      disabled={busy || !text}
                      onClick={() =>
                        void command(
                          "complete",
                          {
                            reflection:
                              field.options.reflection.find(
                                (o) => o.id === text,
                              )?.label || "",
                            liked:
                              field.options.liked.find((o) => o.id === liked)
                                ?.label || "",
                            disliked:
                              field.options.disliked.find(
                                (o) => o.id === disliked,
                              )?.label || "",
                            interest,
                          },
                          true,
                        )
                      }
                    >
                      회고 저장하고 수료 카드 받기
                    </button>
                  </>
                ) : (
                  <>
                    <span className="kc-eyebrow">나의 선택</span>
                    <h2
                      ref={choicesHeading}
                      tabIndex={-1}
                      data-help="simulation-choice"
                    >
                      {
                        {
                          inspect: "흩어진 단서를 연결해 봐.",
                          act: "무엇부터 바꿔볼까?",
                          verify: "조치가 효과가 있었을까?",
                          handover: "다음 동료에게 알려줘.",
                          done: "업무 완료",
                        }[field.phase]
                      }
                    </h2>
                    {field.phase === "inspect" && (
                      <>
                        <p>
                          {readyToChoose
                            ? "확인한 자료를 떠올리며 원인을 골라요."
                            : "현장 자료를 먼저 살펴보세요. 필수 자료를 포함해 세 곳 이상 확인하면 선택을 저장할 수 있어요."}
                        </p>
                      </>
                    )}
                    {field.phase === "act" && (
                      <div className="kc-action-options">
                        {field.actions.map((a) => (
                          <label
                            key={a.id}
                            className={action === a.id ? "is-selected" : ""}
                          >
                            <input
                              type="radio"
                              name="farm-action"
                              disabled={busy}
                              checked={action === a.id}
                              onChange={() => setAction(a.id)}
                            />
                            <span>
                              <strong>{a.name}</strong>
                              <small>
                                {a.minutes}분 · 운영 자원 {a.cost}
                              </small>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    {(field.phase === "verify" || field.phase === "handover") && <ActionOutcome field={field} />}
                    {field.phase === "handover" && (
                      <p>
                        확인한 이상 징후, 수행한 조치, 재측정 결과와 아직 남은
                        일 중 무엇을 다음 담당자에게 전달할지 골라 주세요.
                      </p>
                    )}
                    <ChoiceCards
                      legend={
                        {
                          inspect: "어떤 원인일까?",
                          act: "이 조치를 고른 이유는?",
                          verify: "다음에는 무엇을 확인할까?",
                          handover: "동료에게 무엇을 알려줄까?",
                          done: "나의 선택",
                        }[field.phase]
                      }
                      options={
                        field.options[
                          field.phase === "inspect" ? "compare" : field.phase
                        ] || []
                      }
                      value={text}
                      onChange={setText}
                      disabled={busy}
                    />
                    <button
                      className="kc-button kc-decision-submit"
                      disabled={
                        busy ||
                        !text ||
                        (field.phase === "inspect" &&
                          (required.some(
                            (id) => !field.inspected.includes(id),
                          ) ||
                            field.inspected.length < 3))
                      }
                      onClick={() =>
                        void command(
                          field.phase === "inspect" ? "compare" : field.phase,
                          {
                            optionId: text,
                            ...(field.phase === "act"
                              ? { actionId: action }
                              : {}),
                          },
                          true,
                        )
                      }
                    >
                      {busy ? "선택 저장 중…" : "이렇게 해볼래요"}
                      <ArrowRight size={18} />
                    </button>
                    <details className="kc-coach">
                      <summary>막혔다면 크랩 코치에게 질문하기</summary>
                      <p>
                        {(session.coachMode ?? session.mode) === "ai"
                          ? "AI 코치가 현재 상황을 바탕으로 설명해 줘요. 선택과 결과는 바꾸지 않아요."
                          : "질문을 저장하고 미리 작성된 학습 안내를 보여줘요. AI가 생성한 답변은 아니에요."}
                      </p>
                      <textarea
                        aria-label="코치에게 질문"
                        maxLength={5000}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                      />
                      <button
                        disabled={busy || !question.trim()}
                        onClick={() =>
                          void command("question", { text: question })
                        }
                      >
                        질문 보내기
                      </button>
                      {session.questionReply && (
                        <p className="kc-note">{session.questionReply}</p>
                      )}
                    </details>
                  </>
                )}
              </aside>
            )}
          </div>
          <details className="kc-shift-progress"><summary>진행 상황 · {Math.min(phaseIndex + 1, 5)} / 5</summary>
          <ol className="kc-phases" aria-label="직무체험 진행 단계">
            {[
              "현장 조사",
              "조치 선택",
              "결과 확인",
              "업무 인계",
              "나의 회고",
            ].map((s, i) => (
              <li
                key={s}
                aria-current={phaseIndex === i ? "step" : undefined}
                className={i <= phaseIndex ? "is-active" : ""}
              >
                <span>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          </details>
          <details className="kc-log">
            <summary data-help="simulation-result">
              <NotebookPen size={18} /> 나의 교대 작업일지 · {field.log.length}
              건
            </summary>
            {field.log.length ? (
              <ol>
                {field.log.map((entry, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <p>{entry.text}</p>
                      {entry.result && <small>{entry.result}</small>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>조사한 자료와 남긴 판단이 이곳에 차곡차곡 쌓여요.</p>
            )}
            <small>
              반복 열람은 시간을 다시 쓰거나 경험 점수를 추가하지 않아요.
            </small>
          </details>
        </>
      )}
      <footer className="kc-field-footer">
        <RotateCcw size={14} /> 마지막으로 저장된 단계부터 이어할 수 있어요. ·
        게임 자원은 직무 능력 점수가 아니에요.
      </footer>
    </div>
  );
}
