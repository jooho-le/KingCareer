import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  Clock3,
  X,
  Check,
  Code2,
  HeartPulse,
  Sprout,
  CarFront,
  FlaskConical,
} from "lucide-react";
import { motion } from "motion/react";
import type { Career, CareerId } from "./data";

export const jobIcons = {
  developer: Code2,
  nurse: HeartPulse,
  farmer: Sprout,
  engineer: CarFront,
  researcher: FlaskConical,
};
export function JobIcon({ id, size = 24 }: { id: CareerId; size?: number }) {
  const Icon = jobIcons[id];
  return <Icon size={size} strokeWidth={1.8} />;
}
export function Logo() {
  return (
    <span className="brand">
      <img src="/brand/03_icons/crown.svg" alt="" />
      <b>
        King<span>Career</span>
      </b>
      <small>경험으로 찾는 나의 가능성</small>
    </span>
  );
}
export function Button({
  children,
  onClick,
  kind = "primary",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "white" | "dark" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <motion.button
      type={type}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`button ${kind} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function SectionHeading({
  title,
  sub,
  onClick,
  action = "전체 보기",
}: {
  title: string;
  sub?: string;
  onClick?: () => void;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {onClick && (
        <button className="text-button" onClick={onClick}>
          {action}
          <ArrowUpRight size={17} />
        </button>
      )}
    </div>
  );
}
export function Tag({
  children,
  color = "purple",
}: {
  children: ReactNode;
  color?: string;
}) {
  return <span className={`tag ${color}`}>{children}</span>;
}
export function Empty({
  title,
  children,
  action,
  onClick,
}: {
  title: string;
  children: ReactNode;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <img src="/brand/01_mascots/mascot_08_guide.png" alt="" />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <Button onClick={onClick}>
          {action}
          <ArrowRight size={17} />
        </Button>
      )}
    </div>
  );
}
export function Progress({
  value,
  color = "purple",
}: {
  value: number;
  color?: string;
}) {
  return (
    <div
      className={`progress ${color}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, value)}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, select, a[href], [tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
export function CareerCard({
  career,
  saved,
  onSave,
  onOpen,
  compact = false,
}: {
  career: Career;
  saved: boolean;
  onSave: () => void | Promise<void>;
  onOpen: () => void;
  compact?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <motion.article
      className={`career-card ${compact ? "compact" : ""}`}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <div className={`career-art ${career.color}`}>
        <JobArt id={career.id} />
        <span className="art-label">{career.region}에서 만나는 직업</span>
        <button
          aria-label={`${career.title} ${saved ? "저장 취소" : "저장"}`}
          aria-pressed={saved}
          className={`save-button ${saved ? "saved" : ""}`}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave();
            } finally {
              setSaving(false);
            }
          }}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="career-card-body" onClick={onOpen}>
        <span className="card-kicker">{career.field}</span>
        <h3>
          {career.title}
          <ArrowUpRight size={20} />
        </h3>
        <p>{career.intro}</p>
        <div className="card-meta">
          <span>
            <Clock3 size={14} />약 10분
          </span>
          <span>
            직무체험 <ArrowRight size={14} />
          </span>
        </div>
      </button>
    </motion.article>
  );
}
export function JobArt({ id }: { id: CareerId }) {
  const asset = {
    developer: "developer",
    nurse: "nurse",
    farmer: "smartfarm",
    engineer: "automotive",
    researcher: "food_research",
  }[id];
  return (
    <div className={`career-scene scene-${id}`} aria-hidden="true">
      <img
        src={`/brand/05_career_illustrations/${asset}.svg`}
        alt=""
        loading="lazy"
      />
    </div>
  );
}
export function HeroArt() {
  return (
    <div className="king-hero-art" aria-hidden="true">
      <span className="king-hero-orbit" />
      <span className="king-hero-block" />
      <img
        className="king-main-mascot"
        src="/brand/01_mascots/mascot_00_original.png"
        alt=""
        fetchPriority="high"
      />
      <span className="king-hero-label label-explore">
        <img src="/brand/03_icons/compass.svg" alt="" />
        너의 다음 가능성
      </span>
      <span className="king-hero-label label-play">
        <img src="/brand/03_icons/simulation.svg" alt="" />
        오늘의 나, 플레이!
      </span>
    </div>
  );
}
export function Steps({
  current,
  labels,
}: {
  current: number;
  labels: string[];
}) {
  return (
    <div className="steps">
      {labels.map((label, i) => (
        <div className={i <= current ? "active" : ""} key={label}>
          <span>{i < current ? <Check size={15} /> : i + 1}</span>
          <b>{label}</b>
        </div>
      ))}
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div
      className="stat"
      style={{ "--stat-color": `var(--${color})` } as CSSProperties}
    >
      <span>{label}</span>
      <div>
        <strong>{value}</strong>
        <small>{unit}</small>
      </div>
    </div>
  );
}
