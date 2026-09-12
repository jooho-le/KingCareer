import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { api, errorMessage, json, requestId } from "../api";
import { Button, Tag } from "../components";
import { useApp } from "../store";
import type { CareerId, Page } from "../data";
import "./career-review.css";
import "./review-flow.css";

type Answers = { enjoyed: string; difficult: string; again: string };
type Next = {
  key: string;
  careerId: CareerId;
  kind: "simulation" | "project" | "discovery";
  title: string;
  reason: string;
};
export type CareerReview = {
  activityId: string;
  careerId: CareerId;
  activityTitle: string;
  version: number;
  status: "draft" | "generating" | "ready" | "confirmed";
  date: string;
  answers: Answers;
  mode?: "ai" | "template";
  error: string;
  generated: null | {
    summary: string;
    evidenceRefs: string[];
    nextKey: string;
    reason: string;
  };
  candidates?: Next[];
  missing?: string[];
  sources?: { ref: string; activityId: string; title: string; date: string }[];
  confirmation: null | {
    agreement: "agree" | "different";
    correction: string;
    note: string;
    summary: string;
    next: Next;
    date: string;
  };
};
export type ReviewList = {
  reviews: CareerReview[];
  options: Record<keyof Answers, Record<string, string>>;
  mode: "ai" | "template";
  defaults?: Record<string, { answers: Partial<Answers>; source: { reflection?: string; liked?: string; disliked?: string; interest?: number } }>;
};
const emptyAnswers: Answers = { enjoyed: "", difficult: "", again: "" };
const pageFor = (kind: Next["kind"]): Page =>
  kind === "project"
    ? "projects"
    : kind === "discovery"
      ? "discovery"
      : "simulation";
const questions: { key: keyof Answers; title: string }[] = [
  { key: "enjoyed", title: "가장 재미있었던 일은?" },
  { key: "difficult", title: "어떤 점이 어려웠어?" },
  { key: "again", title: "이 일을 다시 해보고 싶어?" },
];

