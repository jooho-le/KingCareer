import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Flag,
  Lightbulb,
  MessageCircle,
  Play,
  RotateCcw,
  Send,
  Target,
} from "lucide-react";
import {
  Button,
  CareerCard,
  PageHeading,
  Progress,
  Tag,
} from "../components";
import { careers, dimensions, getCareer } from "../data";
import type { Activity, CareerId } from "../data";
import { api, ApiError, json, requestId } from "../api";
import type { SimulationSession } from "../api";
import { useApp } from "../store";
import ChoiceCards from "../fieldwork/ChoiceCards";
import StartingPointCard from "../fieldwork/StartingPointCard";
import ProjectLobby from "./ProjectLobby";
import SimulationLobby from "./SimulationLobby";

const reflectionChoices = [
  "생각보다 여러 정보를 살펴보고 판단하는 직업이었어요.",
  "동료와 협력하고 질문하는 일이 중요하다는 걸 알았어요.",
  "직접 경험해 보니 다른 직업도 더 알아보고 싶어요.",
];
const likedChoices = [
  "문제의 원인을 찾는 과정",
  "해결 방법을 선택하는 과정",
  "새로운 일을 알아가는 과정",
  "아직 잘 모르겠어요",
];
const difficultChoices = [
  "정보를 비교하는 것이 어려웠어요",
  "선택을 결정하는 것이 어려웠어요",
  "크게 어려운 점은 없었어요",
];
const optionsFor = (items: string[]) =>
  items.map((label) => ({ id: label, label }));

const Smartfarm = lazy(() => import("../fieldwork/Smartfarm"));
const Workshop = lazy(() => import("../fieldwork/Workshop"));

const questions = [
  {
    title: "이 직업을 얼마나 알고 있어?",
    description: "지금 알고 있는 만큼 편하게 알려줘.",
    answers: [
      "이름을 처음 들어봤어요",
      "이름과 하는 일을 조금 알아요",
      "다른 사람에게 하는 일을 설명할 수 있어요",
    ],
  },
  {
    title: "실제 업무를 떠올릴 수 있어?",
    description: "하루 동안 어떤 일을 하고, 어떤 판단을 하는지 생각해 봐.",
    answers: [
      "아직 잘 모르겠어요",
      "영상이나 글에서 접해봤어요",
      "업무 과정과 판단의 이유를 설명할 수 있어요",
    ],
  },
  {
    title: "직접 해본 활동이 있어?",
    description: "수업에서 한 작은 활동이나 온라인 체험도 괜찮아.",
    answers: [
      "아직 관련 활동을 해보지 않았어요",
      "짧은 체험이나 연습을 해봤어요",
      "직접 프로젝트 결과물을 만들어봤어요",
    ],
  },
  {
    title: "어떤 역량을 사용하는 직업일까?",
    description: "이 일을 할 때 어떤 역량이 필요한지 떠올려 봐.",
    answers: [
      "어떤 역량이 필요한지 모르겠어요",
      "필요한 역량을 한두 가지 알아요",
      "역량을 실제 업무와 연결해서 설명할 수 있어요",
    ],
  },
  {
    title: "어떤 공부와 연결되는지 알아?",
    description: "관련 과목이나 전공을 찾아본 적이 있는지 알려줘.",
    answers: [
      "관련 과목이나 전공을 아직 몰라요",
      "관련된 과목이나 전공 이름을 알아요",
      "관련 전공의 수업 내용을 살펴봤어요",
    ],
  },
  {
    title: "이 일을 하는 사람을 만나봤어?",
    description:
      "실제 현직자와 대화한 경험을 알려줘. AI와의 대화는 포함하지 않아.",
    answers: [
      "아직 직접 대화한 적은 없어요",
      "강연이나 온라인 만남에 참여했어요",
      "현직자에게 직접 질문하고 대화했어요",
    ],
  },
];

