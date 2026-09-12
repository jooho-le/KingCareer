import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { api, errorMessage, json, requestId } from "../api";
import { useApp } from "../store";
import type { Activity } from "../data";
import type { DrawingScene } from "./types";
const DrawingBoard = lazy(() => import("./DrawingBoard"));
type Artifact = Activity & { scene?: DrawingScene; observations?: string[] };
export default function ArtifactPreview({
  activityId,
}: {
  activityId: string;
}) {
  const { refresh } = useApp();
  const [artifact, setArtifact] = useState<Artifact | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const key = useRef(requestId()),
    lock = useRef(false);
  useEffect(() => {
    let live = true;
    setError("");
    api<Artifact>(`/portfolio/${activityId}/artifact`)
      .then((value) => {
        if (live) setArtifact(value);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [activityId, retry]);
  const evaluate = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      setArtifact(
        await api<Artifact>(
          `/portfolio/${activityId}/evaluate`,
          json("POST", { clientRequestId: key.current }),
        ),
      );
      void refresh().catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <section className="kc-workshop">
      <h3>이 수정본의 결과물</h3>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            disabled={busy}
            onClick={() =>
              artifact ? void evaluate() : setRetry((n) => n + 1)
            }
          >
            다시 시도
          </button>
        </p>
      )}
      {!artifact ? (
        <p role="status">제출한 결과물을 불러오는 중…</p>
      ) : (
        <>
          {artifact.scene && (
            <Suspense fallback={<p>배치도를 여는 중…</p>}>
              <DrawingBoard
                careerId={artifact.careerId}
                initial={artifact.scene}
                locked
                onChange={() => {}}
              />
            </Suspense>
          )}
          <div className="kc-note">
            <strong>
              {artifact.evaluationStatus === "ai_feedback"
                ? "Gemini 코치의 피드백"
                : "AI 코치 미연결 · 제출 완료"}
            </strong>
            <p>{artifact.feedback}</p>
            {artifact.observations?.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </div>
          <button
            disabled={busy || artifact.evaluationStatus === "ai_feedback"}
            onClick={() => void evaluate()}
          >
            {busy ? "코치 피드백을 받는 중…" : "AI 코치 피드백 요청"}
          </button>
        </>
      )}
    </section>
  );
}
