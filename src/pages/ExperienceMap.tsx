import { useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Compass,
  FileImage,
  Flag,
  Play,
  Ticket,
} from "lucide-react";
import { Empty } from "../components";
import { dateLabel, type Activity, type CareerId, type Page } from "../data";
import { useApp } from "../store";
import type { Badge } from "../fieldwork/types";
import { projectFor, workplaceFor } from "../fieldwork/workplaces";
import "./experience-map.css";

const colors: Record<CareerId, string> = {
  developer: "#0967FF",
  nurse: "#7C3AED",
  farmer: "#FF6A1F",
  engineer: "#0967FF",
  researcher: "#7C3AED",
};
const tints: Record<CareerId, string> = {
  developer: "#EAF1FF",
  nurse: "#F0E9FF",
  farmer: "#FFF0E5",
  engineer: "#EAF1FF",
  researcher: "#F0E9FF",
};
const categoryNames: Record<string, string> = {
  self_report: "스스로 알려준 경험",
  participation: "체험 중 남긴 기록",
  artifact: "선택·회고·제출물",
};
const recordNames: Record<string, string> = {
  explored: "자료 살펴보기",
  saved: "관심 직업 저장",
  questioned: "코치에게 질문",
  choice: "직무 상황에서 선택",
  free: "직무 상황에 응답",
  reflection: "나의 회고",
  simulation: "직무체험 완료",
  project: "프로젝트 기록",
  diagnosis: "출발점 기록",
};
const kindNames = {
  simulation: "직무체험",
  project: "미니 프로젝트",
  diagnosis: "출발점 기록",
};
const badgesToDiscover = [
  { name: "현장 탐색가", art: "01", hint: "다양한 현장 자료 살펴보기" },
  { name: "근거를 잇는 사람", art: "02", hint: "가설과 조치 이유 고르기" },
  { name: "다음 교대의 동료", art: "03", hint: "확인하고 인계하기" },
  { name: "개선 설계자", art: "04", hint: "설계 결과물 제출하기" },
];