function useRequestKeys() {
  const keys = useRef(new Map<string, string>());
  return (body: unknown) => {
    const fingerprint = JSON.stringify(body);
    if (!keys.current.has(fingerprint))
      keys.current.set(fingerprint, requestId());
    return keys.current.get(fingerprint)!;
  };
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const running = useRef(false);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const run = async (task: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    pending.current = task;
    setBusy(true);
    setError(null);
    try {
      await task();
      pending.current = null;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("연결을 확인하고 다시 시도해 주세요."),
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return {
    busy,
    error,
    run,
    retry: () => {
      if (pending.current) void run(pending.current);
    },
    clear: () => {
      setError(null);
      pending.current = null;
    },
  };
}

function RequestError({
  error,
  retry,
  busy,
  onConflict,
}: {
  error: Error | null;
  retry: () => void;
  busy: boolean;
  onConflict?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="request-error" role="alert">
      <p>{error.message}</p>
      <p>입력한 내용은 이 화면에 남아 있어요.</p>
      <div className="button-row">
        <Button kind="secondary" disabled={busy} onClick={retry}>
          다시 시도하기
        </Button>
        {error instanceof ApiError && error.status === 409 && onConflict && (
          <Button kind="ghost" disabled={busy} onClick={onConflict}>
            최신 저장 상태 불러오기
          </Button>
        )}
      </div>
    </div>
  );
}

function Mascot({
  pose = "mascot_00_original",
  large = false,
}: {
  pose?: string;
  large?: boolean;
}) {
  return (
    <img
      className={large ? "activity-mascot hero-mascot" : "activity-mascot"}
      src={`/brand/01_mascots/${pose}.png`}
      alt="함께 탐험하는 KingCareer 캐릭터"
      width={large ? 240 : 108}
      height={large ? 240 : 108}
    />
  );
}

export function Diagnosis() {
  const { go, careerId, setCareerId, refresh, toast, requireAuth, catalog, state } =
    useApp();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(6).fill(-1));
  const [result, setResult] = useState<Activity | null>(null);
  const [editingReview, setEditingReview] = useState(false);
  const action = useAction();
  const keyFor = useRequestKeys();
  const reduceMotion = useReducedMotion();
  const savedPoint = state.gaps[careerId]?.startingPoint;
  const next = state.recommendations.find((item) => item.careerId === careerId);
  useEffect(() => {
    document.querySelector<HTMLElement>(".diagnosis-focus")?.focus({ preventScroll: true });
  }, [step]);
  const availableCareers = catalog.length ? catalog : careers;
  const job =
    availableCareers.find((item) => item.id === careerId) ??
    getCareer(careerId);
  const finish = () => {
    if (!requireAuth()) return;
    const payload = { careerId, answers: [...answers] };
    const clientRequestId = keyFor(payload);
    void action.run(async () => {
      const activity = await api<Activity>(
        "/diagnoses",
        json("POST", { ...payload, clientRequestId }),
      );
      setResult(activity);
      setStep(8);
      await refresh().catch(() =>
        toast("진단은 저장됐어요. 경험지도는 연결 후 다시 불러와 주세요."),
      );
    });
  };
  return (
    <>
      <PageHeading
        eyebrow="MY STARTING POINT"
        title="꿈 말고, 해본 것부터 이야기해 봐"
        description="지금까지 알게 된 것과 직접 해본 일을 모아 나의 출발점을 찾아보자."
      />
      {step === 0 && savedPoint && <StartingPointCard point={savedPoint} next={next} />}
      {step === 0 ? (
        <section className="panel diagnosis-intro">
          <div className="activity-hero-row">
            <div className="intro-copy">
              <Tag color="orange">약 3분 · 6개의 질문</Tag>
              <h2>
                같은 꿈이어도,
                <br />
                필요한 경험은 다르니까.
              </h2>
              <p>
                관심 있는 직업 하나를 고르고 알고 있는 것과 경험한 것을 알려줘.
              </p>
            </div>
            <Mascot large />
          </div>
          <div className="career-select-grid">
            {availableCareers.map((c) => (
              <button
                className={`career-select ${careerId === c.id ? "selected" : ""}`}
                key={c.id}
                aria-pressed={careerId === c.id}
                onClick={() => {
                  setCareerId(c.id);
                  setAnswers(Array(6).fill(-1));
                  setResult(null);
                  setEditingReview(false);
                }}
              >
                <span className={`job-badge ${c.color}`}>
                  <img
                    src={`/brand/12_career_kingcrabs/${c.id}.png`}
                    alt=""
                    width={76}
                    height={76}
                    loading="lazy"
                  />
                </span>
                <b>{c.title}</b>
                {careerId === c.id && <Check size={18} />}
              </button>
            ))}
          </div>
          <Button
            onClick={() => {
              if (requireAuth()) setStep(1);
            }}
          >
            {savedPoint ? "지금의 경험으로 다시 진단하기" : "나의 출발점 알아보기"}
            <ArrowRight size={18} />
          </Button>
        </section>
      ) : step <= 6 ? (
        <section className="panel questionnaire">
          <div className="question-top">
            <Tag>{job.title}</Tag>
            <span>{String(step).padStart(2, "0")} / 06</span>
          </div>
          <Progress value={(step / 6) * 100} />
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: reduceMotion ? 0 : 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduceMotion ? 0 : -20 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              <span className="eyebrow">{dimensions[step - 1]}</span>
              <h2 className="diagnosis-focus" tabIndex={-1}>{questions[step - 1].title}</h2>
              <p>{questions[step - 1].description}</p>
              <div className="choices">
                {[...questions[step - 1].answers, "아직 모르겠어요 / 기억이 나지 않아요"].map((answer, i) => (
                  <button
                    key={answer}
                    disabled={action.busy}
                    className={answers[step - 1] === i ? "selected" : ""}
                    aria-pressed={answers[step - 1] === i}
                    onClick={() => {
                      action.clear();
                      setAnswers((old) =>
                        old.map((v, index) => (index === step - 1 ? i : v)),
                      );
                    }}
                  >
                    <span>{i + 1}</span>
                    {answer}
                    {answers[step - 1] === i && <Check size={20} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
          <RequestError {...action} />
          <div className="form-actions">
            <Button
              kind="ghost"
              disabled={action.busy}
              onClick={() => {
                action.clear();
                setStep(step - 1);
              }}
            >
              <ArrowLeft size={17} />
              이전
            </Button>
            <Button
              disabled={answers[step - 1] < 0 || action.busy}
              onClick={() => {
                setStep(editingReview ? 7 : step + 1);
                setEditingReview(false);
              }}
            >
              {action.busy
                ? "진단 저장 중"
                : step === 6 || editingReview
                  ? "답변 함께 확인하기"
                  : "다음 질문"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      ) : step === 7 ? (
        <section className="panel diagnosis-review">
          <Tag color="orange">마지막으로 확인해 봐</Tag>
          <h2 className="diagnosis-focus" tabIndex={-1}>{job.title}, 지금의 내 출발점</h2>
          <p>정답은 없어. 다른 답이 떠오르면 수정한 뒤 기록해 줘.</p>
          {questions.map((question, i) => (
            <div className="diagnosis-review-row" key={question.title}>
              <div><b>{question.title}</b><p>{question.answers[answers[i]] ?? "아직 모르겠어요 / 기억이 나지 않아요"}</p></div>
              <Button kind="ghost" disabled={action.busy} onClick={() => { action.clear(); setEditingReview(true); setStep(i + 1); }}>수정</Button>
            </div>
          ))}
          <RequestError {...action} />
          <Button disabled={action.busy || answers.some((answer) => answer < 0)} onClick={finish}>
            {action.busy ? "출발점 저장 중…" : "내 출발점과 추천 경험 보기"}<ArrowRight size={17} />
          </Button>
        </section>
      ) : (
        result && (
          <section className="panel result-panel">
            <Mascot pose="mascot_06_celebrate" />
            <Tag color="purple">나의 출발점을 기록했어</Tag>
            <h2 className="diagnosis-focus" tabIndex={-1}>이제 너의 출발점이 생겼어.</h2>
            <p>
              {job.title}에 대해 알려준 내용을 저장했어. 직접 경험하며 지도를
              채워보자.
            </p>
            {result.startingPoint && <StartingPointCard point={result.startingPoint} next={result.nextActivity} />}
            <p>{result.feedback}</p>
            {!result.startingPoint && <div className="button-row centered">
              <Button onClick={() => go("map", careerId)}>
                나의 진로 기록 보기
                <ArrowUpRight size={17} />
              </Button>
              <Button
                kind="secondary"
                onClick={() => go("simulation", careerId)}
              >
                직접 경험해 보기
                <Play size={16} />
              </Button>
            </div>}
          </section>
        )
      )}
    </>
  );
}

const simulationBackgrounds: Record<CareerId, string> = {
  developer: "bg_03_developer",
  nurse: "bg_04_nurse",
  farmer: "bg_05_smartfarm",
  engineer: "bg_06_automotive",
  researcher: "bg_07_food_research",
};
type TurnInput = {
  kind: "start" | "choice" | "free" | "question" | "continue";
  choiceIndex?: number;
  text?: string;
};

export function Simulation() {
  const selected = new URLSearchParams(location.hash.split("?")[1] || "").get(
    "career",
  );
  const farm = [
    "developer",
    "nurse",
    "farmer",
    "engineer",
    "researcher",
  ].includes(selected || "");
  return farm ? (
    <Suspense fallback={<p role="status">현장 체험을 준비하는 중…</p>}>
      <Smartfarm legacy={<ClassicSimulation />} />
    </Suspense>
  ) : (
    <SimulationLobby />
  );
}

function ClassicSimulation() {
  const {
    state,
    go,
    careerId,
    setCareerId,
    save,
    refresh,
    toast,
    requireAuth,
    user,
    catalog,
  } = useApp();
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [free, setFree] = useState("");
  const [freeMode, setFreeMode] = useState(false);
  const [question, setQuestion] = useState("");
  const [reflection, setReflection] = useState("");
  const [liked, setLiked] = useState("");
  const [disliked, setDisliked] = useState("");
  const [interest, setInterest] = useState(3);
  const [completed, setCompleted] = useState<Activity | null>(null);
  const action = useAction();
  const keyFor = useRequestKeys();
  const initialized = useRef(false);
  const reduceMotion = useReducedMotion();
  const availableCareers = catalog.length ? catalog : careers;
  const job =
    availableCareers.find(
      (item) => item.id === (session?.careerId ?? careerId),
    ) ?? getCareer(session?.careerId ?? careerId);
  const open = (id: CareerId, sessionId?: string) => {
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    if (!sessionId && params.get("career") !== id) {
      go("simulation", id);
      return;
    }
    if (!requireAuth()) return;
    setCareerId(id);
    void action.run(async () => {
      const next = await api<SimulationSession>(
        sessionId
          ? `/simulations/${encodeURIComponent(sessionId)}`
          : "/simulations",
        sessionId ? undefined : json("POST", { careerId: id }),
      );
      setSession(next);
      setCareerId(next.careerId);
      setChoice(null);
      setFree("");
      setQuestion("");
      setReflection("");
      setLiked("");
      setDisliked("");
      setCompleted(null);
      setInterest(3);
    });
  };
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    if (params.has("career") || params.has("session"))
      open(careerId, params.get("session") ?? undefined);
    // Saved routes load once; subsequent session changes are explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const turn = (input: TurnInput) => {
    if (!session || !requireAuth()) return;
    const payload = { ...input, expectedVersion: session.version };
    const clientRequestId = keyFor({ sessionId: session.id, ...payload });
    const id = session.id;
    void action.run(async () => {
      const next = await api<SimulationSession>(
        `/simulations/${id}/turn`,
        json("POST", { ...payload, clientRequestId }),
      );
      setSession(next);
      if (input.kind === "question") setQuestion("");
      if (input.kind === "continue" || input.kind === "start") {
        setChoice(null);
        setFree("");
      }
    });
  };
  const reload = () => {
    if (!session) return;
    const id = session.id;
    void action.run(async () => {
      setSession(await api<SimulationSession>(`/simulations/${id}`));
    });
  };
  const finish = () => {
    if (!session || !requireAuth()) return;
    const id = session.id;
    const payload = {
      reflection: reflection.trim(),
      liked: liked.trim(),
      disliked: disliked.trim(),
      interest,
      expectedVersion: session.version,
    };
    const clientRequestId = keyFor({ id, ...payload });
    void action.run(async () => {
      const result = await api<{
        session: SimulationSession;
        activity: Activity;
      }>(
        `/simulations/${id}/complete`,
        json("POST", { ...payload, clientRequestId }),
      );
      setSession(result.session);
      setCompleted(result.activity);
      await refresh().catch(() =>
        toast("체험 기록은 저장됐어요. 경험지도는 연결 후 다시 불러와 주세요."),
      );
    });
  };
  const stage = session?.stage ?? "lobby";
  return (
    <>
      <PageHeading
        eyebrow="STEP INTO A NEW DAY"
        title={
          stage === "lobby"
            ? "오늘은 어떤 내가 되어볼까?"
            : `${job.title}의 하루`
        }
        description={
          stage === "lobby"
            ? "다른 사람의 하루에 들어가 보면, 몰랐던 내가 보일 거야."
            : "가상의 직무 상황에서 선택하고, 네 생각을 남겨봐."
        }
      />
      <RequestError {...action} onConflict={reload} />
      {stage === "lobby" ? (
        <>
          <section className="simulation-intro">
            <img
              className="lobby-crab"
              src="/brand/12_career_kingcrabs/engineer.png"
              alt="직무 현장으로 안내하는 크랩"
              width={180}
              height={180}
            />
            <div>
              <h3>새로운 직업의 첫 출근, 준비됐어?</h3>
              <p>
                현장을 살펴보고, 직접 조치를 골라봐. 하루의 업무를 마치면 나만의
                수료 카드가 생겨. 하던 체험은 이어서 할 수 있어.
              </p>
            </div>
            <Tag color="orange">5가지 직업의 하루</Tag>
          </section>
          {action.busy && (
            <p className="save-status" role="status">
              저장된 체험을 불러오는 중이에요.
            </p>
          )}
          <div className="career-grid three">
            {availableCareers.map((c) => (
              <CareerCard
                key={c.id}
                career={c}
                saved={state.saved.includes(c.id)}
                onSave={() => {
                  void save(c.id).catch(() =>
                    toast("관심 직업을 저장하지 못했어요. 다시 시도해 주세요."),
                  );
                }}
                onOpen={() => {
                  if (!action.busy) open(c.id);
                }}
              />
            ))}
          </div>
          <p className="fine-print">
            체험은 교육용 시나리오로 진행돼요. 선택한 조치에 따라 현장의 변화와
            결과를 확인할 수 있어요.
          </p>
        </>
      ) : (
        session && (
          <>
            <div className="simulation-mode">
              <Tag color={session.mode === "template" ? "orange" : "purple"}>
                {session.mode === "template"
                  ? "시나리오 체험 · AI 응답 없음"
                  : "AI 시뮬레이션"}
              </Tag>
              <span className="save-status" role="status">
                {action.busy ? "체험 기록 저장 중" : "저장한 체험 이어가기"}
              </span>
            </div>
            {stage === "brief" ? (
              <section className="panel brief-panel">
                <button
                  className="text-button"
                  disabled={action.busy}
                  onClick={() => {
                    action.clear();
                    setSession(null);
                  }}
                >
                  <ArrowLeft size={16} />
                  다른 직업 보기
                </button>
                <div
                  className="simulation-scene"
                  style={{
                    backgroundImage: `url(/brand/11_backgrounds/${simulationBackgrounds[job.id]}.svg)`,
                  }}
                >
                  <Mascot large />
                </div>
                <Tag color={job.color}>오늘 너의 역할</Tag>
                <h2>{job.title}</h2>
                <p>{job.intro}</p>
                <div className="brief-facts">
                  <div>
                    <Flag size={22} />
                    <span>배경</span>
                    <b>{job.region}의 가상 직무팀</b>
                  </div>
                  <div>
                    <Target size={22} />
                    <span>오늘의 목표</span>
                    <b>상황을 살펴보고 내 생각 제안하기</b>
                  </div>
                  <div>
                    <Clock3 size={22} />
                    <span>예상 시간</span>
                    <b>약 10분 · 3개의 상황</b>
                  </div>
                </div>
                <div className="chip-list centered">
                  {job.skills.map((s) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                </div>
                <Button
                  disabled={action.busy}
                  onClick={() => turn({ kind: "start" })}
                >
                  이 역할로 시작하기
                  <Play size={17} />
                </Button>
                <p className="fine-print">
                  학습용 가상 상황이에요. 실제 기관의 업무 지침이 아니에요.
                </p>
              </section>
            ) : stage === "play" ? (
              <div className="simulation-layout">
                <section className="panel scenario-panel">
                  <div className="question-top">
                    <Tag color={job.color}>{job.title}</Tag>
                    <span>
                      상황 {session.step + 1} / {job.scenarios.length}
                    </span>
                  </div>
                  <Progress
                    value={
                      ((session.step + (session.response ? 1 : 0)) /
                        job.scenarios.length) *
                      100
                    }
                  />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={session.step}
                      initial={{ opacity: 0, y: reduceMotion ? 0 : 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    >
                      {session.step > 0 && (
                        <div className="previous-context">
                          <Check size={16} />
                          <span>
                            지난 선택: {session.turns[session.step - 1]?.answer}
                            <small>
                              {session.turns[session.step - 1]?.response}
                            </small>
                          </span>
                        </div>
                      )}
                      <h2>{session.scenario.title}</h2>
                      <p className="scenario-text">{session.scenario.text}</p>
                      {!session.response ? (
                        <>
                          <div className="input-mode">
                            <button
                              disabled={action.busy}
                              className={!freeMode ? "selected" : ""}
                              onClick={() => setFreeMode(false)}
                            >
                              선택해서 답하기
                            </button>
                            <button
                              disabled={action.busy}
                              className={freeMode ? "selected" : ""}
                              onClick={() => setFreeMode(true)}
                            >
                              내 생각 직접 쓰기
                            </button>
                          </div>
                          {freeMode ? (
                            <label className="form-field">
                              너라면 어떻게 할래?
                              <textarea
                                disabled={action.busy}
                                value={free}
                                onChange={(e) => setFree(e.target.value)}
                                placeholder="내 생각과 이유를 5자 이상 적어줘."
                                rows={4}
                                maxLength={1500}
                              />
                              <small>
                                {free.length} / 1,500 ·{" "}
                                {session.mode === "template"
                                  ? "자유 답변은 저장되며 AI 내용 평가는 하지 않아요."
                                  : "생성된 피드백과 네 생각을 비교해 봐."}
                              </small>
                            </label>
                          ) : (
                            <div className="choices">
                              {session.scenario.choices.map((answer, i) => (
                                <button
                                  disabled={action.busy}
                                  key={answer}
                                  className={choice === i ? "selected" : ""}
                                  aria-pressed={choice === i}
                                  onClick={() => setChoice(i)}
                                >
                                  <span>{String.fromCharCode(65 + i)}</span>
                                  {answer}
                                  {choice === i && <Check size={19} />}
                                </button>
                              ))}
                            </div>
                          )}
                          <Button
                            className="full-width"
                            disabled={
                              action.busy ||
                              (freeMode
                                ? free.trim().length < 5
                                : choice === null)
                            }
                            onClick={() =>
                              turn(
                                freeMode
                                  ? { kind: "free", text: free.trim() }
                                  : { kind: "choice", choiceIndex: choice! },
                              )
                            }
                          >
                            {action.busy ? "기록 중" : "나의 생각 전달하기"}
                            <Send size={17} />
                          </Button>
                        </>
                      ) : (
                        <div className="scenario-response">
                          <div className="my-answer">
                            <span>나의 선택</span>
                            <p>{session.response.answer}</p>
                          </div>
                          <div className="ai-answer">
                            <Mascot pose="mascot_08_guide" />
                            <div>
                              <b>
                                {session.mode === "template"
                                  ? "시나리오의 다음 장면"
                                  : "AI의 다음 장면"}
                              </b>
                              <p>{session.response.response}</p>
                              <div className="lesson">
                                <Lightbulb size={18} />
                                <span>{session.response.lesson}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            className="full-width"
                            disabled={action.busy}
                            onClick={() => turn({ kind: "continue" })}
                          >
                            {session.step === job.scenarios.length - 1
                              ? "나의 경험 돌아보기"
                              : "다음 상황으로"}
                            <ArrowRight size={17} />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </section>
                <aside className="panel simulation-side">
                  <Mascot pose="mascot_08_guide" />
                  <Tag color="blue">오늘의 탐험 힌트</Tag>
                  <h3>선택에는 이유가 있어.</h3>
                  <p>왜 그렇게 생각했는지 떠올려 봐.</p>
                  <div className="simulation-timeline">
                    {job.scenarios.map((s, i) => (
                      <div
                        key={s.title}
                        className={i <= session.step ? "active" : ""}
                      >
                        <span>
                          {i < session.turns.length ? (
                            <Check size={15} />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <div>
                          <b>{s.title}</b>
                          <small>
                            {i < session.turns.length
                              ? "내 선택을 기록했어요"
                              : i === session.step
                                ? "지금 경험하는 중"
                                : "다음에 만날 상황"}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      turn({ kind: "question", text: question.trim() });
                    }}
                  >
                    <label className="form-field">
                      상황에 대해 질문하기
                      <textarea
                        disabled={action.busy}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        maxLength={1000}
                        rows={3}
                        placeholder="더 알고 싶은 점을 적어줘."
                      />
                    </label>
                    <Button
                      kind="secondary"
                      type="submit"
                      disabled={action.busy || question.trim().length < 2}
                    >
                      <MessageCircle size={16} />
                      질문 남기기
                    </Button>
                  </form>
                  {session.questionReply && (
                    <p className="hint-box" role="status">
                      {session.questionReply}
                    </p>
                  )}
                  <p className="fine-print">
                    {session.mode === "template"
                      ? "질문은 저장되고 준비된 안내를 보여줘요. 질문만으로 다음 상황으로 넘어가지는 않아요."
                      : "질문을 통해 상황을 더 살펴볼 수 있어요."}
                  </p>
                </aside>
              </div>
            ) : stage === "reflection" ? (
              <section className="panel reflection-panel">
                <Mascot pose="mascot_07_read" />
                <Tag color="orange">생각까지 남겨야 나의 경험</Tag>
                <h2>직접 해보니까 어땠어?</h2>
                <p>흥미가 줄어도 좋은 발견이야. 솔직하게 남겨줘.</p>
                <ChoiceCards
                  legend="직접 해보니 어떤 생각이 들었어?"
                  options={optionsFor(reflectionChoices)}
                  value={reflection}
                  onChange={setReflection}
                  disabled={action.busy}
                />
                <div className="two-column">
                  <ChoiceCards
                    legend="좋았던 점 (선택)"
                    options={optionsFor(likedChoices)}
                    value={liked}
                    onChange={setLiked}
                    disabled={action.busy}
                  />
                  <ChoiceCards
                    legend="어려웠던 점 (선택)"
                    options={optionsFor(difficultChoices)}
                    value={disliked}
                    onChange={setDisliked}
                    disabled={action.busy}
                  />
                </div>
                <Interest
                  value={interest}
                  onChange={setInterest}
                  disabled={action.busy}
                />
                <Button
                  className="full-width"
                  disabled={action.busy || reflection.trim().length < 5}
                  onClick={finish}
                >
                  {action.busy ? "경험 저장 중" : "나의 경험 기록하기"}
                  <Check size={17} />
                </Button>
              </section>
            ) : (
              <section className="panel result-panel">
                <Mascot pose="mascot_06_celebrate" />
                <Tag color="purple">새로운 나를 발견했어</Tag>
                <h2>오늘, {job.title}로 살아봤어.</h2>
                <p>너의 선택과 회고가 활동 기록에 남았어.</p>
                <div className="takeaway-list">
                  {session.turns.map((turn, i) => (
                    <div key={i}>
                      <span>{i + 1}</span>
                      <div>
                        <b>{turn.answer}</b>
                        <p>{turn.lesson}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {completed && <p>{completed.feedback}</p>}
                <div className="button-row centered">
                  <Button onClick={() => go("map", job.id)}>
                    업데이트된 지도 보기
                    <ArrowUpRight size={17} />
                  </Button>
                  <Button
                    kind="secondary"
                    onClick={() => go("projects", job.id)}
                  >
                    프로젝트로 이어가기
                    <ArrowRight size={17} />
                  </Button>
                  <Button
                    kind="ghost"
                    disabled={action.busy}
                    onClick={() => open(job.id)}
                  >
                    <RotateCcw size={16} />
                    다시 체험하기
                  </Button>
                </div>
              </section>
            )}
          </>
        )
      )}
    </>
  );
}

export function Interest({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="interest-rating" disabled={disabled}>
      <legend>지금 이 직업에 대한 관심은?</legend>
      <div>
        {[
          "별로 없어요",
          "조금 있어요",
          "보통이에요",
          "꽤 궁금해요",
          "더 해보고 싶어요",
        ].map((text, i) => (
          <button
            type="button"
            key={text}
            aria-pressed={value === i + 1}
            className={value === i + 1 ? "selected" : ""}
            onClick={() => onChange(i + 1)}
          >
            <b>{i + 1}</b>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Projects() {
  const selected = new URLSearchParams(location.hash.split("?")[1] || "").get(
    "career",
  );
  const farm = [
    "developer",
    "nurse",
    "farmer",
    "engineer",
    "researcher",
  ].includes(selected || "");
  return farm ? (
    <Suspense fallback={<p role="status">설계 작업실을 준비하는 중…</p>}>
      <Workshop />
    </Suspense>
  ) : (
    <ProjectLobby />
  );
}
