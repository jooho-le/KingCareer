import {
  ArrowUpRight,
  Check,
  Clock3,
  Download,
  History,
  PenLine,
} from "lucide-react";
import "./project-panel.css";
import { writingReady } from "./project-writing";

type Props = {
  brief: string;
  careerId: string;
  answers: string[];
  hasDrawing: boolean;
  interest: number | null;
  busy: boolean;
  onInterest: (value: number) => void;
  onWriting: () => void;
  onSimulation: () => void;
  onHistory: () => void;
  onBackup: () => void;
};
const interestLabels = [
  "별로 끌리지 않아",
  "조금 아쉬웠어",
  "아직 잘 모르겠어",
  "꽤 흥미로워",
  "더 해보고 싶어",
];
export default function ProjectBrief(props: Props) {
  const checklist = [
    { title: "내 아이디어를 담은 설계도", done: props.hasDrawing },
    ...["발견한 문제", "개선 제안과 근거", "확인 방법"].map((title, i) => ({
      title,
      done: writingReady(props.answers[i] || ""),
    })),
  ];
  const ready = checklist.filter((item) => item.done).length;
  return (
    <div className="studio-brief">
      <section className="brief-mission" aria-labelledby="brief-title">
        <div className="brief-mission-heading" data-help="studio-brief">
          <div>
            <span className="brief-eyebrow">오늘의 미션</span>
            <h2 id="brief-title">이 문제를 부탁해!</h2>
          </div>
          <img
            src={`/brand/12_career_kingcrabs/${props.careerId}.png`}
            alt=""
            width={64}
            height={64}
          />
        </div>
        <p>{props.brief}</p>
        <div className="brief-mission-footer">
          <span>
            <Clock3 size={14} />
            20–30분
          </span>
          <button onClick={props.onSimulation}>
            체험 다시 보기 <ArrowUpRight size={14} />
          </button>
        </div>
      </section>

      <section className="brief-drawing-tip" aria-label="그림 작업 도움">
        <h3>그림 안에서 시작해 봐요</h3>
        <p>
          네모 안의 글을 두 번 눌러 고치고, 화살표로 일의 흐름을 연결해요.
          필요한 곳에는 가지선과 메모를 덧붙여 봐요.
        </p>
        <p>
          ‘완성 그림 예시’도 같은 손그림 도안이에요. 내가 그린 모습 그대로
          포트폴리오에 남고, ‘내 설명’에는 바꾼 이유를 짧게 적으면 돼요.
        </p>
      </section>

      <section
        className="brief-checklist"
        aria-labelledby="brief-checklist-title"
      >
        <div className="brief-section-heading">
          <h3 id="brief-checklist-title">제출 전 확인</h3>
          <span aria-live="polite">{ready} / 4</span>
        </div>
        <ul>
          {checklist.map((item) => (
            <li key={item.title} className={item.done ? "is-ready" : ""}>
              <span
                className="brief-check"
                aria-label={item.done ? "준비됨" : "작성 전"}
              >
                {item.done ? <Check size={13} /> : <span />}
              </span>
              {item.title}
            </li>
          ))}
        </ul>
        <button className="brief-writing-link" onClick={props.onWriting}>
          <PenLine size={14} />
          {ready === 4 ? "내 설명 다시 보기" : "내 설명 작성하기"}
          <ArrowUpRight size={14} />
        </button>
      </section>

      <fieldset className="brief-interest" disabled={props.busy}>
        <legend>해보니, 이 직업은 어때?</legend>
        <div>
          {interestLabels.map((label, index) => (
            <label
              key={label}
              className={props.interest === index + 1 ? "is-selected" : ""}
            >
              <input
                type="radio"
                name="project-interest"
                value={index + 1}
                checked={props.interest === index + 1}
                onChange={() => props.onInterest(index + 1)}
                aria-label={`${index + 1}점 · ${label}`}
              />
              <span>{index + 1}</span>
            </label>
          ))}
        </div>
        <p>
          {props.interest === null
            ? "제출 전에 지금의 마음을 골라줘. 선택도 초안에 저장돼."
            : interestLabels[props.interest - 1]}
        </p>
      </fieldset>

      <div className="brief-tools">
        <button disabled={props.busy} onClick={props.onHistory}>
          <History size={16} />
          수정 이력
        </button>
        <button onClick={props.onBackup}>
          <Download size={16} />
          작업 백업
        </button>
      </div>
    </div>
  );
}
