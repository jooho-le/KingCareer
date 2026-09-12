import { useCallback, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  GraduationCap,
  Heart,
  ShieldCheck,
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
  Progress,
  SectionHeading,
  Steps,
  Tag,
} from "../components";
import { careers, dateLabel, fields, getCareer } from "../data";
import type { CareerId, Profile } from "../data";
import { useApp } from "../store";

export function Onboarding() {
  const { state, setState, go } = useApp();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Profile["role"]>(state.profile.role);
  const [interests, setInterests] = useState<string[]>(state.profile.interests);
  const select = (field: string) =>
    setInterests((items) =>
      field === fields[5]
        ? [field]
        : items.includes(field)
          ? items.filter((x) => x !== field)
          : [...items.filter((x) => x !== fields[5]), field],
    );
  return (
    <>
      <PageHeading
        eyebrow="WELCOME TO ITDA"
        title="너의 가능성과 만나는 곳, 잇다"
        description="꿈을 정하지 않아도 괜찮아. 경험하면서 너를 알아가면 되니까."
      />
      <Steps
        current={step}
        labels={["잇다 만나기", "함께하는 사람", "나의 관심"]}
      />
      {step === 0 ? (
        <section className="onboarding-hero">
          <div>
            <Tag color="orange">진로는, 경험하고 선택하는 것</Tag>
            <h2>
              아직 만나지 못한
              <br />
              나의 세계를 잇다.
            </h2>
            <p>
              알고 있는 직업도, 직접 해본 일도 모두 다르니까.
              <br />
              잇다는 필요한 경험을 찾아 네가 직접 해보게 도와줘.
            </p>
            <div className="intro-points">
              <span>
                <Check size={17} />
                나를 알아가는 경험지도
              </span>
              <span>
                <Check size={17} />
                선택하며 배우는 직무체험
              </span>
              <span>
                <Check size={17} />
                결과물을 만드는 작은 프로젝트
              </span>
            </div>
            <Button kind="dark" onClick={() => setStep(1)}>
              잇다 시작하기
              <ArrowRight size={17} />
            </Button>
          </div>
          <HeroArt />
        </section>
      ) : step === 1 ? (
        <section className="panel onboarding-panel">
          <h2>어떤 모습으로 함께할까?</h2>
          <p>나에게 맞는 시작을 준비할게.</p>
          <div className="role-options">
            <button
              className={role === "student" ? "selected" : ""}
              onClick={() => setRole("student")}
            >
              <UserRound size={36} />
              <h3>학생</h3>
              <p>직접 해보며 나의 가능성을 찾고 싶어요.</p>
              {role === "student" && <Check size={20} />}
            </button>
            <button
              className={role === "teacher" ? "selected" : ""}
              onClick={() => setRole("teacher")}
            >
              <GraduationCap size={36} />
              <h3>교사 / 멘토</h3>
              <p>학생들의 다양한 경험을 함께하고 싶어요.</p>
              {role === "teacher" && <Check size={20} />}
            </button>
          </div>
          <div className="form-actions">
            <Button kind="ghost" onClick={() => setStep(0)}>
              <ArrowLeft size={17} />
              이전
            </Button>
            <Button onClick={() => setStep(2)}>
              다음
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      ) : (
        <section className="panel onboarding-panel">
          <h2>조금이라도 궁금한 분야가 있어?</h2>
          <p>여러 개 골라도, 아직 몰라도 괜찮아. 나중에 바꿀 수 있어.</p>
          <div className="interest-options">
            {fields.map((f, i) => (
              <button
                className={interests.includes(f) ? "selected" : ""}
                key={f}
                onClick={() => select(f)}
              >
                {i < 5 ? <JobIcon id={careers[i].id} /> : <Heart size={24} />}
                <span>{f}</span>
                {interests.includes(f) && <Check size={18} />}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <Button kind="ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={17} />
              이전
            </Button>
            <Button
              disabled={!interests.length}
              onClick={() => {
                setState((s) => ({
                  ...s,
                  profile: { ...s.profile, role, interests },
                }));
                go("auth");
              }}
            >
              이 관심으로 시작하기
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      )}
    </>
  );
}

export function Auth() {
  const { state, setState, go, toast } = useApp();
  const [mode, setMode] = useState<"signup" | "login" | "find">("signup");
  const [profile, setProfile] = useState(state.profile);
  return (
    <>
      <PageHeading
        eyebrow="YOUR OWN LITTLE SPACE"
        title="나의 이름으로, 탐험 시작"
        description="네가 쌓은 경험을 다시 찾아올 수 있도록."
      />
      <div className="auth-layout">
        <section className="auth-side">
          <span className="eyebrow">NICE TO MEET YOU</span>
          <h2>
            모든 가능성은
            <br />
            너에게서 시작해.
          </h2>
          <HeroArt />
          <p>
            발견하고, 경험하고, 선택하는
            <br />
            너만의 이야기를 함께할게.
          </p>
        </section>
        <section className="panel auth-form">
          <div className="filter-tabs">
            <button
              className={mode === "signup" ? "selected" : ""}
              onClick={() => setMode("signup")}
            >
              프로필 만들기
            </button>
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => setMode("login")}
            >
              다시 시작하기
            </button>
          </div>
          {mode === "signup" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setState((s) => ({
                  ...s,
                  profile: {
                    ...profile,
                    name: profile.name.trim(),
                    onboarded: true,
                  },
                }));
                toast("나만의 탐험 공간이 준비됐어요.");
                go(profile.role === "teacher" ? "teacher" : "home");
              }}
            >
              <h2>반가워, 어떤 이름으로 부를까?</h2>
              <ProfileFields profile={profile} onChange={setProfile} />
              <p className="local-notice">
                <ShieldCheck size={19} />
                체험판에서는 서버 계정 대신 이 브라우저에 프로필과 활동을
                저장해요. 비밀번호는 수집하지 않아요.
              </p>
              <Button
                className="full-width"
                type="submit"
                disabled={!profile.name.trim()}
              >
                나의 탐험 시작하기
                <ArrowRight size={17} />
              </Button>
            </form>
          ) : mode === "login" ? (
            <>
              <h2>돌아왔구나!</h2>
              {state.profile.onboarded ? (
                <>
                  <div className="return-profile">
                    <span className="avatar">
                      {state.profile.name.slice(0, 1)}
                    </span>
                    <div>
                      <b>{state.profile.name}</b>
                      <p>이 브라우저에 저장된 프로필</p>
                    </div>
                  </div>
                  <Button className="full-width" onClick={() => go("home")}>
                    이어서 탐험하기
                    <ArrowRight size={17} />
                  </Button>
                </>
              ) : (
                <Empty
                  title="이 브라우저에 저장된 프로필이 없어요"
                  action="프로필 만들기"
                  onClick={() => setMode("signup")}
                >
                  처음이라면 나의 이름부터 알려줘.
                </Empty>
              )}
              <button className="text-button" onClick={() => setMode("find")}>
                계정 찾기
              </button>
              <p className="fine-print">
                서버 로그인과 다른 기기 동기화는 아직 제공하지 않아요.
              </p>
            </>
          ) : (
            <>
              <h2>내 기록을 찾고 있나요?</h2>
              <p>
                이 체험판은 기록을 작성한 브라우저에 저장해요. 다른 기기를
                이용하고 있다면, 처음 사용한 기기와 브라우저로 접속해 주세요.
              </p>
              <p>
                브라우저 데이터를 삭제했다면 서버에서 복원할 수 없어요.
                포트폴리오에서 활동 기록을 파일로 보관할 수 있어요.
              </p>
              <Button kind="secondary" onClick={() => setMode("login")}>
                <ArrowLeft size={17} />
                돌아가기
              </Button>
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
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}) {
  return (
    <>
      <label className="form-field">
        이름 / 닉네임
        <input
          required
          value={profile.name === "탐험가" ? "" : profile.name}
          onChange={(e) => onChange({ ...profile, name: e.target.value })}
          placeholder="별명으로 시작해도 좋아요"
          maxLength={20}
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
            {[
              "중학교 1학년",
              "중학교 2학년",
              "중학교 3학년",
              "고등학교 1학년",
              "고등학교 2학년",
              "고등학교 3학년",
              "교사 / 멘토",
              "기타",
            ].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          거주지역
          <select
            value={profile.region}
            onChange={(e) => onChange({ ...profile, region: e.target.value })}
          >
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
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="form-field">
        사용자 유형
        <select
          value={profile.role}
          onChange={(e) =>
            onChange({ ...profile, role: e.target.value as Profile["role"] })
          }
        >
          <option value="student">학생</option>
          <option value="teacher">교사 / 멘토</option>
        </select>
      </label>
      <fieldset className="interest-fieldset">
        <legend>관심분야</legend>
        <div className="chip-list">
          {fields.map((f) => (
            <button
              type="button"
              className={`interest-chip ${profile.interests.includes(f) ? "selected" : ""}`}
              key={f}
              aria-pressed={profile.interests.includes(f)}
              onClick={() =>
                onChange({
                  ...profile,
                  interests:
                    f === fields[5]
                      ? [f]
                      : profile.interests.includes(f)
                        ? profile.interests.filter((x) => x !== f)
                        : [
                            ...profile.interests.filter((x) => x !== fields[5]),
                            f,
                          ],
                })
              }
            >
              {f}
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function ProfilePage() {
  const { state, setState, go, save, toast } = useApp();
  const [profile, setProfile] = useState(state.profile);
  const [tab, setTab] = useState("profile");
  const [reset, setReset] = useState(false);
  const close = useCallback(() => setReset(false), []);
  return (
    <>
      <PageHeading
        eyebrow="MY OWN CORNER"
        title="나를 조금 더, 나답게"
        description="관심은 언제든 바뀌어도 좋아. 지금의 나를 알려줘."
      />
      <div className="profile-banner">
        <span className="avatar large-avatar">
          {state.profile.name.slice(0, 1)}
        </span>
        <div>
          <Tag>
            {state.profile.role === "teacher"
              ? "함께하는 멘토"
              : "가능성을 탐험하는 중"}
          </Tag>
          <h2>{state.profile.name}</h2>
          <p>
            {state.profile.school || "나의 탐험 공간"} · {state.profile.region}
          </p>
        </div>
        <Button kind="white" onClick={() => go("portfolio")}>
          내 활동 기록
          <ArrowUpRight size={17} />
        </Button>
      </div>
      <div className="filter-tabs">
        {[
          { id: "profile", text: "내 프로필" },
          { id: "saved", text: `저장한 직업 ${state.saved.length}` },
          { id: "settings", text: "알림·계정 설정" },
        ].map((t) => (
          <button
            className={tab === t.id ? "selected" : ""}
            key={t.id}
            onClick={() => setTab(t.id)}
          >
            {t.text}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <form
          className="panel profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            setState((s) => ({
              ...s,
              profile: {
                ...profile,
                name: profile.name.trim(),
                onboarded: true,
              },
            }));
            toast("지금의 나로 프로필을 업데이트했어요.");
          }}
        >
          <SectionHeading title="내 프로필과 관심" />
          <ProfileFields profile={profile} onChange={setProfile} />
          <Button type="submit" disabled={!profile.name.trim()}>
            변경사항 저장
            <Check size={17} />
          </Button>
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
            action="직업 발견하러 가기"
            onClick={() => go("discovery")}
          >
            직업 카드의 저장 버튼을 누르면 여기서 다시 만날 수 있어.
          </Empty>
        )
      ) : (
        <section className="panel settings-panel">
          <SectionHeading title="내가 편한 방식으로" />
          <div className="setting-row">
            <div>
              <h3>탐험 안내 알림</h3>
              <p>홈 상단에 탐험 안내 표시를 보여줘요.</p>
            </div>
            <button
              role="switch"
              aria-checked={state.profile.notifications}
              aria-label="탐험 안내 알림"
              className={`toggle ${state.profile.notifications ? "on" : ""}`}
              onClick={() => {
                setState((s) => ({
                  ...s,
                  profile: {
                    ...s.profile,
                    notifications: !s.profile.notifications,
                  },
                }));
                setProfile((p) => ({
                  ...p,
                  notifications: !state.profile.notifications,
                }));
              }}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <h3>내 활동 보관하기</h3>
              <p>포트폴리오에서 텍스트 파일로 내려받을 수 있어요.</p>
            </div>
            <Button kind="secondary" onClick={() => go("portfolio")}>
              <Download size={17} />
              포트폴리오
            </Button>
          </div>
          <div className="setting-row">
            <div>
              <h3>프로필 화면으로 돌아가기</h3>
              <p>이 기기의 기록은 계속 보관돼요.</p>
            </div>
            <Button kind="secondary" onClick={() => go("auth")}>
              프로필 선택
            </Button>
          </div>
          <div className="setting-row">
            <div>
              <h3>이 브라우저의 기록 삭제</h3>
              <p>프로필, 활동, 프로젝트 초안과 저장한 직업을 지워요.</p>
            </div>
            <button className="danger-button" onClick={() => setReset(true)}>
              기록 삭제
            </button>
          </div>
        </section>
      )}
      {reset && (
        <Modal title="이 기기의 기록을 모두 지울까요?" onClose={close}>
          <p>
            활동 {state.activities.length}개와 프로필, 프로젝트 초안, 저장한
            직업을 삭제해요. 서버에 사본이 없어 복원할 수 없어요.
          </p>
          <div className="button-row">
            <Button kind="secondary" onClick={close}>
              취소
            </Button>
            <Button
              kind="dark"
              onClick={() => {
                localStorage.removeItem("itda-career-v1");
                window.location.hash = "home";
                window.location.reload();
              }}
            >
              기록 모두 삭제
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

const students = [
  {
    id: "student-a",
    name: "김하늘",
    grade: "중학교 2학년",
    interest: "IT·소프트웨어",
    career: "developer" as CareerId,
    activities: 2,
    scores: [70, 30, 20, 35, 40, 0],
    before: [35, 15, 0, 10, 40, 0],
  },
  {
    id: "student-b",
    name: "이도윤",
    grade: "중학교 3학년",
    interest: "농업·스마트팜",
    career: "farmer" as CareerId,
    activities: 4,
    scores: [75, 60, 55, 50, 30, 25],
    before: [40, 25, 15, 25, 30, 25],
  },
  {
    id: "student-c",
    name: "박서연",
    grade: "고등학교 1학년",
    interest: "의료·보건",
    career: "nurse" as CareerId,
    activities: 1,
    scores: [45, 20, 10, 20, 50, 0],
    before: [20, 10, 0, 10, 50, 0],
  },
];
export function Teacher() {
  const { state, setState, toast } = useApp();
  const [selected, setSelected] = useState(students[0]);
  const [filter, setFilter] = useState("all");
  const [career, setCareer] = useState<CareerId>("developer");
  const [report, setReport] = useState(false);
  const close = useCallback(() => setReport(false), []);
  const assigned = state.assignments.filter((a) => a.student === selected.id);
  const assign = () => {
    setState((s) => ({
      ...s,
      assignments: [
        {
          student: selected.id,
          careerId: career,
          date: new Date().toISOString(),
        },
        ...s.assignments,
      ],
    }));
    toast(`${selected.name} 예시 학생에게 활동 배정을 기록했어요.`);
  };
  return (
    <>
      <PageHeading
        eyebrow="GROW TOGETHER"
        title="서로 다른 출발점, 함께하는 성장"
        description="학생에게 필요한 경험을 발견하고, 다음 걸음을 함께해 주세요."
      >
        <Tag color="orange">가상 학생 데이터</Tag>
      </PageHeading>
      <div className="teacher-notice">
        <ShieldCheck size={20} />
        <p>
          교사 화면의 사용 흐름을 확인하는 데모예요. 아래 학생은 모두 가상이며,
          활동 배정은 이 브라우저에만 저장돼요.
        </p>
      </div>
      <div className="stats-row">
        <div className="stat">
          <span>예시 학생</span>
          <div>
            <strong>3</strong>
            <small>명</small>
          </div>
        </div>
        <div className="stat">
          <span>활동 경험 30 미만</span>
          <div>
            <strong>2</strong>
            <small>명</small>
          </div>
        </div>
        <div className="stat">
          <span>기록한 활동 배정</span>
          <div>
            <strong>{state.assignments.length}</strong>
            <small>건</small>
          </div>
        </div>
      </div>
      <div className="teacher-layout">
        <section className="panel">
          <SectionHeading title="학생 목록" />
          <div className="filter-tabs">
            <button
              className={filter === "all" ? "selected" : ""}
              onClick={() => setFilter("all")}
            >
              전체
            </button>
            <button
              className={filter === "gap" ? "selected" : ""}
              onClick={() => setFilter("gap")}
            >
              경험 공백 확인
            </button>
          </div>
          {students
            .filter((s) => filter === "all" || s.scores[2] < 30)
            .map((s) => (
              <button
                className={`student-card ${selected.id === s.id ? "selected" : ""}`}
                key={s.id}
                onClick={() => {
                  setSelected(s);
                  setCareer(s.career);
                }}
              >
                <span className="avatar">{s.name.slice(1, 2)}</span>
                <div>
                  <b>{s.name}</b>
                  <small>
                    {s.grade} · {s.interest}
                  </small>
                </div>
                <ArrowRight size={17} />
              </button>
            ))}
        </section>
        <section className="panel">
          <SectionHeading
            title={`${selected.name} 학생의 경험`}
            sub={`예시 활동 ${selected.activities}개 · ${selected.interest}`}
          />
          <div className="dimension-list">
            {[
              "직업 인식",
              "직무 이해",
              "활동 경험",
              "역량 이해",
              "학과 이해",
              "현직자 교류",
            ].map((label, i) => (
              <div key={label}>
                <div>
                  <span>{label}</span>
                  <b>{selected.scores[i]}</b>
                </div>
                <Progress
                  value={selected.scores[i]}
                  color={i % 2 ? "purple" : "orange"}
                />
              </div>
            ))}
          </div>
          <div className="teacher-assign">
            <h3>다음 활동 배정</h3>
            <label className="form-field">
              추천 직무체험
              <select
                value={career}
                onChange={(e) => setCareer(e.target.value as CareerId)}
              >
                {careers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.title}의 하루
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <Button onClick={assign}>
                활동 배정 기록
                <Check size={17} />
              </Button>
              <Button kind="secondary" onClick={() => setReport(true)}>
                변화 리포트
                <ArrowUpRight size={17} />
              </Button>
            </div>
          </div>
          <h3>배정한 활동</h3>
          {assigned.length ? (
            assigned.map((a, i) => (
              <div className="assignment-row" key={a.date + i}>
                <Check size={16} />
                {getCareer(a.careerId).title}의 하루
                <span>{dateLabel(a.date)}</span>
              </div>
            ))
          ) : (
            <p className="muted">아직 배정한 활동이 없어요.</p>
          )}
        </section>
      </div>
      {report && (
        <Modal title={`${selected.name} 학생의 변화 리포트`} onClose={close}>
          <Tag color="orange">가상 보고서 예시</Tag>
          <h3>활동 전후 변화</h3>
          <div className="change-grid">
            {["직무 이해", "활동 경험", "역량 이해"].map((d, i) => (
              <div key={d}>
                <span>{d}</span>
                <p>
                  <small>{selected.before[i + 1]}</small>
                  <ArrowRight size={15} />
                  <strong>{selected.scores[i + 1]}</strong>
                </p>
              </div>
            ))}
          </div>
          <h3>함께 이야기해 볼 질문</h3>
          <p>“직접 해보면서 예상과 달랐던 점은 무엇이었나요?”</p>
          <h3>다음 경험 방향</h3>
          <p>
            {selected.scores[2] < 30
              ? "직무 시뮬레이션과 작은 프로젝트로 실제 업무의 과정을 탐색하도록 제안해요."
              : "체험에서 생긴 질문을 정리하고 현직자에게 물어볼 기회를 탐색해요."}
          </p>
        </Modal>
      )}
    </>
  );
}
