import { useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { api, errorMessage, json, requestId } from "../api";
import type { Activity } from "../data";
import { useApp } from "../store";

export default function PortfolioEvaluation({ activity, onEvaluated }: {
  activity: Activity;
  onEvaluated: (activity: Activity) => void;
}) {
  const { refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const key = useRef(requestId());
  const done = activity.evaluationStatus === "ai_feedback";
  const evaluate = async () => {
    if (pending.current || done) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const updated = await api<Activity>(`/portfolio/${activity.id}/evaluate`, json("POST", { clientRequestId: key.current }));
      onEvaluated(updated);
      void refresh().catch(() => {});
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return <section className="portfolio-evaluation" aria-label="프로젝트 AI 피드백" aria-busy={busy}>
    <div className="portfolio-evaluation-title"><MessageCircle size={22} /><strong>크랩의 한마디</strong></div>
    <p>{done ? "네가 만든 결과물에서 다음 아이디어를 찾아봤어." : "작성한 설명과 설계도 속 글·연결을 읽고, 잘 드러난 점과 다음에 다듬을 점을 알려줄게."}</p>
    {done && !!activity.observations?.length && <ul>{activity.observations.map((item, index) => <li key={index}>{item}</li>)}</ul>}
    {!done && <button className="button primary" disabled={busy} onClick={() => void evaluate()}>{busy ? "크랩이 결과물을 읽는 중…" : error ? "AI 피드백 다시 요청" : "AI 피드백 받기"}</button>}
    {busy && <p role="status">잠시 기다려 줘. 피드백은 결과물과 함께 저장돼.</p>}
    {error && <p role="alert">{error}</p>}
    <small>AI의 제안이야. 직업 적합도나 성적을 매기는 평가는 아니야.</small>
  </section>;
}
