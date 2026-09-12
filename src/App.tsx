import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  Menu,
  X,
  ArrowUpRight,
  Search,
  Compass,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  LogIn,
} from "lucide-react";
import { Logo, Modal, Button, Empty } from "./components";
import { initialState, getCareer, careers } from "./data";
import type {
  Page,
  CareerId,
  AppState,
  Profile,
  Career,
  SourceReference,
} from "./data";
import { api, ApiError, errorMessage, json } from "./api";
import { StoreContext, type RouteOptions } from "./store";
import {
  Home,
  Discovery,
  Recommendation,
  Portfolio,
} from "./pages/Explore";
import { Diagnosis, Simulation, Projects } from "./pages/Activities";
import { Onboarding, Auth, ProfilePage } from "./pages/Account";
import { CareerReviewStudio } from "./fieldwork/CareerReview";
import { ActivityHelp } from "./fieldwork/ActivityHelp";
import "./navigation.css";

import { mainNavigation as nav } from "./navigation";
const titles: Record<Page, string> = {
  home: "홈",
  map: "나의 진로 기록",
  review: "이번 경험 돌아보기",
  simulation: "직무체험",
  projects: "미니 프로젝트",
  discovery: "직업 발견",
  portfolio: "포트폴리오",
  diagnosis: "관심·경험 진단",
  recommendation: "다음 경험 추천",
  profile: "마이페이지",
  onboarding: "KingCareer 시작하기",
  auth: "로그인·회원가입",
};
const privatePages: Page[] = [
  "map",
  "portfolio",
  "review",
  "diagnosis",
  "recommendation",
  "profile",
];
function readPage(): Page {
  const route = window.location.hash.slice(1).split("?")[0];
  if (route === "map") {
    const params = new URLSearchParams(location.hash.split("?")[1]);
    params.set("tab", "records");
    history.replaceState(null, "", `${location.pathname}${location.search}#profile?${params}`);
    return "profile";
  }
  return Object.hasOwn(titles, route) ? (route as Page) : "home";
}
export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [user, setUser] = useState<Profile | null>(null);
  const [catalog, setCatalog] =
    useState<(Career & { sources?: SourceReference[] })[]>(careers);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>(readPage);
  const [routeHash, setRouteHash] = useState(location.hash);
  const [careerId, setCareerId] = useState<CareerId>(
    () =>
      getCareer(
        new URLSearchParams(location.hash.split("?")[1]).get("career") ||
          "developer",
      ).id,
  );
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [menu, setMenu] = useState(false);
  const [compactMenu, setCompactMenu] = useState(() => matchMedia("(max-width: 760px)").matches);
  const [notice, setNotice] = useState(false);
  const [message, setMessage] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logoutBusy = useRef(false);
  const [onboardingInterests, setOnboardingInterests] = useState<string[]>([]);
  const mainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const guard = useRef<
    null | ((reason?: "navigate" | "logout") => Promise<boolean>)
  >(null);
  const guardBusy = useRef(false);
  const acceptedHash = useRef(location.hash);
  const skipHashGuard = useRef(false);
  const fetchSequence = useRef(0);
  const afterAuth = useRef<{ page: Page; careerId?: CareerId; tab?: string; options?: RouteOptions } | null>(null);
  const saving = useRef(new Set<CareerId>());
  const toast = useCallback((value: string) => {
    setMessage(value);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 5000);
  }, []);
  const refresh = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    try {
      const data = await api<AppState>("/state");
      if (sequence !== fetchSequence.current) return;
      setState({ ...initialState, ...data });
      setUser(data.profile);
      setError("");
    } catch (e) {
      if (sequence !== fetchSequence.current) return;
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setState(initialState);
        setError("");
        return;
      }
      setError(errorMessage(e));
      throw e;
    }
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      refresh(),
      api<{ careers: Career[] }>("/catalog"),
    ]);
    if (results[1].status === "fulfilled") setCatalog(results[1].value.careers);
    else setError(errorMessage(results[1].reason));
    setLoading(false);
  }, [refresh]);
  useEffect(() => {
    void load();
    return () => {
      fetchSequence.current++;
    };
  }, [load]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const viewport = matchMedia("(max-width: 760px)");
    const update = () => {
      setCompactMenu(viewport.matches);
      if (!viewport.matches) setMenu(false);
    };
    viewport.addEventListener("change", update);
    return () => viewport.removeEventListener("change", update);
  }, []);
  const applyHash = useCallback(() => {
    const nextPage = readPage();
    acceptedHash.current = location.hash;
    setRouteHash(location.hash);
    setPage(nextPage);
    const id = new URLSearchParams(location.hash.split("?")[1]).get("career");
    if (id) setCareerId(getCareer(id).id);
    setMenu(false);
  }, []);
  useEffect(() => {
    const onHash = async () => {
      if (skipHashGuard.current) {
        skipHashGuard.current = false;
        applyHash();
        return;
      }
      const requested = location.hash;
      const previous = acceptedHash.current;
      if (guard.current && !(await guard.current())) {
        history.replaceState(
          null,
          "",
          `${location.pathname}${location.search}${previous}`,
        );
        return;
      }
      if (location.hash === requested) applyHash();
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [applyHash]);
  const go = useCallback(
    async (target: Page, id?: CareerId, tab?: string, options?: RouteOptions) => {
      if (guardBusy.current) return;
      guardBusy.current = true;
      try {
        if (guard.current && !(await guard.current())) return;
        if (id) setCareerId(id);
        const destination = target === "map" ? "profile" : target;
        const params = new URLSearchParams();
        if (id) params.set("career", id);
        if (options?.activityId) params.set("activityId", options.activityId);
        if (options?.sessionId) params.set("sessionId", options.sessionId);
        if (target === "map" || tab) params.set("tab", target === "map" ? "records" : tab!);
        const hash = `#${destination}${params.size ? `?${params}` : ""}`;
        if (location.hash === hash) {
          setMenu(false);
          setPage(destination);
          return;
        }
        skipHashGuard.current = true;
        location.hash = hash;
      } catch (e) {
        toast(errorMessage(e));
      } finally {
        guardBusy.current = false;
      }
    },
    [toast],
  );
  const registerNavigationGuard = useCallback(
    (value: (reason?: "navigate" | "logout") => Promise<boolean>) => {
      guard.current = value;
      return () => {
        if (guard.current === value) guard.current = null;
      };
    },
    [],
  );
  const requireAuth = useCallback(() => {
    if (user) return true;
    const params = new URLSearchParams(location.hash.split("?")[1]);
    afterAuth.current = { page, careerId, tab: params.get("tab") || undefined,
      options: { activityId: params.get("activityId") || undefined, sessionId: params.get("sessionId") || undefined } };
    void go("auth");
    toast("나의 계정으로 시작하면 경험을 계속 이어갈 수 있어요.");
    return false;
  }, [user, page, careerId, go, toast]);
  const completeAuth = useCallback(async () => {
    ++fetchSequence.current;
    const data = await api<AppState>("/state");
    setState({ ...initialState, ...data });
    setUser(data.profile);
    setError("");
    const next = afterAuth.current;
    afterAuth.current = null;
    void go(next?.page ?? "home", next?.careerId, next?.tab, next?.options);
  }, [go]);
  const clearUser = useCallback(() => {
    ++fetchSequence.current;
    setUser(null);
    setState(initialState);
    setOnboardingInterests([]);
    setError("");
    setNotice(false);
    setSearch("");
    setSearchInput("");
    afterAuth.current = null;
  }, []);
  const logout = useCallback(async () => {
    if (logoutBusy.current || guardBusy.current) return;
    logoutBusy.current = true;
    guardBusy.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      if (guard.current && !(await guard.current("logout"))) {
        setLogoutError(
          "작성 중인 내용을 저장하지 못했어요. 저장을 마친 뒤 다시 로그아웃해 주세요.",
        );
        return;
      }
      try {
        await api("/auth/logout", json("POST"));
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) throw e;
      }
      guard.current = null;
      clearUser();
      setMenu(false);
      guardBusy.current = false;
      void go("auth");
      toast("로그아웃했어요. 저장한 경험은 다음에 이어갈 수 있어요.");
    } catch (e) {
      setLogoutError(`로그아웃하지 못했어요. ${errorMessage(e)}`);
    } finally {
      logoutBusy.current = false;
      guardBusy.current = false;
      setLoggingOut(false);
    }
  }, [clearUser, go, toast]);
  const save = useCallback(
    async (id: CareerId) => {
      if (!requireAuth() || saving.current.has(id)) return;
      saving.current.add(id);
      try {
        await api(
          `/saved/${id}`,
          json("PUT", { saved: !state.saved.includes(id) }),
        );
        try {
          await refresh();
        } catch {
          /* Global retry banner preserves server-success distinction. */
        }
      } catch (e) {
        toast(errorMessage(e));
      } finally {
        saving.current.delete(id);
      }
    },
    [requireAuth, state.saved, refresh, toast],
  );
  useEffect(() => {
    document.title = `${titles[page]} · KingCareer`;
    window.scrollTo({ top: 0, behavior: "instant" });
    mainRef.current?.focus({ preventScroll: true });
  }, [page]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
      if (e.key === "Tab") {
        const nodes = sidebarRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [menu]);
  const pages: Record<Page, ReactNode> = {
    home: <Home />,
    map: <ProfilePage />,
    review: <CareerReviewStudio />,
    simulation: <Simulation />,
    projects: <Projects />,
    discovery: <Discovery />,
    portfolio: <Portfolio />,
    diagnosis: <Diagnosis />,
    recommendation: <Recommendation />,
    profile: <ProfilePage />,
    onboarding: <Onboarding />,
    auth: <Auth />,
  };
  const closeNotice = useCallback(() => setNotice(false), []);
  const activeNav = page === "discovery" ? "simulation"
    : page === "diagnosis" || page === "recommendation" ? "home"
    : page === "review" ? "portfolio" : page;
  return (
    <MotionConfig reducedMotion="user">
      <StoreContext.Provider
        value={{
          state,
          user,
          loading,
          error,
          catalog,
          go,
          careerId,
          activityId: new URLSearchParams(routeHash.split("?")[1]).get("activityId") || undefined,
          sessionId: new URLSearchParams(routeHash.split("?")[1]).get("sessionId") || undefined,
          setCareerId,
          save,
          toast,
          refresh,
          retry: () => {
            void load();
          },
          requireAuth,
          completeAuth,
          clearUser,
          logout,
          loggingOut,
          search,
          setSearch,
          onboardingInterests,
          setOnboardingInterests,
          registerNavigationGuard,
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
        <div className="app-shell kc-refresh" data-page={page}>
          {menu && (
            <button
              className="sidebar-scrim"
              aria-label="메뉴 닫기"
              onClick={() => setMenu(false)}
            />
          )}
          <aside
            className={`app-sidebar ${menu ? "is-open" : ""}`}
            aria-label="주 메뉴"
            inert={compactMenu && !menu}
            aria-hidden={compactMenu && !menu ? true : undefined}
            ref={sidebarRef}
          >
            <button
              className="brand-button"
              aria-label="KingCareer 홈"
              onClick={() => {
                void go("home");
              }}
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
            <div className="workspace-label">나의 진로 탐험</div>
            <nav aria-label="주요 활동">
              {nav.map((item) => (
                <button
                  key={item.id}
                  aria-current={activeNav === item.id ? page === item.id ? "page" : "location" : undefined}
                  className={`nav-item ${activeNav === item.id ? "active" : ""}`}
                  onClick={() => {
                    void go(item.id);
                  }}
                >
                  {activeNav === item.id && (
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
                  <img
                    className="nav-asset"
                    src={`/brand/03_icons/${item.icon}.svg`}
                    alt=""
                  />
                  <span>{item.title}</span>
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <a
                className="intro-link"
                href="/"
                onClick={async (e) => {
                  e.preventDefault();
                  if (!guard.current || (await guard.current()))
                    location.assign("/");
                }}
              >
                KingCareer 소개
                <ArrowUpRight size={15} />
              </a>
              <button
                className="sidebar-profile"
                aria-current={page === "profile" ? "page" : undefined}
                onClick={() => {
                  void go(user ? "profile" : "auth");
                }}
              >
                <img
                  className="avatar"
                  src="/brand/00_brand/brand_avatar.png"
                  alt=""
                />
                <span>
                  <b>{user ? state.profile.name : "나의 계정으로 시작"}</b>
                  <small>
                    {user ? "프로필 · 기록 · 설정" : "경험을 차곡차곡 저장해 봐"}
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
                {page !== "simulation" && <form
                  className="global-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearch(searchInput);
                    void go("simulation");
                  }}
                >
                  <Search size={16} />
                  <input
                    aria-label="직업 검색"
                    placeholder="어떤 직업이 궁금해?"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </form>}
                {user ? (
                  <>
                    {state.profile.notifications && (
                      <button
                        className="icon-button notification-button"
                        aria-label="내 경험 안내 보기"
                        onClick={() => setNotice(true)}
                      >
                        <Compass size={20} />
                      </button>
                    )}
                    <button
                      className="profile-avatar-button"
                      aria-label="내 프로필"
                      onClick={() => {
                        void go("profile");
                      }}
                    >
                      <img
                        src="/brand/02_expressions/expression_02.png"
                        alt=""
                      />
                    </button>
                  </>
                ) : (
                  <button
                    className="login-link"
                    onClick={() => {
                      void go("auth");
                    }}
                  >
                    로그인
                    <LogIn size={16} />
                  </button>
                )}
              </div>
            </header>
            <main
              className="main-content"
              id="main-content"
              inert={loggingOut}
              tabIndex={-1}
              ref={mainRef}
            >
              <ActivityHelp topic={page === "simulation" || page === "projects" ? page : undefined} />
              {logoutError && (
                <div className="logout-error" role="alert">
                  {logoutError}
                  <button disabled={loggingOut} onClick={() => void logout()}>
                    다시 시도
                  </button>
                </div>
              )}
              {error && (
                <div className="server-error" role="alert">
                  <AlertCircle size={20} />
                  <p>
                    {error}
                    <small>
                      저장하지 못한 입력은 현재 화면에서 유지해 주세요.
                    </small>
                  </p>
                  <button
                    onClick={() => {
                      void load();
                    }}
                    disabled={loading}
                  >
                    <RotateCcw size={16} />
                    다시 연결
                  </button>
                </div>
              )}
              {loading && !user ? (
                <div className="loading-state" role="status">
                  <img src="/brand/01_mascots/mascot_07_read.png" alt="" />
                  <p>나의 탐험 공간을 준비하고 있어요.</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${routeHash}-${user?.username ?? "guest"}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    {privatePages.includes(page) && !user ? (
                      <Empty
                        title="나의 이름으로 경험을 쌓아봐"
                        action="로그인·회원가입"
                        onClick={() => {
                          requireAuth();
                        }}
                      >
                        진단과 활동 기록은 내 계정에 안전하게 보관돼요.
                      </Empty>
                    ) : (
                      pages[page]
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
              <footer className="footer">
                <span>
                  KingCareer<span>경험이 모여, 나의 가능성이 되다.</span>
                </span>
                <span>직무체험 · 프로젝트 · 나의 포트폴리오</span>
              </footer>
            </main>
          </div>
        </div>
        <AnimatePresence>
          {message && (
            <motion.div
              className="toast"
              role="status"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <CheckCircle2 size={20} />
              {message}
            </motion.div>
          )}
          {notice && (
            <Modal title="나의 경험 안내" onClose={closeNotice}>
              <div className="notice-item">
                <img
                  className="guide-mascot"
                  src="/brand/01_mascots/mascot_02_cheer.png"
                  alt=""
                />
                <div>
                  <h3>다음 가능성이 기다리고 있어요</h3>
                  <p>
                    {state.activities.length
                      ? `${state.activities.length}개의 경험을 기록했어요. 다음 경험도 이어가 볼까요?`
                      : "첫 체험을 시작하고 나의 이야기를 남겨봐요."}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setNotice(false);
                  void go("recommendation");
                }}
              >
                다음 경험 살펴보기
                <ArrowUpRight size={17} />
              </Button>
              <p className="fine-print">
                저장한 활동을 바탕으로 다음 경험을 찾아드려요.
              </p>
            </Modal>
          )}
        </AnimatePresence>
      </StoreContext.Provider>
    </MotionConfig>
  );
}
