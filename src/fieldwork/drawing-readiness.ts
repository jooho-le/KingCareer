import type { DrawingScene } from "./types";
import { hasWritingBlanks } from "./project-writing";

export function drawingReady(scene: DrawingScene | null | undefined) {
  const elements =
    scene?.elements.filter((element) => !element.isDeleted) ?? [];
  if (
    !elements.length ||
    elements.some((element) =>
      hasWritingBlanks(String(element.originalText ?? element.text ?? "")),
    )
  )
    return false;
  return elements.some((element) => {
    const guide = (
      element.customData as
        { kingCareerGuide?: { originalText: string | null } } | undefined
    )?.kingCareerGuide;
    if (!guide) return true; // Includes older student-authored card scenes.
    const text = String(element.originalText ?? element.text ?? "").trim();
    return (
      element.type === "text" && text.length > 0 && text !== guide.originalText
    );
  });
}
