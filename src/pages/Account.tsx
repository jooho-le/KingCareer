import { useCallback, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  Heart,
  LogOut,
  LockKeyhole,
  AlertCircle,
  Bookmark,
  ChevronDown,
  CircleHelp,
  History,
  Settings2,
  UserRound,
} from "lucide-react";
import {
  Button,
  CareerCard,
  Empty,
  HeroArt,
  JobIcon,
  Modal,
  PageHeading,
  Steps,
  Tag,
} from "../components";
import { careers, fields, getCareer, initialState } from "../data";
import type { Profile } from "../data";
import { useApp } from "../store";
import { api, json, errorMessage } from "../api";
import ExperienceMap from "./ExperienceMap";
import { ActivityHelpSettings } from "../fieldwork/ActivityHelp";
import "./profile-page.css";

function profilePayload(profile: Profile) {
  return {
    name: profile.name.trim(),
    school: profile.school,
    grade: profile.grade,
    region: profile.region,
    interests: profile.interests,
    notifications: profile.notifications,
  };
}
function FormError({ message }: { message: string }) {
  return message ? (
    <div className="form-error" role="alert">
      <AlertCircle size={17} />
      <span>{message}</span>
    </div>
  ) : null;
}

export function Onboarding() {
  const { state, user, go, setOnboardingInterests, refresh, toast } = useApp();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState(state.profile.interests);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const select = (field: string) =>
    setInterests((items) =>
      field === fields[5]
        ? [field]
        : items.includes(field)
          ? items.filter((x) => x !== field)
          : [...items.filter((x) => x !== fields[5]), field],
    );
  const finish = async () => {
    setError("");
    if (!user) {
      setOnboardingInterests(interests);
      go("auth");
      return;
    }
    setBusy(true);
    try {
      await api("/profile", json("PATCH", { interests }));
      await refresh();
      toast("관심분야를 저장했어요.");
      go("home");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="WELCOME TO KINGCAREER"
        title="경험의 주인공은, 바로 너"
        description="정해진 꿈이 없어도 괜찮아. 작은 경험부터 함께 시작해 보자."
      />
      <Steps current={step} labels={["KingCareer 만나기", "나의 관심 찾기"]} />
      {step === 0 ? (
        <section className="onboarding-hero">
          <div>
            <Tag color="orange">나의 가능성에 로그인</Tag>
            <h2>
              해보기 전에는
              <br />
              모르는 나의 세계.
            </h2>
            <p>
              직업의 하루를 경험하고, 작은 결과물을 만들고.
              <br />
              내가 좋아하는 일을 내 방식으로 찾아봐.
            </p>
            <div className="intro-points">
              <span>
                <Check size={17} />
                체험을 마치면 남는 나의 수료 카드
              </span>
              <span>
                <Check size={17} />
                선택하며 배우는 직무 시뮬레이션
              </span>
              <span>
                <Check size={17} />내 손으로 만드는 미니 프로젝트
              </span>
            </div>
            <Button onClick={() => setStep(1)}>
              나의 탐험 준비하기
              <ArrowRight size={17} />
            </Button>
          </div>
          <HeroArt />
        </section>
      ) : (
        <section className="panel onboarding-panel">
          <div className="onboarding-question">
            <img src="/brand/01_mascots/mascot_01_explore.png" alt="" />
            <div>
              <h2>조금이라도 궁금한 분야가 있어?</h2>
              <p>여러 개 골라도, 아직 몰라도 좋아. 나중에 바꿀 수 있어.</p>
            </div>
          </div>
          <div className="interest-options">
            {fields.map((field, index) => (
              <button
                key={field}
                className={interests.includes(field) ? "selected" : ""}
                aria-pressed={interests.includes(field)}
                onClick={() => select(field)}
              >
                {index < 5 ? (
                  <JobIcon id={careers[index].id} />
                ) : (
                  <Heart size={24} />
                )}
                <span>{field}</span>
                {interests.includes(field) && <Check size={18} />}
              </button>
            ))}
          </div>
          <FormError message={error} />
          <div className="form-actions">
            <Button kind="ghost" disabled={busy} onClick={() => setStep(0)}>
              <ArrowLeft size={17} />
              이전
            </Button>
            <Button
              disabled={!interests.length || busy}
              onClick={() => {
                void finish();
              }}
            >
              {busy ? "관심을 저장하는 중…" : "이 관심으로 시작하기"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      )}
    </>
  );
}

export function Auth() {
  const { user, go, onboardingInterests, completeAuth, toast } = useApp();
  const [mode, setMode] = useState<"login" | "signup">(
    onboardingInterests.length ? "signup" : "login",
  );
  const [profile, setProfile] = useState<Profile>({
    ...initialState.profile,
    name: "",
    interests: onboardingInterests,
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setError("");
    if (mode === "signup" && password !== confirm) {
      setError("비밀번호가 서로 달라요. 다시 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await api(
        `/auth/${mode === "signup" ? "register" : "login"}`,
        json("POST", {
          username: username.trim(),
          password,
          ...(mode === "signup"
            ? {
                name: profile.name.trim(),
                school: profile.school,
                grade: profile.grade,
                region: profile.region,
                interests: profile.interests,
              }
            : {}),
        }),
      );
      setPassword("");
      setConfirm("");
      await completeAuth();
      toast(
        mode === "signup"
          ? "KingCareer에 온 걸 환영해!"
          : "다시 돌아왔구나. 탐험을 이어가 보자.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="YOUR NEXT CHAPTER"
        title="나의 이름으로, 새로운 시작"
        description="작은 발견부터 완성한 프로젝트까지. 내 계정에 차곡차곡 쌓아봐."
      />
      <div className="auth-layout">
        <section className="auth-side">
          <span className="eyebrow">HELLO, KINGCAREER</span>
          <h2>
            가능성의 주인공은
            <br />
            언제나 너야.
          </h2>
          <HeroArt />
          <p>
            하나의 정답보다, 여러 번의 경험.
            <br />
            너만의 진로 이야기를 시작해 봐.
          </p>
        </section>
        <section className="panel auth-form">
          {user ? (
            <>
              <Tag color="blue">로그인되어 있어요</Tag>
              <h2>{user.name}, 반가워!</h2>
              <div className="return-profile">
                <img
                  className="avatar"
                  src="/brand/00_brand/brand_avatar.png"
                  alt=""
                />
                <div>
                  <b>{user.username}</b>
                  <p>내 계정으로 경험을 이어갈 수 있어요.</p>
                </div>
              </div>
              <Button className="full-width" onClick={() => go("home")}>
                홈으로
                <ArrowRight size={17} />
              </Button>
              <Button
                className="full-width"
                kind="ghost"
                onClick={() => go("profile")}
              >
                계정 설정
              </Button>
            </>
          ) : (
            <>
              <div className="filter-tabs">
                <button
                  className={mode === "login" ? "selected" : ""}
                  disabled={busy}
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  로그인
                </button>
                <button
                  className={mode === "signup" ? "selected" : ""}
                  disabled={busy}
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                >
                  회원가입
                </button>
              </div>
              <h2>
                {mode === "signup"
                  ? "너의 이야기를 들려줘"
                  : "다시 만나서 반가워!"}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <label className="form-field">
                  아이디
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    maxLength={32}
                    autoComplete="username"
                    pattern={"[A-Za-z0-9_.\\-]+"}
                    placeholder="영문·숫자 3–32자, _ . - 사용 가능"
                    disabled={busy}
                  />
                </label>
                <label className="form-field">
                  비밀번호
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder="8자 이상 입력해 주세요"
                    disabled={busy}
                  />
                </label>
                {mode === "signup" && (
                  <>
                    <label className="form-field">
                      비밀번호 확인
                      <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        placeholder="한 번 더 입력해 주세요"
                        disabled={busy}
                      />
                    </label>
                    <label className="form-field">
                      닉네임
                      <input
                        value={profile.name}
                        onChange={(e) =>
                          setProfile({ ...profile, name: e.target.value })
                        }
                        required
                        minLength={1}
                        maxLength={40}
                        autoComplete="nickname"
                        placeholder="어떤 이름으로 불러줄까?"
                        disabled={busy}
                      />
                    </label>
                    <p className="fine-print">
                      학교·학년·지역은 가입 후 마이페이지에서 편하게 알려줘.
                    </p>
                  </>
                )}
                <FormError message={error} />
                <Button className="full-width" type="submit" disabled={busy}>
                  {busy
                    ? "계정을 확인하는 중…"
                    : mode === "signup"
                      ? "나의 탐험 시작하기"
                      : "로그인하고 이어하기"}
                  <ArrowRight size={17} />
                </Button>
                <p className="fine-print">
                  이메일을 수집하지 않는 학생 계정이에요. 현재 이메일·소셜
                  로그인과 자동 비밀번호 찾기는 제공하지 않아요.
                </p>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function ProfileFields({
  profile,
  onChange,
  disabled = false,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="profile-fields">
      <label className="form-field">
        닉네임
        <input
          required
          value={profile.name}
          onChange={(e) => onChange({ ...profile, name: e.target.value })}
          placeholder="어떤 이름으로 불러줄까?"
          minLength={1}
          maxLength={40}
          autoComplete="nickname"
        />
      </label>
      <label className="form-field">
        학교 <span className="optional">선택</span>
        <input
          value={profile.school}
          onChange={(e) => onChange({ ...profile, school: e.target.value })}
          placeholder="학교를 입력해 주세요"
          maxLength={50}
        />
      </label>
      <div className="two-column">
        <label className="form-field">
          학년
          <select
            value={profile.grade}
            onChange={(e) => onChange({ ...profile, grade: e.target.value })}
          >
            <option value="">선택 안 함</option>
            {[
              "중학교 1학년",
              "중학교 2학년",
              "중학교 3학년",
              "고등학교 1학년",
              "고등학교 2학년",
              "고등학교 3학년",
              "기타",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          거주지역
          <select
            value={profile.region}
            onChange={(e) => onChange({ ...profile, region: e.target.value })}
          >
            <option value="">선택 안 함</option>
            {[
              "전주",
              "군산",
              "익산",
              "정읍",
              "남원",
              "김제",
              "완주",
              "진안",
              "무주",
              "장수",
              "임실",
              "순창",
              "고창",
              "부안",
              "기타",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="interest-fieldset">
        <legend>관심분야</legend>
        <div className="chip-list">
          {fields.map((field) => (
            <button
              type="button"
              key={field}
              className={`interest-chip ${profile.interests.includes(field) ? "selected" : ""}`}
              aria-pressed={profile.interests.includes(field)}
              onClick={() =>
                onChange({
                  ...profile,
                  interests:
                    field === fields[5]
                      ? [field]
                      : profile.interests.includes(field)
                        ? profile.interests.filter((x) => x !== field)
                        : [
                            ...profile.interests.filter((x) => x !== fields[5]),
                            field,
                          ],
                })
              }
            >
              {field}
            </button>
          ))}
        </div>
      </fieldset>
    </fieldset>
  );
}

export function ProfilePage() {
  const { state, go, save, refresh, clearUser, toast, logout, loggingOut } =
    useApp();
  const [profile, setProfile] = useState(state.profile);
  const [tab, setTab] = useState(() => {
    const value = new URLSearchParams(location.hash.split("?")[1]).get("tab");
    return value && ["profile", "records", "saved", "settings"].includes(value) ? value : "profile";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteKind, setDeleteKind] = useState<"records" | "account" | null>(
    null,
  );
  const [deletePassword, setDeletePassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const close = useCallback(() => {
    setDeleteKind(null);
    setDeletePassword("");
    setError("");
  }, []);
  const saveProfile = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/profile", json("PATCH", profilePayload(profile)));
      try {
        await refresh();
      } catch {
        /* Top-level retry owns refresh failure. */
      }
      toast("지금의 나로 프로필을 저장했어요.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const toggleNotifications = async () => {
    setBusy(true);
    setError("");
    const notifications = !state.profile.notifications;
    try {
      await api("/profile", json("PATCH", { notifications }));
      setProfile((p) => ({ ...p, notifications }));
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const changePassword = async () => {
    setError("");
    if (newPassword !== repeatPassword) {
      setError("새 비밀번호가 서로 달라요.");
      return;
    }
    setBusy(true);
    try {
      await api(
        "/auth/password",
        json("POST", { currentPassword, newPassword }),
      );
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      toast("비밀번호를 변경했어요.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      if (deleteKind === "account") {
        await api(
          "/auth/account",
          json("DELETE", { password: deletePassword }),
        );
        clearUser();
        go("auth");
        toast("계정과 연결된 기록을 삭제했어요.");
      } else {
        await api("/records", json("DELETE"));
        await refresh();
        toast("계정은 유지하고 학습 기록을 삭제했어요.");
      }
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="kc-profile-page">
      <header className="profile-identity">
        <div className="profile-portrait" aria-hidden="true">
          <img src="/brand/00_brand/brand_avatar.png" alt="" />
        </div>
        <div className="profile-identity-copy">
          <span className="profile-kicker">MY SPACE</span>
          <h1>{state.profile.name}의 프로필</h1>
          <p className="profile-handle">@{state.profile.username}</p>
          <p>지금의 관심과 경험을, 나답게 모아봐.</p>
        </div>
        <div className="profile-account-actions">
          <Button kind="white" onClick={() => go("portfolio")}>
            내 포트폴리오
            <ArrowUpRight size={17} />
          </Button>
          <Button
            kind="ghost"
            disabled={busy || loggingOut}
            onClick={() => void logout()}
          >
            <LogOut size={16} />
            {loggingOut ? "로그아웃 중…" : "로그아웃"}
          </Button>
        </div>
      </header>
      <nav className="profile-nav" aria-label="프로필 메뉴">
        {[
          { id: "profile", label: "내 프로필", icon: UserRound },
          { id: "records", label: "진로 기록", icon: History },
          { id: "saved", label: "저장한 직업", icon: Bookmark },
          { id: "settings", label: "설정", icon: Settings2 },
        ].map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "selected" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => {
              setTab(item.id);
              go("profile", undefined, item.id);
              setError("");
            }}
          >
            <item.icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
            {item.id === "saved" && state.saved.length > 0 && <span className="profile-saved-count">{state.saved.length}</span>}
          </button>
        ))}
      </nav>
      <div className="profile-content">
      {tab === "records" ? <ExperienceMap /> : tab === "profile" ? (
        <form
          className="panel profile-form"
          aria-labelledby="profile-edit-heading"
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          <header className="profile-section-heading">
            <span className="profile-section-icon"><UserRound size={21} aria-hidden="true" /></span>
            <div><h2 id="profile-edit-heading">나를 소개할게</h2><p>닉네임과 관심분야는 언제든 바꿀 수 있어.</p></div>
          </header>
          <ProfileFields
            profile={profile}
            onChange={setProfile}
            disabled={busy}
          />
          <FormError message={error} />
          <footer className="profile-save-row">
            <p>학교·학년·지역은 선택사항이야.</p>
            <Button type="submit" disabled={busy || !profile.name.trim()}>
              {busy ? "저장하는 중…" : error ? "다시 저장하기" : "변경사항 저장"}
              <Check size={17} />
            </Button>
          </footer>
        </form>
      ) : tab === "saved" ? (
        state.saved.length ? (
          <div className="career-grid three">
            {state.saved.map((id) => (
              <CareerCard
                key={id}
                career={getCareer(id)}
                saved
                onSave={() => save(id)}
                onOpen={() => go("simulation", id)}
              />
            ))}
          </div>
        ) : (
          <Empty
            title="눈길이 가는 직업을 모아봐"
            action="체험할 직업 둘러보기"
            onClick={() => go("simulation")}
          >
            직업 카드의 저장 버튼을 누르면 여기서 다시 만날 수 있어.
          </Empty>
        )
      ) : (
        <div className="profile-settings">
          {!deleteKind && <FormError message={error} />}
          <section className="panel settings-panel" aria-labelledby="profile-help-heading">
          <header className="profile-section-heading">
            <span className="profile-section-icon blue"><CircleHelp size={21} aria-hidden="true" /></span>
            <div><h2 id="profile-help-heading">내가 쓰기 편하게</h2><p>화면 안내를 다시 보고, 표시 방법을 정해봐.</p></div>
          </header>
          <ActivityHelpSettings />
          <div className="setting-row">
            <div>
              <h3>탐험 안내 표시</h3>
              <p>홈 상단에 탐험 안내 표시를 보여줘요.</p>
            </div>
            <button
              role="switch"
              aria-checked={state.profile.notifications}
              aria-label="탐험 안내 표시"
              className={`toggle ${state.profile.notifications ? "on" : ""}`}
              disabled={busy}
              onClick={() => {
                void toggleNotifications();
              }}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <h3>내 활동 보관하기</h3>
              <p>포트폴리오를 파일로 내려받을 수 있어요.</p>
            </div>
            <Button kind="secondary" onClick={() => go("portfolio")}>
              <Download size={17} />
              포트폴리오
            </Button>
          </div>
          </section>
          <section className="panel settings-panel profile-security" aria-labelledby="profile-account-heading">
          <header className="profile-section-heading">
            <span className="profile-section-icon"><LockKeyhole size={21} aria-hidden="true" /></span>
            <div><h2 id="profile-account-heading">계정과 기록 관리</h2><p>비밀번호를 바꾸거나 저장한 기록을 관리해.</p></div>
          </header>
          <details className="profile-password-details">
          <summary><LockKeyhole size={19} aria-hidden="true" /><span>비밀번호 변경</span><ChevronDown size={19} aria-hidden="true" /></summary>
          <form
            className="password-form"
            onSubmit={(e) => {
              e.preventDefault();
              void changePassword();
            }}
          >
            <label className="form-field">
              현재 비밀번호
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            <div className="two-column">
              <label className="form-field">
                새 비밀번호
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="form-field">
                새 비밀번호 확인
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
            <Button type="submit" kind="secondary" disabled={busy}>
              비밀번호 변경
            </Button>
          </form>
          </details>
          <div className="setting-row">
            <div>
              <h3>학습 기록 초기화</h3>
              <p>활동, 프로젝트 초안, 진단, 저장 직업을 삭제해요.</p>
            </div>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => {
                setError("");
                setDeleteKind("records");
              }}
            >
              기록 삭제
            </button>
          </div>
          <div className="setting-row">
            <div>
              <h3>계정 삭제</h3>
              <p>계정과 연결된 모든 기록을 삭제해요.</p>
            </div>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => {
                setError("");
                setDeleteKind("account");
              }}
            >
              계정 삭제
            </button>
          </div>
        </section>
        </div>
      )}
      </div>
      {deleteKind && (
        <Modal
          title={
            deleteKind === "account"
              ? "계정과 기록을 모두 삭제할까요?"
              : "학습 기록을 초기화할까요?"
          }
          onClose={close}
        >
          <p>
            {deleteKind === "account"
              ? "내 프로필과 활동, 프로젝트 초안, 시뮬레이션 진행 기록을 모두 삭제합니다."
              : "활동과 진단, 프로젝트 초안, 진행 중인 시뮬레이션, 저장한 직업을 삭제합니다. 계정과 프로필은 유지합니다."}{" "}
            삭제 후 복원할 수 없으니 필요한 기록은 먼저 내려받아 주세요.
          </p>
          {deleteKind === "account" && (
            <label className="form-field">
              현재 비밀번호
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
          <FormError message={error} />
          <div className="button-row">
            <Button kind="secondary" disabled={busy} onClick={close}>
              취소
            </Button>
            <Button
              kind="dark"
              disabled={busy || (deleteKind === "account" && !deletePassword)}
              onClick={() => {
                void remove();
              }}
            >
              {busy ? "삭제하는 중…" : "삭제 확인"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
