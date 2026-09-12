import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
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
  JobIcon,
  PageHeading,
  Progress,
  Steps,
  Tag,
  CareerCard,
} from "../components";
import { careers, dimensions, getCareer, scoreFor } from "../data";
import { useApp } from "../store";

const questions = [
  {
    title: "이 직업을 얼마나 알고 있어?",
    description: "정답은 없어. 지금의 경험을 솔직하게 알려줘.",
    answers: [
      "이름도 처음 들어봐요",
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
      "업무 과정과 판단의 예를 설명할 수 있어요",
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
    description: "내가 잘하는지보다, 이 일에 필요한 역량을 아는지 떠올려 봐.",
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
      "관심 전공의 수업 내용을 살펴봤어요",
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
export function Diagnosis() {
  const { state, go, careerId, setCareerId, record } = useApp();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(6).fill(-1));
  const job = getCareer(careerId);
  const result = answers.map((x) => [10, 45, 75][x] ?? 0);
  const finish = () => {
    record({
      careerId,
      kind: "diagnosis",
      title: `${job.title} 관심·경험 진단`,
      answers: answers.map(
        (a, i) => `${dimensions[i]}: ${questions[i].answers[a]}`,
      ),
      before: scoreFor(state, careerId),
      after: result,
      reflection: "나의 기존 경험을 스스로 돌아보고 기록했어요.",
      feedback:
        "자가 응답으로 만든 출발점이에요. 실제 활동과 회고를 통해 계속 확인해 봐요.",
    });
    setStep(7);
  };
  return (
    <>
      <PageHeading
        eyebrow="GET TO KNOW YOURSELF"
        title="꿈 말고, 해본 것부터 이야기해 봐"
        description="잘하는지 평가하는 시간이 아니야. 너의 출발점을 함께 찾아보자."
      />
      {step === 0 ? (
        <section className="panel diagnosis-intro">
          <div className="intro-copy">
            <Tag color="orange">약 3분 · 6개의 질문</Tag>
            <h2>
              같은 꿈이어도,
              <br />
              필요한 경험은 다르니까.
            </h2>
            <p>
              관심 있는 직업 하나를 고르고 알고 있는 것과 경험한 것을 알려줘.
              <br />
              아직 모르겠다면 궁금한 직업부터 골라도 좋아.
            </p>
          </div>
          <div className="career-select-grid">
            {careers.map((c) => (
              <button
                className={`career-select ${careerId === c.id ? "selected" : ""}`}
                key={c.id}
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
          <Button onClick={() => setStep(1)}>
            나의 출발점 알아보기
            <ArrowRight size={18} />
          </Button>
        </section>
      ) : step <= 6 ? (
        <section className="panel questionnaire">
          <div className="question-top">
            <Tag>{job.title}</Tag>
            <span>
              {String(step).padStart(2, "0")} <span>/ 06</span>
            </span>
          </div>
          <Progress value={(step / 6) * 100} />
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
            >
              <span className="eyebrow">{dimensions[step - 1]}</span>
              <h2>{questions[step - 1].title}</h2>
              <p>{questions[step - 1].description}</p>
              <div className="choices">
                {questions[step - 1].answers.map((answer, i) => (
                  <button
                    key={answer}
                    className={answers[step - 1] === i ? "selected" : ""}
                    aria-pressed={answers[step - 1] === i}
                    onClick={() =>
                      setAnswers((a) =>
                        a.map((v, index) => (index === step - 1 ? i : v)),
                      )
                    }
                  >
                    <span>{i + 1}</span>
                    {answer}
                    {answers[step - 1] === i && <Check size={20} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="form-actions">
            <Button kind="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={17} />
              이전
            </Button>
            <Button
              disabled={answers[step - 1] < 0}
              onClick={() => (step === 6 ? finish() : setStep(step + 1))}
            >
              {step === 6 ? "진단 결과 보기" : "다음 질문"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      ) : (
        <section className="panel result-panel">
          <div className="success-orbit">
            <CheckCircle2 size={48} />
          </div>
          <Tag color="purple">나를 알아가는 첫걸음 완료</Tag>
          <h2>이제 너의 출발점이 생겼어!</h2>
          <p>
            {job.title}에 대해 기록했어. 낮은 지표는 앞으로 경험해볼 공간이야.
          </p>
          <div className="diagnosis-results">
            {dimensions.map((d, i) => (
              <div key={d}>
                <span>{d}</span>
                <Progress
                  value={result[i]}
                  color={i % 2 ? "purple" : "orange"}
                />
                <b>{result[i]}</b>
              </div>
            ))}
          </div>
          <p className="fine-print">
            수치는 자가 응답을 표시한 체험판 지표이며, 검증된 검사 점수가
            아니에요.
          </p>
          <div className="button-row centered">
            <Button onClick={() => go("map", careerId)}>
              나의 지도 펼치기
              <ArrowUpRight size={17} />
            </Button>
            <Button kind="secondary" onClick={() => go("simulation", careerId)}>
              직접 경험해 보기
              <Play size={16} />
            </Button>
          </div>
        </section>
      )}
    </>
  );
}

type Turn = { answer: string; response: string; lesson: string };
export function Simulation() {
  const { state, go, careerId, setCareerId, save, record } = useApp();
  const job = getCareer(careerId);
  const [stage, setStage] = useState<
    "lobby" | "brief" | "play" | "reflection" | "result"
  >(() => (window.location.hash.includes("?career=") ? "brief" : "lobby"));
  const [step, setStep] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [free, setFree] = useState("");
  const [freeMode, setFreeMode] = useState(false);
  const [response, setResponse] = useState<Turn | null>(null);
  const [reflection, setReflection] = useState("");
  const [liked, setLiked] = useState("");
  const [disliked, setDisliked] = useState("");
  const [interest, setInterest] = useState(3);
  const scenario = job.scenarios[step];
  const start = () => {
    setStep(0);
    setTurns([]);
    setChoice(null);
    setFree("");
    setResponse(null);
    setReflection("");
    setLiked("");
    setDisliked("");
    setInterest(3);
    setStage("play");
  };
  const submit = () => {
    const answer = freeMode ? free.trim() : scenario.choices[choice!];
    const turn = {
      answer,
      response: freeMode
        ? `“${answer}”라는 의견을 기록했어요. 이 체험판은 자유 답변의 의미를 AI로 분석하지 않아요. 아래 직무 관점과 비교해 봐요.`
        : scenario.responses[choice!],
      lesson: scenario.lesson,
    };
    setResponse(turn);
    setTurns((t) => [...t, turn]);
  };
  const next = () => {
    if (step === 2) {
      setStage("reflection");
      return;
    }
    setStep(step + 1);
    setResponse(null);
    setChoice(null);
    setFree("");
  };
  const finish = () => {
    const before = scoreFor(state, careerId);
    const after = before.map((v, i) => Math.max(v, [60, 60, 40, 50, 0, 0][i]));
    record({
      careerId,
      kind: "simulation",
      title: `${job.title}의 하루`,
      answers: turns.map((t) => t.answer),
      reflection: `새로운 발견: ${reflection.trim()}\n맞았던 점: ${liked.trim() || "아직 생각 중"}\n맞지 않았던 점: ${disliked.trim() || "아직 생각 중"}`,
      before,
      after,
      interest,
      feedback: turns.map((t) => t.lesson).join(" "),
    });
    setStage("result");
  };
  return (
    <>
      <PageHeading
        eyebrow="TRY A DIFFERENT DAY"
        title={
          stage === "lobby"
            ? "오늘은 어떤 내가 되어볼까?"
            : `${job.title}의 하루`
        }
        description={
          stage === "lobby"
            ? "누군가의 하루에 들어가 보면, 몰랐던 내가 보일 거야."
            : "가상의 직무 상황에서 선택하고, 네 생각을 남겨봐."
        }
      />
      {stage === "lobby" ? (
        <>
          <div className="simulation-intro">
            <span className="round-icon orange">
              <Flag size={27} />
            </span>
            <div>
              <h3>직업을 고르고, 새로운 하루에 들어가 봐.</h3>
              <p>
                3개의 상황과 짧은 회고 · 약 10분 · 언제든 다른 직업도 경험할 수
                있어
              </p>
            </div>
            <Tag color="orange">시나리오 체험판</Tag>
          </div>
          <div className="career-grid three">
            {careers.map((c) => (
              <CareerCard
                key={c.id}
                career={c}
                saved={state.saved.includes(c.id)}
                onSave={() => save(c.id)}
                onOpen={() => {
                  setCareerId(c.id);
                  setStage("brief");
                }}
              />
            ))}
          </div>
          <p className="fine-print">
            현재는 준비된 시나리오가 선택에 따라 반응해요. 생성형 AI의 실시간
            상황 생성은 아직 연결되지 않았어요.
          </p>
        </>
      ) : stage === "brief" ? (
        <section className="panel brief-panel">
          <button className="text-button" onClick={() => setStage("lobby")}>
            <ArrowLeft size={16} />
            다른 직업 보기
          </button>
          <span className={`brief-icon ${job.color}`}>
            <JobIcon id={job.id} size={64} />
          </span>
          <Tag color={job.color}>오늘의 역할</Tag>
          <h2>{job.title}</h2>
          <p>{job.intro}</p>
          <div className="brief-facts">
            <div>
              <MapPinIcon />
              <span>팀 배경</span>
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
          <Button onClick={start}>
            이 역할로 시작하기
            <Play size={17} />
          </Button>
          <p className="fine-print">
            학습용 가상 상황이에요. 실제 기관의 업무 지시가 아니에요.
          </p>
        </section>
      ) : stage === "play" ? (
        <div className="simulation-layout">
          <section className="panel scenario-panel">
            <div className="question-top">
              <Tag color={job.color}>{job.title} · DAY 01</Tag>
              <span>상황 {step + 1} / 3</span>
            </div>
            <Progress value={((step + (response ? 1 : 0)) / 3) * 100} />
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {step > 0 && (
                  <div className="previous-context">
                    <Check size={16} />
                    <span>
                      지난 선택: {turns[step - 1]?.answer}
                      <small>{turns[step - 1]?.response}</small>
                    </span>
                  </div>
                )}
                <h2>{scenario.title}</h2>
                <p className="scenario-text">{scenario.text}</p>
                {!response ? (
                  <>
                    <div className="input-mode">
                      <button
                        className={!freeMode ? "selected" : ""}
                        onClick={() => setFreeMode(false)}
                      >
                        선택해서 답하기
                      </button>
                      <button
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
                          value={free}
                          onChange={(e) => setFree(e.target.value)}
                          placeholder="내 생각과 이유를 5자 이상 적어줘."
                          rows={4}
                          maxLength={1500}
                        />
                        <small>{free.length} / 1,500</small>
                      </label>
                    ) : (
                      <div className="choices">
                        {scenario.choices.map((answer, i) => (
                          <button
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
                        freeMode ? free.trim().length < 5 : choice === null
                      }
                      onClick={submit}
                    >
                      나의 생각 전달하기
                      <Send size={17} />
                    </Button>
                  </>
                ) : (
                  <motion.div
                    className="scenario-response"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="my-answer">
                      <span>나의 선택</span>
                      <p>{response.answer}</p>
                    </div>
                    <div className="response-body">
                      <span className="response-icon">
                        <MessageCircle size={22} />
                      </span>
                      <div>
                        <b>선택에 따른 상황</b>
                        <p>{response.response}</p>
                        <div className="lesson">
                          <Lightbulb size={18} />
                          <span>{response.lesson}</span>
                        </div>
                      </div>
                    </div>
                    <Button className="full-width" onClick={next}>
                      {step === 2 ? "나의 경험 돌아보기" : "다음 상황으로"}
                      <ArrowRight size={17} />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </section>
          <aside className="panel simulation-side">
            <Tag color="blue">오늘의 탐험 노트</Tag>
            <h3>선택에는 이유가 있어.</h3>
            <p>정답을 맞히기보다 왜 그렇게 생각했는지 돌아봐.</p>
            <div className="simulation-timeline">
              {job.scenarios.map((s, i) => (
                <div key={s.title} className={i <= step ? "active" : ""}>
                  <span>{i < turns.length ? <Check size={15} /> : i + 1}</span>
                  <div>
                    <b>{s.title}</b>
                    <small>
                      {i < turns.length
                        ? "내 선택을 기록했어요"
                        : i === step
                          ? "지금 경험하는 중"
                          : "다음에 만날 상황"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="side-note">
              <FileText size={20} />
              <p>마지막 회고까지 마치면 포트폴리오에 저장돼요.</p>
            </div>
          </aside>
        </div>
      ) : stage === "reflection" ? (
        <section className="panel reflection-panel">
          <Tag color="orange">생각까지 남겨야, 나의 경험</Tag>
          <h2>직접 해보니까 어땠어?</h2>
          <p>흥미가 줄어도 좋은 발견이야. 솔직하게 남겨줘.</p>
          <label className="form-field">
            새롭게 알게 된 점 <span className="required">필수</span>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="예: 개발자는 코딩만 하는 줄 알았는데, 사용자 이야기도 많이 듣는구나. (5자 이상)"
              rows={3}
              maxLength={1500}
            />
          </label>
          <div className="two-column">
            <label className="form-field">
              나와 맞았던 점
              <textarea
                value={liked}
                onChange={(e) => setLiked(e.target.value)}
                placeholder="조금이라도 재미있었던 순간"
                rows={3}
                maxLength={1000}
              />
            </label>
            <label className="form-field">
              나와 안 맞았던 점
              <textarea
                value={disliked}
                onChange={(e) => setDisliked(e.target.value)}
                placeholder="어렵거나 덜 즐거웠던 순간"
                rows={3}
                maxLength={1000}
              />
            </label>
          </div>
          <Interest value={interest} onChange={setInterest} />
          <Button
            className="full-width"
            disabled={reflection.trim().length < 5}
            onClick={finish}
          >
            나의 경험 기록하기
            <Check size={17} />
          </Button>
        </section>
      ) : (
        <section className="panel result-panel">
          <div className="success-orbit">
            <Flag size={46} />
          </div>
          <Tag color="purple">새로운 나를 발견했어!</Tag>
          <h2>오늘, {job.title}로 살아봤어.</h2>
          <p>네가 한 3번의 선택과 회고가 진로지도에 남았어.</p>
          <div className="takeaway-list">
            {turns.map((turn, i) => (
              <div key={i}>
                <span>{i + 1}</span>
                <div>
                  <b>{turn.answer}</b>
                  <p>{turn.lesson}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="button-row centered">
            <Button onClick={() => go("map", careerId)}>
              업데이트된 지도 보기
              <ArrowUpRight size={17} />
            </Button>
            <Button kind="secondary" onClick={() => go("projects", careerId)}>
              프로젝트로 이어가기
              <ArrowRight size={17} />
            </Button>
            <Button kind="ghost" onClick={() => setStage("brief")}>
              <RotateCcw size={16} />
              다시 체험하기
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
function MapPinIcon() {
  return <Flag size={22} />;
}
export function Interest({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <fieldset className="interest-rating">
      <legend>지금 이 직업에 대한 관심은?</legend>
      <div>
        {[
          "별로 없어요",
          "조금 있어요",
          "보통이에요",
          "꽤 궁금해요",
          "더 해볼래요",
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

export function Projects() {
  const { state, setState, go, careerId, setCareerId, record, toast } =
    useApp();
  const job = getCareer(careerId);
  const [stage, setStage] = useState<"list" | "detail" | "work" | "result">(
    () => (window.location.hash.includes("?career=") ? "detail" : "list"),
  );
  const [mission, setMission] = useState(0);
  const [hint, setHint] = useState(false);
  const [question, setQuestion] = useState("");
  const [help, setHelp] = useState("");
  const [interest, setInterest] = useState(3);
  const draft = state.drafts[careerId] ?? ["", "", ""];
  const updateDraft = (value: string) =>
    setState((s) => ({
      ...s,
      drafts: {
        ...s.drafts,
        [careerId]: (s.drafts[careerId] ?? ["", "", ""]).map((x, i) =>
          i === mission ? value : x,
        ),
      },
    }));
  const feedback = `세 단계의 결과물을 완성했어요. ${job.skills[0]}과 ${job.skills[1]}을 사용하는 과정을 경험했어요. 다음에는 제안이 실제 이용자에게 도움이 되는지 확인할 질문과 비교 기준을 더 구체적으로 적어보세요. 이 피드백은 제출 단계에 따른 안내이며 AI의 내용 평가는 아니에요.`;
  const finish = () => {
    const before = scoreFor(state, careerId);
    record({
      careerId,
      kind: "project",
      title: job.project,
      answers: draft,
      before,
      after: before.map((v, i) => Math.max(v, [65, 65, 65, 60, 0, 0][i])),
      interest,
      reflection: draft[2],
      feedback,
    });
    setStage("result");
  };
  return (
    <>
      <PageHeading
        eyebrow="SMALL PROJECT, BIG DISCOVERY"
        title={
          stage === "list" ? "작게 만들어봐, 크게 발견할 거야" : job.project
        }
        description="생각만 했던 아이디어를 나만의 결과물로. 완벽하지 않아도 괜찮아."
      />
      {stage === "list" ? (
        <>
          <section className="project-intro">
            <span className="round-icon purple">
              <LayersIcon />
            </span>
            <div>
              <Tag color="purple">MY FIRST PROJECT</Tag>
              <h2>
                작은 결과물 하나가,
                <br />
                나를 설명하는 이야기가 되니까.
              </h2>
              <p>관심 직업의 문제를 골라 3개의 미션을 완성해 봐.</p>
            </div>
            <div className="project-art" aria-hidden="true">
              <FileText size={85} />
              <span>
                MAKE
                <br />
                IT YOURS.
              </span>
            </div>
          </section>
          <div className="project-grid">
            {careers.map((c) => (
              <motion.button
                whileHover={{ y: -4 }}
                className="project-card"
                key={c.id}
                onClick={() => {
                  setCareerId(c.id);
                  setStage("detail");
                }}
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
                    20–30분
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
          <h2>{job.project}</h2>
          <p className="detail-intro">{job.problem}</p>
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
                단계의 답변이 포트폴리오로 저장돼.
              </p>
            </div>
          </div>
          <div className="button-row">
            <Button
              onClick={() => {
                setMission(0);
                setHint(false);
                setStage("work");
              }}
            >
              {draft.some((x) => x.trim())
                ? "작성하던 프로젝트 이어하기"
                : "내 프로젝트 시작하기"}
              <ArrowRight size={17} />
            </Button>
            <Button kind="ghost" onClick={() => setStage("list")}>
              다른 프로젝트 보기
            </Button>
          </div>
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
                <span>자동 저장됨</span>
              </div>
              <h2>{job.missions[mission]}</h2>
              <p className="muted">
                구체적인 대상과 이유를 적어주면 아이디어가 더 선명해져.
              </p>
              <label className="form-field">
                나의 결과물
                <textarea
                  rows={9}
                  value={draft[mission]}
                  onChange={(e) => updateDraft(e.target.value)}
                  placeholder="내 생각을 10자 이상 적어줘. 짧게 시작해도 괜찮아."
                  maxLength={5000}
                />
                <small>{draft[mission].length} / 5,000</small>
              </label>
              {mission === 2 && (
                <Interest value={interest} onChange={setInterest} />
              )}
              <div className="form-actions">
                <Button
                  kind="ghost"
                  onClick={() => {
                    if (mission === 0) setStage("detail");
                    else setMission(mission - 1);
                    setHint(false);
                  }}
                >
                  <ArrowLeft size={17} />
                  이전
                </Button>
                <Button
                  disabled={
                    mission === 2
                      ? draft.some((x) => x.trim().length < 10)
                      : draft[mission].trim().length < 10
                  }
                  onClick={() => {
                    if (mission === 2) finish();
                    else {
                      setMission(mission + 1);
                      setHint(false);
                      setHelp("");
                    }
                  }}
                >
                  {mission === 2 ? "프로젝트 제출하기" : "다음 미션"}
                  {mission === 2 ? (
                    <Check size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                </Button>
              </div>
            </section>
            <aside className="panel hint-panel">
              <span className="round-icon orange">
                <Lightbulb size={26} />
              </span>
              <h3>막막할 땐, 작은 힌트</h3>
              <p>멋진 답을 찾기보다 질문을 작게 나눠보자.</p>
              <Button kind="secondary" onClick={() => setHint(!hint)}>
                {hint ? "힌트 접기" : "단계별 힌트 보기"}
                <Lightbulb size={16} />
              </Button>
              {hint && (
                <motion.div
                  className="hint-box"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {
                    [
                      "“누가, 언제, 무엇 때문에 불편할까?”를 한 문장으로 적고, 그 사람이 하는 행동을 떠올려봐.",
                      "아이디어를 3개 적고, 가장 간단하게 시작할 수 있는 것 하나를 골라봐. 누구에게 왜 도움이 되는지도 적어줘.",
                      "성공했는지 알아볼 질문과 관찰할 행동을 정해봐. 비교할 때 무엇을 같은 조건으로 둘지도 생각해 봐.",
                    ][mission]
                  }
                </motion.div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setHelp(
                    "이 체험판은 질문을 AI로 분석하지 않아요. 지금 단계에서는 “" +
                      job.missions[mission] +
                      "”라는 질문을 작게 나눠보세요. 대상, 이유, 구체적인 예시를 한 문장씩 적으면 시작하기 쉬워요.",
                  );
                  setQuestion("");
                  toast("단계에 맞는 작성 가이드를 열었어요.");
                }}
              >
                <label className="form-field">
                  궁금한 점 정리하기
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="어디서 막혔는지 적어봐"
                    maxLength={300}
                  />
                </label>
                <Button
                  kind="ghost"
                  type="submit"
                  disabled={question.trim().length < 2}
                >
                  작성 가이드 열기
                  <ArrowRight size={16} />
                </Button>
              </form>
              {help && <p className="hint-box">{help}</p>}
              <p className="fine-print">
                준비된 단계별 가이드예요. AI 힌트 생성은 아직 연결되지 않았어요.
              </p>
            </aside>
          </div>
        </>
      ) : (
        <section className="panel result-panel">
          <div className="success-orbit">
            <CheckCircle2 size={48} />
          </div>
          <Tag color="purple">내 손으로 만든 첫 가능성</Tag>
          <h2>너만의 프로젝트가 완성됐어!</h2>
          <p>{job.project}</p>
          <div className="project-result-feedback">
            <h3>활동 피드백</h3>
            <p>{feedback}</p>
            <div className="chip-list">
              {job.skills.map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </div>
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
      )}
    </>
  );
}
function LayersIcon() {
  return <FileText size={27} />;
}
