import type { Recommendation, StartingPoint } from "../data";
import { useApp } from "../store";
import { Button, Tag } from "../components";
import { ArrowRight } from "lucide-react";

export default function StartingPointCard({ point, next }: {
  point: StartingPoint;
  next?: Recommendation | null;
}) {
  const { go } = useApp();
  const kind = next?.kind ?? point.firstActivity;
  return (
    <section className="starting-point-card" aria-label="진단으로 정한 나의 출발점">
      <Tag color="purple">{point.label}</Tag>
      <h2>{point.summary}</h2>
      <p>{point.reason}</p>
      {next && <p className="starting-point-next"><b>지금 이어갈 경험</b><br />{next.reason.replace(point.reason, "").trim()}</p>}
      <p>{point.followUp}</p>
      <div className="button-row">
        <Button onClick={() => go(kind === "project" ? "projects" : kind, point.careerId)}>
          {kind === "project" ? "추천 프로젝트 만들기" : kind === "discovery" ? "직업 더 알아보기" : "추천 직무체험 시작"}
          <ArrowRight size={17} />
        </Button>
        <Button kind="ghost" onClick={() => go("map", point.careerId)}>경험지도 보기</Button>
      </div>
      <small>내가 답한 경험을 바탕으로 정한 출발점이야. 실제 활동 기록과는 따로 관리해.</small>
    </section>
  );
}