export function CareerReviewStudio() {
  const { state, careerId, activityId, user, go, refresh, registerNavigationGuard } =
    useApp();
  const activities = state.activities.filter(
    (a) => a.kind === "simulation" || a.kind === "project",
  );
  const [data, setData] = useState<ReviewList | null>(null);
  const [selected, setSelected] = useState("");
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [editing, setEditing] = useState(false);
  const [editPrevious, setEditPrevious] = useState(false);
  const [agreement, setAgreement] = useState<"agree" | "different">("agree");
  const [correction, setCorrection] = useState("unsure");
  const [note, setNote] = useState("");
  const [nextKey, setNextKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const live = useRef(true);
  const initialized = useRef(false);
  const current = data?.reviews.find((r) => r.activityId === selected);
  const seed = data?.defaults?.[selected];
  const initialAnswers = current?.answers || { ...emptyAnswers, ...seed?.answers };
  const invalidActivity = !!activityId && !activities.some((a) => a.id === activityId);
  const dirty = useRef(false);
  dirty.current =
    (editing &&
      JSON.stringify(answers) !==
        JSON.stringify(initialAnswers)) ||
    (!!current?.generated &&
      (note !== (current.confirmation?.note || "") ||
        nextKey !==
          (current.confirmation?.next.key || current.generated.nextKey) ||
        agreement !== (current.confirmation?.agreement || "agree") ||
        (agreement === "different" &&
          correction !== (current.confirmation?.correction || "unsure"))));
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(
    () =>
      registerNavigationGuard(
        async () =>
          !dirty.current ||
          confirm("아직 저장하지 않은 회고 선택이 있어요. 화면을 이동할까요?"),
      ),
    [registerNavigationGuard],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const useReview = (review?: CareerReview, aid = selected, value = data) => {
    setAnswers(review?.answers || { ...emptyAnswers, ...value?.defaults?.[aid]?.answers });
    setEditing(!review?.generated);
    setEditPrevious(false);
    setAgreement(review?.confirmation?.agreement || "agree");
    setCorrection(review?.confirmation?.correction || "unsure");
    setNote(review?.confirmation?.note || "");
    setNextKey(
      review?.confirmation?.next.key || review?.generated?.nextKey || "",
    );
  };
  const load = useCallback(async () => {
    const value = await api<ReviewList>("/career-reviews");
    if (live.current) setData(value);
    return value;
  }, []);
  useEffect(() => {
    setLoading(true);
    void load()
      .then((value) => {
        if (!live.current || initialized.current) return;
        initialized.current = true;
        const activity = activityId ? activities.find((a) => a.id === activityId) :
          activities.find((a) => a.careerId === careerId) || activities[0];
        setSelected(activity?.id || "");
        useReview(value.reviews.find((r) => r.activityId === activity?.id), activity?.id || "", value);
      })
      .catch((e) => {
        if (live.current) setError(errorMessage(e));
      })
      .finally(() => {
        if (live.current) setLoading(false);
      });
    // Re-query after new completion; form input is retained during background refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, user?.username, state.activities.length]);
  useEffect(() => {
    if (current?.status !== "generating") return;
    let polling = false;
    const timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void load()
        .then((value) => {
          const updated = value.reviews.find((r) => r.activityId === selected);
          if (live.current && updated?.status !== "generating")
            useReview(updated);
        })
        .catch((e) => {
          if (live.current) setError(errorMessage(e));
        })
        .finally(() => {
          polling = false;
        });
    }, 3000);
    return () => clearInterval(timer);
  }, [current, selected, load]);
  const apply = (value: CareerReview) => {
    if (!live.current) return;
    setData((old) =>
      old
        ? {
            ...old,
            reviews: [
              value,
              ...old.reviews.filter((r) => r.activityId !== value.activityId),
            ],
          }
        : old,
    );
    useReview(value);
  };
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      if (live.current) setError(errorMessage(e));
      await load().catch(() => {});
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  };
  const generate = () =>
    run(async () => {
      let saved = current;
      if (editing || !saved) {
        saved = await api<CareerReview>(
          `/career-reviews/${selected}/answers`,
          json("PUT", {
            ...answers,
            expectedVersion: current?.version || 0,
            clientRequestId: requestId(),
          }),
        );
        apply(saved);
      }
      const result = await api<CareerReview>(
        `/career-reviews/${selected}/generate`,
        json("POST", {
          expectedVersion: saved.version,
          clientRequestId: requestId(),
        }),
      );
      apply(result);
    });
  const confirmReview = () =>
    run(async () => {
      if (!current) return;
      const result = await api<CareerReview>(
        `/career-reviews/${selected}/confirm`,
        json("PUT", {
          expectedVersion: current.version,
          clientRequestId: requestId(),
          agreement,
          correction,
          note,
          nextKey,
        }),
      );
      apply(result);
      await refresh();
    });
  const working = busy || current?.status === "generating";
  const complete = Object.values(answers).every(Boolean);
  return (
    <section
      className="career-review-studio"
      aria-labelledby="career-review-heading"
    >
      <header>
        <div>
          <span className="review-kicker">UPDATE · 경험으로 다음 선택하기</span>
          <h2 id="career-review-heading">크랩과 경험 돌아보기</h2>
          <p>해본 일에서 발견한 나를 정리하고, 다음 경험을 직접 골라봐.</p>
        </div>
        <img
          src="/brand/12_career_kingcrabs/hello.png"
          alt=""
          width={100}
          height={100}
        />
      </header>
      <div className="button-row"><Button kind="secondary" onClick={() => go("portfolio")}>결과물과 수료 카드 보기</Button><Button kind="secondary" onClick={() => go("home")}>홈으로</Button></div>
      {error && (
        <div className="review-error" role="alert">
          {error}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const value = await load();
                if (!initialized.current) {
                  initialized.current = true;
                  const a = activityId ? activities.find((a) => a.id === activityId) :
                    activities.find((a) => a.careerId === careerId) ||
                    activities[0];
                  setSelected(a?.id || "");
                  useReview(value.reviews.find((r) => r.activityId === a?.id), a?.id || "", value);
                }
              })
            }
          >
            <RotateCcw size={16} />
            다시 불러오기
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">회고 기록을 불러오는 중…</p>
      ) : invalidActivity ? (
        <div className="review-empty" role="alert">
          <h3>요청한 활동 기록을 찾을 수 없어.</h3>
          <p>삭제되었거나 현재 계정의 기록이 아닐 수 있어. 포트폴리오에서 돌아볼 활동을 다시 골라줘.</p>
          <Button onClick={() => go("portfolio")}>내 활동 다시 고르기</Button>
        </div>
      ) : !activities.length ? (
        <div className="review-empty">
          <p>직무체험이나 프로젝트를 마치면 경험을 함께 돌아볼 수 있어.</p>
          <Button onClick={() => go("simulation")}>
            첫 체험 고르기
            <ArrowRight size={17} />
          </Button>
        </div>
      ) : (
        data && (
          <>
            <label className="review-select">
              돌아볼 활동
              <select
                value={selected}
                disabled={working}
                onChange={(e) => {
                  const activity = activities.find((a) => a.id === e.target.value);
                  if (activity) go("review", activity.careerId, undefined, { activityId: activity.id });
                }}
              >
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} · {new Date(a.date).toLocaleDateString("ko-KR")}
                    {data.reviews.some(
                      (r) => r.activityId === a.id && r.status === "confirmed",
                    )
                      ? " · 회고 완료"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            {(editing || !current?.generated) && (
              <>
                {seed && Object.keys(seed.answers).length > 0 && !current && (
                  <section className="review-previous">
                    <div><strong>체험할 때 남긴 답을 가져왔어</strong><button disabled={working} onClick={() => setEditPrevious((v) => !v)}>{editPrevious ? "기존 답 접기" : "내 답 수정하기"}</button></div>
                    <p>{questions.filter((q) => seed.answers[q.key]).map((q) => data.options[q.key][answers[q.key]]).join(" · ")}</p>
                    {seed.source.reflection && <p className="review-previous-note">{seed.source.reflection}</p>}
                    <small>{complete ? "다시 답하지 않아도 돼. 아래 버튼을 누르면 이 기록으로 정리해 줄게." : "아직 남기지 않은 것만 아래에서 골라줘."}</small>
                  </section>
                )}
                <div className="review-questions">
                  {questions.filter((q) => !!current || editPrevious || !seed?.answers[q.key]).map((q) => (
                    <fieldset key={q.key} disabled={working}>
                      <legend>{q.title}</legend>
                      {Object.entries(data.options[q.key]).filter(([id]) => !id.startsWith("interest_") || id === answers[q.key] || id === initialAnswers[q.key]).map(
                        ([id, label]) => (
                          <label
                            key={id}
                            className={
                              answers[q.key] === id ? "is-selected" : ""
                            }
                          >
                            <input
                              type="radio"
                              name={`review-${selected}-${q.key}`}
                              checked={answers[q.key] === id}
                              onChange={() => {
                                setAnswers((a) => ({ ...a, [q.key]: id }));
                                setEditing(true);
                              }}
                            />
                            {label}
                          </label>
                        ),
                      )}
                    </fieldset>
                  ))}
                </div>
                <p className="review-disclosure">
                  {data.mode === "ai"
                    ? "AI 정리를 요청하면 선택한 활동과 최근 활동 최대 6개의 답변·회고·관심 기록을 AI에 전달해요. 계정 정보와 설계 이미지 파일은 보내지 않아요."
                    : "현재는 AI 없이 선택한 응답과 경험 기록을 정리해요. AI가 작성한 내용으로 표시하지 않아요."}
                </p>
                <Button
                  disabled={!complete || working}
                  onClick={() => void generate()}
                >
                  {working
                    ? "회고를 저장하고 정리하는 중…"
                    : data.mode === "ai"
                      ? "회고 저장하고 AI 정리 받기"
                      : "회고 저장하고 기록 정리하기"}
                  <ArrowRight size={17} />
                </Button>
                {current?.error && (
                  <p className="review-error" role="alert">
                    {current.error} 선택한 응답은 보관되어 있어요.
                  </p>
                )}
              </>
            )}
            {working && (
              <p role="status">
                선택한 응답을 바탕으로 경험을 정리하고 있어요.
              </p>
            )}
            {!editing && current?.generated && (
              <div className="review-result">
                <div className="review-result-label">
                  <Tag color={current.mode === "ai" ? "purple" : "blue"}>
                    {current.mode === "ai"
                      ? "AI 경험 정리"
                      : "기록 기반 정리 · AI 미사용"}
                  </Tag>
                  {current.status === "confirmed" && (
                    <span>
                      <Check size={16} />
                      내가 확인한 회고
                    </span>
                  )}
                </div>
                <h3>이번 경험에서 발견한 나</h3>
                <p className="review-summary">{current.generated.summary}</p>
                <details>
                  <summary>어떤 기록을 참고했을까?</summary>
                  <ul>
                    {current.sources
                      ?.filter((s) =>
                        current.generated?.evidenceRefs.includes(s.ref),
                      )
                      .map((s) => (
                        <li key={s.ref}>
                          {s.title} ·{" "}
                          {new Date(s.date).toLocaleDateString("ko-KR")}
                        </li>
                      ))}
                  </ul>
                  <p>
                    객관식 회고:{" "}
                    {questions
                      .map((q) => data.options[q.key][current.answers[q.key]])
                      .join(" · ")}
                  </p>
                </details>
                <h3>아직 확인하지 못한 경험</h3>
                {current.missing?.length ? (
                  <ul>
                    {current.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    등록된 경험목표에 기록이 있어요. 다른 직업과 비교해 봐도
                    좋아요.
                  </p>
                )}
                <small>
                  기록이 없다는 뜻이에요. 능력이 부족하다는 평가가 아니에요.
                </small>
                <h3>다음에 해볼 활동</h3>
                <p>{current.generated.reason}</p>
                <label className="review-select">
                  내가 선택할 다음 경험
                  <select
                    value={nextKey}
                    disabled={working}
                    onChange={(e) => setNextKey(e.target.value)}
                  >
                    {current.candidates?.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                {nextKey !== current.generated.nextKey && (
                  <p>
                    {current.candidates?.find((c) => c.key === nextKey)?.reason}
                  </p>
                )}
                <fieldset className="review-agreement" disabled={working}>
                  <legend>이 정리가 내 생각과 비슷해?</legend>
                  {(
                    [
                      ["agree", "내 생각과 비슷해요"],
                      ["different", "조금 달라요"],
                    ] as const
                  ).map(([id, label]) => (
                    <label key={id}>
                      <input
                        type="radio"
                        name={`agree-${selected}`}
                        checked={agreement === id}
                        onChange={() => setAgreement(id)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {agreement === "different" && (
                  <label className="review-select">
                    내 생각에 더 가까운 말
                    <select
                      value={correction}
                      disabled={working}
                      onChange={(e) => setCorrection(e.target.value)}
                    >
                      <option value="not_me">
                        정리한 내용이 내 생각과 달라요
                      </option>
                      <option value="other">
                        다른 역할을 더 알아보고 싶어요
                      </option>
                      <option value="unsure">
                        경험을 더 해보고 정하고 싶어요
                      </option>
                    </select>
                  </label>
                )}
                <label className="review-note">
                  내 말로 덧붙이기 · 선택
                  <textarea
                    value={note}
                    maxLength={1200}
                    disabled={working}
                    placeholder="쓰고 싶은 이야기가 있을 때만 남겨도 좋아."
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                {current.confirmation && (
                  <div className="review-confirmed">
                    <strong>내가 남긴 최종 회고</strong>
                    <p>{current.confirmation.summary}</p>
                    <span>
                      선택한 다음 경험: {current.confirmation.next.title}
                    </span>
                  </div>
                )}
                <div className="button-row">
                  <Button
                    disabled={working || !nextKey}
                    onClick={() => void confirmReview()}
                  >
                    {working ? "저장 중…" : "확인하고 나의 진로 기록에 저장"}
                    <Check size={17} />
                  </Button>
                  <Button
                    kind="secondary"
                    disabled={working}
                    onClick={() => setEditing(true)}
                  >
                    회고 선택 다시하기
                  </Button>
                  {current.status === "confirmed" && (
                    <Button
                      kind="secondary"
                      onClick={() => go("map", current.careerId)}
                    >
                      나의 진로 기록 보기
                      <ArrowRight size={17} />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}

export function ReviewMapCard({ careerId, home = false, compact = false }: { careerId?: CareerId; home?: boolean; compact?: boolean }) {
  const { state, go } = useApp();
  const [reviews, setReviews] = useState<CareerReview[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api<ReviewList>("/career-reviews")
      .then((d) => {
        if (live) setReviews(d.reviews);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [retry, state.activities.length]);
  const review = [...reviews].sort((a, b) => (b.confirmation?.date || "").localeCompare(a.confirmation?.date || "")).find(
    (r) => (!careerId || r.careerId === careerId) && r.status === "confirmed",
  );
  const next = review?.confirmation?.next;
  const suggested = state.recommendations[0];
  const done =
    !!next &&
    state.activities.some(
      (a) =>
        a.careerId === next.careerId &&
        a.kind === next.kind &&
        a.date > review!.confirmation!.date,
    );
  return (
    <section className="review-map-card">
      {!compact && <span className="review-kicker">UPDATE · 내가 확인한 회고</span>}
      <h3>{compact ? "최근에 발견한 나" : home ? "다음에 해볼 경험" : "내가 확인한 경험 회고"}</h3>
      {loading ? (
        <p role="status">확인한 회고를 불러오는 중…</p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>다시 불러오기</button>
        </>
      ) : review && next ? (
        <>
          <p>{review.confirmation!.summary}</p>
          <small>
            {review.activityTitle} ·{" "}
            {new Date(review.confirmation!.date).toLocaleDateString("ko-KR")}
          </small>
          {!compact && <><strong>{next.title}</strong>
          <p>
            {review.confirmation!.agreement === "agree" &&
            next.key === review.generated?.nextKey
              ? review.generated.reason
              : next.reason}
          </p>
          <button onClick={() => home ? go(pageFor(next.kind), next.careerId) : go("home")}>
            {home ? (done ? "선택한 활동 다시 보기" : "내가 고른 경험 시작") : "홈에서 다음 경험 보기"}
            <ArrowRight size={17} />
          </button>
          </>}
          <button
            className="review-map-secondary"
            onClick={() => go("review", review?.careerId || careerId, undefined, { activityId: review?.activityId })}
          >
            회고 다시 보기
          </button>
        </>
      ) : (
        <>
          <p>
            {compact ? "해본 일이 어땠는지 짧게 돌아봐." : home && !state.activities.length ? (suggested?.reason || "궁금한 직업의 하루를 경험하고 첫 기록을 남겨봐.") : "체험 후 재미있었던 일과 어려웠던 점을 돌아보면 다음에 해보고 싶은 일이 더 또렷해져."}
          </p>
          <button onClick={() => home && !state.activities.length ? go(suggested ? pageFor(suggested.kind) : "simulation", suggested?.careerId) : go("review", careerId)}>
            {home && !state.activities.length ? "첫 경험 골라보기" : "크랩과 경험 돌아보기"}
            <ArrowRight size={17} />
          </button>
        </>
      )}
    </section>
  );
}
