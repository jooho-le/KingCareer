import { ArrowRight, Clock3, MousePointer2, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Button, CareerCard, Empty } from "../components";
import { useApp } from "../store";
import { workplaceFor } from "../fieldwork/workplaces";
import "./simulation-lobby.css";

export default function SimulationLobby() {
  const { user, state, catalog, go, save, search, setSearch } = useApp();
  const reduced = useReducedMotion();
  const [field, setField] = useState("전체");
  const [savedOnly, setSavedOnly] = useState(false);
  const ongoing = [...(state.activeActivities || [])].filter(a => a.kind === "simulation")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).at(0);
  const query = search.trim().toLocaleLowerCase();
  const list = catalog.filter(c => (field === "전체" || c.field === field)
    && (!savedOnly || state.saved.includes(c.id))
    && [c.title, c.field, c.intro, ...c.related, ...c.skills, ...c.majors].join(" ").toLocaleLowerCase().includes(query));
  const reset = () => { setSearch(""); setField("전체"); setSavedOnly(false); };
  return <div className="simulation-lobby">
    <motion.header className="simulation-lobby-heading" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
      <div className="simulation-heading-copy">
        <span className="simulation-heading-label">직업 속으로 입장!</span>
        <h1>오늘은 어떤 내가 되어볼까?</h1>
        <p>직업을 골라 현장을 살피고, 나의 선택으로 문제를 풀어봐.</p>
        <div className="simulation-heading-facts"><span><Clock3 size={16} />약 10분</span><span><MousePointer2 size={16} />객관식으로 선택</span></div>
      </div>
      <div className="simulation-heading-ticket" aria-hidden="true"><span>체험을 마치면</span><img src="/brand/12_career_kingcrabs/developer.png" alt="" /><strong>나만의 수료 카드</strong></div>
    </motion.header>
    {ongoing && <section className="simulation-resume" aria-label="진행 중인 직무체험">
      <div><small>하던 체험이 있어</small><h2>{ongoing.title}</h2></div>
      <Button onClick={() => go("simulation", ongoing.careerId, undefined, { sessionId: ongoing.sessionId })}>이어서 하기 <ArrowRight size={17} /></Button>
    </section>}
    <section className="simulation-find" aria-label="체험할 직업 찾기">
      <div className="simulation-find-inputs">
        <label className="simulation-search"><Search size={19} aria-hidden="true" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="직업, 관심 분야, 전공으로 검색" aria-label="체험할 직업 검색" /></label>
        <label className="simulation-field"><span>관심 분야</span><select value={field} onChange={e => setField(e.target.value)} aria-label="관심 분야로 좁히기"><option value="전체">전체 분야</option>{[...new Set(catalog.map(c => c.field))].map(f => <option key={f} value={f}>{f}</option>)}</select></label>
      </div>
      <div className="simulation-find-options">
        <span role="status">체험할 직업 {list.length}개</span>
        {user && <label><input type="checkbox" checked={savedOnly} onChange={e => setSavedOnly(e.target.checked)} />저장한 직업만</label>}
        {(search || field !== "전체" || savedOnly) && <button onClick={reset}>필터 지우기</button>}
      </div>
    </section>
    {list.length ? <div className="career-grid three">
      {list.map((c, index) => <motion.div className="simulation-career-option" data-career={c.id} key={c.id} initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: Math.min(index, 4) * .05 }}>
        <CareerCard career={c} saved={state.saved.includes(c.id)} onSave={() => save(c.id)} onOpen={() => go("simulation", c.id)} />
        <details className="simulation-career-info"><summary>하는 일과 관련 전공</summary><p>{workplaceFor(c.id)?.brief || "온실의 센서, 잎의 상태, 동료의 기록을 살펴보고 과열의 원인을 찾아봐."}</p><dl><div><dt>사용하는 역량</dt><dd>{c.skills.join(" · ")}</dd></div><div><dt>관련 전공</dt><dd>{c.majors.join(" · ")}</dd></div></dl><button onClick={() => go("discovery", c.id)}>관련 직업과 정보 출처 보기 <ArrowRight size={15} /></button></details>
      </motion.div>)}
    </div> : <Empty title="이 조건에 맞는 직업이 없어" action="전체 직업 보기" onClick={reset}>검색어나 관심 분야를 바꿔서 찾아봐.</Empty>}
  </div>;
}
