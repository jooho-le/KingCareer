import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));
const profile = { name: "메뉴 확인", username: "studio_navigation", school: "", grade: "", region: "", interests: [], onboarded: true, notifications: true };
async function setup(page: Page, activities: unknown[] = []) {
  await page.addInitScript(() => {
    localStorage.setItem(`kingcareer:activity-help:v1:${encodeURIComponent("user:studio_navigation")}:projects`, "hidden");
  });
  await page.route("**/api/v1/catalog", route => route.fulfill({ json: { careers } }));
  await page.route("**/api/v1/state", route => route.fulfill({ json: { profile, activities, saved: [], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [] } }));
}

test("studio uses the shared app sidebar and topbar and saves before navigation", async ({ page }) => {
  await setup(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let failSave = true;
  let draft = { careerId: "developer", answers: ["", "", ""], version: 1, interest: null, scene: { elements: [] } };
  await page.route("**/api/v1/projects/developer", route => route.fulfill({ json: draft }));
  await page.route("**/api/v1/projects/developer/draft", route => {
    if (failSave) return route.fulfill({ status: 503, json: { detail: "저장 연결을 다시 확인해 주세요." } });
    draft = { ...draft, ...route.request().postDataJSON(), version: draft.version + 1 };
    return route.fulfill({ json: draft });
  });
  await page.goto("/app/#projects?career=developer");
  await expect(page.locator(".kc-studio")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(손그림 흐름도 넣기|그림 전체 보기)$/ })).toBeEnabled();
  const rail = page.getByRole("complementary", { name: "주 메뉴", exact: true });
  await expect(rail.getByRole("button", { name: "미니 프로젝트", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".main-content .kc-studio")).toBeVisible();
  await expect(page.locator(".studio-nav-rail")).toHaveCount(0);
  await expect(page.locator(".topbar")).toBeVisible();
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const toggle = page.getByRole("button", { name: "메뉴 열기", exact: true });
    const before = await page.locator(".studio-canvas").boundingBox();
    if (width <= 760) {
    await toggle.click();
    await expect(rail).toBeVisible();
    await expect(page.locator(".main-shell")).toHaveAttribute("inert", "");
    expect(await page.locator(".studio-canvas").boundingBox()).toEqual(before);
    await page.screenshot({ path: `.local/sidebar-review/menu-${width}.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(page.locator(".main-shell")).not.toHaveAttribute("inert", "");
    } else {
      await expect(rail).toBeVisible();
      expect((await rail.boundingBox())!.width).toBeGreaterThan(150);
    }
    // Account card must stay clear of the screen edge, including short windows.
    if (width <= 760) await toggle.click();
    await rail.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const railBox = (await rail.boundingBox())!;
    const accountBox = (await rail.locator(".sidebar-profile").boundingBox())!;
    expect(railBox.y + railBox.height - accountBox.y - accountBox.height).toBeGreaterThanOrEqual(23);
    await expect(rail.locator(".sidebar-profile")).toBeInViewport();
    await page.screenshot({ path: `.local/sidebar-spacing/${width}.png`, animations: "disabled" });
    if (width <= 760) await page.keyboard.press("Escape");
    const studioBox = (await page.locator(".kc-studio").boundingBox())!;
    const topbarBox = (await page.locator(".topbar").boundingBox())!;
    expect(studioBox.y).toBeGreaterThanOrEqual(topbarBox.y + topbarBox.height);
    expect(studioBox.y + studioBox.height).toBeLessThanOrEqual(height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/sidebar-review/studio-${width}.png`, animations: "disabled" });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  const input = page.locator(".kc-writing-grid textarea").first();
  await input.fill("저장에 실패해도 작성한 아이디어가 남아 있어야 해요.");
  await rail.getByRole("button", { name: "포트폴리오", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("저장 연결을 다시 확인");
  await expect(page).toHaveURL(/#projects\?career=developer/);
  await expect(input).toHaveValue("저장에 실패해도 작성한 아이디어가 남아 있어야 해요.");
  failSave = false;
  await rail.getByRole("button", { name: "포트폴리오", exact: true }).click();
  await expect(page).toHaveURL(/#portfolio$/);
  expect(draft.answers[0]).toBe("저장에 실패해도 작성한 아이디어가 남아 있어야 해요.");
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  expect(errors).toEqual([]);
});

test("portfolio feedback retries, persists visibly, and reaches the downloaded document", async ({ page }) => {
  let artifact = { id: "project-check", careerId: "developer", kind: "project", title: "로그인 복구 설계 노트", date: "2026-09-13T01:00:00Z", answers: ["로그인 오류를 발견했어요.", "다시 시도 버튼을 만들어요.", "버튼을 찾는지 확인해요."], before: [], after: [], reflection: "", interest: 4, feedback: "저장했어요.", evaluationStatus: "not_connected", observations: [] as string[], scene: { elements: [] } };
  const activities = [artifact];
  await setup(page, activities);
  await page.route("**/api/v1/portfolio/project-check/artifact", route => route.fulfill({ json: artifact }));
  let attempts = 0;
  const keys: string[] = [];
  await page.route("**/api/v1/portfolio/project-check/evaluate", async route => {
    keys.push(route.request().postDataJSON().clientRequestId);
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { detail: "AI 연결을 다시 시도해 주세요. 제출물은 보존돼요." } });
    artifact = { ...artifact, evaluationStatus: "ai_feedback", feedback: "다시 시도 안내가 구체적이야.", observations: ["확인할 기준을 하나 더 정해 봐."] };
    activities[0] = artifact;
    await route.fulfill({ json: artifact });
  });
  await page.goto("/app/#portfolio");
  await page.locator(".portfolio-work-card").click();
  const panel = page.getByRole("region", { name: "프로젝트 AI 피드백" });
  await panel.getByRole("button", { name: "AI 피드백 받기", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("제출물은 보존돼요");
  await panel.getByRole("button", { name: "AI 피드백 다시 요청" }).click();
  await expect(panel).toContainText("확인할 기준을 하나 더 정해 봐.");
  await expect(panel.getByRole("button")).toHaveCount(0);
  expect(keys[0]).toBe(keys[1]);
  await expect(page.getByRole("dialog")).toContainText("다시 시도 안내가 구체적이야.");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "설계도와 설명 함께 받기" }).click();
  const download = await downloaded;
  const file = test.info().outputPath("portfolio.html");
  await download.saveAs(file);
  expect(readFileSync(file, "utf8")).toContain("다시 시도 안내가 구체적이야.");
  await page.reload();
  await page.locator(".portfolio-work-card").click();
  await expect(page.getByRole("dialog")).toContainText("다시 시도 안내가 구체적이야.");
  await expect(panel.getByRole("button")).toHaveCount(0);
});
