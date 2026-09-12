import { ArrowRight, ArrowUpRight, Clock3, Layers3, PencilRuler } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "../components";
import { useApp } from "../store";
import { projectFor } from "../fieldwork/workplaces";
import "./project-lobby.css";

export default function ProjectLobby() {
  const { state, catalog, go } = useApp();
  const reduced = useReducedMotion();
  const ongoing = state.activeActivities?.find(a => a.kind === "project");
  return <div className="project-lobby">
    <motion.header className="project-lobby-heading" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
      <div><span className="project-heading-label">미니 프로젝트 · 아이디어 작업실</span><h1>어떤 아이디어를 만들어볼까?</h1><p>직업에서 만난 문제를 그림으로 풀어봐. 나만의 포트폴리오가 돼.</p><div className="project-heading-formats"><span><Layers3 size={16}/>손그림 흐름도</span><span><PencilRuler size={16}/>자유롭게 그리기</span></div></div>
      <div className="project-heading-art" aria-hidden="true"><div className="project-heading-paper"><img src="/brand/05_career_illustrations/developer.png" alt=""/><span>내 아이디어, 작품이 되다</span></div></div>
    </motion.header>
    {ongoing && <section className="project-resume" aria-label="작성 중인 프로젝트">
      <img src={`/brand/12_career_kingcrabs/${ongoing.careerId}.png`} alt="" width={58} height={58}/>
      <div><span>저장한 작업이 있어</span><h2>{ongoing.title}</h2></div>
      <Button onClick={() => go("projects", ongoing.careerId)}>이어서 만들기 <ArrowRight size={16}/></Button>
    </section>}
    <div className="project-grid">
      {catalog.map((c, index) => {
        const project = projectFor(c.id);
        const inProgress = state.activeActivities?.some(a => a.kind === "project" && a.careerId === c.id);
        return <motion.button className="project-card" data-career={c.id} key={c.id} initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: Math.min(index, 4) * .05 }} whileHover={reduced ? undefined : { y: -5 }} whileTap={reduced ? undefined : { scale: .99 }} onClick={() => go("projects",c.id)}>
          <div className="project-card-top"><div className="project-card-identity"><span>{inProgress ? "이어서 완성해 봐" : "오늘의 크리에이터"}</span><strong>{c.title}</strong></div><img className="project-card-crab" src={`/brand/12_career_kingcrabs/${c.id}.png`} alt="" width={170} height={170} loading="lazy"/>{inProgress && <span className="project-progress-sticker">작성 중</span>}</div>
          <div className="project-card-content"><h3>{project.title}</h3><p>{project.brief}</p>
          <div className="project-template-preview" aria-hidden="true">{(c.id === "developer" ? ["오류 안내", "복구 경로", "확인 메모"] : project.nodes.slice(0,3)).map((label,i) => <span key={label} className={`preview-node-${i}`}>{label}</span>)}</div>
          <div className="project-card-meta"><span><Clock3 size={16}/>20–30분</span><span>{inProgress ? "이어서 만들기" : "작업실 열기"}<ArrowUpRight size={18}/></span></div></div>
        </motion.button>;
      })}
    </div>
  </div>;
}
