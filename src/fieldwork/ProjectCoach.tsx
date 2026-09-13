import { useEffect, useRef, useState } from "react";
import { api, errorMessage, json, requestId } from "../api";
import type { CareerId } from "../data";

type Reply = {
  mode: "ai" | "template";
  hint: string;
  nextAction: string;
  example?: string;
  version: number;
  mission: number;
};
export default function ProjectCoach({
  careerId,
  save,
  disabled,
}: {
  careerId: CareerId;
  save: () => Promise<{ version: number }>;
  disabled: boolean;
}) {
  const [mission, setMission] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false),
    live = useRef(true);
  const keys = useRef(new Map<string, string>());
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  async function ask(intent: string) {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setReply(null);
    try {
      const snapshot = await save();
      if (!live.current) return;
      const fingerprint = JSON.stringify([
        careerId,
        snapshot.version,
        mission,
        intent,
      ]);
      if (!keys.current.has(fingerprint))
        keys.current.set(fingerprint, requestId());
      const value = await api<Reply>(
        `/projects/${careerId}/help`,
        json("POST", {
          expectedVersion: snapshot.version,
          mission,
          intent,
          clientRequestId: keys.current.get(fingerprint),
        }),
      );
      if (live.current) setReply(value);
    } catch (e) {
      if (live.current) setError(errorMessage(e));
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <section className="kc-project-coach" aria-label="프로젝트 크랩 코치">
      <h2>막히면 크랩에게 물어봐</h2>
      <div className="kc-coach-controls">
        <label>
          도움받을 항목{" "}
          <select
            value={mission}
            disabled={busy || disabled}
            onChange={(e) => {
              setMission(Number(e.target.value));
              setReply(null);
              setError("");
            }}
          >
            <option value={0}>발견한 문제</option>
            <option value={1}>개선 제안과 근거</option>
            <option value={2}>확인과 검증 계획</option>
          </select>
        </label>
        <div className="kc-button-row">
          {[
            ["start", "어디서 시작할까?"],
            ["improve", "어떻게 다듬을까?"],
            ["check", "무엇을 확인할까?"],
          ].map(([intent, label]) => (
            <button
              key={intent}
              disabled={busy || disabled}
              onClick={() => void ask(intent)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <small>
        저장한 설명과 도형·화살표의 연결을 참고해. 그림의 완성도나 직무 능력을
        판정하지는 않아.
      </small>
      {busy && <p role="status">초안을 저장하고 코치에게 물어보는 중…</p>}
      {error && <p role="alert">{error} 위 질문을 눌러 다시 시도할 수 있어.</p>}
      {reply && (
        <div className="kc-note" aria-live="polite">
          <strong>
            {reply.mode === "ai" ? "AI 코치 힌트" : "기본 안내 · AI 미연결"}
          </strong>
          <p>{reply.hint}</p>
          <p>
            <b>지금 해볼 일</b> · {reply.nextAction}
          </p>
          <small>
            수정본 {reply.version} 기준 · 이후에 바꾼 내용은 다시 물어봐.
          </small>
          {reply.example && <div className="kc-note"><strong>참고 예시</strong><p className="preserve-text">{reply.example}</p><small>정답은 하나가 아니에요. 내 상황에 맞게 바꿔 써 봐요.</small></div>}
        </div>
      )}
    </section>
  );
}
