import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { createPortal } from "react-dom";
import { api, errorMessage, json, requestId } from "../api";
import type { Activity, CareerId } from "../data";
import { useApp } from "../store";
import CareerEntry from "./CareerEntry";
import ProjectCoach from "./ProjectCoach";
import ProjectBrief from "./ProjectBrief";
import { downloadFile, type DrawingScene } from "./types";
import "./fieldwork.css";
import "./workshop-studio.css";
import { hasWritingBlanks, writingReady } from "./project-writing";
import { drawingReady } from "./drawing-readiness";
import { Modal } from "../components";
import { isRecoveryScene } from "./recovery-model";

import { projectFor } from "./workplaces";
const DrawingBoard = lazy(() => import("./DrawingBoard"));
const RecoveryStudio = lazy(() => import("./RecoveryStudio"));
type Draft = {
  careerId: CareerId;
  answers: string[];
  version: number;
  scene: DrawingScene | null;
  interest: number | null;
};
type Revision = {
  version: number;
  date: string;
  interest: number | null;
  hasDrawing: boolean;
  completedAnswers: number;
};
type Artifact = Activity & { scene?: DrawingScene; observations?: string[] };
const emptyScene = (): DrawingScene => ({
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
});
const contentOf = (d: Draft) =>
  JSON.stringify({
    answers: d.answers,
    scene: d.scene,
    interest: d.interest ?? null,
  }, (_key, value: unknown) => {
    // Server validation can reorder object keys. The same saved document must
    // compare equal or saveLatest would keep resending it indefinitely.
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const object = value as Record<string, unknown>;
      return Object.fromEntries(Object.keys(object).sort().map(key => [key, object[key]]));
    }
    return value;
  });

