import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  Download,
  Search,
  Share2,
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
  SectionHeading,
  Stat,
  Tag,
} from "../components";
import { dateLabel, fields } from "../data";
import type {
  Activity,
  Career,
  CareerId,
  Page,
  Recommendation as NextExperience,
  SourceReference,
} from "../data";
import { api, errorMessage, json, requestId } from "../api";
import { useApp } from "../store";
import { AwardsShelf } from "../fieldwork/Awards";
const ArtifactPreview = lazy(() => import("../fieldwork/ArtifactPreview"));

type CatalogCareer = Career & { sources?: SourceReference[] };
const artwork: Record<CareerId, string> = {
  developer: "developer",
  nurse: "nurse",
  farmer: "smartfarm",
  engineer: "automotive",
  researcher: "food_research",
};
const kindLabels: Record<NextExperience["kind"], string> = {
  simulation: "직무체험",
  project: "미니 프로젝트",
  discovery: "직업 탐색",
};
const kindPages: Record<NextExperience["kind"], Page> = {
  simulation: "simulation",
  project: "projects",
  discovery: "discovery",
};

function FeedbackLabel({ activity }: { activity: Activity }) {
  const label =
    activity.evaluationStatus === "self_report"
      ? "자기보고 기록"
      : activity.evaluationStatus === "completed" ||
          activity.evaluationStatus === "ai_feedback"
        ? "AI 피드백 완료"
        : activity.evaluationStatus === "pending"
          ? "AI 평가 대기"
          : "AI 평가 미연결";
  return (
    <Tag color={activity.evaluationStatus === "completed" ? "blue" : "purple"}>
      {label}
    </Tag>
  );
}
function RetryNotice({
  message,
  retry,
  busy = false,
}: {
  message: string;
  retry: () => void;
  busy?: boolean;
}) {
  return (
    <div className="inline-error" role="alert">
      <p>{message}</p>
      <Button kind="secondary" disabled={busy} onClick={retry}>
        다시 시도
      </Button>
    </div>
  );
}

