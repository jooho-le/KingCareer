import { useEffect, useRef } from "react";
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
  Compass,
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
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M10 8v15c0 8 7 10 12 5l8-8M30 32V17c0-8-7-10-12-5l-8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
      </svg>
      <b>
        잇다<span>.</span>
      </b>
      <small>나의 가능성을 잇다</small>
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
        <Compass size={34} />
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
  onSave: () => void;
  onOpen: () => void;
  compact?: boolean;
}) {
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
          onClick={onSave}
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
  return (
    <div className={`job-art job-art-${id}`} aria-hidden="true">
      {id === "developer" ? (
        <>
          <div className="mini-screen">
            <span />
            <span />
            <span />
            <div>
              <Code2 size={52} />
            </div>
            <i />
          </div>
          <div className="floating-code">&lt;/&gt;</div>
          <div className="floating-square" />
        </>
      ) : id === "farmer" ? (
        <>
          <div className="plant-pot" />
          <Sprout className="plant-sprout" size={100} strokeWidth={2.1} />
          <div className="sensor">
            <span />
            24°<small>온실 온도</small>
          </div>
        </>
      ) : id === "nurse" ? (
        <>
          <div className="medical-bag">
            <div />
            <HeartPulse size={62} />
          </div>
          <div className="medical-cross">+</div>
        </>
      ) : id === "engineer" ? (
        <>
          <div className="car-platform" />
          <CarFront size={112} strokeWidth={1.7} />
          <div className="floating-code">GO</div>
        </>
      ) : (
        <>
          <FlaskConical size={105} strokeWidth={1.5} />
          <div className="food-circle" />
          <div className="floating-code">LAB</div>
        </>
      )}
    </div>
  );
}
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="hero-spark spark-one" />
      <div className="hero-spark spark-two" />
      <div className="floating-note note-one">
        <span />
        나의 가능성, 탐색 중
      </div>
      <div className="hero-ticket">
        <span>MY NEXT CHAPTER</span>
        <div className="ticket-face">
          <i />
          <i />
          <b />
        </div>
        <strong>
          HELLO,
          <br />
          FUTURE!
        </strong>
        <div className="ticket-bottom">
          무한한 가능성을 가진 나<ArrowUpRight size={23} />
        </div>
      </div>
      <div className="hero-sticker">
        <Compass size={34} />
      </div>
      <div className="floating-note note-two">어떤 내가 될까?</div>
      <div className="orange-shape" />
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
