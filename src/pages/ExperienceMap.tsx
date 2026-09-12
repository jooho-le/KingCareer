import { ArrowRight } from "lucide-react";
import { Empty } from "../components";
import { dateLabel } from "../data";
import { useApp } from "../store";
import { ReviewMapCard } from "../fieldwork/CareerReview";
import "./career-records.css";
import StartingPointCard from "../fieldwork/StartingPointCard";

export default function ExperienceMap() {
  const { state, catalog, go, loading, user, requireAuth } = useApp();
  const activities = state.activities.filter(a => a.kind === "simulation" || a.kind === "project");
  const experienced = catalog.map(career => ({
    career,
    records: activities.filter(a => a.careerId === career.id).sort((a,b) => b.date.localeCompare(a.date)),
  })).filter(item => item.records.length > 0).sort((a,b) => b.records[0].date.localeCompare(a.records[0].date));
  const startingPoints = Object.values(state.gaps).flatMap(report => report?.startingPoint ? [report.startingPoint] : [])
    .sort((a, b) => b.date.localeCompare(a.date));
  if (loading) return <p role="status">기록을 불러오는 중…</p>;
  if (!user) return <Empty title="로그인하고 나의 기록 보기" action="로그인" onClick={requireAuth}>{null}</Empty>;
  return <div className="career-records">
    {startingPoints.map(point => <StartingPointCard key={point.careerId} point={point}
      next={state.recommendations.find(item => item.careerId === point.careerId)} />)}
    <section className="career-records-list" aria-labelledby="experienced-jobs">
      <header><h2 id="experienced-jobs">내가 해본 직업</h2><button onClick={() => go("portfolio")}>결과물 보기 <ArrowRight size={16} /></button></header>
      {experienced.length ? <ul>{experienced.map(({career, records}) => <li key={career.id}>
        <img src={`/brand/12_career_kingcrabs/${career.id}.png`} alt="" width={56} height={56} />
        <div><h3>{career.title}</h3><p>{[records.some(a => a.kind === "simulation") && "체험 완료", records.some(a => a.kind === "project") && "프로젝트 제출"].filter(Boolean).join(" · ")}</p></div>
        <time dateTime={records[0].date}>{dateLabel(records[0].date)}</time>
      </li>)}</ul> : <div className="career-records-empty"><p>체험을 마치면 여기에 기록이 남아.</p><button onClick={() => go("simulation")}>첫 직무체험 고르기 <ArrowRight size={16} /></button></div>}
    </section>
    {activities.length > 0 && <ReviewMapCard compact />}
  </div>;
}