export function Home() {
  const { state, user, catalog, go, save } = useApp();
  const recommendation = state.recommendations[0];
  const recommended = catalog.find((c) => c.id === recommendation?.careerId);
  const completed = state.activities.filter((a) => a.kind !== "diagnosis");
  const explored = Object.values(state.gaps).filter((g) =>
    g?.evidence.some((e) => e.kind === "explored"),
  ).length;
  const steps: {
    label: string;
    caption: string;
    icon: string;
    page: Page;
    color: string;
  }[] = [
    {
      label: "나 알아가기",
      caption: "나의 출발점",
      icon: "profile",
      page: "diagnosis",
      color: "orange",
    },
    {
      label: "직업 발견",
      caption: "처음 만난 세계",
      icon: "compass",
      page: "discovery",
      color: "purple",
    },
    {
      label: "직접 해보기",
      caption: "직업의 하루",
      icon: "simulation",
      page: "simulation",
      color: "blue",
    },
    {
      label: "기록 모으기",
      caption: "나만의 이야기",
      icon: "journal",
      page: "portfolio",
      color: "purple",
    },
  ];
  return (
    <>
      <div className="home-greeting">
        <div>
          <div className="greeting-label">KINGCAREER BASECAMP</div>
          <h1>
            반가워, {user ? state.profile.name : "탐험가"}
            <span className="greeting-dot">.</span>
          </h1>
          <p>정해진 꿈이 없어도 괜찮아. 궁금한 일부터 하나씩 해보자.</p>
        </div>
        <Tag color="blue">오늘의 가능성, 열어보는 중</Tag>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">LET'S PLAY YOUR NEXT</span>
          <h2>
            오늘은 어떤
            <br />
            내가 되어볼까?
            <br />
            <span>일단, 해보는 거야.</span>
          </h2>
          <p>
            오늘은 개발자, 내일은 스마트팜 전문가.
            <br />
            작은 경험으로 너의 세계를 넓혀봐.
          </p>
          <Button
            kind="dark"
            onClick={() =>
              go(
                recommendation ? kindPages[recommendation.kind] : "discovery",
                recommended?.id,
              )
            }
          >
            {recommendation ? "나의 다음 경험 열기" : "궁금한 직업 만나기"}
            <ArrowUpRight size={19} />
          </Button>
          <div className="hero-bottom">
            <span>{catalog.length}가지 직업에서 시작하는 나의 이야기</span>
          </div>
        </div>
        <HeroArt />
      </section>
      <section className="kc-farm-entry">
        <img
          src="/brand/01_mascots/mascot_01_explore.png"
          alt="현장 체험을 안내하는 크랩"
        />
        <div>
          <span className="kc-eyebrow">FIVE WORKPLACES · YOUR FIRST SHIFT</span>
          <h2>오늘은 어떤 현장으로 출근할까?</h2>
          <p>3D 현장 조사부터 교대 업무, 나만의 개선 설계까지.</p>
        </div>
        <button className="kc-button" onClick={() => go("simulation")}>
          현장 골라보기 <ArrowRight size={17} />
        </button>
      </section>
      <div className="dashboard-grid">
        <section className="panel journey-panel">
          <SectionHeading
            title="너의 속도로, 한 걸음씩"
            action="지도 펼치기"
            onClick={() => go("map")}
          />
          <div className="journey-track kingcareer-steps">
            {steps.map((step, i) => (
              <button
                className={`journey-stop stop-${i} ${step.color}`}
                key={step.page}
                onClick={() => go(step.page)}
              >
                <motion.span whileHover={{ rotate: 7, scale: 1.06 }}>
                  <img
                    src={`/brand/03_icons/${step.icon}.svg`}
                    width="30"
                    height="30"
                    alt=""
                  />
                </motion.span>
                <b>{step.label}</b>
                <small>{step.caption}</small>
              </button>
            ))}
          </div>
          <div className="journey-footer">
            <img
              src="/brand/01_mascots/mascot_05_idea.png"
              width="48"
              height="48"
              alt=""
            />
            <p>잘하는지 몰라도 괜찮아. 해본 것부터 함께 알아보자.</p>
            <button onClick={() => go("diagnosis")}>
              나의 출발점
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
        <section className="weekly-card">
          <div className="weekly-top">
            <span>MY LITTLE STEPS</span>
            <img
              src="/brand/03_icons/crown.svg"
              width="36"
              height="36"
              alt=""
            />
          </div>
          <h2>
            하나씩 해본 게<br />
            나의 이야기가 돼.
          </h2>
          <div className="weekly-stats">
            <div>
              <strong>{completed.length}</strong>
              <span>완료한 경험</span>
            </div>
            <div>
              <strong>
                {explored}
                <small>/{catalog.length}</small>
              </strong>
              <span>소개를 살펴본 직업</span>
            </div>
          </div>
          <button onClick={() => go("portfolio")}>
            나의 기록 보기
            <ArrowUpRight size={18} />
          </button>
        </section>
      </div>
      <section className="home-careers">
        <SectionHeading
          title="직업의 하루가 기다리고 있어"
          sub="준비된 상황 속에서 골라보고, 질문하고, 느낀 점을 남겨봐."
          onClick={() => go("simulation")}
        />
        <div className="career-grid three">
          {catalog.slice(0, 3).map((c) => (
            <CareerCard
              key={c.id}
              career={c}
              saved={state.saved.includes(c.id)}
              onSave={() => {
                void save(c.id);
              }}
              onOpen={() => go("simulation", c.id)}
            />
          ))}
        </div>
      </section>
      <div className="home-bottom-grid">
        <section className="project-teaser">
          <img
            src="/brand/03_icons/project.svg"
            width="48"
            height="48"
            alt=""
          />
          <div>
            <span className="eyebrow">MAKE SOMETHING YOURS</span>
            <h3>아이디어를 내 손으로 만들어보면?</h3>
            <p>
              {recommended?.project ??
                "작은 프로젝트에서 너만의 결과물을 만들어 봐."}
            </p>
          </div>
          <button
            className="circle-button"
            aria-label="미니 프로젝트 보기"
            onClick={() => go("projects", recommended?.id)}
          >
            <ArrowUpRight />
          </button>
        </section>
        <section className="portfolio-teaser">
          <Bookmark size={25} />
          <div>
            <small>경험이 쌓이는 나의 기록</small>
            <h3>수료증과 배지를 모아 봐요</h3>
          </div>
          <button
            className="circle-button"
            aria-label="포트폴리오 보기"
            onClick={() => go("portfolio")}
          >
            <ArrowUpRight />
          </button>
        </section>
      </div>
      {state.activities.length > 0 && (
        <section className="spaced-panel">
          <SectionHeading
            title="최근에 남긴 나의 경험"
            action="기록 모아보기"
            onClick={() => go("portfolio")}
          />
          <div className="activity-list">
            {state.activities.slice(0, 3).map((activity) => (
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

export { default as CareerMap } from "./ExperienceMap";

export function Discovery() {
  const { state, user, catalog, save, go, search, setSearch, refresh } =
    useApp();
  const [field, setField] = useState("전체");
  const [savedOnly, setSavedOnly] = useState(false);
  const [detail, setDetail] = useState<CatalogCareer | null>(null);
  const [eventStatus, setEventStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [eventError, setEventError] = useState("");
  const eventRequest = useRef<{
    careerId: CareerId;
    clientRequestId: string;
    controller?: AbortController;
  } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      eventRequest.current?.controller?.abort();
    };
  }, []);
  const close = useCallback(() => {
    setDetail(null);
    eventRequest.current = null;
  }, []);
  const recordExploration = useCallback(
    async (request: NonNullable<typeof eventRequest.current>) => {
      request.controller?.abort();
      request.controller = new AbortController();
      setEventStatus("saving");
      setEventError("");
      try {
        await api("/experience-events", {
          ...json("POST", {
            careerId: request.careerId,
            kind: "explored",
            clientRequestId: request.clientRequestId,
          }),
          signal: request.controller.signal,
        });
        if (mounted.current && eventRequest.current === request)
          setEventStatus("saved");
        try {
          await refresh();
        } catch {
          /* The global connection banner owns refresh errors. */
        }
      } catch (error) {
        if (
          !mounted.current ||
          eventRequest.current !== request ||
          (error instanceof Error && error.name === "AbortError")
        )
          return;
        setEventError(errorMessage(error));
        setEventStatus("error");
      }
    },
    [refresh],
  );
  const isAuthenticated = Boolean(user);
  const open = useCallback(
    (career: CatalogCareer) => {
      setDetail(career);
      setEventError("");
      setEventStatus("idle");
      eventRequest.current?.controller?.abort();
      if (!isAuthenticated) {
        eventRequest.current = null;
        return;
      }
      const request = { careerId: career.id, clientRequestId: requestId() };
      eventRequest.current = request;
      void recordExploration(request);
    },
    [isAuthenticated, recordExploration],
  );
  const requestedCareer = new URLSearchParams(
    window.location.hash.split("?")[1],
  ).get("career");
  useEffect(() => {
    const career = catalog.find((item) => item.id === requestedCareer);
    if (career) open(career);
  }, [catalog, requestedCareer, open]);
  const list = catalog.filter(
    (c) =>
      (field === "전체" || c.field === field) &&
      (!savedOnly || state.saved.includes(c.id)) &&
      [c.title, c.field, c.intro, ...c.related, ...c.majors, ...c.skills]
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
            처음 만난 직업이
            <br />
            다음 이야기가 될지 몰라.
          </h2>
        </div>
        <img
          className="discovery-mascot"
          src="/brand/01_mascots/mascot_01_explore.png"
          alt="직업을 찾아보는 킹크랩 캐릭터"
        />
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
        {["전체", ...fields.slice(0, 5)].map((item) => (
          <button
            key={item}
            className={field === item ? "selected" : ""}
            onClick={() => setField(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="result-heading">
        <span>
          발견한 직업 <b>{list.length}</b>
        </span>
        <span>마음이 가는 카드부터 열어봐</span>
      </div>
      {list.length ? (
        <div className="career-grid three">
          {list.map((c) => (
            <CareerCard
              key={c.id}
              career={c}
              saved={state.saved.includes(c.id)}
              onSave={() => {
                void save(c.id);
              }}
              onOpen={() => open(c)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="여기에 맞는 직업이 아직 없어"
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
          <img
            className="career-detail-art"
            src={`/brand/05_career_illustrations/${artwork[detail.id]}.svg`}
            alt={`${detail.title}의 업무를 표현한 그림`}
          />
          <p className="detail-intro">{detail.intro}</p>
          {user ? (
            <div className="record-status" role="status">
              {eventStatus === "saving"
                ? "살펴본 직업을 기록하고 있어요."
                : eventStatus === "saved"
                  ? "직업 소개를 살펴본 기록이 저장됐어요."
                  : null}
            </div>
          ) : (
            <p className="fine-print">
              로그인하면 앞으로의 탐색과 활동을 나의 기록으로 모을 수 있어.
            </p>
          )}
          {eventStatus === "error" && (
            <RetryNotice
              message={`탐색 기록을 저장하지 못했어요. ${eventError}`}
              retry={() => {
                if (eventRequest.current)
                  void recordExploration(eventRequest.current);
              }}
            />
          )}
          <h3>이런 문제를 만나봐</h3>
          <p>{detail.problem}</p>
          <h3>이런 역량을 사용해</h3>
          <div className="chip-list">
            {detail.skills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
          </div>
          <h3>관련 전공</h3>
          <p>{detail.majors.join(" · ")}</p>
          <h3>함께 알아볼 직업</h3>
          <div className="chip-list">
            {detail.related.map((job) => (
              <span className="plain-chip" key={job}>
                {job}
              </span>
            ))}
          </div>
          <p className="fine-print">
            연관 직업은 탐색 키워드야. 현재 직무체험은 다섯 가지 대표 직업을
            제공해.
          </p>
          <details className="source-details">
            <summary>직업·역량 정보의 출처</summary>
            {detail.sources?.length ? (
              <ul>
                {detail.sources.map((source) => (
                  <li key={`${source.source}-${source.id}`}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.source} · {source.label || source.id}
                      <ArrowUpRight size={14} />
                    </a>
                    <small>
                      {[
                        source.version && `버전 ${source.version}`,
                        source.license,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>출처 정보를 아직 불러오지 못했어. 서버 연결 후 다시 열어봐.</p>
            )}
            <p className="fine-print">
              직업 자료를 바탕으로 KingCareer가 한국어 설명과 교육용 활동을
              구성했어. 교육용 경험목표와 기록 기준은 프로젝트에서 만든
              기준이야.
            </p>
          </details>
          <div className="button-row">
            <Button
              onClick={() => {
                close();
                go("simulation", detail.id);
              }}
            >
              직무체험 시작
              <ArrowRight size={16} />
            </Button>
            <Button
              kind="secondary"
              onClick={() => {
                void save(detail.id);
              }}
            >
              <Bookmark size={17} />
              {state.saved.includes(detail.id) ? "저장 취소" : "직업 저장"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function Recommendation() {
  const { state, catalog, go } = useApp();
  const [kind, setKind] = useState("all");
  const recommendations = state.recommendations.filter(
    (item) => kind === "all" || item.kind === kind,
  );
  const lead = state.recommendations[0];
  const leadCareer = catalog.find((c) => c.id === lead?.careerId);
  return (
    <>
      <PageHeading
        eyebrow="YOUR NEXT EXPERIENCE"
        title="다음 경험은, 너에게 맞춰서"
        description="나의 기록에서 아직 비어 있는 곳을 찾아 다음 경험을 연결했어."
      />
      {lead && leadCareer ? (
        <section className="recommendation-hero">
          <div>
            <Tag color="orange">지금 해보면 좋을 경험</Tag>
            <h2>
              {leadCareer.title},<br />한 걸음 더 알아볼까?
            </h2>
            <p>{lead.reason}</p>
            <Button onClick={() => go(kindPages[lead.kind], lead.careerId)}>
              {kindLabels[lead.kind]} 열기
              <ArrowUpRight size={18} />
            </Button>
          </div>
          <img
            className="recommendation-mascot"
            src="/brand/01_mascots/mascot_08_guide.png"
            alt="다음 경험을 안내하는 킹크랩"
          />
        </section>
      ) : (
        <Empty
          title="새로운 추천을 기다리는 중"
          action="직업 탐색하기"
          onClick={() => go("discovery")}
        >
          지금 필요한 경험을 불러오지 못했거나, 제공 중인 활동의 기록을 모두
          모았어. 다른 직업도 만나봐.
        </Empty>
      )}
      <div className="filter-tabs">
        {[
          { value: "all", label: "모든 경험" },
          { value: "simulation", label: "직무체험" },
          { value: "project", label: "미니 프로젝트" },
          { value: "discovery", label: "직업 탐색" },
        ].map((item) => (
          <button
            key={item.value}
            className={kind === item.value ? "selected" : ""}
            onClick={() => setKind(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="recommendation-grid">
        {recommendations.map((item) => {
          const career = catalog.find((c) => c.id === item.careerId);
          if (!career) return null;
          return (
            <article
              className="panel recommendation-card"
              key={`${item.careerId}-${item.kind}`}
            >
              <div className="recommendation-card-top">
                <JobIcon id={career.id} size={28} />
                <Tag
                  color={
                    item.kind === "project"
                      ? "purple"
                      : item.kind === "simulation"
                        ? "blue"
                        : "orange"
                  }
                >
                  {kindLabels[item.kind]}
                </Tag>
              </div>
              <h2>{item.kind === "project" ? career.project : career.title}</h2>
              <p>{item.reason}</p>
              <details className="gap-details">
                <summary>연결된 기록과 추천 이유</summary>
                <h3>이 활동으로 남겨볼 기록</h3>
                <ul>
                  {item.missingObjectives.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
                <h3>이렇게 이어졌어</h3>
                <ol>
                  {item.path.map((step, i) => (
                    <li key={`${i}-${step}`}>{step}</li>
                  ))}
                </ol>
              </details>
              <Button
                kind="secondary"
                onClick={() => go(kindPages[item.kind], item.careerId)}
              >
                {kindLabels[item.kind]} 시작
                <ArrowRight size={17} />
              </Button>
            </article>
          );
        })}
      </div>
      {lead && recommendations.length === 0 && (
        <p className="muted">이 종류에서 추가로 추천할 경험은 아직 없어.</p>
      )}
      <p className="fine-print">
        추천은 서버에 저장된 경험 기록과 교육용 목표의 연결을 바탕으로 만들어져.
        직업 적합성이나 능력의 순위가 아니야.
      </p>
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
  const { catalog } = useApp();
  const job = catalog.find((c) => c.id === activity.careerId);
  return (
    <button className="activity-row" onClick={onClick}>
      <span className={`job-badge ${job?.color ?? "purple"}`}>
        <JobIcon id={activity.careerId} />
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
  useEffect(() => {
    setDetail((current) =>
      current
        ? state.activities.find((item) => item.id === current.id) || null
        : null,
    );
  }, [state.activities]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const downloadLock = useRef(false);
  const close = useCallback(() => setDetail(null), []);
  const list = state.activities.filter(
    (activity) => filter === "all" || filter === activity.kind,
  );
  const latest = state.activities[0];
  const download = async () => {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch("/api/v1/portfolio/export", {
        credentials: "include",
        headers: { Accept: "text/plain" },
      });
      if (!response.ok) {
        let message =
          response.status === 401
            ? "로그인 후 다시 내려받아 주세요."
            : "포트폴리오를 내려받지 못했어요.";
        try {
          const body = (await response.json()) as { detail?: string };
          if (typeof body.detail === "string") message = body.detail;
        } catch {
          /* Keep the response-status message. */
        }
        throw new Error(message);
      }
      if (!response.headers.get("content-type")?.includes("text/plain"))
        throw new Error(
          "포트폴리오 파일을 읽을 수 없어요. 서버 연결을 확인해 주세요.",
        );
      const text = await response.text();
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "KingCareer-진로-포트폴리오.txt";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("서버에 저장된 포트폴리오를 내려받았어요.");
    } catch (error) {
      setDownloadError(errorMessage(error));
    } finally {
      downloadLock.current = false;
      setDownloading(false);
    }
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${state.profile.name}의 KingCareer 진로 기록\n${state.activities.map((a) => `${a.title}: ${a.reflection || a.feedback}`).join("\n")}`,
      );
      toast("활동 요약을 복사했어요. 원하는 곳에 붙여넣어 공유해 주세요.");
    } catch {
      toast("복사하지 못했어요. 다운로드로 기록을 저장할 수 있어요.");
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
            onClick={() => {
              void share();
            }}
          >
            <Share2 size={17} />
            요약 복사
          </Button>
          <Button
            disabled={!state.activities.length || downloading}
            onClick={() => {
              void download();
            }}
          >
            <Download size={17} />
            {downloading ? "내려받는 중" : "다운로드"}
          </Button>
        </div>
      </PageHeading>
      <AwardsShelf />
      {downloadError && (
        <RetryNotice
          message={downloadError}
          busy={downloading}
          retry={() => {
            void download();
          }}
        />
      )}
      <div className="stats-row">
        <Stat
          label="완료한 직무체험"
          value={state.activities.filter((a) => a.kind === "simulation").length}
          unit="개"
          color="orange"
        />
        <Stat
          label="제출한 프로젝트"
          value={state.activities.filter((a) => a.kind === "project").length}
          unit="개"
          color="purple"
        />
        <Stat
          label="기록을 남긴 직업"
          value={new Set(state.activities.map((a) => a.careerId)).size}
          unit="개"
          color="blue"
        />
      </div>
      <section className="panel spaced-panel">
        <SectionHeading
          title="최근에 달라진 나의 기록"
          sub="교육용 목표의 기록 충족도 변화야. 직무 능력 점수와는 달라."
        />
        {latest ? (
          <div className="change-grid">
            {["직무 이해", "활동 경험", "역량 이해"].map((name, i) => (
              <div key={name}>
                <span>{name}</span>
                <p>
                  <small>{latest.before[i + 1] ?? 0}%</small>
                  <ArrowRight size={17} />
                  <strong>{latest.after[i + 1] ?? 0}%</strong>
                </p>
              </div>
            ))}
            <div>
              <span>활동 후 내가 남긴 관심</span>
              <p>
                <strong>{latest.interest ?? "미기록"}</strong>
                {latest.interest !== undefined && <small>/ 5</small>}
              </p>
            </div>
          </div>
        ) : (
          <div className="portfolio-empty-intro">
            <img
              src="/brand/01_mascots/mascot_04_project.png"
              width="116"
              height="116"
              alt=""
            />
            <p className="muted">
              활동을 마치면 전후 기록과 회고를 여기서 꺼내볼 수 있어.
            </p>
          </div>
        )}
      </section>
      <SectionHeading title="나의 활동 기록" />
      <div className="filter-tabs">
        {[
          { id: "all", label: "모든 기록" },
          { id: "simulation", label: "직무체험" },
          { id: "project", label: "미니 프로젝트" },
          { id: "diagnosis", label: "진로 진단" },
        ].map((item) => (
          <button
            className={filter === item.id ? "selected" : ""}
            key={item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="activity-list">
          {list.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              onClick={() => setDetail(activity)}
            />
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
          <div className="chip-list">
            <Tag>{dateLabel(detail.date)}</Tag>
            <FeedbackLabel activity={detail} />
          </div>
          <h3>나의 활동</h3>
          <ol className="answer-list">
            {detail.answers.map((answer, i) => (
              <li className="preserve-text" key={i}>
                {answer}
              </li>
            ))}
          </ol>
          <h3>
            {detail.evaluationStatus === "completed" ||
            detail.evaluationStatus === "ai_feedback"
              ? "AI 피드백"
              : "활동 기록 안내"}
          </h3>
          <p className="preserve-text">{detail.feedback}</p>
          {detail.evaluationStatus !== "completed" &&
            detail.evaluationStatus !== "ai_feedback" &&
            detail.evaluationStatus !== "self_report" && (
              <p className="fine-print">
                {detail.evaluationStatus === "pending"
                  ? "활동은 저장됐어. AI의 내용 평가는 아직 기다리는 중이야."
                  : "활동은 저장됐어. 지금은 AI가 결과물의 내용이나 직무 역량을 평가하지 않아."}
              </p>
            )}
          <h3>나에게 남은 것</h3>
          <p className="preserve-text">
            {detail.reflection || "별도의 회고를 남기지 않았어."}
          </p>
          {detail.kind === "project" && (
            <>
              <p>
                <a href={`/api/v1/portfolio/${detail.id}/artifact`} download>
                  이 수정본의 배치도·설명 JSON 다운로드
                </a>
              </p>
              <Suspense fallback={<p>결과물을 여는 중…</p>}>
                <ArtifactPreview activityId={detail.id} />
              </Suspense>
            </>
          )}
          <h3>활동 후 관심</h3>
          <p>
            {detail.interest !== undefined
              ? `${detail.interest} / 5`
              : "관심을 별도로 기록하지 않았어."}
          </p>
          <Button
            kind="secondary"
            onClick={() => {
              close();
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