export default function ExperienceMap() {
  const {
    state,
    catalog,
    careerId,
    setCareerId,
    go,
    retry,
    loading,
    user,
    requireAuth,
  } = useApp();
  const reduced = useReducedMotion();
  const [filter, setFilter] = useState("all");
  const [recordLimit, setRecordLimit] = useState(8);
  const career = catalog.find((c) => c.id === careerId);
  const report = state.gaps[careerId];
  const recent = state.activities
    .filter((a) => a.careerId === careerId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const simulations = recent.filter((a) => a.kind === "simulation");
  const projects = recent.filter((a) => a.kind === "project");
  const badges = Array.from(
    new Map(
      recent
        .flatMap((a) => (a as Activity & { badges?: Badge[] }).badges || [])
        .map((b) => [b.id, b]),
    ).values(),
  );
  const recommendation = state.recommendations.find(
    (r) => r.careerId === careerId,
  );
  const recommendedPage: Page = recommendation
    ? (
        {
          simulation: "simulation",
          project: "projects",
          discovery: "discovery",
        } as const
      )[recommendation.kind]
    : "discovery";
  const latest = recent[0];
  const evidence = [...(report?.evidence || [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const filtered = evidence.filter(
    (e) => filter === "all" || e.category === filter,
  );
  const explored = !!report?.evidence.some(
    (e) => e.category !== "self_report" && e.objectives.includes("explored"),
  );
  const stages = [
    {
      title: "직업 만나기",
      label: "DISCOVER",
      body: "하는 일과 필요한 역량을 알아봐요.",
      page: "discovery" as Page,
      done: explored,
      icon: Compass,
      stamp: "살펴본 직업",
      action: "직업 알아보기",
    },
    {
      title: "현장으로 출근",
      label: "EXPERIENCE",
      body: "직접 살펴보고, 조치를 골라 봐요.",
      page: "simulation" as Page,
      done: simulations.length > 0,
      icon: Play,
      stamp: "체험 수료",
      action: simulations.length ? "다시 체험하기" : "현장 체험 열기",
    },
    {
      title: "나만의 결과물",
      label: "CREATE",
      body: "발견한 문제를 설계도로 바꿔요.",
      page: "projects" as Page,
      done: projects.length > 0,
      icon: FileImage,
      stamp: "포트폴리오 저장",
      action: projects.length ? "작업실 다시 열기" : "프로젝트 만들기",
    },
  ];
  const visited = stages.filter((s) => s.done).length;
  const nextTitle =
    recommendation?.kind === "project"
      ? projectFor(careerId).title
      : recommendation?.kind === "simulation"
        ? workplaceFor(careerId)?.title || "온실의 아침을 부탁해."
        : "이 직업의 또 다른 모습 만나기";

  if (!user)
    return (
      <Empty
        title={
          loading
            ? "나의 지도를 불러오는 중이에요"
            : "크랩과 나만의 지도를 만들어 봐요"
        }
        action={loading ? undefined : "로그인하고 시작하기"}
        onClick={requireAuth}
      >
        직무체험과 결과물, 수료 기록을 한곳에 모아요.
      </Empty>
    );
  if (!career)
    return (
      <Empty
        title="직업 지도를 준비하고 있어요"
        action={loading ? "불러오는 중" : "다시 불러오기"}
        onClick={retry}
      >
        직업 정보를 불러오면 나의 기록을 연결해 드릴게요.
      </Empty>
    );

  return (
    <div
      className="kc-atlas"
      style={
        {
          "--atlas-accent": colors[careerId],
          "--atlas-tint": tints[careerId],
        } as CSSProperties
      }
    >
      <header className="atlas-heading">
        <div>
          <span className="atlas-kicker">MY CAREER JOURNEY</span>
          <h1>나의 진로 탐험 지도</h1>
          <p>만나보고, 해보고, 만들어 본 경험. 다음 한 걸음도 네가 골라 봐.</p>
        </div>
        <button
          className="atlas-outline-button"
          onClick={() => go("diagnosis", careerId)}
        >
          출발점 기록하기 <ArrowUpRight size={16} />
        </button>
      </header>

      <nav className="atlas-careers" aria-label="지도로 볼 직업 선택">
        {catalog.map((c) => {
          const completed = state.activities.some(
            (a) => a.careerId === c.id && a.kind === "simulation",
          );
          return (
            <button
              key={c.id}
              aria-pressed={careerId === c.id}
              className={careerId === c.id ? "is-current" : ""}
              onClick={() => setCareerId(c.id)}
            >
              <img
                src={`/brand/12_career_kingcrabs/${c.id}.png`}
                alt=""
                width={80}
                height={80}
              />
              <span>
                <strong>{c.title}</strong>
                <small>
                  {completed ? "체험 수료 기록 있음" : "나의 경험 펼쳐보기"}
                </small>
              </span>
              {completed && (
                <Check className="atlas-career-check" size={14} aria-hidden />
              )}
            </button>
          );
        })}
      </nav>

      {!report ? (
        <div className="atlas-load">
          <Empty
            title="경험 기록을 아직 불러오지 못했어요"
            action={loading ? "불러오는 중" : "다시 불러오기"}
            onClick={retry}
          >
            연결되면 저장된 경험과 다음 활동을 보여 드릴게요.
          </Empty>
        </div>
      ) : (
        <>
          <motion.div
            key={careerId}
            className="atlas-main"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <section
              className="atlas-board"
              aria-labelledby="atlas-career-title"
            >
              <div className="atlas-board-cover">
                <div className="atlas-cover-copy">
                  <span className="atlas-field">
                    <span />
                    {career.field}
                  </span>
                  <h2 id="atlas-career-title">
                    {career.title},<br />
                    어디까지 만나봤을까?
                  </h2>
                  <p>
                    {visited === 0
                      ? "아직 빈 지도여도 괜찮아. 궁금한 활동 하나부터 시작해 보자."
                      : `${visited}가지 방식으로 이 직업을 만나봤어. 경험을 더하거나 다른 직업으로 여행해도 좋아.`}
                  </p>
                  <div className="atlas-stamp-count">
                    <Flag size={16} />
                    <strong>{visited}</strong>
                    <span>/ 3가지 경험 방식</span>
                  </div>
                </div>
                <div className="atlas-character">
                  <span className="atlas-character-shape" aria-hidden />
                  <motion.img
                    src={`/brand/12_career_kingcrabs/${careerId}.png`}
                    alt={`${career.title} 크랩`}
                    width={300}
                    height={300}
                    initial={reduced ? false : { rotate: -5, scale: 0.93 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ duration: 0.45 }}
                  />
                  <span className="atlas-name-tag">
                    {user.name}의 탐험 기록
                  </span>
                </div>
              </div>
              <div className="atlas-route-caption">
                <span>MY CHECKPOINTS</span>
                <small>순서는 자유롭게, 기록은 차곡차곡.</small>
              </div>
              <ol className="atlas-checkpoints">
                {stages.map((stage, i) => (
                  <li
                    key={stage.page}
                    className={`atlas-checkpoint checkpoint-${i} ${stage.done ? "is-done" : ""}`}
                  >
                    <div className="atlas-checkpoint-top">
                      <span className="atlas-step">0{i + 1}</span>
                      <stage.icon size={20} />
                    </div>
                    <small>{stage.label}</small>
                    <h3>{stage.title}</h3>
                    <p>{stage.body}</p>
                    <span className="atlas-step-status">
                      {stage.done ? (
                        <>
                          <Check size={14} />
                          {stage.stamp}
                        </>
                      ) : (
                        "새로운 경험을 남길 자리"
                      )}
                    </span>
                    <button onClick={() => go(stage.page, careerId)}>
                      {stage.action}
                      <ArrowRight size={16} />
                    </button>
                  </li>
                ))}
              </ol>
              <p className="atlas-board-note">
                지도에는 저장된 경험을 표시해요. 능력이나 적성을 매기는 점수는
                아니에요.
              </p>
            </section>

            <aside className="atlas-side">
              <section className="atlas-next">
                <span className="atlas-kicker">YOUR NEXT EXPERIENCE</span>
                <h2>
                  {recommendation
                    ? "다음엔 이걸 해볼까?"
                    : "다른 가능성도 만나볼까?"}
                </h2>
                <span className="atlas-next-kind">
                  {recommendation
                    ? (
                        {
                          simulation: "직무체험",
                          project: "미니 프로젝트",
                          discovery: "직업 탐색",
                        } as const
                      )[recommendation.kind]
                    : "직업 탐색"}
                </span>
                <h3>{nextTitle}</h3>
                <p>
                  {recommendation?.reason ||
                    "지금 남긴 경험을 바탕으로 다른 직업도 만나봐. 마음이 바뀌는 것도 좋은 발견이야."}
                </p>
                <button
                  onClick={() =>
                    go(recommendedPage, recommendation ? careerId : undefined)
                  }
                >
                  {recommendation ? "이 경험 시작하기" : "다른 직업 둘러보기"}
                  <ArrowRight size={18} />
                </button>
                <button
                  className="atlas-next-reasons"
                  onClick={() => go("recommendation", careerId)}
                >
                  추천 이유 더 보기 <ArrowUpRight size={14} />
                </button>
              </section>
              <section
                className={`atlas-pass ${simulations.length ? "is-earned" : ""}`}
              >
                <div className="atlas-pass-top">
                  <Ticket size={23} />
                  <span>CAREER PASS</span>
                  <b>{String(simulations.length).padStart(2, "0")}</b>
                </div>
                <h3>
                  {simulations.length
                    ? `${career.title} 수료 기록`
                    : "첫 수료 카드를 기다려요"}
                </h3>
                <p>
                  {simulations.length
                    ? `최근 수료 · ${dateLabel(simulations[0].date)}`
                    : "현장 체험과 회고를 마치면 이 직업의 수료 카드가 생겨요."}
                </p>
                <div className="atlas-pass-perforation" />
                <button
                  onClick={() =>
                    go(
                      simulations.length ? "portfolio" : "simulation",
                      careerId,
                    )
                  }
                >
                  {simulations.length
                    ? "수료 카드 보러 가기"
                    : "첫 체험 시작하기"}
                  <ArrowRight size={16} />
                </button>
              </section>
            </aside>
          </motion.div>

          <section className="atlas-collection">
            <div className="atlas-section-title">
              <div>
                <span className="atlas-kicker">COLLECT YOUR MOMENTS</span>
                <h2>
                  이 직업에서 모은 배지 <span>{badges.length}</span>
                </h2>
              </div>
              <button onClick={() => go("portfolio")}>
                전체 컬렉션 <ArrowUpRight size={16} />
              </button>
            </div>
            {badges.length ? (
              <div className="atlas-badges">
                {badges.map((b) => (
                  <article key={b.id}>
                    <img
                      src={`/brand/08_badges/experience_badge_${b.art}.png`}
                      alt=""
                      width={76}
                      height={76}
                    />
                    <div>
                      <strong>{b.name}</strong>
                      <p>{b.description}</p>
                    </div>
                    <Check size={17} aria-label="획득" />
                  </article>
                ))}
              </div>
            ) : (
              <div className="atlas-badges is-preview">
                {badgesToDiscover.map((b) => (
                  <article key={b.art}>
                    <img
                      src={`/brand/08_badges/experience_badge_${b.art}.png`}
                      alt=""
                      width={65}
                      height={65}
                    />
                    <div>
                      <small>아직 받기 전</small>
                      <strong>{b.name}</strong>
                      <p>{b.hint}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="atlas-journal">
            <div className="atlas-section-title">
              <div>
                <span className="atlas-kicker">A PAGE FROM MY JOURNAL</span>
                <h2>경험하고 남긴 한 페이지</h2>
              </div>
              <button onClick={() => go("portfolio")}>
                기록 모아보기 <ArrowUpRight size={16} />
              </button>
            </div>
            {latest ? (
              <div className="atlas-journal-content">
                <div>
                  <span className="atlas-journal-kind">
                    {kindNames[latest.kind]} · {dateLabel(latest.date)}
                  </span>
                  <h3>{latest.title}</h3>
                  <p className="atlas-reflection">
                    {latest.reflection ||
                      (latest.kind === "project"
                        ? "내가 만든 결과물이 포트폴리오에 저장됐어요."
                        : latest.feedback)}
                  </p>
                </div>
                <div className="atlas-journal-summary">
                  <span>이 직업에서 남긴 결과물</span>
                  <strong>
                    {projects.length}
                    <small>개</small>
                  </strong>
                  <button
                    onClick={() =>
                      go(projects.length ? "portfolio" : "projects", careerId)
                    }
                  >
                    {projects.length ? "결과물 보기" : "첫 결과물 만들기"}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="atlas-journal-empty">
                <FileImage size={30} />
                <p>
                  체험에서 좋았던 순간도, 생각과 달랐던 순간도.
                  <br />
                  활동을 마치면 여기에서 다시 만날 수 있어요.
                </p>
              </div>
            )}
          </section>

          <details className="atlas-details">
            <summary>
              <span>
                <Compass size={19} />
                <strong>나의 경험, 조금 더 자세히</strong>
                <small>항목별 기록과 변화</small>
              </span>
              <ChevronDown size={20} />
            </summary>
            <div className="atlas-detail-body">
              <p>
                각 항목은 교육용 목표에 필요한 기록이 얼마나 모였는지 보여줘요.
                스스로 알려준 경험은 수행 기록과 따로 보관해요.
              </p>
              <div className="atlas-dimensions">
                {report.dimensions.map((d, i) => (
                  <article key={d.name}>
                    <div>
                      <h3>{d.name}</h3>
                      <strong>
                        {d.unknown ? "아직 확인 전" : `${d.coverage}%`}
                      </strong>
                    </div>
                    <div
                      className="atlas-meter"
                      role="meter"
                      aria-label={`${d.name} 기록 충족률`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={d.coverage}
                      aria-valuetext={
                        d.unknown ? "확인할 기록 없음" : `${d.coverage}%`
                      }
                    >
                      <span
                        style={{
                          width: `${d.coverage}%`,
                          background: ["#FF6A1F", "#7C3AED", "#0967FF"][i % 3],
                        }}
                      />
                    </div>
                    <p>
                      목표 {d.observed}/{d.target} · 근거 {d.evidenceCount}개
                    </p>
                    {d.missing.length > 0 && (
                      <details>
                        <summary>
                          더 남길 수 있는 기록 {d.missing.length}개
                        </summary>
                        <ul>
                          {d.missing.map((g) => (
                            <li key={g}>{g}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                ))}
              </div>
              {report.unavailableVerification.length > 0 && (
                <p className="atlas-verification-note">
                  {report.unavailableVerification.join(" · ")}은 아직 지원하지
                  않아요. 빈칸이 남아도 경험이 부족하다는 판단은 아니에요.
                </p>
              )}
              {latest && (
                <div className="atlas-changes">
                  <h3>최근 활동 전후의 기록</h3>
                  <div>
                    {report.dimensions.slice(0, 4).map((d, i) => (
                      <p key={d.name}>
                        <span>{d.name}</span>
                        <small>{latest.before[i] ?? 0}%</small>
                        <ArrowRight size={14} />
                        <b>{latest.after[i] ?? 0}%</b>
                      </p>
                    ))}
                  </div>
                  <small>
                    기록이 추가된 변화예요. 직무 능력이 그만큼 올랐다는 뜻은
                    아니에요.
                  </small>
                </div>
              )}
            </div>
          </details>

          <details className="atlas-details">
            <summary>
              <span>
                <FileImage size={19} />
                <strong>지도에 연결된 기록</strong>
                <small>{evidence.length}개 · 근거 확인</small>
              </span>
              <ChevronDown size={20} />
            </summary>
            <div className="atlas-detail-body">
              <div className="atlas-record-filters" aria-label="기록 종류 선택">
                {[["all", "전체"], ...Object.entries(categoryNames)].map(
                  ([key, name]) => (
                    <button
                      key={key}
                      aria-pressed={filter === key}
                      onClick={() => {
                        setFilter(key);
                        setRecordLimit(8);
                      }}
                    >
                      {name}
                    </button>
                  ),
                )}
              </div>
              {filtered.length ? (
                <>
                  <ol className="atlas-evidence">
                    {filtered.slice(0, recordLimit).map((e) => (
                      <li key={e.id}>
                        <div>
                          <span>
                            {categoryNames[e.category] || "활동 기록"}
                          </span>
                          <time>{dateLabel(e.date)}</time>
                        </div>
                        <h3>{recordNames[e.kind] || "경험 활동 기록"}</h3>
                        {e.category === "self_report" ? (
                          <p>
                            내가 알고 있거나 해봤다고 알려준 내용이에요. 수행
                            근거와 따로 보관해요.
                          </p>
                        ) : (
                          e.text && <p>{e.text}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                  {filtered.length > recordLimit && (
                    <button
                      className="atlas-outline-button"
                      onClick={() => setRecordLimit((n) => n + 8)}
                    >
                      기록 더 보기 ({filtered.length - recordLimit}개 남음)
                      <ChevronDown size={15} />
                    </button>
                  )}
                </>
              ) : (
                <p className="atlas-no-records">
                  {evidence.length
                    ? "이 종류의 기록은 아직 없어요."
                    : "관심 있는 직업을 살펴보면 첫 기록이 생겨요."}
                </p>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
