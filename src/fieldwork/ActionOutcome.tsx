import { motion, useReducedMotion } from "motion/react";
import { Fan, Droplets, Wrench, ArrowRight } from "lucide-react";
import type { Fieldwork } from "./types";
export default function ActionOutcome({ field }: { field: Fieldwork }) {
  const reduced = useReducedMotion();
  if (!field.action) return null;
  const action = field.action.id;
  const workplace = field.presentation;
  const Icon = workplace
    ? Wrench
    : action === "water"
      ? Droplets
      : action === "escalate"
        ? Wrench
        : Fan;
  return (
    <motion.section
      className={`kc-action-outcome kc-effect-${action}`}
      role="status"
      key={action}
      initial={reduced ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="kc-action-illustration">
        <Icon size={38} />
        <span>
          {workplace
            ? "조치 반영"
            : action === "water"
              ? "급수 재현"
              : action === "escalate"
                ? "담당자 도착"
                : "창문 열림"}
        </span>
      </div>
      <div>
        <span className="kc-eyebrow">내 조치로 달라진 점</span>
        <h3>{field.action.name}</h3>
        {workplace ? (
          <div className="kc-reading-change">
            <span>
              {workplace.metric}{" "}
              <b>
                {workplace.before}
                {workplace.unit}
              </b>
            </span>
            <ArrowRight size={17} />
            <strong>
              {field.metricValue}
              {workplace.unit}
            </strong>
          </div>
        ) : (
          <div className="kc-reading-change">
            <span>
              온도 <b>33°C</b>
            </span>
            <ArrowRight size={17} />
            <strong>{field.temperature}°C</strong>
            <span>
              수분 <b>61%</b>
            </span>
            <ArrowRight size={17} />
            <strong>{action === "water" ? 74 : 61}%</strong>
          </div>
        )}
        <p>{field.action.result}</p>
        {field.verificationOutcome && (
          <div
            className={`kc-verification-outcome ${field.verificationOutcome.status === "unverified" ? "is-pending" : ""}`}
          >
            <strong>
              {field.verificationOutcome.status === "unverified"
                ? "아직 확인하지 않은 일"
                : "다시 확인하고 발견한 일"}
            </strong>
            <p>{field.verificationOutcome.finding}</p>
            <ul>
              {field.verificationOutcome.remaining.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <small>
          선택한 조치를 재현한 모습이에요. 장면과 수치는 저장된 결과를 보여줘요.
        </small>
      </div>
    </motion.section>
  );
}