export default function Workshop() {
  const {
    user,
    careerId: cid,
    go,
    refresh,
    registerNavigationGuard,
    state,
  } = useApp();
  const startingPoint = state.gaps[cid]?.startingPoint;
  const project = projectFor(cid);
  const [draft, setDraft] = useState<Draft | null>(null),
    [initialScene, setInitialScene] = useState<DrawingScene>(emptyScene);
  const [epoch, setEpoch] = useState(0),
    [edits, setEdits] = useState(0),
    [status, setStatus] = useState("불러오는 중…");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Artifact | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]),
    [historyOpen, setHistoryOpen] = useState(false);
  const [panel, setPanel] = useState("brief");
  const [panelOpen, setPanelOpen] = useState(false);
  const panelState = useRef({ panel, panelOpen });
  panelState.current = { panel, panelOpen };
  const beforeHelp = useRef<{ panel: string; panelOpen: boolean } | null>(null);
  const editing = !!user && !!draft && !result;
  useEffect(() => {
    if (!editing) return;
    const guide = (event: Event) => {
      const step = (event as CustomEvent<{ step: string }>).detail?.step;
      if (step === "close") {
        if (beforeHelp.current) {
          setPanel(beforeHelp.current.panel);
          setPanelOpen(beforeHelp.current.panelOpen);
          beforeHelp.current = null;
        }
        return;
      }
      if (!beforeHelp.current) beforeHelp.current = { ...panelState.current };
      if (step === "brief" || step === "writing") {
        setPanel(step);
        setPanelOpen(true);
        document.querySelector(".studio-panel-scroll")?.scrollTo(0, 0);
      } else if (step === "tools" || step === "submit") setPanelOpen(false);
    };
    window.addEventListener("kingcareer:studio-help-step", guide);
    return () =>
      window.removeEventListener("kingcareer:studio-help-step", guide);
  }, [editing]);
  useEffect(() => {
    if (!editing) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const firstButton = [
      ...document.querySelectorAll<HTMLButtonElement>(".studio-topbar button"),
    ].find((button) => button.getClientRects().length > 0);
    firstButton?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previous;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [editing]);
  const current = useRef<Draft | null>(null),
    saved = useRef(""),
    pending = useRef<Promise<Draft> | null>(null);
  const mounted = useRef(true),
    operation = useRef(false),
    keys = useRef(new Map<string, string>()),
    loadGeneration = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const requestKey = (body: unknown) => {
    const fingerprint = JSON.stringify(body);
    if (!keys.current.has(fingerprint))
      keys.current.set(fingerprint, requestId());
    return keys.current.get(fingerprint);
  };
  const load = useCallback(async () => {
    if (!user) return;
    const generation = ++loadGeneration.current;
    setError("");
    setStatus("불러오는 중…");
    try {
      const response = await api<Draft>(`/projects/${cid}`);
      if (generation !== loadGeneration.current) return;
      const loaded = {
        ...response,
        scene: response.scene || emptyScene(),
        interest: response.interest ?? null,
      };
      const fresh = response.version === 0 && !loaded.scene.elements.length && !response.answers.some(answer => answer.trim());
      const value = fresh ? { ...loaded, scene: { ...emptyScene(), elements: (await import("./project-templates")).projectTemplate(cid) } } : loaded;
      if (generation !== loadGeneration.current) return;
      current.current = value;
      saved.current = contentOf(loaded);
      setDraft(value);
      setInitialScene(value.scene);
      setEpoch((e) => e + 1);
      setStatus(fresh ? "새 작업을 준비했어요 · 수정하면 자동 저장돼요" : "저장한 초안을 불러왔어요");
    } catch (e) {
      if (generation === loadGeneration.current) {
        setError(errorMessage(e));
        setStatus("불러오기 실패");
      }
    }
  }, [user?.username, cid]);
  useEffect(() => {
    void load();
    return () => {
      loadGeneration.current++;
    };
  }, [load]);
  const save = useCallback(
    async function saveLatest(): Promise<Draft> {
      if (pending.current) {
        await pending.current;
        return saveLatest();
      }
      const snapshot = current.current;
      if (!snapshot) throw new Error("프로젝트를 먼저 불러와 주세요.");
      if (saved.current === contentOf(snapshot)) return snapshot;
      if (mounted.current) {
        setStatus("초안 저장 중…");
        setError("");
      }
      const body = {
        answers: snapshot.answers,
        scene: snapshot.scene,
        interest: snapshot.interest,
        expectedVersion: snapshot.version,
      };
      const task = api<Draft>(
        `/projects/${cid}/draft`,
        json("PUT", { ...body, clientRequestId: requestKey(body) }),
      );
      pending.current = task;
      try {
        const value = await task;
        saved.current = contentOf(value);
        if (current.current) {
          current.current = { ...current.current, version: value.version };
          if (mounted.current) setDraft(current.current);
        }
        if (mounted.current)
          setStatus(
            saved.current === contentOf(current.current!)
              ? `초안 저장 완료 · 수정본 ${value.version}`
              : "추가 변경사항 저장 대기",
          );
      } catch (e) {
        if (mounted.current) {
          setError(errorMessage(e));
          setStatus("저장하지 못했어요 · 입력은 유지돼요");
        }
        throw e;
      } finally {
        pending.current = null;
      }
      if (current.current && saved.current !== contentOf(current.current))
        return saveLatest();
      return current.current!;
    },
    [cid],
  );
  useEffect(() => {
    if (!edits || !current.current || operation.current) return;
    const timer = window.setTimeout(() => {
      void save().catch(() => {});
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [edits, save]);
  useEffect(
    () =>
      registerNavigationGuard(async () => {
        if (operation.current) return false;
        if (!current.current || saved.current === contentOf(current.current))
          return true;
        try {
          await save();
          return true;
        } catch {
          return false;
        }
      }),
    [registerNavigationGuard, save],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        pending.current ||
        (current.current && saved.current !== contentOf(current.current))
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const update = useCallback((change: Partial<Draft>) => {
    if (!current.current || operation.current) return;
    const next = { ...current.current, ...change };
    if (contentOf(next) === contentOf(current.current)) return;
    current.current = next;
    setDraft(next);
    setEdits((n) => n + 1);
    setStatus("변경사항 저장 대기…");
  }, []);
  const draw = useCallback(
    (scene: DrawingScene) => update({ scene }),
    [update],
  );
  const submit = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await save();
      if (value.interest === null) {
        setPanel("brief");
        setPanelOpen(true);
        throw new Error("이 직업이 어땠는지 관심도를 골라 주세요.");
      }
      const body = { expectedVersion: value.version, interest: value.interest };
      const activity = await api<Artifact>(
        `/projects/${cid}/submit`,
        json("POST", { ...body, clientRequestId: requestKey(body) }),
      );
      setResult(activity);
      setStatus("포트폴리오에 제출했어요");
      void refresh().catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const history = async () => {
    try {
      setRevisions(await api<Revision[]>(`/projects/${cid}/revisions`));
      setHistoryOpen(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const restore = async (revision: Revision) => {
    if (
      operation.current ||
      !confirm(`수정본 ${revision.version}의 내용으로 새 수정본을 만들까요?`)
    )
      return;
    operation.current = true;
    setBusy(true);
    try {
      await save();
      const detail = await api<Draft>(
        `/projects/${cid}/revisions/${revision.version}`,
      );
      const next = {
        ...current.current!,
        answers: detail.answers,
        scene: detail.scene || emptyScene(),
        interest: detail.interest ?? null,
      };
      current.current = next;
      setDraft(next);
      setInitialScene(next.scene);
      setEpoch((e) => e + 1);
      await save();
      setHistoryOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const evaluate = async () => {
    if (!result || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      setResult(
        await api<Artifact>(
          `/portfolio/${result.id}/evaluate`,
          json("POST", {
            clientRequestId: requestKey({ evaluation: result.id }),
          }),
        ),
      );
      void refresh().catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const backup = () => {
    if (current.current)
      downloadFile(
        `KingCareer-${cid}-작업백업.json`,
        JSON.stringify(current.current, null, 2),
        "application/json",
      );
  };
  const openWriting = () => {
    setPanel("writing");
    setPanelOpen(true);
    requestAnimationFrame(() => {
      const missing =
        draft?.answers.findIndex((value) => !writingReady(value)) ?? 0;
      const target = document.querySelectorAll<HTMLElement>(
        ".studio-writing-item",
      )[Math.max(0, missing)];
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  };
  const startSketch = async () => {
    if (operation.current || !current.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await save();
      const { projectTemplate } = await import("./project-templates");
      const next: Draft = { ...current.current!, scene: { ...emptyScene(), elements: projectTemplate(cid) } };
      current.current = next;
      setDraft(next);
      setInitialScene(next.scene!);
      setEpoch(value => value + 1);
      setStatus("기존 초안을 보관하고 새 작업을 저장하는 중…");
      await save();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  if (editing && draft && cid === "developer" && isRecoveryScene(draft.scene)) {
    return <div className="studio-host">
      <Suspense fallback={<p role="status">작업실을 준비하는 중…</p>}>
        <RecoveryStudio key={`${cid}-${epoch}`} draft={draft} status={status} busy={busy} error={error} isSaved={saved.current === contentOf(draft)}
          onChange={update} onSave={save} onSubmit={submit} onBack={() => go("projects")}
          onHistory={() => void history()} onBackup={backup} onStartSketch={() => void startSketch()} />
      </Suspense>
      {historyOpen && createPortal(<Modal title="저장된 수정 이력" onClose={() => setHistoryOpen(false)}>
        <p>현재 작업을 저장한 뒤 선택한 내용으로 복원해요. 이전 그림도 그대로 열 수 있어요.</p>
        <div className="kc-revisions">
          {revisions.length ? revisions.map(revision => <button key={revision.version} disabled={busy} onClick={() => void restore(revision)}>
            수정본 {revision.version} · {new Date(revision.date).toLocaleString("ko-KR")} · 복원
          </button>) : <p>아직 저장된 수정본이 없어요.</p>}
        </div>
      </Modal>, document.body)}
    </div>;
  }
  if (editing && draft)
    return (
      <div className="studio-host">
        <section className="kc-workshop kc-studio" aria-label="프로젝트 작업실">
          <header className="studio-topbar kc-save-bar">
            <button
              className="kc-text-button"
              onClick={() => go("projects")}
              aria-label="프로젝트 목록으로"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="studio-title">
              <h1>{project.title}</h1>
              <span role="status">{status}</span>
            </div>
            <button disabled={busy} onClick={() => void save().catch(() => {})}>
              <Save size={16} /> 저장
            </button>
            <button
              onClick={() =>
                window.dispatchEvent(new Event("kingcareer:show-help"))
              }
            >
              화면 안내
            </button>
            <button
              className="kc-button"
              data-help="studio-submit"
              disabled={
                busy ||
                draft.interest === null ||
                draft.answers.some((s) => !writingReady(s)) ||
                !drawingReady(draft.scene)
              }
              onClick={() => void submit()}
            >
              {busy ? "제출 중…" : "제출하기"}
            </button>
          </header>
          <div className="studio-errors">
            {" "}
            {error && (
              <div className="kc-error" role="alert">
                <p>{error}</p>
                <button
                  disabled={busy}
                  onClick={() =>
                    draft ? void save().catch(() => {}) : void load()
                  }
                >
                  저장·연결 다시 시도
                </button>
                {draft && (
                  <>
                    <button onClick={backup}>입력한 내용 파일로 보관</button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "화면의 변경사항을 마지막으로 저장한 초안으로 바꿀까요? 필요하면 먼저 파일로 보관해 주세요.",
                          )
                        )
                          void load();
                      }}
                    >
                      저장한 초안 다시 불러오기
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="studio-body">
            <div className="studio-canvas">
              <Suspense
                fallback={
                  <div className="kc-panel" role="status">
                    설계 도구를 준비하는 중…
                  </div>
                }
              >
                <DrawingBoard
                  key={epoch}
                  careerId={cid}
                  initial={initialScene}
                  onChange={draw}
                  onStartNew={() => void startSketch()}
                  locked={busy}
                />
              </Suspense>
            </div>
            <aside
              className={`studio-panel ${panelOpen ? "is-open" : ""}`}
              aria-label="프로젝트 작업 도움"
            >
              <div className="studio-panel-heading">
                <div
                  className="studio-tabs"
                  role="tablist"
                  aria-label="작업 패널"
                  onKeyDown={(event) => {
                    const ids = ["brief", "writing", "coach"];
                    let next = ids.indexOf(panel);
                    if (event.key === "ArrowRight")
                      next = (next + 1) % ids.length;
                    else if (event.key === "ArrowLeft")
                      next = (next + ids.length - 1) % ids.length;
                    else if (event.key === "Home") next = 0;
                    else if (event.key === "End") next = ids.length - 1;
                    else return;
                    event.preventDefault();
                    setPanel(ids[next]);
                    setPanelOpen(true);
                    document.getElementById(`studio-tab-${ids[next]}`)?.focus();
                  }}
                >
                  {[
                    ["brief", "과제"],
                    ["writing", "내 설명"],
                    ["coach", "크랩 도움"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      id={`studio-tab-${id}`}
                      role="tab"
                      tabIndex={panel === id ? 0 : -1}
                      aria-selected={panel === id}
                      aria-controls={`studio-panel-${id}`}
                      onClick={() => {
                        setPanel(id);
                        setPanelOpen(true);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  className="studio-panel-close"
                  onClick={() => setPanelOpen(false)}
                  aria-label="패널 접기"
                >
                  접기
                </button>
              </div>
              <div className="studio-panel-scroll">
                <div
                  role="tabpanel"
                  id="studio-panel-brief"
                  aria-labelledby="studio-tab-brief"
                  hidden={panel !== "brief"}
                >
                  {startingPoint && (
                    <div className="diagnosis-guidance">
                      <b>{startingPoint.label}</b>
                      <p>
                        {startingPoint.level === "challenge"
                          ? "만들어본 경험을 살려 두 가지 개선안을 비교해 봐. 선택한 안의 근거와 효과를 확인할 방법까지 결과물에 담아보자."
                          : startingPoint.level === "guided"
                            ? "처음이라면 직무체험에서 본 물체 하나부터 그려봐. 발견한 문제, 바꿀 점, 확인할 방법을 차례로 채우면 돼."
                            : "체험에서 선택했던 조치를 결과물로 이어가 보자. 배치도와 짧은 설명으로 개선 이유를 보여줘."}
                      </p>
                    </div>
                  )}
                  <ProjectBrief
                    brief={project.brief}
                    careerId={cid}
                    answers={draft.answers}
                    hasDrawing={drawingReady(draft.scene)}
                    interest={draft.interest}
                    busy={busy}
                    onInterest={(interest) => update({ interest })}
                    onWriting={openWriting}
                    onSimulation={() => go("simulation", cid)}
                    onHistory={() => void history()}
                    onBackup={backup}
                  />
                  {historyOpen && (
                    <div className="kc-revisions">
                      <h3>저장된 수정 이력</h3>
                      {revisions.length ? (
                        revisions.map((r) => (
                          <button
                            key={r.version}
                            disabled={busy}
                            onClick={() => void restore(r)}
                          >
                            수정본 {r.version} ·{" "}
                            {new Date(r.date).toLocaleString("ko-KR")} · 이
                            내용으로 복원
                          </button>
                        ))
                      ) : (
                        <p>아직 저장된 수정본이 없어요.</p>
                      )}
                      <button onClick={() => setHistoryOpen(false)}>
                        닫기
                      </button>
                    </div>
                  )}
                </div>
                <div
                  role="tabpanel"
                  id="studio-panel-writing"
                  aria-labelledby="studio-tab-writing"
                  hidden={panel !== "writing"}
                >
                  <div className="kc-writing-grid">
                    {[
                      {
                        title: "01 · 발견한 문제",
                        hint: "어떤 현장 자료에서 무엇이 불편하거나 위험하다고 느꼈나요?",
                      },
                      {
                        title: "02 · 개선 제안과 근거",
                        hint: "무엇을 어디에 바꿨고, 그렇게 설계한 이유는 무엇인가요?",
                      },
                      {
                        title: "03 · 확인과 검증 계획",
                        hint: "개선 효과를 어떤 수치와 관찰로 확인할 건가요? 남은 한계도 적어 봐요.",
                      },
                    ].map((item, i) => (
                      <div
                        className="studio-writing-item"
                        key={i}
                        tabIndex={-1}
                      >
                        <label htmlFor={`project-answer-${i}`}>
                          {i === 0 && (
                            <span
                              className="studio-writing-heading"
                              data-help="studio-writing"
                            >
                              아이디어를 짧게 설명해 봐
                            </span>
                          )}
                          <strong>{item.title}</strong>
                          <span>{project.hints[i] || item.hint}</span>
                        </label>
                        <textarea
                          id={`project-answer-${i}`}
                          disabled={busy}
                          maxLength={5000}
                          value={draft.answers[i]}
                          onChange={(e) =>
                            update({
                              answers: draft.answers.map((s, n) =>
                                n === i ? e.target.value : s,
                              ),
                            })
                          }
                          placeholder="내가 발견한 것부터 한 문장으로 적어봐."
                        />
                        <small className="writing-readiness" role="status">
                          {hasWritingBlanks(draft.answers[i])
                            ? "이전에 저장한 빈칸이 있어요. 내 생각으로 마저 채워줘요."
                            : writingReady(draft.answers[i])
                              ? "설명을 적었어요. 내 생각과 맞는지 읽어봐요."
                              : "그림에서 바꾼 내용을 짧게 적어줘요. 설명은 10자 이상이면 돼요."}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  role="tabpanel"
                  id="studio-panel-coach"
                  aria-labelledby="studio-tab-coach"
                  hidden={panel !== "coach"}
                >
                  <ProjectCoach
                    key={cid}
                    careerId={cid}
                    save={save}
                    disabled={busy}
                  />
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    );
  if (!user) return <CareerEntry mode="project" />;
  return (
    <section className="kc-workshop">
      <button className="kc-text-button" onClick={() => go("projects")}>
        <ArrowLeft size={16} /> 프로젝트 목록
      </button>
      <div className="kc-section-heading">
        <div>
          <span className="kc-eyebrow">MAKE SOMETHING THAT MATTERS</span>
          <h1>{project.title}</h1>
          <p>체험에서 발견한 문제를, 보여줄 수 있는 결과물로 바꿔 봐요.</p>
        </div>
        <img
          className="kc-guide-small"
          src={`/brand/12_career_kingcrabs/${cid}.png`}
          alt="프로젝트를 돕는 크랩"
        />
      </div>
      {error && (
        <div className="kc-error" role="alert">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() => (draft ? void save().catch(() => {}) : void load())}
          >
            저장·연결 다시 시도
          </button>
          {draft && (
            <>
              <button onClick={backup}>입력한 내용 파일로 보관</button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "화면의 변경사항을 마지막으로 저장한 초안으로 바꿀까요? 필요하면 먼저 파일로 보관해 주세요.",
                    )
                  )
                    void load();
                }}
              >
                저장한 초안 다시 불러오기
              </button>
            </>
          )}
        </div>
      )}
      {result ? (
        <div className="kc-project-result">
          <img
            src="/brand/08_badges/experience_badge_04.png"
            alt="개선 설계자 배지"
          />
          <span className="kc-eyebrow">나의 포트폴리오</span>
          <h2>{result.studioKind === "login-recovery" ? "직접 고치고 확인한 화면을 남겼어요." : "생각이 결과물이 됐어요."}</h2>
          <p>
            {result.studioKind === "login-recovery" ? "내 설계와 두 상황의 확인 기록을 포트폴리오에 저장했어요. 활동 완료 배지를 받았어요." : "설계도와 세 가지 설명을 수정본별로 저장했어요. 개선 설계자 배지를 받았어요."}
          </p>
          {result.designSummary && <div className="kc-note"><strong>내 설계에서 정리한 내용</strong>{result.designSummary.map((text, index) => <p key={index}>{text}</p>)}</div>}
          <div className="kc-note">
            <strong>
              {result.evaluationStatus === "ai_feedback"
                ? "AI 코치의 글 피드백"
                : "프로젝트 제출 완료 · AI 피드백 없음"}
            </strong>
            <p>{result.feedback}</p>
            {result.observations?.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
            <small>
              설계도의 시각적 구조나 직무 능력을 검증한 결과는 아니에요.
            </small>
          </div>
          <div className="kc-button-row">
            <button
              className="kc-button"
              onClick={() =>
                go("review", cid, undefined, { activityId: result.id })
              }
            >
              경험 돌아보고 다음 활동 고르기 <ArrowRight size={18} />
            </button>
            <button
              disabled={busy || result.evaluationStatus === "ai_feedback"}
              onClick={() => void evaluate()}
            >
              {busy ? "코치에게 물어보는 중…" : "AI 코치 피드백 요청"}
            </button>
            <button disabled={busy} onClick={() => setResult(null)}>
              더 다듬기
            </button>
            <a href={`/api/v1/portfolio/${result.id}/artifact`} download>
              제출 결과물 JSON 받기
            </a>
          </div>
        </div>
      ) : (
        <p role="status">{status}</p>
      )}
    </section>
  );
}
