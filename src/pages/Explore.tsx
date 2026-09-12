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
import {
  Button,
  CareerCard,
  Empty,
  JobIcon,
  Modal,
  PageHeading,
  Tag,
} from "../components";
import { dateLabel, fields, getCareer } from "../data";
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
import ArtifactThumbnail from "../fieldwork/ArtifactThumbnail";
import PortfolioEvaluation from "../fieldwork/PortfolioEvaluation";
import "./portfolio-flow.css";
import "./portfolio-preview.css";
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
          : "활동 기록 · AI 평가 없음";
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

export { default as Home } from "./Basecamp";

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
          src="/brand/12_career_kingcrabs/hello.png"
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
              <p>출처 정보를 불러오지 못했어. 잠시 후 다시 열어봐.</p>
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
            src={`/brand/12_career_kingcrabs/${leadCareer.id}.png`}
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
                <img
                  className="recommendation-crab"
                  src={`/brand/12_career_kingcrabs/${career.id}.png`}
                  alt=""
                  width={84}
                  height={84}
                  loading="lazy"
                />
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
        추천은 네가 남긴 경험과 아직 해보지 않은 활동을 바탕으로 만들어져. 직업
        적합성이나 능력의 순위가 아니야.
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
  const { state, go, toast, activityId } = useApp();
  const [filter, setFilter] = useState(() => {
    const tab = new URLSearchParams(location.hash.split("?")[1]).get("tab");
    if (tab && ["project", "certificates", "simulation"].includes(tab)) return tab;
    const latest = [...state.activities].filter((a) => a.kind !== "diagnosis").sort((a, b) => b.date.localeCompare(a.date))[0];
    return latest?.kind === "simulation" ? "certificates" : "project";
  });
  const [detail, setDetail] = useState<Activity | null>(null);
  useEffect(() => {
    if (location.hash.split("?")[0] === "#portfolio" && activityId)
      setDetail(state.activities.find((a) => a.id === activityId) || null);
  }, [activityId, state.activities]);
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
          "포트폴리오 파일을 읽을 수 없어요. 연결을 확인한 뒤 다시 내려받아 주세요.",
        );
      const text = await response.text();
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "KingCareer-활동-요약.txt";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("활동 요약 텍스트를 내려받았어요. 그림이 포함된 문서는 개별 결과물에서 받을 수 있어요.");
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
      <div className="portfolio-collection-hero">
      <PageHeading
        eyebrow="내가 모은 경험"
        title="나의 포트폴리오"
        description="직접 해본 일, 내가 만든 아이디어. 하나씩 모으면 나만의 이야기가 돼."
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
            {downloading ? "내려받는 중" : "활동 요약 TXT"}
          </Button>
        </div>
      </PageHeading>
        <div className="portfolio-collection-art" aria-hidden="true">
          <span className="collection-orbit" />
          <span className="collection-mini-card collection-mini-card-back" />
          <span className="collection-mini-card collection-mini-card-front" />
          <img src="/brand/01_mascots/mascot_06_celebrate.png" alt="" width={200} height={200} />
          <span className="collection-sticker">나의 가능성 수집 중</span>
        </div>
        <div className="collection-record-strip">
          <span><b>{state.activities.filter((activity) => activity.kind === "simulation").length}</b>번의 직무체험</span>
          <span><b>{state.activities.filter((activity) => activity.kind === "project").length}</b>개의 프로젝트 결과물</span>
        </div>
      </div>
      {downloadError && (
        <RetryNotice
          message={downloadError}
          busy={downloading}
          retry={() => {
            void download();
          }}
        />
      )}
      <div className="filter-tabs portfolio-collection-tabs">
        {[
          { id: "project", label: "프로젝트 결과물" },
          { id: "certificates", label: "수료 카드·배지" },
          { id: "simulation", label: "체험 기록" },
        ].map((item) => (
          <button
            className={filter === item.id ? "selected" : ""}
            key={item.id}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {filter === "certificates" ? <AwardsShelf /> : list.length ? (
        <div className={filter === "project" ? "portfolio-work-grid" : "activity-list"}>
          {list.map((activity) => (
            filter === "project" ? <button className="portfolio-work-card" data-career={activity.careerId} key={activity.id} onClick={() => setDetail(activity)}>
              <ArtifactThumbnail activity={activity} />
              <span>{dateLabel(activity.date)} · 제출한 결과물</span>
              <h2>{activity.title}</h2>
              <p>{activity.answers[0] || (activity.studioKind === "login-recovery" ? "직접 고친 화면과 두 상황에서 눌러본 결과를 펼쳐봐." : "저장한 설계도와 아이디어를 펼쳐봐.")}</p>
              <strong>설계도와 설명 보기 <ArrowRight size={17} /></strong>
            </button> : <ActivityRow
              key={activity.id}
              activity={activity}
              onClick={() => setDetail(activity)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="나의 첫 번째 이야기를 기다리는 중"
          action={filter === "project" ? "첫 프로젝트 만들기" : "직무체험 시작하기"}
          onClick={() => go(filter === "project" ? "projects" : "simulation")}
        >
          경험을 마치면 나의 선택과 결과물을 다시 꺼내볼 수 있어.
        </Empty>
      )}
      {detail && (
        <Modal title={detail.title} onClose={close}>
          <div className="portfolio-preview" data-kind={detail.kind}>
            <div className="portfolio-preview-meta">
              <img src={`/brand/12_career_kingcrabs/${detail.careerId}.png`} alt="" width={64} height={64} />
              <div><span className="portfolio-preview-kind">{detail.kind === "project" ? "나의 프로젝트" : "나의 직무체험"}</span><strong>{getCareer(detail.careerId).title}</strong><span>{dateLabel(detail.date)} · 저장한 기록</span></div>
              {detail.interest !== undefined && <span className="portfolio-preview-interest">활동 후 관심 <b>{detail.interest}<small> / 5</small></b></span>}
            </div>
            <div className="portfolio-result-layout">
              {detail.kind === "project" && <Suspense fallback={<p role="status">결과물을 여는 중…</p>}><ArtifactPreview activityId={detail.id} evaluation={detail} /></Suspense>}
              <section className="portfolio-result-story" aria-label={detail.kind === "project" ? "나의 설명" : "나의 선택"}>
                <h3>{detail.studioKind === "login-recovery" ? "내 설계에서 정리한 내용" : detail.kind === "project" ? "내 아이디어는 이렇게" : "현장에서 내가 한 선택"}</h3>
                <ol className="portfolio-story-cards">
                  {(detail.studioKind === "login-recovery" ? detail.designSummary || [] : detail.answers).map((answer, index) => <li key={index}><span className="portfolio-story-number">{index + 1}</span><div><h4>{detail.studioKind === "login-recovery" ? ["오류 안내", "버튼 연결", "입력 내용 처리"][index] : detail.kind === "project" ? ["발견한 문제", "개선 제안과 근거", "확인 방법"][index] || "나의 설명" : `선택 ${index + 1}`}</h4><p className="preserve-text">{answer || "이 부분은 설명을 남기지 않았어."}</p></div></li>)}
                </ol>
                {detail.studioKind === "login-recovery" && <>
                  <h3>직접 눌러 확인한 경로</h3>
                  <ul className="portfolio-story-cards">{detail.checks?.map(check => <li key={check.scenario}><div><h4>{check.scenario === "recovered" ? "연결이 돌아온 상황" : "계속 연결되지 않는 상황"}</h4><p>{check.message}</p></div></li>)}</ul>
                  {detail.answers[0]?.trim() && <details className="portfolio-personal-note"><summary>내가 남긴 말</summary><p className="preserve-text">{detail.answers[0]}</p></details>}
                </>}
                {detail.reflection && <details className="portfolio-personal-note"><summary>나에게 남은 것</summary><p className="preserve-text">{detail.reflection}</p></details>}
              </section>
            </div>
            <section className="portfolio-feedback-block" aria-label="결과물 피드백">
              {detail.kind === "project" ? <>
                {detail.evaluationStatus === "ai_feedback" && <div className="portfolio-feedback-summary"><span>AI 코치 피드백</span><p className="preserve-text">{detail.feedback}</p></div>}
                <PortfolioEvaluation key={detail.id} activity={detail} onEvaluated={(updated) => setDetail(current => current?.id === updated.id ? updated : current)} />
              </> : <><FeedbackLabel activity={detail} /><h3>{detail.evaluationStatus === "completed" || detail.evaluationStatus === "ai_feedback" ? "AI 피드백" : "활동 기록 안내"}</h3><p className="preserve-text">{detail.feedback}</p></>}
            </section>
            <div className="portfolio-preview-next">
              <div><strong>이번 경험에서 무엇을 발견했을까?</strong><p>크랩과 돌아보고 다음 경험을 골라 봐.</p></div>
              <Button onClick={() => { close(); go("review", detail.careerId, undefined, { activityId: detail.id }); }}>크랩과 경험 돌아보기 <ArrowRight size={17} /></Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
