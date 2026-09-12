import type { SceneQuality } from "./SceneKit";

export type QualityPreference = "auto" | SceneQuality;
const STORAGE_KEY = "kingcareer.scene.quality";

export function readQualityPreference(): QualityPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "high" || stored === "balanced") return stored;
  } catch { /* Browser storage can be disabled; automatic mode still works. */ }
  return "auto";
}

export function saveQualityPreference(value: QualityPreference) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Optional preference. */ }
}

export function automaticQuality(): SceneQuality {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return window.matchMedia("(max-width: 900px), (prefers-reduced-motion: reduce)").matches ||
    (memory !== undefined && memory <= 4) ||
    (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
    ? "balanced" : "high";
}
