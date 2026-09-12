import type { DrawingScene } from "./types";

export type StepCard = { id: string; title: string; detail: string };
type StepMetadata = { schema: number; order: number };

export function stepMetadata(
  element: Record<string, unknown>,
): StepMetadata | null {
  const data = element.customData as
    { kingCareerStep?: StepMetadata } | undefined;
  const step = data?.kingCareerStep;
  return step?.schema === 1 && Number.isFinite(step.order) ? step : null;
}

// The visible text is the source of truth, including edits made in the drawing editor.
export function readStepCards(scene: DrawingScene | null): StepCard[] {
  if (!scene) return [];
  return scene.elements
    .filter(
      (element) =>
        !element.isDeleted &&
        element.type === "rectangle" &&
        stepMetadata(element),
    )
    .sort((a, b) => stepMetadata(a)!.order - stepMetadata(b)!.order)
    .map((element) => {
      const label = scene.elements.find(
        (candidate) =>
          !candidate.isDeleted &&
          candidate.type === "text" &&
          candidate.containerId === element.id,
      );
      const [title = "", ...lines] = String(
        label?.originalText ?? label?.text ?? "",
      ).split("\n");
      return { id: String(element.id), title, detail: lines.join("\n") };
    });
}

export function preferredAuthoringMode(
  scene: DrawingScene | null,
): "cards" | "drawing" {
  return !scene?.elements.some((element) => !element.isDeleted) ||
    readStepCards(scene).length
    ? "cards"
    : "drawing";
}
