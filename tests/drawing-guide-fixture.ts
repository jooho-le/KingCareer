import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));
export const careerIds = ["developer", "nurse", "farmer", "engineer", "researcher"];
export async function drawingFixture(page: Page, initialElements: any[] = [], answers = ["", "", ""]) {
  const drafts: Record<string, any> = Object.fromEntries(careerIds.map(careerId => [careerId, {
    careerId, answers, version: 1, interest: 4, scene: { elements: initialElements, appState: { viewBackgroundColor: "#ffffff" } },
  }]));
  let writes = 0;
  const errors: string[] = [], unexpected: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("kingcareer:activity-help:v1:user%3Adrawing_student:projects", "hidden"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/catalog")) return route.fulfill({ json: { careers } });
    if (path.endsWith("/state")) return route.fulfill({ json: {
      profile: { name: "그림 작업 확인", username: "drawing_student", onboarded: true, interests: [] },
      saved: [], activities: [], activeActivities: [], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [],
    } });
    const project = path.match(/\/projects\/(developer|nurse|farmer|engineer|researcher)(\/draft)?$/);
    if (project) {
      const id = project[1];
      if (project[2]) {
        const body = route.request().postDataJSON();
        drafts[id] = { ...drafts[id], answers: body.answers, scene: body.scene, interest: body.interest, version: drafts[id].version + 1 };
        writes++;
      }
      return route.fulfill({ json: drafts[id] });
    }
    unexpected.push(path);
    return route.fulfill({ status: 503, json: { detail: "화면 검사에서는 모델을 호출하지 않습니다." } });
  });
  return { drafts, errors, unexpected, writes: () => writes };
}
export async function openDrawing(page: Page, career = "developer") {
  await page.goto(`/app/#projects?career=${career}`);
  await expect(page.getByRole("button", { name: /^(손그림 흐름도 넣기|그림 전체 보기)$/ })).toBeEnabled();
}
export async function saveDrawing(page: Page) {
  await page.locator(".studio-topbar").getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".studio-title [role='status']")).toContainText("저장 완료");
}
export async function editFlowNote(page: Page, index: number, text: string) {
  // Fit the actual canvas, select a memo, then use the editor's native Enter key.
  // The template supplies drawing coordinates; no editor state is mutated here.
  await page.getByRole("button", { name: "그림 전체 보기", exact: true }).click();
  const point = await page.evaluate(async noteIndex => {
    const modulePath = "/src/fieldwork/project-templates.ts";
    const { projectTemplate } = await import(modulePath);
    const career = new URLSearchParams(location.hash.split("?")[1]).get("career") || "developer";
    const elements = projectTemplate(career);
    const notes = elements.filter((e: any) => e.type === "rectangle").slice(4);
    const note = notes[noteIndex];
    const left = Math.min(...elements.map((e: any) => e.x));
    const right = Math.max(...elements.map((e: any) => e.x + e.width));
    const top = Math.min(...elements.map((e: any) => e.y));
    const bottom = Math.max(...elements.map((e: any) => e.y + e.height));
    const board = document.querySelector(".kc-drawing-board .excalidraw")!.getBoundingClientRect();
    const zoom = parseFloat(document.querySelector(".kc-drawing-board .reset-zoom-button")!.textContent!) / 100;
    return {
      x: board.x + board.width / 2 + (note.x + note.width / 2 - (left + right) / 2) * zoom,
      y: board.y + board.height / 2 + (note.y + note.height / 2 - (top + bottom) / 2) * zoom,
    };
  }, index);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press("Enter");
  const input = page.locator(".excalidraw-wysiwyg");
  await expect(input).toBeVisible();
  await input.fill(text);
  await page.keyboard.press("Escape");
  await expect(input).toHaveCount(0);
}
