import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  FileText,
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
  JobIcon,
  PageHeading,
  Progress,
  Steps,
  Tag,
} from "../components";
import { careers, dimensions, getCareer } from "../data";
import type { Activity, CareerId } from "../data";
import { api, ApiError, json, requestId } from "../api";
import type { ProjectDraft, SimulationSession } from "../api";
import { useApp } from "../store";

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
  const { go, careerId, setCareerId, refresh, toast, requireAuth, catalog } =
    useApp();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(6).fill(-1));
  const [result, setResult] = useState<Activity | null>(null);
  const action = useAction();
  const keyFor = useRequestKeys();
  const reduceMotion = useReducedMotion();
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
      setStep(7);
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
                onClick={() => setCareerId(c.id)}
              >
                <span className={`job-badge ${c.color}`}>
                  <JobIcon id={c.id} />
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
            나의 출발점 알아보기
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
              <h2>{questions[step - 1].title}</h2>
              <p>{questions[step - 1].description}</p>
              <div className="choices">
                {questions[step - 1].answers.map((answer, i) => (
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
              onClick={() => (step === 6 ? finish() : setStep(step + 1))}
            >
              {action.busy
                ? "진단 저장 중"
                : step === 6
                  ? "나의 출발점 기록하기"
                  : "다음 질문"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      ) : (
        result && (
          <section className="panel result-panel">
            <Mascot pose="mascot_06_celebrate" />
            <Tag color="purple">첫 번째 기록을 남겼어</Tag>
            <h2>이제 너의 출발점이 생겼어.</h2>
            <p>
              {job.title}에 대해 알려준 내용을 저장했어. 직접 경험하며 지도를
              채워보자.
            </p>
            <div className="diagnosis-results">
              {dimensions.map((d, i) => (
                <div key={d}>
                  <span>{d}</span>
                  <Progress
                    value={result.after[i] ?? 0}
                    color={i % 2 ? "purple" : "orange"}
                  />
                  <b>{result.after[i] ?? 0}%</b>
                </div>
              ))}
            </div>
            <p className="fine-print">
              기록으로 확인한 경험목표 충족도예요. 자기보고는 실제 활동 기록과
              구분하며, 능력이나 적성을 평가하는 점수가 아니에요.
            </p>
            <p>{result.feedback}</p>
            <div className="button-row centered">
              <Button onClick={() => go("map", careerId)}>
                나의 지도 펼치기
                <ArrowUpRight size={17} />
              </Button>
              <Button
                kind="secondary"
                onClick={() => go("simulation", careerId)}
              >
                직접 경험해 보기
                <Play size={16} />
              </Button>
            </div>
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
            <Mascot pose="mascot_01_explore" />
            <div>
              <h3>직업을 고르고, 새로운 하루로 들어가 봐.</h3>
              <p>
                3개의 상황과 짧은 회고 · 약 10분 · 저장한 지점부터 이어할 수
                있어.
              </p>
            </div>
            <Tag color="orange">준비된 시나리오</Tag>
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
            지금은 준비된 시나리오가 선택에 따라 반응해요. 실시간 AI 생성은 연결
            예정이에요.
          </p>
        </>
      ) : (
        session && (
          <>
            <div className="simulation-mode">
              <Tag color={session.mode === "template" ? "orange" : "purple"}>
                {session.mode === "template"
                  ? "준비된 시나리오 · AI 미연결"
                  : "AI 시뮬레이션"}
              </Tag>
              <span className="save-status" role="status">
                {action.busy ? "서버에 기록 중" : "서버에 저장된 체험"}
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
                <label className="form-field">
                  새롭게 알게 된 점 <span className="required">필수</span>
                  <textarea
                    disabled={action.busy}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="새롭게 알게 된 점이나 달라진 생각을 5자 이상 적어줘."
                    rows={3}
                    maxLength={1500}
                  />
                </label>
                <div className="two-column">
                  <label className="form-field">
                    나와 맞았던 점
                    <textarea
                      disabled={action.busy}
                      value={liked}
                      onChange={(e) => setLiked(e.target.value)}
                      placeholder="조금이라도 재미있었던 순간"
                      rows={3}
                      maxLength={1000}
                    />
                  </label>
                  <label className="form-field">
                    나와 덜 맞았던 점
                    <textarea
                      disabled={action.busy}
                      value={disliked}
                      onChange={(e) => setDisliked(e.target.value)}
                      placeholder="어렵거나 덜 즐거웠던 순간"
                      rows={3}
                      maxLength={1000}
                    />
                  </label>
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

type SaveAttempt = {
  careerId: CareerId;
  answers: string[];
  expectedVersion: number;
  clientRequestId: string;
};
type ProjectRevision = { version: number; answers: string[]; date: string };

export function Projects() {
  const {
    state,
    go,
    careerId,
    setCareerId,
    refresh,
    toast,
    requireAuth,
    user,
    registerNavigationGuard,
    catalog,
  } = useApp();
  const [stage, setStage] = useState<"list" | "detail" | "work" | "result">(
    () => (window.location.hash.includes("?career=") ? "detail" : "list"),
  );
  const [mission, setMission] = useState(0);
  const [hint, setHint] = useState(false);
  const [interest, setInterest] = useState(3);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [saveState, setSaveState] = useState<
    "saved" | "dirty" | "saving" | "error"
  >("saved");
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [result, setResult] = useState<Activity | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [revisions, setRevisions] = useState<ProjectRevision[] | null>(null);
  const action = useAction();
  const keyFor = useRequestKeys();
  const reduceMotion = useReducedMotion();
  const draftRef = useRef<ProjectDraft | null>(null);
  const answersRef = useRef<string[]>(["", "", ""]);
  const dirtyRef = useRef(false);
  const rebaseBlocked = useRef(false);
  const inflight = useRef<Promise<boolean> | null>(null);
  const attemptRef = useRef<SaveAttempt | null>(null);
  const selectedRef = useRef(careerId);
  const mountedRef = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const availableCareers = catalog.length ? catalog : careers;
  const job =
    availableCareers.find((item) => item.id === careerId) ??
    getCareer(careerId);

  const flushDraft = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (rebaseBlocked.current) return false;
    if (inflight.current) return inflight.current;
    if (!dirtyRef.current && !attemptRef.current) return true;
    if (!draftRef.current) return false;
    const task = (async () => {
      if (mountedRef.current) {
        setSaveState("saving");
        setSaveError(null);
      }
      try {
        while (dirtyRef.current || attemptRef.current) {
          const current = draftRef.current!;
          const attempt = attemptRef.current ?? {
            careerId: current.careerId,
            answers: [...answersRef.current],
            expectedVersion: current.version,
            clientRequestId: requestId(),
          };
          attemptRef.current = attempt;
          const saved = await api<ProjectDraft>(
            `/projects/${attempt.careerId}/draft`,
            json("PUT", {
              answers: attempt.answers,
              expectedVersion: attempt.expectedVersion,
              clientRequestId: attempt.clientRequestId,
            }),
          );
          draftRef.current = saved;
          attemptRef.current = null;
          dirtyRef.current =
            JSON.stringify(answersRef.current) !==
            JSON.stringify(attempt.answers);
          if (mountedRef.current) setDraft(saved);
        }
        if (mountedRef.current) {
          setSaveState("saved");
          setSaveError(null);
        }
        return true;
      } catch (cause) {
        if (mountedRef.current) {
          setSaveState("error");
          setSaveError(
            cause instanceof Error
              ? cause
              : new Error("초안을 저장하지 못했어요."),
          );
        }
        return false;
      }
    })();
    inflight.current = task;
    try {
      return await task;
    } finally {
      inflight.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(
    () =>
      registerNavigationGuard(async () => {
        const saved = await flushDraft();
        if (!saved)
          toast(
            "초안을 저장하지 못해 이 화면에 머물렀어요. 저장을 다시 시도해 주세요.",
          );
        return saved;
      }),
    [registerNavigationGuard, flushDraft, toast],
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || inflight.current || attemptRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const loadDraft = async (id: CareerId) => {
    const saved = await api<ProjectDraft>(`/projects/${id}`);
    if (selectedRef.current !== id) return;
    draftRef.current = saved;
    answersRef.current = [...saved.answers];
    dirtyRef.current = false;
    attemptRef.current = null;
    rebaseBlocked.current = false;
    setDraft(saved);
    setAnswers([...saved.answers]);
    setSaveState("saved");
    setSaveError(null);
    setReloadRequired(false);
  };
  useEffect(() => {
    if (!user || stage === "list" || draftRef.current?.careerId === careerId)
      return;
    selectedRef.current = careerId;
    void action.run(() => loadDraft(careerId));
    // Changing a career loads its own server draft; live edits are never reset by a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careerId, user, stage]);

  const openProject = (id: CareerId) => {
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    if (params.get("career") !== id) {
      go("projects", id);
      return;
    }
    if (!requireAuth()) return;
    void action.run(async () => {
      if (!(await flushDraft())) return;
      selectedRef.current = id;
      setDraft(null);
      setCareerId(id);
      setStage("detail");
      setMission(0);
      setHint(false);
      setResult(null);
      setRevisions(null);
      setInterest(3);
      await loadDraft(id);
    });
  };
  const updateDraft = (value: string) => {
    const next = answersRef.current.map((v, index) =>
      index === mission ? value : v,
    );
    answersRef.current = next;
    setAnswers(next);
    dirtyRef.current =
      JSON.stringify(next) !== JSON.stringify(draftRef.current?.answers);
    if (!saveError) setSaveState(dirtyRef.current ? "dirty" : "saved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!saveError) void flushDraft();
    }, 650);
  };
  const reloadVersion = () => {
    void action.run(async () => {
      const current = await api<ProjectDraft>(`/projects/${careerId}`);
      draftRef.current = current;
      setDraft(current);
      attemptRef.current = null;
      dirtyRef.current =
        JSON.stringify(answersRef.current) !== JSON.stringify(current.answers);
      rebaseBlocked.current = dirtyRef.current;
      setSaveError(null);
      setReloadRequired(dirtyRef.current);
      setSaveState(dirtyRef.current ? "dirty" : "saved");
    });
  };
  const finish = () => {
    if (!requireAuth()) return;
    void action.run(async () => {
      if (!(await flushDraft())) return;
      const current = draftRef.current!;
      const payload = { interest, expectedVersion: current.version };
      const clientRequestId = keyFor({ careerId, ...payload });
      const activity = await api<Activity>(
        `/projects/${careerId}/submit`,
        json("POST", { ...payload, clientRequestId }),
      );
      setResult(activity);
      setStage("result");
      await refresh().catch(() =>
        toast("프로젝트는 저장됐어요. 활동 목록은 연결 후 다시 불러와 주세요."),
      );
    });
  };
  const nextMission = () =>
    action.run(async () => {
      if (!(await flushDraft())) return;
      setMission((old) => Math.min(2, old + 1));
      setHint(false);
    });
  const leaveWork = () =>
    action.run(async () => {
      if (!(await flushDraft())) return;
      if (mission === 0) setStage("detail");
      else setMission((old) => Math.max(0, old - 1));
      setHint(false);
    });
  const hints = [
    "‘누가, 언제, 무엇 때문에 불편할까?’를 한 문장으로 쓰고, 그 사람이 하는 행동을 떠올려 봐.",
    "아이디어를 3개 쓰고, 가장 간단하게 시작할 수 있는 것 하나를 골라봐. 누구에게 왜 필요한지도 적어줘.",
    "성공했는지 알아볼 질문과 관찰할 행동을 정해봐. 비교할 때 무엇을 같은 조건으로 둘지도 생각해 봐.",
  ];
  const showHistory = () => {
    if (!requireAuth()) return;
    if (revisions) {
      setRevisions(null);
      return;
    }
    void action.run(async () => {
      setRevisions(
        await api<ProjectRevision[]>(`/projects/${careerId}/revisions`),
      );
    });
  };

  return (
    <>
      <PageHeading
        eyebrow="MAKE SOMETHING YOURS"
        title={
          stage === "list" ? "작게 만들어도, 크게 발견할 거야" : job.project
        }
        description="생각만 했던 아이디어를 나만의 결과물로. 완벽하지 않아도 괜찮아."
      />
      <RequestError {...action} onConflict={reloadVersion} />
      <RequestError
        error={saveError}
        busy={saveState === "saving"}
        retry={() => {
          void flushDraft();
        }}
        onConflict={reloadVersion}
      />
      {reloadRequired && (
        <div className="request-error" role="alert">
          <p>
            다른 화면에서 초안이 변경됐어요. 이 화면의 입력은 유지했어요. 현재
            입력으로 저장하면 서버의 최신 초안을 새 버전으로 갱신해요.
          </p>
          <Button
            kind="secondary"
            onClick={() => {
              rebaseBlocked.current = false;
              setReloadRequired(false);
              void flushDraft();
            }}
          >
            현재 입력으로 저장하기
          </Button>
        </div>
      )}
      {stage === "list" ? (
        <>
          <section className="project-intro">
            <div>
              <Tag color="purple">MY FIRST PROJECT</Tag>
              <h2>
                작은 결과물 하나가,
                <br />
                나를 설명하는 이야기가 되니까.
              </h2>
              <p>관심 직업의 문제를 골라 3개의 미션을 완성해 봐.</p>
            </div>
            <Mascot large />
          </section>
          <div className="project-grid">
            {availableCareers.map((c) => (
              <motion.button
                whileHover={reduceMotion ? undefined : { y: -4 }}
                className="project-card"
                key={c.id}
                disabled={action.busy}
                onClick={() => openProject(c.id)}
              >
                <div className="project-card-top">
                  <span className={`job-badge ${c.color}`}>
                    <JobIcon id={c.id} />
                  </span>
                  <Tag color={c.color}>
                    {state.drafts[c.id]?.some((x) => x.trim())
                      ? "작성 중"
                      : "입문"}
                  </Tag>
                </div>
                <small>{c.title}</small>
                <h3>{c.project}</h3>
                <p>{c.problem}</p>
                <div className="project-card-meta">
                  <span>
                    <Clock3 size={14} />
                    20~30분
                  </span>
                  <span>
                    3개 미션
                    <ArrowUpRight size={17} />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </>
      ) : stage === "detail" ? (
        <section className="panel project-detail">
          <Tag color={job.color}>{job.title} · 입문</Tag>
          <div className="activity-hero-row">
            <div>
              <h2>{job.project}</h2>
              <p className="detail-intro">{job.problem}</p>
            </div>
            <img
              className="activity-illustration"
              src="/brand/04_feature_illustrations/feature_04_project.svg"
              alt="아이디어를 결과물로 만드는 프로젝트"
              width="240"
              height="180"
            />
          </div>
          <div className="chip-list">
            {job.skills.map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </div>
          <h3>함께 해볼 미션</h3>
          <div className="mission-list">
            {job.missions.map((m, i) => (
              <div key={m}>
                <span>{i + 1}</span>
                <b>{m}</b>
                <small>약 {i === 1 ? 10 : 5}분</small>
              </div>
            ))}
          </div>
          <div className="example-output">
            <FileText size={25} />
            <div>
              <b>완성하면 이런 결과물이 남아</b>
              <p>
                문제 정의, 아이디어, 확인 계획을 담은 나만의 기획 노트. 세
                단계의 답변이 포트폴리오에 저장돼.
              </p>
            </div>
          </div>
          <div className="button-row">
            <Button
              disabled={
                action.busy ||
                Boolean(user && (!draft || draft.careerId !== careerId))
              }
              onClick={() => {
                if (!requireAuth()) return;
                setMission(0);
                setHint(false);
                setStage("work");
              }}
            >
              {action.busy
                ? "초안 불러오는 중"
                : answers.some((x) => x.trim())
                  ? "작성하던 프로젝트 이어하기"
                  : "내 프로젝트 시작하기"}
              <ArrowRight size={17} />
            </Button>
            <Button
              kind="ghost"
              disabled={action.busy}
              onClick={() => {
                void flushDraft().then((ok) => {
                  if (ok) setStage("list");
                });
              }}
            >
              다른 프로젝트 보기
            </Button>
            <Button kind="ghost" disabled={action.busy} onClick={showHistory}>
              {revisions ? "수정 이력 접기" : "저장된 수정 이력 보기"}
            </Button>
          </div>
          {revisions && (
            <div className="project-revisions">
              <h3>내 아이디어가 바뀌어 온 과정</h3>
              {revisions.length ? (
                revisions.map((revision) => (
                  <details key={revision.version}>
                    <summary>
                      버전 {revision.version} ·{" "}
                      {new Date(revision.date).toLocaleString("ko-KR")}
                    </summary>
                    {revision.answers.map((answer, index) => (
                      <div key={index}>
                        <b>미션 {index + 1}</b>
                        <p className="revision-answer">
                          {answer || "아직 작성하지 않았어요."}
                        </p>
                      </div>
                    ))}
                  </details>
                ))
              ) : (
                <p>첫 초안을 저장하면 수정 이력이 여기에 남아요.</p>
              )}
            </div>
          )}
        </section>
      ) : stage === "work" ? (
        <>
          <Steps
            current={mission}
            labels={["문제 발견", "아이디어 만들기", "확인하고 제출"]}
          />
          <div className="project-work-grid">
            <section className="panel">
              <div className="question-top">
                <Tag>MISSION {mission + 1}</Tag>
                <span className={`save-status ${saveState}`} role="status">
                  {saveState === "saved"
                    ? "서버에 저장됨"
                    : saveState === "saving"
                      ? "초안 저장 중"
                      : saveState === "dirty"
                        ? "아직 저장되지 않은 변경"
                        : "저장 실패 · 다시 시도해 주세요"}
                </span>
              </div>
              <h2>{job.missions[mission]}</h2>
              <p className="muted">
                구체적인 대상과 이유를 적어주면 아이디어가 더 선명해져.
              </p>
              <label className="form-field">
                나의 결과물
                <textarea
                  disabled={action.busy || !draft || reloadRequired}
                  rows={9}
                  value={answers[mission]}
                  onChange={(e) => updateDraft(e.target.value)}
                  placeholder="내 생각을 10자 이상 적어줘. 짧게 시작해도 괜찮아."
                  maxLength={5000}
                />
                <small>{answers[mission].length} / 5,000</small>
              </label>
              {mission === 2 && (
                <Interest
                  value={interest}
                  onChange={setInterest}
                  disabled={action.busy}
                />
              )}
              <div className="form-actions">
                <Button
                  kind="ghost"
                  disabled={
                    action.busy || saveState === "saving" || reloadRequired
                  }
                  onClick={() => {
                    void leaveWork();
                  }}
                >
                  <ArrowLeft size={17} />
                  이전
                </Button>
                <Button
                  disabled={
                    action.busy ||
                    saveState === "saving" ||
                    reloadRequired ||
                    !draft ||
                    (mission === 2
                      ? answers.some((x) => x.trim().length < 10)
                      : answers[mission].trim().length < 10)
                  }
                  onClick={() => {
                    if (mission === 2) finish();
                    else void nextMission();
                  }}
                >
                  {action.busy
                    ? mission === 2
                      ? "제출 중"
                      : "초안 저장 중"
                    : mission === 2
                      ? "프로젝트 제출하기"
                      : "다음 미션"}
                  {mission === 2 ? (
                    <Check size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                </Button>
              </div>
            </section>
            <aside className="panel hint-panel">
              <Mascot pose="mascot_05_idea" />
              <Tag color="orange">준비된 작성 가이드</Tag>
              <h3>막막할 땐, 작은 힌트</h3>
              <p>질문을 작게 나눠서 생각해 보자.</p>
              <Button kind="secondary" onClick={() => setHint(!hint)}>
                {hint ? "힌트 접기" : "단계별 힌트 보기"}
                <Lightbulb size={16} />
              </Button>
              {hint && <div className="hint-box">{hints[mission]}</div>}
              <p className="fine-print">
                지금은 준비된 가이드를 제공해요. AI 질문 답변과 내용 평가는 연결
                예정이에요.
              </p>
              <div className="side-note">
                <FileText size={20} />
                <p>
                  초안은 서버에 자동 저장돼. 저장 중에는 완료될 때까지 이 화면에
                  머물러줘.
                </p>
              </div>
            </aside>
          </div>
        </>
      ) : (
        result && (
          <section className="panel result-panel">
            <Mascot pose="mascot_06_celebrate" />
            <Tag color="purple">내 손으로 만든 첫 가능성</Tag>
            <h2>너만의 프로젝트가 완성됐어!</h2>
            <p>{result.title}</p>
            <div className="project-result-feedback">
              <h3>제출 완료 안내</h3>
              <p>{result.feedback}</p>
              <Tag color="orange">AI 내용 평가 · 미연결</Tag>
              <p className="fine-print">
                결과물 제출과 회고를 활동 기록으로 남겼어요. 결과물의 품질이나
                역량을 AI가 평가한 상태는 아니에요.
              </p>
            </div>
            <div className="button-row centered">
              <Button onClick={() => go("portfolio")}>
                포트폴리오에서 보기
                <ArrowUpRight size={17} />
              </Button>
              <Button kind="secondary" onClick={() => go("map", careerId)}>
                경험지도 확인하기
                <ArrowRight size={17} />
              </Button>
            </div>
          </section>
        )
      )}
    </>
  );
}
