import { useCallback, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  MapPin,
  Bookmark,
  Search,
  SlidersHorizontal,
  Download,
  Share2,
  Layers,
  Lightbulb,
  MoveUpRight,
  Flag,
  ChevronRight,
  CheckCheck,
} from "lucide-react";
import { motion } from "motion/react";
import {
  Button,
  CareerCard,
  Empty,
  HeroArt,
  JobIcon,
  Modal,
  PageHeading,
  Progress,
  SectionHeading,
  Stat,
  Tag,
} from "../components";
import {
  careers,
  dateLabel,
  dimensions,
  fields,
  getCareer,
  nextCareer,
  scoreFor,
} from "../data";
import type { Activity, Career } from "../data";
import { useApp } from "../store";

export function Home() {
  const { state, go, save } = useApp();
  const recommended = nextCareer(state);
  const completed = state.activities.filter((a) => a.kind !== "diagnosis");
  const explored = new Set(state.activities.map((a) => a.careerId)).size;
  return (
    <>
      <div className="home-greeting">
        <div>
          <div className="greeting-label">
            <span />
            오늘도, 새로운 나를 발견하는 하루
          </div>
          <h1>
            반가워, {state.profile.name}
            <span className="greeting-dot">.</span>
          </h1>
          <p>정해진 꿈이 없어도 괜찮아. 하나씩 해보면 알게 될 거야.</p>
        </div>
        <span className="date-pill">
          <span className="live-dot" />
          나의 진로 탐험 DAY{" "}
          {Math.max(
            1,
            new Set(
              state.activities.map((a) =>
                new Date(a.date).toLocaleDateString("ko-KR"),
              ),
            ).size,
          )}
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <span />
            YOUR FUTURE STARTS HERE
          </span>
          <h2>
            좋아하는 걸 찾는
            <br />
            가장 재밌는 방법,
            <br />
            <span>일단, 해보는 거야.</span>
          </h2>
          <p>
            오늘은 개발자, 내일은 스마트팜 전문가.
            <br />
            작은 경험으로 너의 세계를 넓혀봐.
          </p>
          <Button kind="dark" onClick={() => go("simulation", recommended.id)}>
            {completed.length
              ? "나의 다음 경험 시작하기"
              : "나의 첫 경험 시작하기"}
            <ArrowUpRight size={19} />
          </Button>
          <div className="hero-bottom">
            <span className="stacked-dots">
              <i />
              <i />
              <i />
            </span>
            <span>5가지 직업, 무한한 나의 가능성</span>
          </div>
        </div>
        <HeroArt />
        <div className="hero-page-indicator">
          <span />
          01 <i /> EXPLORE
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel journey-panel">
          <SectionHeading
            title="조금씩 채워지는 나의 진로지도"
            onClick={() => go("map")}
            action="지도 펼치기"
          />
          <div className="map-subline">
            <span>너만의 속도로, 한 걸음씩</span>
            <Tag color="orange">
              {completed.length
                ? `${completed.length}개의 경험을 쌓았어요`
                : "첫 발자국을 남겨봐"}
            </Tag>
          </div>
          <div className="journey-track">
            <svg
              viewBox="0 0 650 138"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M55 77 C125 77 104 30 171 30 S228 100 300 100 S362 35 428 35 S488 91 545 91 S582 54 620 54" />
            </svg>
            {[
              {
                label: "나 알아가기",
                icon: Compass,
                target: "diagnosis",
                color: "orange",
              },
              {
                label: "직업 발견",
                icon: Search,
                target: "discovery",
                color: "purple",
              },
              {
                label: "직접 해보기",
                icon: Flag,
                target: "simulation",
                color: "blue",
              },
              {
                label: "나의 가능성",
                icon: Layers,
                target: "map",
                color: "purple",
              },
            ].map((item, i) => (
              <button
                key={item.label}
                className={`journey-stop stop-${i} ${item.color}`}
                onClick={() => go(item.target as "diagnosis")}
              >
                <motion.span whileHover={{ rotate: 10, scale: 1.08 }}>
                  {i === 0 && state.activities.length ? (
                    <Check size={25} />
                  ) : (
                    <item.icon size={24} />
                  )}
                </motion.span>
                <b>{item.label}</b>
                <small>
                  {
                    [
                      "나의 출발점",
                      "몰랐던 세계",
                      "새로운 경험",
                      "계속 이어져!",
                    ][i]
                  }
                </small>
              </button>
            ))}
          </div>
          <div className="journey-footer">
            <span className="small-spark">
              <Lightbulb size={17} />
            </span>
            <p>
              {state.activities.length
                ? "경험이 쌓일수록 나를 더 잘 알게 될 거야."
                : "어떤 경험이 필요한지 궁금해? 먼저 나를 알아보자."}
            </p>
            <button onClick={() => go("diagnosis")}>
              3분 진단
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
        <section className="weekly-card">
          <div className="weekly-top">
            <span>MY LITTLE STEPS</span>
            <div className="weekly-symbol">
              <MoveUpRight size={25} />
            </div>
          </div>
          <h2>
            작은 경험이
            <br />큰 가능성이 되도록.
          </h2>
          <div className="weekly-stats">
            <div>
              <strong>{completed.length}</strong>
              <span>완료한 경험</span>
            </div>
            <div>
              <strong>
                {explored}
                <small>/5</small>
              </strong>
              <span>탐색한 직업</span>
            </div>
          </div>
          <button onClick={() => go("portfolio")}>
            나의 성장 기록 보기
            <ArrowUpRight size={18} />
          </button>
        </section>
      </div>
      <section className="home-careers">
        <SectionHeading
          title="오늘은 어떤 내가 되어볼까?"
          sub="부담 없이 10분, 새로운 직업의 하루에 로그인해 봐."
          onClick={() => go("simulation")}
        />
        <div className="career-grid three">
          {[careers[0], careers[2], careers[3]].map((c) => (
            <CareerCard
              key={c.id}
              career={c}
              saved={state.saved.includes(c.id)}
              onSave={() => save(c.id)}
              onOpen={() => go("simulation", c.id)}
            />
          ))}
        </div>
      </section>
      <div className="home-bottom-grid">
        <section className="project-teaser">
          <span className="teaser-icon">
            <Layers size={27} />
          </span>
          <div>
            <span className="eyebrow">MAKE SOMETHING YOURS</span>
            <h3>아이디어를 내 손으로 만들어보면?</h3>
            <p>{recommended.project}</p>
          </div>
          <button
            className="circle-button"
            aria-label="추천 미니 프로젝트 보기"
            onClick={() => go("projects", recommended.id)}
          >
            <ArrowUpRight />
          </button>
        </section>
        <section className="region-teaser">
          <MapPin size={25} />
          <div>
            <small>가까운 곳의 새로운 발견</small>
            <h3>전북에도 이런 직업이?</h3>
          </div>
          <button
            className="circle-button"
            aria-label="전북 지역 직업 보기"
            onClick={() => go("region")}
          >
            <ArrowUpRight />
          </button>
        </section>
      </div>
      {state.activities.length > 0 && (
        <section className="spaced-panel">
          <SectionHeading
            title="최근에 남긴 나의 경험"
            sub="작은 발견도 잊지 않도록 모아뒀어."
            onClick={() => go("portfolio")}
            action="기록 모아보기"
          />
          <div className="activity-list">
            {state.activities.slice(0, 2).map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                onClick={() => go("portfolio")}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function CareerMap() {
  const { state, go, careerId, setCareerId } = useApp();
  const career = getCareer(careerId);
  const scores = scoreFor(state, careerId);
  const recent = state.activities.filter((a) => a.careerId === careerId);
  const latest = recent[0];
  const points = scores
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      return `${150 + Math.cos(angle) * v},${140 + Math.sin(angle) * v}`;
    })
    .join(" ");
  return (
    <>
      <PageHeading
        eyebrow="MY CAREER MAP"
        title="나의 가능성을 펼쳐봐"
        description="얼마나 잘하는지보다, 어떤 경험을 해봤는지가 중요해."
      >
        <Button kind="secondary" onClick={() => go("diagnosis")}>
          진단 다시 하기
          <ArrowUpRight size={16} />
        </Button>
      </PageHeading>
      <div className="field-tabs" aria-label="직업 선택">
        {careers.map((c) => (
          <button
            className={c.id === careerId ? "selected" : ""}
            key={c.id}
            onClick={() => setCareerId(c.id)}
          >
            <JobIcon id={c.id} size={18} />
            {c.title}
          </button>
        ))}
      </div>
      <div className="map-detail-grid">
        <section className="panel radar-panel">
          <div className="section-heading">
            <div>
              <Tag color={career.color}>{career.field}</Tag>
              <h2>{career.title} 경험 지도</h2>
            </div>
            <span className={`job-badge ${career.color}`}>
              <JobIcon id={career.id} />
            </span>
          </div>
          <svg
            className="radar"
            viewBox="0 0 300 285"
            role="img"
            aria-label={`${career.title} 경험 기록 지표: ${dimensions.map((d, i) => `${d} ${scores[i]}`).join(", ")}`}
          >
            {[25, 50, 75, 100].map((r) => (
              <polygon
                key={r}
                points={Array.from(
                  { length: 6 },
                  (_, i) =>
                    `${150 + Math.cos((Math.PI * 2 * i) / 6 - Math.PI / 2) * r},${140 + Math.sin((Math.PI * 2 * i) / 6 - Math.PI / 2) * r}`,
                ).join(" ")}
                fill="none"
                stroke="#e5e2ef"
              />
            ))}
            {dimensions.map((_, i) => (
              <line
                key={i}
                x1="150"
                y1="140"
                x2={150 + Math.cos((Math.PI * 2 * i) / 6 - Math.PI / 2) * 100}
                y2={140 + Math.sin((Math.PI * 2 * i) / 6 - Math.PI / 2) * 100}
                stroke="#e5e2ef"
              />
            ))}
            <motion.polygon
              key={careerId + scores.join()}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              points={points}
              fill="#7546f3"
              fillOpacity=".18"
              stroke="#7546f3"
              strokeWidth="2.5"
            />
            {dimensions.map((d, i) => (
              <text
                key={d}
                x={150 + Math.cos((Math.PI * 2 * i) / 6 - Math.PI / 2) * 127}
                y={144 + Math.sin((Math.PI * 2 * i) / 6 - Math.PI / 2) * 121}
                textAnchor="middle"
                fontSize="10"
                fill="#666377"
              >
                {d}
              </text>
            ))}
          </svg>
          <p className="fine-print">
            자가 응답과 완료한 활동을 바탕으로 한 체험판 기록 지표예요. 능력
            평가나 적성 점수가 아니에요. 기록이 0이면 아직 확인하지 못한
            영역이에요.
          </p>
        </section>
        <section className="panel">
          <SectionHeading
            title="경험을 하나씩 채워가는 중"
            sub={
              recent.length
                ? `${recent.length}개의 기록이 모였어요.`
                : "아직 기록이 없어요. 진단으로 출발점을 알려줘."
            }
          />
          <div className="dimension-list">
            {dimensions.map((d, i) => (
              <div key={d}>
                <div>
                  <span>{d}</span>
                  <b>{scores[i] === 0 ? "미확인" : `${scores[i]} / 100`}</b>
                </div>
                <Progress
                  value={scores[i]}
                  color={
                    i % 3 === 0 ? "orange" : i % 3 === 1 ? "purple" : "blue"
                  }
                />
              </div>
            ))}
          </div>
          <Button
            className="full-width"
            onClick={() =>
              go(recent.length ? "simulation" : "diagnosis", careerId)
            }
          >
            {recent.length ? "이 직업 더 경험하기" : "나의 출발점 기록하기"}
            <ArrowRight size={17} />
          </Button>
        </section>
      </div>
      <section className="panel spaced-panel">
        <SectionHeading
          title="최근에는 이렇게 달라졌어"
          sub="같은 직업의 활동 전후를 비교해 봐."
        />
        {latest ? (
          <>
            <div className="change-grid">
              {dimensions.slice(0, 4).map((d, i) => (
                <div key={d}>
                  <span>{d}</span>
                  <p>
                    <small>{latest.before[i]}</small>
                    <ArrowRight size={17} />
                    <strong>{latest.after[i]}</strong>
                  </p>
                </div>
              ))}
            </div>
            <div className="record-source">
              <CheckCheck size={19} />
              <div>
                <b>{latest.title}</b>
                <p>
                  {dateLabel(latest.date)} ·{" "}
                  {latest.reflection || latest.feedback}
                </p>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="첫 경험이 이곳의 시작이 돼"
            action="직무체험 둘러보기"
            onClick={() => go("simulation")}
          >
            활동을 마치면 변화와 그 근거가 여기에 남아요.
          </Empty>
        )}
      </section>
      <section>
        <SectionHeading title="나의 경험 히스토리" />
        {recent.length ? (
          <div className="activity-list">
            {recent.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                onClick={() => go("portfolio")}
              />
            ))}
          </div>
        ) : (
          <p className="muted">아직 이 직업에 남긴 기록이 없어요.</p>
        )}
      </section>
    </>
  );
}

export function Discovery() {
  const { state, save, go, search, setSearch } = useApp();
  const [field, setField] = useState("전체");
  const [savedOnly, setSavedOnly] = useState(false);
  const [detail, setDetail] = useState<Career | null>(null);
  const close = useCallback(() => setDetail(null), []);
  const list = careers.filter(
    (c) =>
      (field === "전체" || c.field === field) &&
      (!savedOnly || state.saved.includes(c.id)) &&
      [c.title, c.field, c.intro, ...c.related, ...c.majors]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="DISCOVER YOUR NEXT"
        title="몰랐던 직업, 새로운 나"
        description="관심 있는 것부터 시작해도, 그냥 둘러봐도 좋아."
      />
      <div className="discovery-banner">
        <div>
          <Tag color="purple">호기심에 정답은 없으니까</Tag>
          <h2>
            아직 이름도 몰랐던 직업이
            <br />
            너의 다음 이야기가 될지 몰라.
          </h2>
        </div>
        <div className="discovery-art" aria-hidden="true">
          <Compass size={82} />
          <span>WHAT'S NEXT?</span>
        </div>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={20} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="직업, 역량, 전공으로 찾아봐"
            aria-label="직업 필터 검색"
          />
        </label>
        <button
          className={`button secondary ${savedOnly ? "is-selected" : ""}`}
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly(!savedOnly)}
        >
          <Bookmark size={18} />
          {savedOnly ? "저장한 직업만" : "저장한 직업"}
        </button>
      </div>
      <div className="filter-tabs">
        {["전체", ...fields.slice(0, 5), "기타"].map((f) => (
          <button
            key={f}
            className={field === f ? "selected" : ""}
            onClick={() => setField(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="result-heading">
        <span>
          발견한 직업 <b>{list.length}</b>
        </span>
        <span>
          <SlidersHorizontal size={14} />
          관심의 시작은 자유롭게
        </span>
      </div>
      {list.length ? (
        <div className="career-grid three">
          {list.map((c) => (
            <CareerCard
              key={c.id}
              career={c}
              saved={state.saved.includes(c.id)}
              onSave={() => save(c.id)}
              onOpen={() => setDetail(c)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="아직 여기에 맞는 직업이 없어요"
          action="전체 직업 보기"
          onClick={() => {
            setSearch("");
            setField("전체");
            setSavedOnly(false);
          }}
        >
          검색어나 분야를 바꿔서 다시 찾아봐.
        </Empty>
      )}
      {detail && (
        <Modal title={detail.title} onClose={close}>
          <Tag color={detail.color}>{detail.field}</Tag>
          <p className="detail-intro">{detail.intro}</p>
          <h3>실제로 하는 일</h3>
          <p>{detail.problem}</p>
          <h3>이런 역량을 사용해요</h3>
          <div className="chip-list">
            {detail.skills.map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </div>
          <h3>관련 전공</h3>
          <p>{detail.majors.join(" · ")}</p>
          <h3>함께 알아볼 직업</h3>
          <div className="chip-list">
            {detail.related.map((s) => (
              <span className="plain-chip" key={s}>
                {s}
              </span>
            ))}
          </div>
          <p className="fine-print">
            연관 직업은 탐색 키워드예요. 현재 체험은 5가지 대표 직업을 제공해요.
          </p>
          <div className="button-row">
            <Button
              onClick={() => {
                setDetail(null);
                go("simulation", detail.id);
              }}
            >
              직무체험 시작
              <ArrowRight size={16} />
            </Button>
            <Button kind="secondary" onClick={() => save(detail.id)}>
              <Bookmark size={17} />
              {state.saved.includes(detail.id) ? "저장 취소" : "직업 저장"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

const regionData = [
  {
    name: "전주",
    industries: "IT · 콘텐츠 · 관광",
    description: "익숙한 도시의 일상을 더 편리하게 만드는 사람들을 만나봐.",
    career: "developer",
  },
  {
    name: "군산",
    industries: "자동차 · 이차전지 · 항만",
    description: "이동과 에너지의 다음 모습을 상상하는 직업을 탐색해 봐.",
    career: "engineer",
  },
  {
    name: "익산",
    industries: "식품 · 바이오",
    description: "우리의 먹거리와 건강에 새로운 아이디어를 더해봐.",
    career: "researcher",
  },
  {
    name: "김제",
    industries: "스마트농업 · 특장차",
    description: "기술과 농업이 만나면 어떤 새로운 일이 생길까?",
    career: "farmer",
  },
  {
    name: "완주",
    industries: "자동차 · 수소",
    description: "더 나은 이동과 에너지를 고민하는 경험을 해봐.",
    career: "engineer",
  },
  {
    name: "새만금",
    industries: "이차전지 · 에너지",
    description: "미래의 에너지와 모빌리티를 연결하는 일을 상상해 봐.",
    career: "engineer",
  },
] as const;
export function Region() {
  const { state, go, save } = useApp();
  const [region, setRegion] = useState(
    state.profile.region in
      Object.fromEntries(regionData.map((r) => [r.name, 1]))
      ? state.profile.region
      : "전주",
  );
  const selected = regionData.find((r) => r.name === region)!;
  const job = getCareer(selected.career);
  const [org, setOrg] = useState(false);
  const close = useCallback(() => setOrg(false), []);
  return (
    <>
      <PageHeading
        eyebrow="LOCAL IS FULL OF POSSIBILITIES"
        title="가능성은, 생각보다 가까이에"
        description="내가 사는 전북에도 이렇게 다양한 직업이 있어."
      />
      <div className="region-layout">
        <section className="region-map panel">
          <div className="region-map-title">
            <Tag color="blue">JEONBUK</Tag>
            <h2>우리 동네에서 시작하는 탐험</h2>
          </div>
          <div className="map-illustration">
            <svg viewBox="0 0 440 390" aria-hidden="true">
              <path
                d="M121 51L214 29L281 52L300 102L361 120L386 186L361 241L389 292L320 350L253 329L210 365L147 327L99 347L68 286L37 241L65 177L50 114L103 109Z"
                fill="#e9e2fb"
                stroke="#d5c6f6"
                strokeWidth="2"
              />
              <path
                d="M65 177L154 158L214 29M154 158L247 180L300 102M247 180L253 329M247 180L361 241M154 158L147 327"
                fill="none"
                stroke="#fff"
                strokeWidth="3"
                strokeDasharray="7 5"
              />
            </svg>
            {regionData.map((r, i) => (
              <motion.button
                key={r.name}
                className={`map-pin pin-${i} ${region === r.name ? "selected" : ""}`}
                whileHover={{ y: -4 }}
                onClick={() => setRegion(r.name)}
              >
                <MapPin size={18} />
                {r.name}
              </motion.button>
            ))}
          </div>
          <p className="fine-print">
            지역 탐색 안내도 · 실제 지리 경계와 다를 수 있어요.
          </p>
        </section>
        <motion.section
          key={region}
          className="region-info panel"
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="region-number">
            {String(
              regionData.findIndex((r) => r.name === region) + 1,
            ).padStart(2, "0")}
          </span>
          <Tag color="blue">우리 지역의 가능성</Tag>
          <h2>{selected.name}</h2>
          <h3>{selected.industries}</h3>
          <p>{selected.description}</p>
          <div className="region-job">
            <span className={`job-badge ${job.color}`}>
              <JobIcon id={job.id} />
            </span>
            <div>
              <small>이 지역에서 상상하는 하루</small>
              <b>{job.title}</b>
            </div>
            <ArrowUpRight size={22} />
          </div>
          <Button onClick={() => go("simulation", job.id)}>
            지역 직무체험 시작
            <ArrowRight size={17} />
          </Button>
          <button className="text-button" onClick={() => setOrg(true)}>
            체험 속 기업·기관 보기
            <ArrowUpRight size={16} />
          </button>
          <p className="fine-print">
            산업 연결은 콘텐츠 기획 예시예요. 실제 기관과의 제휴 및 방문
            프로그램은 아직 제공하지 않아요.
          </p>
        </motion.section>
      </div>
      <SectionHeading title="우리 지역에서 이런 일을 해볼 수 있어" />
      <div className="career-grid three">
        {careers
          .filter((c) => c.region === region || c.id === job.id)
          .map((c) => (
            <CareerCard
              key={c.id}
              career={c}
              saved={state.saved.includes(c.id)}
              onSave={() => save(c.id)}
              onOpen={() => go("simulation", c.id)}
            />
          ))}
      </div>
      {org && (
        <Modal title={`${region} 체험 속 팀`} onClose={close}>
          <Tag color="orange">가상 기관</Tag>
          <h3>{region} 내일연구소</h3>
          <p>
            지역의 문제를 해결하는 가상의 팀이에요. 실제 기업 정보나 채용 공고가
            아니에요.
          </p>
          <h3>함께하는 직무</h3>
          <p>
            {job.title} · {job.skills.join(" · ")}
          </p>
          <Button
            onClick={() => {
              setOrg(false);
              go("simulation", job.id);
            }}
          >
            이 팀의 하루 체험하기
            <ArrowRight size={16} />
          </Button>
        </Modal>
      )}
    </>
  );
}

export function Recommendation() {
  const { state, go } = useApp();
  const job = nextCareer(state);
  const scores = scoreFor(state, job.id);
  const gap = dimensions.filter((_, i) => scores[i] < 50);
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE MORE YOU"
        title="다음 경험은, 너에게 맞춰서"
        description="지금의 관심과 남아 있는 경험 공백에서 다음 걸음을 찾아봐."
      />
      <section className="recommendation-hero">
        <div>
          <Tag color="orange">지금 해보면 좋을 경험</Tag>
          <h2>
            {job.title}의 하루,
            <br />
            한번 들어가 볼래?
          </h2>
          <p>
            {state.profile.interests.includes(job.field)
              ? `네가 선택한 ${job.field} 분야에서`
              : "아직 관심분야를 고르지 않아, 다양한 분야 중에서"}
            <br />
            완료한 활동이 적은 직업을 먼저 골랐어.
          </p>
          <Button onClick={() => go("simulation", job.id)}>
            추천 직무체험 시작
            <ArrowUpRight size={18} />
          </Button>
        </div>
        <span className={`recommendation-icon ${job.color}`}>
          <JobIcon id={job.id} size={92} />
        </span>
      </section>
      <div className="two-column">
        <section className="panel">
          <SectionHeading title="이 경험을 제안한 이유" />
          <div className="reason-item">
            <span>01</span>
            <div>
              <h3>내가 고른 관심에서 출발</h3>
              <p>
                {state.profile.interests.length
                  ? state.profile.interests.join(" · ")
                  : "관심분야를 아직 고르지 않았어요. 모르는 직업부터 둘러봐도 좋아요."}
              </p>
            </div>
          </div>
          <div className="reason-item">
            <span>02</span>
            <div>
              <h3>경험의 빈칸을 확인</h3>
              <p>
                {gap.length
                  ? gap.join(" · ")
                  : "기본 활동을 경험했어요. 다른 관점에서 다시 체험해 봐요."}
              </p>
            </div>
          </div>
          <div className="reason-item">
            <span>03</span>
            <div>
              <h3>직접 해보며 생각을 구체화</h3>
              <p>{job.skills.join(", ")}을 사용하는 상황을 만나게 돼요.</p>
            </div>
          </div>
          <p className="fine-print">
            현재 추천은 관심분야와 활동 수를 이용한 규칙 기반 체험판이에요.
          </p>
        </section>
        <section className="panel next-project">
          <span className="round-icon purple">
            <Layers size={29} />
          </span>
          <h2>
            경험에서 끝나지 않도록,
            <br />
            작은 결과물도 만들어 봐.
          </h2>
          <h3>{job.project}</h3>
          <p>{job.problem}</p>
          <Button kind="secondary" onClick={() => go("projects", job.id)}>
            미니 프로젝트 보기
            <ArrowRight size={17} />
          </Button>
        </section>
      </div>
    </>
  );
}

export function ActivityRow({
  activity,
  onClick,
}: {
  activity: Activity;
  onClick: () => void;
}) {
  const job = getCareer(activity.careerId);
  return (
    <button className="activity-row" onClick={onClick}>
      <span className={`job-badge ${job.color}`}>
        <JobIcon id={job.id} />
      </span>
      <span>
        <small>
          {activity.kind === "simulation"
            ? "직무체험"
            : activity.kind === "project"
              ? "미니 프로젝트"
              : "관심·경험 진단"}{" "}
          · {dateLabel(activity.date)}
        </small>
        <b>{activity.title}</b>
      </span>
      <span className="activity-done">
        기록 완료
        <Check size={15} />
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
export function Portfolio() {
  const { state, go, toast } = useApp();
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<Activity | null>(null);
  const close = useCallback(() => setDetail(null), []);
  const list = state.activities.filter(
    (a) => filter === "all" || filter === a.kind,
  );
  const completed = state.activities.filter((a) => a.kind !== "diagnosis");
  const download = () => {
    const lines = [
      `${state.profile.name}의 진로 포트폴리오`,
      `저장일: ${new Date().toLocaleDateString("ko-KR")}`,
      "체험판의 가상 직무 활동 및 자기 기록입니다.",
      "",
      ...state.activities.flatMap((a) => [
        `${a.title} (${dateLabel(a.date)})`,
        ...a.answers.map((x, i) => `${i + 1}. ${x}`),
        `나의 회고: ${a.reflection}`,
        `활동 피드백: ${a.feedback}`,
        "",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "잇다-진로-포트폴리오.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("포트폴리오를 파일로 내려받았어요.");
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${state.profile.name}의 잇다 진로 기록\n${state.activities.map((a) => `${a.title}: ${a.reflection || a.feedback}`).join("\n")}`,
      );
      toast("활동 요약을 복사했어요. 원하는 곳에 붙여넣어 공유해 주세요.");
    } catch {
      toast("복사 권한이 없어요. 다운로드로 기록을 저장할 수 있어요.");
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="MY GROWING STORY"
        title="해본 만큼, 나다워지는 중"
        description="작은 선택과 결과물까지. 여기엔 너만의 이야기가 쌓여."
      >
        <div className="button-row">
          <Button
            kind="secondary"
            disabled={!state.activities.length}
            onClick={share}
          >
            <Share2 size={17} />
            요약 복사
          </Button>
          <Button disabled={!state.activities.length} onClick={download}>
            <Download size={17} />
            다운로드
          </Button>
        </div>
      </PageHeading>
      <div className="stats-row">
        <Stat
          label="완료한 직무체험"
          value={completed.filter((a) => a.kind === "simulation").length}
          unit="개"
          color="orange"
        />
        <Stat
          label="만들어낸 프로젝트"
          value={completed.filter((a) => a.kind === "project").length}
          unit="개"
          color="purple"
        />
        <Stat
          label="탐색한 직업"
          value={new Set(state.activities.map((a) => a.careerId)).size}
          unit="개"
          color="blue"
        />
      </div>
      <section className="panel spaced-panel">
        <SectionHeading
          title="나의 성장"
          sub="가장 최근 활동의 기록 지표 변화예요."
        />
        {state.activities[0] ? (
          <div className="change-grid">
            {["직무 이해", "활동 경험", "역량 이해"].map((d, i) => (
              <div key={d}>
                <span>{d}</span>
                <p>
                  <small>{state.activities[0].before[i + 1]}</small>
                  <ArrowRight size={17} />
                  <strong>{state.activities[0].after[i + 1]}</strong>
                </p>
              </div>
            ))}
            <div>
              <span>최근 활동 후 관심</span>
              <p>
                <strong>{state.activities[0].interest ?? "—"}</strong>
                <small>/ 5</small>
              </p>
            </div>
          </div>
        ) : (
          <p className="muted">활동을 마치면 전후 변화를 확인할 수 있어요.</p>
        )}
      </section>
      <SectionHeading title="나의 활동 기록" />
      <div className="filter-tabs">
        {[
          { id: "all", label: "모든 기록" },
          { id: "simulation", label: "AI 직무체험" },
          { id: "project", label: "미니 프로젝트" },
          { id: "diagnosis", label: "진로 진단" },
        ].map((f) => (
          <button
            className={filter === f.id ? "selected" : ""}
            key={f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="activity-list">
          {list.map((a) => (
            <ActivityRow key={a.id} activity={a} onClick={() => setDetail(a)} />
          ))}
        </div>
      ) : (
        <Empty
          title="나의 첫 번째 이야기를 기다리는 중"
          action="직무체험 시작하기"
          onClick={() => go("simulation")}
        >
          경험을 마치면 나의 선택과 결과물을 다시 꺼내볼 수 있어.
        </Empty>
      )}
      {detail && (
        <Modal title={detail.title} onClose={close}>
          <Tag>{dateLabel(detail.date)}</Tag>
          <h3>나의 활동</h3>
          <ol className="answer-list">
            {detail.answers.map((answer, i) => (
              <li key={i}>{answer}</li>
            ))}
          </ol>
          <h3>활동 피드백</h3>
          <p>{detail.feedback}</p>
          <h3>나에게 남은 것</h3>
          <p className="preserve-text">
            {detail.reflection || "별도의 회고를 남기지 않았어요."}
          </p>
          <h3>활동 후 관심</h3>
          <p>
            {detail.interest
              ? `${detail.interest} / 5`
              : "진단 당시에는 관심을 별도로 기록하지 않았어요."}
          </p>
          <Button
            kind="secondary"
            onClick={() => {
              setDetail(null);
              go("map", detail.careerId);
            }}
          >
            진로지도에서 보기
            <ArrowRight size={16} />
          </Button>
        </Modal>
      )}
    </>
  );
}
