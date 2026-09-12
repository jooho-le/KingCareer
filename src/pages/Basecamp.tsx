import { ArrowRight, ArrowUpRight, ChevronDown, Compass, FileImage, MousePointer2, Ticket } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button, SectionHeading } from "../components";
import { dateLabel } from "../data";
import type { ReviewList } from "../fieldwork/CareerReview";
import { api } from "../api";
import "./basecamp-flow.css";
import { useApp } from "../store";

export default function Basecamp() {
  const { user, state, catalog, go } = useApp();
  const reduced = useReducedMotion();
  const next = state.recommendations[0];
  const job = catalog.find((c) => c.id === next?.careerId);
  const active = [...(state.activeActivities || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).at(0);
  const [reviews, setReviews] = useState<ReviewList["reviews"]>([]);
  const [reviewLoading, setReviewLoading] = useState(!!user);
  const [reviewError, setReviewError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user) { setReviews([]); setReviewLoading(false); return; }
    const controller = new AbortController();
    setReviewLoading(true); setReviewError(false);
    void api<ReviewList>("/career-reviews", { signal: controller.signal })
      .then((value) => setReviews(value.reviews))
      .catch(() => { if (!controller.signal.aborted) setReviewError(true); })
      .finally(() => { if (!controller.signal.aborted) setReviewLoading(false); });
    return () => controller.abort();
  }, [user, state.activities.length, retry]);
  const confirmed = [...reviews].filter((r) => r.status === "confirmed" && r.confirmation)
    .sort((a, b) => b.confirmation!.date.localeCompare(a.confirmation!.date))[0]?.confirmation;
  const chosenDone = confirmed && (confirmed.next.kind === "discovery"
    ? state.gaps[confirmed.next.careerId]?.evidence.some((e) => e.kind === "explored" && e.date > confirmed.date)
    : state.activities.some((a) => a.careerId === confirmed.next.careerId && a.kind === confirmed.next.kind && a.date > confirmed.date));
  const chosen = chosenDone ? undefined : confirmed?.next;
  const returning = !!user && (!!state.activities.length || !!active);
  const leadKind = active?.kind || chosen?.kind || next?.kind;
  const leadCareer = active?.careerId || chosen?.careerId || next?.careerId;
  const leadTitle = active?.title || chosen?.title || (next && job ? `${job.title} · ${next.kind === "project" ? "미니 프로젝트" : next.kind === "discovery" ? "직업 탐색" : "직무체험"}` : "첫 직무체험 골라보기");
  const waiting = !!user && !active && reviewLoading;
  const unavailable = !!user && !active && reviewError;
  const leadReason = active ? "마지막으로 저장한 지점부터 이어갈 수 있어." : chosen ? chosen.reason : next?.reason || "궁금한 직업을 고르고, 현장에서 할 일을 직접 선택해 봐.";
  const openLead = () => go(leadKind === "project" ? "projects" : leadKind === "discovery" ? "discovery" : "simulation", leadCareer, undefined, active?.sessionId ? { sessionId: active.sessionId } : undefined);
  const recent = [...state.activities].filter(a => a.kind === "simulation" || a.kind === "project")
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const heroCharacter = returning && catalog.some(c => c.id === leadCareer) ? leadCareer : "hello";

  return (
    <div className={`kc-basecamp basecamp-simple basecamp-adventure${returning ? " basecamp-returning" : ""}`}>
      <header className="basecamp-heading">
        <div>
          <h1>반가워, {user?.name || "탐험가"}.</h1>
          <p>{returning ? "하던 경험을 이어가거나, 완성한 결과를 다시 펼쳐봐." : "꿈이 정해지지 않아도 괜찮아. 궁금한 일 하나부터 시작하자."}</p>
        </div>
      </header>
      <section className="basecamp-hero" aria-label="지금 할 경험">
        <div className="basecamp-hero-copy">
          <span className="basecamp-label"><Compass size={16} aria-hidden="true" />{active ? "이어서 할 경험" : chosen ? "내가 고른 다음 경험" : "오늘의 첫걸음"}</span>
          <h2>{waiting ? "다음 경험을 불러오고 있어" : unavailable ? "내가 고른 경험을 다시 불러올게" : returning ? leadTitle : <>오늘은 어떤<br /><em>내가 되어볼까?</em></>}</h2>
          <p>{waiting ? "회고에서 선택한 활동을 확인하는 중이야." : unavailable ? "저장한 다음 선택을 확인하지 못했어. 다시 시도해 줘." : leadReason}</p>
          <Button disabled={waiting} onClick={unavailable ? () => setRetry((n) => n + 1) : openLead}>
            {waiting ? "불러오는 중…" : unavailable ? "다시 불러오기" : active ? "이어서 하기" : chosen ? "내가 고른 경험 시작" : next ? "추천 경험 열기" : "첫 직무체험 골라보기"}
            <ArrowRight size={18} />
          </Button>
        </div>
        <div className="basecamp-hero-art" aria-hidden="true">
          <div className="basecamp-art-ring" />
          <div className="basecamp-art-tile" />
          <motion.img key={heroCharacter} src={`/brand/12_career_kingcrabs/${heroCharacter}.png`} alt="" width={360} height={360}
            initial={reduced ? false : { y: 24, rotate: -7, scale: 0.94 }} animate={{ y: 0, rotate: -3, scale: 1 }} transition={{ type: "spring", duration: 0.8, bounce: 0.3 }} fetchPriority="high" />
          <div className="basecamp-art-sticker"><Ticket size={19} />{active ? "다시 현장으로!" : "나의 가능성, 발견 중"}</div>
        </div>
        <div className="basecamp-journey" aria-label="직무체험의 흐름">
          <span><Compass size={17} aria-hidden="true" />직업 고르기</span><ArrowRight size={15} aria-hidden="true" />
          <span><MousePointer2 size={17} aria-hidden="true" />현장 체험</span><ArrowRight size={15} aria-hidden="true" />
          <span><Ticket size={17} aria-hidden="true" />나의 수료 카드</span>
        </div>
      </section>

      {recent.length > 0 && <section className="basecamp-recent" aria-label="최근 결과">
        <SectionHeading title="최근 완성한 결과" action="포트폴리오에서 모두 보기" onClick={() => go("portfolio")} />
        <div className="basecamp-records">
          {recent.map((a) => <button className={`basecamp-record ${a.kind === "project" ? "record-project" : "record-simulation"}`} key={a.id} onClick={() => go("portfolio", a.careerId, a.kind === "project" ? "project" : "simulation", { activityId: a.id })}>
            <span className={`basecamp-record-icon ${a.kind === "project" ? "purple" : "blue"}`} aria-hidden="true">{a.kind === "project" ? <FileImage size={24} /> : <Ticket size={24} />}</span>
            <div><small>{a.kind === "simulation" ? "수료 카드" : "프로젝트 결과물"} · {dateLabel(a.date)}</small><strong>{a.title}</strong><p>{a.reflection || "내가 남긴 기록과 결과를 확인해 봐."}</p></div>
            <ArrowUpRight size={18} />
          </button>)}
        </div>
      </section>}

      <details className="basecamp-browse">
        <summary><div className="basecamp-browse-crew" aria-hidden="true">{["developer", "nurse", "farmer"].map(id => <img key={id} src={`/brand/12_career_kingcrabs/${id}.png`} alt="" width={56} height={56} loading="lazy" />)}</div><span><strong>{returning ? "다른 직업도 궁금하다면" : "체험할 직업을 먼저 살펴볼까?"}</strong><small>다섯 가지 직업의 하는 일 보기</small></span><ChevronDown size={20} aria-hidden="true" /></summary>
        <div className="basecamp-job-preview">
          {catalog.map(c => <button key={c.id} onClick={() => go("simulation", c.id)}><img src={`/brand/12_career_kingcrabs/${c.id}.png`} alt="" width={68} height={68} loading="lazy" /><strong>{c.title}</strong><span>{c.intro}</span><ArrowRight size={17} aria-hidden="true" /></button>)}
        </div>
        <button className="basecamp-inline-link" onClick={() => go("simulation")}>분야와 이름으로 찾아보기 <ArrowRight size={16} /></button>
      </details>

      <div className="basecamp-context-links">
        <p>무엇부터 고를지 모르겠다면 <button onClick={() => go("diagnosis")}>해본 경험부터 확인하기 <ArrowUpRight size={15} /></button></p>
        {recent.some(a => a.kind === "simulation") && <p>체험한 아이디어를 더 발전시키려면 <button onClick={() => go("projects")}>미니 프로젝트 만들기 <ArrowUpRight size={15} /></button></p>}
      </div>
    </div>
  );
}
