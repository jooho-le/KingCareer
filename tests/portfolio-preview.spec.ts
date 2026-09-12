import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));
const artifact = {
  id: "portfolio-preview-fixture", careerId: "developer", kind: "project", title: "내가 만든 로그인 복구 설계", date: "2026-09-13T01:00:00Z",
  answers: ["로그인 오류가 나면 다음에 무엇을 할지 알 수 없어요.", "다시 시도 버튼과 문의 버튼을 나누고, 입력한 내용은 지우지 않아요.", "친구가 도움 없이 다시 시도할 수 있는지 확인해요."],
  reflection: "사용자가 당황하지 않도록 알려주는 것이 중요했어요.", interest: 4, feedback: "결과물을 저장했어요.", evaluationStatus: "not_connected", observations: [], before: [], after: [],
  scene: { appState: { viewBackgroundColor: "#ffffff" }, elements: [
    { id: "box", type: "rectangle", x: 20, y: 20, width: 480, height: 200, strokeColor: "#7C3AED", backgroundColor: "#F2EBFF", fillStyle: "solid", roughness: 0, strokeWidth: 2, opacity: 100, angle: 0, seed: 1, version: 1, versionNonce: 1, isDeleted: false, groupIds: [], boundElements: [] },
    { id: "label", type: "text", x: 48, y: 54, width: 390, height: 80, text: "오류 안내 → 다시 시도\n입력한 내용은 그대로 유지", originalText: "오류 안내 → 다시 시도\n입력한 내용은 그대로 유지", fontSize: 24, fontFamily: 2, textAlign: "left", verticalAlign: "top", lineHeight: 1.25, strokeColor: "#352044", backgroundColor: "transparent", opacity: 100, angle: 0, seed: 2, version: 1, versionNonce: 2, isDeleted: false, groupIds: [] },
  ] },
};

async function mockPortfolio(page: Page) {
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/catalog")) return route.fulfill({ json: { careers } });
    if (path.endsWith("/state")) return route.fulfill({ json: { profile: { name: "결과물 확인", username: "portfolio_preview", school: "", grade: "", region: "", interests: [], onboarded: true, notifications: true }, activities: [artifact], saved: [], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [] } });
    if (path.endsWith("/artifact")) return route.fulfill({ json: artifact });
    return route.fulfill({ status: 404, json: { detail: "UI 확인용으로 연결하지 않은 API예요." } });
  });
}

test("portfolio opens the submitted image first, remains readable on small screens, and keeps close reachable", async ({ page }) => {
  test.setTimeout(120000);
  await mockPortfolio(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/app/#portfolio");
  const card = page.locator(".portfolio-work-card");
  await card.click();
  const modal = page.getByRole("dialog", { name: artifact.title });
  const preview = modal.locator(".portfolio-preview");
  const drawing = modal.locator(".portfolio-artifact-image > img");
  await expect(drawing).toBeVisible({ timeout: 45000 });
  await expect(modal.locator(".excalidraw")).toHaveCount(0);
  expect(await drawing.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await modal.locator(".portfolio-artifact").evaluate(element => !!(element.compareDocumentPosition(document.querySelector(".portfolio-result-story")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await preview.evaluate(element => element.scrollTop = 0);
    await expect.poll(() => modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = (await modal.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(await modal.locator(".portfolio-story-cards p").first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(15);
    const closeBefore = await modal.getByRole("button", { name: "닫기", exact: true }).boundingBox();
    await page.screenshot({ path: `.local/portfolio-preview/top-${width}.png`, animations: "disabled" });
    await preview.evaluate(element => element.scrollTop = element.scrollHeight);
    expect(await modal.getByRole("button", { name: "닫기", exact: true }).boundingBox()).toEqual(closeBefore);
    await expect(modal.getByRole("button", { name: "크랩과 경험 돌아보기" })).toBeInViewport();
    await page.screenshot({ path: `.local/portfolio-preview/bottom-${width}.png`, animations: "disabled" });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const readText = modal.getByText("그림 속 글 읽기", { exact: true });
  await readText.click();
  await expect(modal.locator(".portfolio-artifact-transcript li")).toContainText("입력한 내용은 그대로 유지");
  const downloadEvent = page.waitForEvent("download");
  await modal.getByRole("button", { name: "설계도와 설명 함께 받기" }).click();
  const download = await downloadEvent;
  const path = test.info().outputPath("portfolio-document.html");
  await download.saveAs(path);
  const content = readFileSync(path, "utf8");
  expect(content).toContain("data:image/svg+xml");
  for (const answer of artifact.answers) expect(content).toContain(answer);
  expect(content).toContain("활동 저장 안내 · AI 평가 아님");
  await modal.getByRole("button", { name: "닫기", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button", { name: "크랩과 경험 돌아보기" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(modal.getByRole("button", { name: "닫기", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(card).toBeFocused();
  expect(errors).toEqual([]);
});

test("artifact retry preserves the explanation and offers an honest empty drawing state", async ({ page }) => {
  await mockPortfolio(page);
  let fail = true;
  await page.route("**/api/v1/portfolio/portfolio-preview-fixture/artifact", route => fail
    ? route.fulfill({ status: 503, json: { detail: "결과물을 불러오지 못했어요." } })
    : route.fulfill({ json: { ...artifact, scene: { elements: [] } } }));
  await page.goto("/app/#portfolio");
  await page.locator(".portfolio-work-card").click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByRole("alert")).toContainText("결과물을 불러오지 못했어요.");
  await expect(modal.locator(".portfolio-artifact [role=status]")).toHaveCount(0);
  await expect(modal.getByRole("region", { name: "나의 설명" })).toContainText(artifact.answers[0]);
  fail = false;
  await modal.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(modal.locator(".portfolio-artifact-image")).toContainText("설계도 없이 설명으로 남긴 결과물");
  await expect(modal.getByRole("alert")).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "설계도와 설명 함께 받기" })).toBeEnabled();
  await expect(modal.getByRole("button", { name: "AI 피드백 받기", exact: true })).toBeEnabled();
});
