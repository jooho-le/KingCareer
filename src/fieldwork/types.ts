import type { SimulationSession } from "../api";
import type { CareerId } from "../data";
import type { Workplace } from "./workplaces";

export type FarmObject = {
  id: string;
  name: string;
  reading: string;
  detail: string;
};
export type FarmAction = {
  id: string;
  name: string;
  minutes: number;
  cost: number;
  temperature?: number;
  result: string;
  rationale?: string;
};
export type Fieldwork = {
  presentation?: Workplace;
  incidentId?: string;
  verificationOutcome?: {
    status: "unverified" | "rechecked" | "shared";
    finding: string;
    remaining: string[];
  };
  metricValue?: number;
  options: Record<string, { id: string; label: string }[]>;
  visual?: {
    action: string;
    ventOpen?: boolean;
    watering?: boolean;
    technician?: boolean;
    moisture?: number;
    tankLevel?: number;
  };
  schema: string;
  phase: "inspect" | "act" | "verify" | "handover" | "done";
  minutes: number;
  budget: number;
  temperature?: number;
  inspected: string[];
  objects: FarmObject[];
  actions: FarmAction[];
  comparison: string;
  action: FarmAction | null;
  verification: string;
  handover: string;
  ending: string | null;
  log: { kind: string; text: string; result?: string }[];
};
export type FarmSession = SimulationSession & {
  fieldwork?: Fieldwork;
  coachMode?: "ai" | "template";
};
export type Badge = {
  id: string;
  name: string;
  description: string;
  earnedReason?: string;
  art: string;
};
export type Certificate = {
  id: string;
  careerId: CareerId;
  name: string;
  date: string;
  title: string;
  summary: string;
  reflection: string;
  badges: Badge[];
  sessionId?: string;
};
export type Achievements = {
  certificates: Certificate[];
  badges: Badge[];
  availableBadges: Badge[];
};
export type DrawingScene = {
  elements: Record<string, unknown>[];
  appState?: { viewBackgroundColor: string };
  studio?: {
    kind: "login-recovery";
    version: 2;
    message: string;
    messagePosition: { x: number; y: number };
    retry: { label: string; target: "login" | "support" | null; x: number; y: number } | null;
    support: { label: string; target: "login" | "support" | null; x: number; y: number } | null;
    preserveInput: boolean | null;
  };
};

export function downloadFile(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
