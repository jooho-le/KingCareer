import { ArrowLeft, ArrowRight, Check, Clock3 } from "lucide-react";
import { Button, Tag } from "../components";
import { useApp } from "../store";
import { getCareer } from "../data";
import { projectFor, workplaceFor } from "./workplaces";
import "./career-entry.css";

export default function CareerEntry({
  mode,
}: {
  mode: "simulation" | "project";
}) {
  const { careerId, requireAuth, go, catalog } = useApp();
  const job =
    catalog.find((career) => career.id === careerId) || getCareer(careerId);
  const workplace = workplaceFor(careerId);
  const project = projectFor(careerId);
  const isProject = mode === "project";
  const steps = isProject
    ? [
        "손그림 흐름도에 아이디어 그리기",
        "개선 이유와 확인 계획 남기기",
        "결과물을 포트폴리오에 모으기",
      ]
    : [
        "현장에서 단서 살펴보기",
        "조치를 고르고 변화 확인하기",
        "업무를 인계하고 경험 돌아보기",
      ];
  return (
    <div className={`career-entry entry-${mode}`}>
      <button
        className="career-entry-back"
        onClick={() => go(isProject ? "projects" : "simulation")}
      >
        <ArrowLeft size={18} />{" "}
        {isProject ? "프로젝트 목록" : "다른 직업 둘러보기"}
      </button>
      <section
        className="career-entry-hero"
        aria-labelledby="career-entry-title"
      >
        <div className="career-entry-copy">
          <Tag color={isProject ? "purple" : "blue"}>
            {job.title} · {isProject ? "미니 프로젝트" : "직무체험"}
          </Tag>
          <h1 id="career-entry-title">
            {isProject
              ? project.title
              : workplace?.title || "온실의 아침을 부탁해."}
          </h1>
          <p>
            {isProject
              ? project.brief
              : workplace?.brief ||
                "온실의 센서, 잎의 상태, 동료의 기록을 살펴보고 과열의 원인을 찾아봐요."}
          </p>
          <div className="career-entry-meta">
            <Clock3 size={17} />
            {isProject ? "예상 20–30분" : "약 10분 · 객관식으로 선택"}
          </div>
          <Button onClick={requireAuth}>
            {isProject ? "로그인하고 프로젝트 시작" : "로그인하고 체험 시작"}
            <ArrowRight size={18} />
          </Button>
          <small>
            처음이라면 로그인 화면에서 가입할 수 있어요. 선택한{" "}
            {isProject ? "프로젝트" : "직업"}으로 이어집니다.
          </small>
        </div>
        <div className="career-entry-character">
          <img
            src={`/brand/12_career_kingcrabs/${careerId}.png`}
            alt={`${job.title} 크랩`}
            width={380}
            height={380}
            fetchPriority="high"
          />
          <span>
            {isProject ? "나만의 작업실" : workplace?.room || "스마트팜 온실"}
          </span>
        </div>
      </section>
      <section className="career-entry-plan" aria-label="활동 안내">
        <div>
          <h2>{isProject ? "이번 프로젝트에서 할 일" : "오늘 맡게 될 일"}</h2>
          <p>
            {isProject
              ? "작성한 초안은 저장하고, 완성한 결과물은 다시 꺼내볼 수 있어요."
              : "교육용 시나리오에서 선택한 조치에 따라 현장의 변화와 결과를 확인해요."}
          </p>
        </div>
        <ol>
          {steps.map((step, i) => (
            <li key={step}>
              <span>0{i + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
        <p className="career-entry-record">
          <Check size={18} />
          {isProject
            ? "제출한 설계도와 설명이 나의 포트폴리오에 남아요."
            : "체험을 마치면 나의 수료 카드와 활동 기록을 확인할 수 있어요."}
        </p>
      </section>
    </div>
  );
}
