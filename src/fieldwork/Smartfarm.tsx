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
  RotateCcw,
  Search,
  Thermometer,
  NotebookPen,
} from "lucide-react";
import { api, errorMessage, json, requestId } from "../api";
import { useApp } from "../store";
import { AwardsShelf } from "./Awards";
import type { SceneQuality } from "./SceneKit";
import type { FarmSession } from "./types";
import "./fieldwork.css";
import ChoiceCards from "./ChoiceCards";
import ActionOutcome from "./ActionOutcome";

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
    requireAuth,
    refresh,
    registerNavigationGuard,
  } = useApp();
  const workplace = workplaceFor(cid);
  const job = getCareer(cid);
  const required = workplace?.required || ["sensor", "journal"];
  const metric = workplace?.metric || "A구역 온도";
  const unit = workplace?.unit ?? "°C";
  const reduced = !!useReducedMotion();
  const [session, setSession] = useState<FarmSession | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [quality, setQuality] = useState<SceneQuality>("high");
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
  dirty.current = !!(text || question || liked || disliked);
  useEffect(
    () =>
      registerNavigationGuard(
        async () =>
          !dirty.current ||
          window.confirm(
            "아직 저장하지 않은 선택이나 질문이 있어요. 저장된 진행 상태는 유지돼요. 이동할까요?",
          ),
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
  const load = useCallback(async () => {
    if (!user) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError("");
    try {
      const id = new URLSearchParams(location.hash.split("?")[1] || "").get(
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
  }, [user?.username, cid]);
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
  if (!user)
    return (
      <section className="kc-welcome">
        <img
          src={`/brand/06_generated_card_art/${workplace?.art || "smartfarm"}_scene.png`}
          alt={`${job.title} 현장 체험`}
        />
        <div>
          <span className="kc-eyebrow">FIRST DAY AT WORK</span>
          <h1>
            오늘은
            <br />
            {workplace?.role || "스마트팜 운영 담당자"}
          </h1>
          <p>
            {workplace?.brief ||
              "온실을 조사하고, 이상 징후를 찾고, 다음 교대자에게 인계해 봐요."}{" "}
            체험 기록은 내 계정에 이어서 저장돼요.
          </p>
          <button className="kc-button" onClick={requireAuth}>
            로그인하고 출근하기 <ArrowRight size={18} />
          </button>
        </div>
      </section>
    );
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
  const obj = field.objects.find((o) => o.id === selected);
  const inspected = obj && field.inspected.includes(obj.id);
  const inspect = (id: string) => {
    setSelected(id);
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
          disabled={busy || session.stage === "brief"}
          onClick={() => inspect(o.id)}
        >
          <span>{String(i + 1).padStart(2, "0")}</span>
          <strong>{o.name}</strong>
          <small>
            {field.inspected.includes(o.id) ? "확인한 자료" : "살펴보기 · 3분"}
          </small>
        </button>
      ))}
    </div>
  );
  return (
    <div className="kc-fieldwork">
      <header className="kc-topline">
        <button className="kc-text-button" onClick={() => go("simulation")}>
          <ArrowLeft size={16} /> 다른 직업
        </button>
        <span>{workplace?.room || "가상 스마트팜"} / 교육용 상황</span>
        <span className="kc-mode">
          {(session.coachMode ?? session.mode) === "ai"
            ? "Gemini 코치 연결 · 상황은 준비된 분기"
            : "준비된 시나리오 · AI 미연결"}
        </span>
      </header>
      <div className="kc-section-heading">
        <div>
          <span className="kc-eyebrow">FIELD NOTE · {job.title}</span>
          <h1>{workplace?.title || "온실의 아침을 부탁해."}</h1>
          <p>
            {workplace?.brief ||
              "센서의 숫자, 잎의 상태, 동료의 기록. 서로 다른 단서를 연결해 봐요."}
          </p>
        </div>
        <img
          className="kc-guide-small"
          src="/brand/01_mascots/mascot_08_guide.png"
          alt="업무를 안내하는 크랩"
        />
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
            서버 기록 다시 읽기
          </button>
        </div>
      )}
      {session.stage === "completed" ? (
        <>
          <AwardsShelf activityId={session.activityId} />
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
        </>
      ) : (
        <>
          <ol className="kc-phases">
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
          <ActionOutcome field={field} />
          <div className="kc-workspace">
            <section className="kc-scene-panel">
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
                <span>눌러서 가까이 보기 · 드래그 회전</span>
                <div className="kc-scene-settings">
                  <button onClick={() => setSelected("")}>전체 보기</button>
                  <label>
                    화질{" "}
                    <select
                      value={quality}
                      onChange={(e) =>
                        setQuality(e.target.value as SceneQuality)
                      }
                    >
                      <option value="high">높음</option>
                      <option value="balanced">가벼움</option>
                    </select>
                  </label>
                </div>
                <button onClick={() => setFlat((v) => !v)}>
                  {flat ? "3D 현장 보기" : "2D 목록 보기"}
                </button>
              </div>
              {!flat && (
                <div
                  className="kc-scene"
                  aria-label="조사 가능한 직무 현장 3D 모형. 아래 목록에서도 같은 행동을 할 수 있습니다."
                >
                  <SceneBoundary
                    fallback={
                      <p className="kc-scene-fallback">
                        이 환경에서는 3D를 표시할 수 없어요. 아래 조사 목록으로
                        같은 체험을 이어갈 수 있어요.
                      </p>
                    }
                  >
                    <Suspense
                      fallback={
                        <div className="kc-scene-fallback">
                          현장 문을 여는 중…
                        </div>
                      }
                    >
                      {cid === "farmer" ? (
                        <Greenhouse
                          field={field}
                          quality={quality}
                          selected={selected}
                          inspect={inspect}
                          reduced={reduced}
                        />
                      ) : (
                        <WorkplaceScene
                          cid={cid}
                          field={field}
                          quality={quality}
                          selected={selected}
                          inspect={inspect}
                          reduced={reduced}
                        />
                      )}
                    </Suspense>
                  </SceneBoundary>
                </div>
              )}
              {objectButtons}
              {obj && (
                <motion.div
                  className="kc-inspection"
                  key={obj.id}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="kc-eyebrow">
                    <Search size={14} /> {obj.name}
                  </span>
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
                </motion.div>
              )}
            </section>
            <aside className="kc-task-panel" aria-busy={busy}>
              {session.stage === "brief" ? (
                <>
                  <span className="kc-eyebrow">09:00 · 첫 출근</span>
                  <h2>{workplace?.title || "A구역이 평소보다 뜨거워요."}</h2>
                  <p>
                    {workplace?.brief ||
                      "가상 토마토 온실의 오전 교대를 맡았어요."}{" "}
                    조치 전에 필수 자료를 포함해 세 곳 이상을 조사해 주세요.
                  </p>
                  <div className="kc-note">
                    목표는 가장 높은 점수보다, 내가 어떤 자료로 판단했는지
                    남기는 거예요.
                  </div>
                  <button
                    className="kc-button"
                    disabled={busy}
                    onClick={() => void command("start")}
                  >
                    업무 시작 <ArrowRight size={18} />
                  </button>
                  <small>
                    모든 수치와 조작은 교육용으로 작성된 가상 상황이에요.
                  </small>
                </>
              ) : session.stage === "reflection" ? (
                <>
                  <span className="kc-eyebrow">SHIFT COMPLETE</span>
                  <h2>{field.ending}</h2>
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
                  <ChoiceCards
                    legend="오늘의 내 마음과 가까운 것은?"
                    options={field.options.reflection}
                    value={text}
                    onChange={setText}
                    disabled={busy}
                  />
                  <label>
                    체험 후 관심도 · {interest}/5
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={interest}
                      onChange={(e) => setInterest(Number(e.target.value))}
                    />
                  </label>
                  <small>
                    관심이 줄어도 괜찮아요. 선택의 근거를 얻은 경험이에요.
                  </small>
                  <button
                    className="kc-button"
                    disabled={busy || !text}
                    onClick={() =>
                      void command(
                        "complete",
                        {
                          reflection:
                            field.options.reflection.find((o) => o.id === text)
                              ?.label || "",
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
                  <span className="kc-eyebrow">TODAY'S MISSION</span>
                  <h2>
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
                        필수 자료를 포함해 세 곳 이상을 조사한 뒤, 가장 그럴듯한
                        원인을 골라 봐요.
                      </p>
                      <div className="kc-note">
                        조사 {field.inspected.length}/{field.objects.length}곳 ·{" "}
                        {required
                          .map(
                            (id) =>
                              `${field.objects.find((o) => o.id === id)?.name}: ${field.inspected.includes(id) ? "확인" : "미확인"}`,
                          )
                          .join(" · ")}
                      </div>
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
                  {field.phase === "verify" && (
                    <div className="kc-note">
                      <strong>
                        조치 후 {metric} ·{" "}
                        {field.metricValue ?? field.temperature}
                        {unit}
                      </strong>
                      <p>{field.action?.result}</p>
                      <p>
                        이전 {workplace?.before ?? 33}
                        {unit}와 비교해 무엇이 바뀌었고, 무엇을 더 확인해야
                        할까요?
                      </p>
                    </div>
                  )}
                  {field.phase === "handover" && (
                    <p>
                      확인한 이상 징후, 수행한 조치, 재측정 결과와 아직 남은 일
                      중 무엇을 다음 담당자에게 전달할지 골라 주세요.
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
                    className="kc-button"
                    disabled={
                      busy ||
                      !text ||
                      (field.phase === "inspect" &&
                        (required.some((id) => !field.inspected.includes(id)) ||
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
                        ? "Gemini가 현재 상황을 바탕으로 설명해 줘요. 선택과 결과는 바꾸지 않아요."
                        : "AI 미연결 상태예요. 질문을 저장하고 준비된 학습 안내를 보여줘요."}
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
          </div>
          <details className="kc-log" open>
            <summary>
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
