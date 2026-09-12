import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  Home as HomeIcon,
  Map,
  Compass,
  FolderKanban,
  MapPin,
  ChartNoAxesCombined,
  Menu,
  X,
  ArrowUpRight,
  Search,
  Bell,
  ChevronRight,
  BookOpen,
  Lightbulb,
  GraduationCap,
  ScanLine,
  CheckCircle2,
} from "lucide-react";
import { Logo, Modal, Button } from "./components";
import { initialState, loadState, getCareer } from "./data";
import type { Page, CareerId, Activity } from "./data";
import { StoreContext } from "./store";
import {
  Home,
  CareerMap,
  Discovery,
  Region,
  Recommendation,
  Portfolio,
} from "./pages/Explore";
import { Diagnosis, Simulation, Projects } from "./pages/Activities";
import { Onboarding, Auth, ProfilePage, Teacher } from "./pages/Account";

const nav = [
  { id: "home", title: "홈", icon: HomeIcon },
  { id: "map", title: "나의 진로지도", icon: Map },
  { id: "simulation", title: "AI 직무체험", icon: Compass, badge: "TRY" },
  { id: "projects", title: "미니 프로젝트", icon: FolderKanban },
  { id: "discovery", title: "직업 발견", icon: Search },
  { id: "region", title: "전북에서 찾기", icon: MapPin },
  { id: "portfolio", title: "나의 포트폴리오", icon: BookOpen },
] as const;
const titles: Record<Page, string> = {
  home: "나의 탐험 베이스캠프",
  map: "나의 진로지도",
  simulation: "AI 직무체험",
  projects: "미니 프로젝트",
  discovery: "직업 발견",
  region: "전북에서 찾기",
  portfolio: "나의 포트폴리오",
  diagnosis: "관심·경험 진단",
  recommendation: "나에게 필요한 다음 경험",
  teacher: "교사·멘토 공간",
  profile: "마이페이지",
  onboarding: "잇다 시작하기",
  auth: "내 프로필로 시작하기",
};
function readPage(): Page {
  const hash = window.location.hash.slice(1).split("?")[0];
  return hash in titles ? (hash as Page) : "home";
}
export default function App() {
  const [state, setState] = useState(loadState);
  const [page, setPage] = useState<Page>(readPage);
  const [careerId, setCareerId] = useState<CareerId>(
    () =>
      getCareer(
        new URLSearchParams(window.location.hash.split("?")[1]).get("career") ||
          "developer",
      ).id,
  );
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState(false);
  const [message, setMessage] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const mainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const toast = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 3800);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("itda-career-v1", JSON.stringify(state));
    } catch {
      toast(
        "브라우저 저장 공간을 사용할 수 없어요. 새로고침 전에 활동을 내려받아 주세요.",
      );
    }
  }, [state, toast]);
  useEffect(() => {
    const onHash = () => {
      setPage(readPage());
      const id = new URLSearchParams(window.location.hash.split("?")[1]).get(
        "career",
      );
      if (id) setCareerId(getCareer(id).id);
      setMenu(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.title = `${titles[page]} · 잇다`;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (firstRender.current) {
      firstRender.current = false;
    } else {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [page]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
      if (e.key === "Tab") {
        const buttons =
          sidebarRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [menu]);
  const go = useCallback((target: Page, id?: CareerId) => {
    if (id) setCareerId(id);
    setMenu(false);
    window.location.hash = target + (id ? `?career=${id}` : "");
    setPage(target);
  }, []);
  const save = (id: CareerId) =>
    setState((s) => ({
      ...s,
      saved: s.saved.includes(id)
        ? s.saved.filter((x) => x !== id)
        : [...s.saved, id],
    }));
  const record = (activity: Omit<Activity, "id" | "date">) => {
    setState((s) => ({
      ...s,
      activities: [
        {
          ...activity,
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
        },
        ...s.activities,
      ],
      scores: { ...s.scores, [activity.careerId]: activity.after },
      interests:
        activity.interest === undefined
          ? s.interests
          : { ...s.interests, [activity.careerId]: activity.interest },
    }));
    toast("새로운 경험을 진로지도와 포트폴리오에 기록했어요.");
  };
  const pages: Record<Page, React.ReactNode> = {
    home: <Home />,
    map: <CareerMap />,
    simulation: <Simulation />,
    projects: <Projects />,
    discovery: <Discovery />,
    region: <Region />,
    portfolio: <Portfolio />,
    diagnosis: <Diagnosis />,
    recommendation: <Recommendation />,
    teacher: <Teacher />,
    profile: <ProfilePage />,
    onboarding: <Onboarding />,
    auth: <Auth />,
  };
  const closeNotice = useCallback(() => setNotice(false), []);
  return (
    <MotionConfig reducedMotion="user">
      <StoreContext.Provider
        value={{
          state,
          setState,
          go,
          careerId,
          setCareerId,
          toast,
          save,
          record,
          search,
          setSearch,
        }}
      >
        <a
          className="skip-link"
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            mainRef.current?.focus();
          }}
        >
          본문으로 건너뛰기
        </a>
        <div className="app-shell">
          {menu && (
            <button
              className="sidebar-scrim"
              aria-label="메뉴 닫기"
              onClick={() => setMenu(false)}
            />
          )}
          <aside
            ref={sidebarRef}
            className={`sidebar ${menu ? "is-open" : ""}`}
            aria-label="주 메뉴"
          >
            <button
              className="brand-button"
              onClick={() => go("home")}
              aria-label="잇다 홈"
            >
              <Logo />
            </button>
            <button
              className="sidebar-close icon-button"
              aria-label="메뉴 닫기"
              onClick={() => setMenu(false)}
            >
              <X />
            </button>
            <div className="workspace-label">MY CAREER PLAYGROUND</div>
            <nav>
              {nav.map((item) => (
                <button
                  key={item.id}
                  aria-current={page === item.id ? "page" : undefined}
                  className={`nav-item ${page === item.id ? "active" : ""}`}
                  onClick={() => go(item.id)}
                >
                  {page === item.id && (
                    <motion.span
                      className="nav-active"
                      layoutId="nav-active"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                  <item.icon size={20} />
                  <span>{item.title}</span>
                  {"badge" in item && <small>{item.badge}</small>}
                </button>
              ))}
            </nav>
            <div className="sidebar-divider" />
            <button
              className={`nav-item ${page === "diagnosis" ? "active" : ""}`}
              onClick={() => go("diagnosis")}
            >
              <ScanLine size={20} />
              <span>관심·경험 진단</span>
            </button>
            <button
              className={`nav-item ${page === "recommendation" ? "active" : ""}`}
              onClick={() => go("recommendation")}
            >
              <Lightbulb size={20} />
              <span>다음 경험 추천</span>
            </button>
            <div className="sidebar-bottom">
              <button
                className="sidebar-prompt"
                onClick={() => go("onboarding")}
              >
                <span className="prompt-icon">
                  <Compass size={22} />
                </span>
                <strong>꿈이 없어도 괜찮아.</strong>
                <p>해보면서 알아가면 되니까!</p>
                <span>
                  잇다는 처음인가요? <ArrowUpRight size={15} />
                </span>
              </button>
              <button className="mentor-link" onClick={() => go("teacher")}>
                <GraduationCap size={17} />
                교사·멘토 공간
                <ArrowUpRight size={15} />
              </button>
              <button className="sidebar-profile" onClick={() => go("profile")}>
                <span className="avatar">{state.profile.name.slice(0, 1)}</span>
                <span>
                  <b>{state.profile.name}</b>
                  <small>
                    {state.profile.onboarded
                      ? state.profile.grade
                      : "나만의 탐험을 시작해요"}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            </div>
          </aside>
          <div className="main-shell" inert={menu}>
            <header className="topbar">
              <div className="breadcrumb">
                <button
                  className="mobile-menu icon-button"
                  aria-label="메뉴 열기"
                  aria-expanded={menu}
                  onClick={() => setMenu(true)}
                >
                  <Menu />
                </button>
                <span>나의 공간</span>
                <ChevronRight size={14} />
                <strong>{titles[page]}</strong>
              </div>
              <div className="topbar-actions">
                <form
                  className="global-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearch(searchInput);
                    go("discovery");
                  }}
                >
                  <Search size={16} />
                  <input
                    aria-label="직업 검색"
                    placeholder="어떤 직업이 궁금해?"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <kbd>↵</kbd>
                </form>
                <button
                  className="icon-button notification-button"
                  aria-label="알림 보기"
                  onClick={() => setNotice(true)}
                >
                  <Bell size={20} />
                  {state.profile.notifications && <i />}
                </button>
                <button
                  className="avatar small-avatar"
                  aria-label="내 프로필"
                  onClick={() => go("profile")}
                >
                  {state.profile.name.slice(0, 1)}
                </button>
              </div>
            </header>
            <main
              id="main-content"
              ref={mainRef}
              tabIndex={-1}
              className="main-content"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={page}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {pages[page]}
                </motion.div>
              </AnimatePresence>
              <footer className="footer">
                <span>
                  잇다. <span>경험이 모여, 나의 가능성이 되다.</span>
                </span>
                <button onClick={() => go("auth")}>
                  체험판 · 이 브라우저에 저장
                </button>
                <span>MADE FOR JEONBUK</span>
              </footer>
            </main>
          </div>
        </div>
        <AnimatePresence>
          {message && (
            <motion.div
              role="status"
              className="toast"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <CheckCircle2 size={20} />
              {message}
            </motion.div>
          )}
          {notice && (
            <Modal title="나에게 온 소식" onClose={closeNotice}>
              <div className="notice-item">
                <span className="notice-icon">
                  <ChartNoAxesCombined />
                </span>
                <div>
                  <h3>오늘의 가능성이 기다리고 있어요</h3>
                  <p>
                    {state.activities.length
                      ? `${state.activities.length}개의 경험을 기록했어요. 다음 경험도 이어가 볼까요?`
                      : "첫 직무체험을 마치면 나의 진로지도가 채워져요."}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setNotice(false);
                  go("recommendation");
                }}
              >
                다음 경험 살펴보기
                <ArrowUpRight size={17} />
              </Button>
              <p className="fine-print">
                체험판 안내예요. 알림 설정은 마이페이지에서 바꿀 수 있어요.
              </p>
            </Modal>
          )}
        </AnimatePresence>
      </StoreContext.Provider>
    </MotionConfig>
  );
}
export { initialState };
