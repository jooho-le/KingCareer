import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, Save, Download } from "lucide-react";
import { api, errorMessage, json, requestId } from "../api";
import type { Activity, CareerId } from "../data";
import { useApp } from "../store";
import { downloadFile, type DrawingScene } from "./types";
import "./fieldwork.css";

import { projectFor } from "./workplaces";
const DrawingBoard = lazy(() => import("./DrawingBoard"));
type Draft = {
  careerId: CareerId;
  answers: string[];
  version: number;
  scene: DrawingScene | null;
};
type Revision = Draft & { date: string };
type Artifact = Activity & { scene?: DrawingScene; observations?: string[] };
const emptyScene = (): DrawingScene => ({
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
});
const contentOf = (d: Draft) =>
  JSON.stringify({ answers: d.answers, scene: d.scene });

export default function Workshop() {
  const {
    user,
    careerId: cid,
    go,
    refresh,
    requireAuth,
    registerNavigationGuard,
  } = useApp();
  const project = projectFor(cid);
  const [draft, setDraft] = useState<Draft | null>(null),
    [initialScene, setInitialScene] = useState<DrawingScene>(emptyScene);
  const [epoch, setEpoch] = useState(0),
    [edits, setEdits] = useState(0),
    [status, setStatus] = useState("불러오는 중…");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Artifact | null>(null);
  const [interest, setInterest] = useState(3),
    [revisions, setRevisions] = useState<Revision[]>([]),
    [historyOpen, setHistoryOpen] = useState(false);
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
      const value = { ...response, scene: response.scene || emptyScene() };
      current.current = value;
      saved.current = contentOf(value);
      setDraft(value);
      setInitialScene(value.scene);
      setEpoch((e) => e + 1);
      setStatus("서버 기록을 불러왔어요");
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
        setStatus("서버에 저장 중…");
        setError("");
      }
      const body = {
        answers: snapshot.answers,
        scene: snapshot.scene,
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
              ? `서버 저장 완료 · 수정본 ${value.version}`
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
          return window.confirm(
            "저장에 실패한 변경사항이 있어요. 이 화면을 떠날까요? 취소하면 파일로 내려받거나 다시 저장할 수 있어요.",
          );
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
      const body = { expectedVersion: value.version, interest };
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
      const next = {
        ...current.current!,
        answers: revision.answers,
        scene: revision.scene || emptyScene(),
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
  if (!user)
    return (
      <section className="kc-panel">
        <h1>{project.title}</h1>
        <p>{project.brief}</p>
        <button className="kc-button" onClick={requireAuth}>
          로그인하고 시작하기
        </button>
      </section>
    );
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
          src="/brand/01_mascots/mascot_04_project.png"
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
                      "화면의 변경사항을 서버 기록으로 바꿀까요? 필요하면 먼저 파일로 보관해 주세요.",
                    )
                  )
                    void load();
                }}
              >
                서버 기록 다시 불러오기
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
          <span className="kc-eyebrow">FIRST PORTFOLIO PIECE</span>
          <h2>생각이 결과물이 됐어요.</h2>
          <p>
            설계도와 세 가지 설명을 수정본별로 저장했어요. 개선 설계자 배지를
            받았어요.
          </p>
          <div className="kc-note">
            <strong>
              {result.evaluationStatus === "ai_feedback"
                ? "Gemini 코치의 텍스트 피드백"
                : "제출 완료 · AI 내용 평가 미연결"}
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
            <button className="kc-button" onClick={() => go("portfolio")}>
              포트폴리오에서 보기 <ArrowRight size={18} />
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
      ) : draft ? (
        <>
          <div className="kc-project-brief">
            <strong>프로젝트 의뢰</strong>
            <p>{project.brief}</p>
            <span>예상 20–30분 · 설계도 + 개선 근거 + 확인 계획</span>
            <button
              className="kc-text-button"
              onClick={() => go("simulation", cid)}
            >
              현장 체험으로 돌아가기
            </button>
          </div>
          <div className="kc-save-bar">
            <span role="status">
              <Save size={16} /> {status}
            </span>
            <div>
              <button
                disabled={busy}
                onClick={() => void save().catch(() => {})}
              >
                지금 저장
              </button>
              <button disabled={busy} onClick={() => void history()}>
                수정 이력
              </button>
              <button onClick={backup}>
                <Download size={15} /> 작업 백업
              </button>
            </div>
          </div>
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
                    {new Date(r.date).toLocaleString("ko-KR")} · 이 내용으로
                    복원
                  </button>
                ))
              ) : (
                <p>아직 저장된 수정본이 없어요.</p>
              )}
              <button onClick={() => setHistoryOpen(false)}>닫기</button>
            </div>
          )}
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
              locked={busy}
            />
          </Suspense>
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
              <label key={i}>
                <strong>{item.title}</strong>
                <span>{project.hints[i] || item.hint}</span>
                <textarea
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
                  placeholder="10자 이상으로 생각을 설명해 주세요."
                />
                <small>{draft.answers[i].trim().length}자</small>
              </label>
            ))}
          </div>
          <div className="kc-submit-bar">
            <label>
              프로젝트 후 관심도 · {interest}/5
              <input
                type="range"
                min={1}
                max={5}
                value={interest}
                disabled={busy}
                onChange={(e) => setInterest(Number(e.target.value))}
              />
            </label>
            <p>
              제출은 작업물의 저장을 뜻해요. 내용 피드백은 AI 코치 연결 후 따로
              요청할 수 있어요.
            </p>
            <button
              className="kc-button"
              disabled={
                busy ||
                draft.answers.some((s) => s.trim().length < 10) ||
                !draft.scene?.elements.length
              }
              onClick={() => void submit()}
            >
              {busy ? "제출물 저장 중…" : "포트폴리오에 제출하기"}
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <p role="status">{status}</p>
      )}
    </section>
  );
}
