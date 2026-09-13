import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const careers = JSON.parse(readFileSync("backend/data/careers.json", "utf8"));
test("mobile task switching preserves writing and desktop keeps two columns", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(`kingcareer:activity-help:v1:${encodeURIComponent("user:mobile_layout")}:projects`, "hidden");
  });
  await page.route("**/api/v1/catalog", r => r.fulfill({ json: { careers } }));
  await page.route("**/api/v1/state", r => r.fulfill({ json: { profile: { username: "mobile_layout", name: "모바일 검사", interests: [] }, activities: [], saved: [], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [] } }));
  let draft = { careerId: "farmer", version: 1, answers: ["", "", ""], interest: null, scene: { elements: [] } };
  await page.route("**/api/v1/projects/farmer", r => r.fulfill({ json: draft }));
  await page.route("**/api/v1/projects/farmer/draft", r => { draft = { ...draft, ...r.request().postDataJSON(), version: draft.version + 1 }; return r.fulfill({ json: draft }); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/#projects?career=farmer");
  await expect(page.locator(".excalidraw")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "모바일 주 메뉴" })).toBeHidden();
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  await expect(page.locator(".studio-canvas")).toBeHidden();
  const input = page.locator("#project-answer-0");
  await input.fill("온실 센서 위치를 비교해서 햇빛 영향을 확인해요.");
  const panel = await page.locator(".studio-panel").boundingBox();
  expect(panel!.height).toBeGreaterThan(500);
  await page.getByRole("button", { name: "패널 접기" }).click();
  await expect(page.locator(".excalidraw")).toBeVisible();
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  await expect(input).toHaveValue("온실 센서 위치를 비교해서 햇빛 영향을 확인해요.");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width > 760) {
      await expect(page.locator(".studio-canvas")).toBeVisible();
      const canvas = await page.locator(".studio-canvas").boundingBox();
      const side = await page.locator(".studio-panel").boundingBox();
      expect(side!.x).toBeGreaterThanOrEqual(canvas!.x + canvas!.width - 1);
      await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await page.locator(".app-sidebar").getByRole("button", { name: "홈", exact: true }).click();
  await expect(page).toHaveURL(/#home$/);
  await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "미니 프로젝트" }).click();
  await expect(page).toHaveURL(/#projects$/);
  expect(draft.answers[0]).toBe("온실 센서 위치를 비교해서 햇빛 영향을 확인해요.");
});
