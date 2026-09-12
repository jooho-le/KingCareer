import { useId, useState } from "react";
import type { CareerId } from "../data";
import { composeWriting, hasWritingBlanks, readWriting, writingExamples, writingFrames } from "./project-writing";
import "./guided-writing.css";

export default function GuidedWriting({ careerId, index, value, disabled, onChange }: {
  careerId: CareerId; index: number; value: string; disabled: boolean; onChange: (value: string) => void;
}) {
  const id = useId();
  const parsed = readWriting(index, value);
  const [open, setOpen] = useState(hasWritingBlanks(value));
  const frame = writingFrames[index];
  const example = writingExamples[careerId][index];
  const canGuide = !value.trim() || parsed !== null;
  return <div className="guided-writing">
    <details className="writing-example">
      <summary>이렇게 쓸 수 있어요 · 예시</summary>
      <p>{composeWriting(index, example)}</p>
      <small>{["자료와 문제를 함께 적어서 어디서 발견했는지 알 수 있어요.", "바꿀 점에 이유를 연결하면 제안의 뜻이 분명해져요.", "확인할 행동과 성공 기준을 정하면 효과를 비교할 수 있어요."][index]} 연습용 예시이니 내가 본 내용으로 바꿔 써요.</small>
    </details>
    {canGuide && <button className="writing-guide-toggle" type="button" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{open ? "빈칸 도움 접기" : "두 칸으로 문장 만들기"}</button>}
    {open && canGuide && <fieldset id={id} disabled={disabled} className="writing-blanks">
      <legend>내가 생각한 내용으로 채워봐요</legend>
      <p>입력하면 아래 설명에 이어져요. 채우던 내용도 초안에 저장돼요.</p>
      {frame.labels.map((label, slot) => <label key={label}>
        <span>{label}</span>
        <input aria-label={`${index + 1}번 설명 ${label}`} value={parsed?.[slot] || ""} maxLength={500} placeholder={`예: ${example[slot]}`} onChange={event => {
          const fields = [...(parsed || ["", ""])]; fields[slot] = event.target.value;
          onChange(composeWriting(index, fields));
        }} />
      </label>)}
      <small>아래 문장은 직접 고쳐도 돼요. 〔채우기:…〕가 남아 있으면 제출 전에 마저 채워요.</small>
    </fieldset>}
  </div>;
}
