import { test, expect } from "@playwright/test";
import { careerIds, drawingFixture, openDrawing, saveDrawing, editFlowNote } from "./drawing-guide-fixture";

test("five careers have drawing-only examples and editable in-canvas blanks", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await drawingFixture(page);
  for (const id of careerIds) {
    await openDrawing(page, id);
    await expect(page.locator(".studio-authoring-tools,.step-card-editor,.writing-blanks")).toHaveCount(0);
    const before = JSON.stringify(fixture.drafts[id]);
    await page.getByRole("button", { name: "완성 그림 예시", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "완성 그림 예시" });
    await expect(dialog.getByRole("img").locator("svg")).toBeVisible();
    await expect.poll(() => dialog.getByRole("img").locator("svg").evaluate((svg: SVGSVGElement) => svg.viewBox.baseVal.width > 100 && svg.querySelectorAll("text").length > 3)).toBe(true);
    await dialog.screenshot({ path: `.local/drawing-guide/example-${id}.png`, animations: "disabled" });
    expect(JSON.stringify(fixture.drafts[id])).toBe(before);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "완성 그림 예시", exact: true })).toBeFocused();
    await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
    await page.getByRole("button", { name: /^(손그림 흐름도 넣기|그림 전체 보기)$/ }).click();
    await expect(page.getByRole("button", { name: /빈칸 찾기/ })).toHaveCount(0);
    await saveDrawing(page);
    const elements = fixture.drafts[id].scene.elements;
    expect(elements.filter((e: any) => e.originalText?.includes("〔채우기:")).length).toBe(3);
    expect(elements.length).toBeLessThan(100);
    expect(fixture.drafts[id].answers).toEqual(["", "", ""]);
    await page.screenshot({ path: `.local/drawing-guide/scaffold-${id}.png`, animations: "disabled" });
  }
  expect(fixture.errors).toEqual([]);
  expect(fixture.unexpected).toEqual([]);
});

test("editing actual canvas blanks saves and restores; a starter alone cannot submit", async ({ page }) => {
  const answers = ["오류 뒤에 어떤 버튼을 눌러야 할지 알기 어려웠어요.", "입력을 유지하고 다시 시도하는 버튼을 만들었어요.", "친구가 오류 화면에서 다시 시도할 수 있는지 확인해요."];
  const fixture = await drawingFixture(page, [], answers);
  await openDrawing(page);
  const submit = page.locator(".studio-topbar").getByRole("button", { name: "제출하기", exact: true });
  await page.getByRole("button", { name: /^(손그림 흐름도 넣기|그림 전체 보기)$/ }).click();
  await expect(submit).toBeDisabled();
  await editFlowNote(page, 0, "연결을 확인하고 다시 눌러 주세요.");
  await saveDrawing(page);
  expect(fixture.drafts.developer.scene.elements.filter((e: any) => e.originalText?.includes("〔채우기:")).length).toBe(2);
  await page.reload();
  await expect(page.getByRole("button", { name: "그림 전체 보기", exact: true })).toBeEnabled();
  await expect(submit).toBeDisabled();
  await editFlowNote(page, 1, "입력 유지하고 다시 시도");
  await editFlowNote(page, 2, "아이디가 남은 로그인 화면");
  await expect(page.getByRole("button", { name: /빈칸 찾기 ·/ })).toHaveCount(0);
  await expect(submit).toBeEnabled();
  await saveDrawing(page);
  expect(JSON.stringify(fixture.drafts.developer.scene)).toContain("아이디가 남은 로그인 화면");
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  await expect(page.locator(".writing-blanks")).toHaveCount(0);
  for (let i = 0; i < 3; i++) await expect(page.locator(".kc-writing-grid textarea").nth(i)).toHaveValue(answers[i]);
  expect(fixture.errors).toEqual([]);
});

test("fitting a legacy drawing never appends a different template or duplicates artwork", async ({ page }) => {
  const legacy = [{ id: "old-card", type: "rectangle", x: 67, y: 90, width: 240, height: 110, customData: { kingCareerStep: { order: 0 } } },
    { id: "old-text", type: "text", x: 90, y: 120, width: 170, height: 25, fontSize: 20, text: "내가 만든 기존 그림", originalText: "내가 만든 기존 그림" }];
  const fixture = await drawingFixture(page, legacy);
  await openDrawing(page);
  const before = JSON.stringify(fixture.drafts.developer.scene);
  for (let click = 0; click < 2; click++) await page.getByRole("button", { name: "그림 전체 보기", exact: true }).click();
  expect(JSON.stringify(fixture.drafts.developer.scene)).toBe(before);
  expect(fixture.writes()).toBe(0);
  expect(fixture.errors).toEqual([]);
});

test("canvas and example stay usable on small screens without page scrolling", async ({ page }) => {
  const fixture = await drawingFixture(page);
  await openDrawing(page);
  await page.getByRole("button", { name: /^(손그림 흐름도 넣기|그림 전체 보기)$/ }).click();
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const canvas = page.locator(".kc-drawing-board");
    const bounds = await canvas.boundingBox();
    expect(bounds!.height).toBeGreaterThan(100);
    const before = await page.evaluate(() => window.scrollY);
    await canvas.hover(); await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    await page.getByRole("button", { name: "완성 그림 예시", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "완성 그림 예시" });
    await expect(dialog.getByRole("img").locator("svg")).toBeVisible();
    await dialog.getByRole("button", { name: "크게 보기", exact: true }).click();
    await expect(dialog.locator(".drawing-example-image")).toHaveClass(/is-zoomed/);
    await expect.poll(() => dialog.locator("button").evaluateAll(buttons => buttons.every(button => {
      const r = button.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
    }))).toBe(true);
    await page.screenshot({ path: `.local/drawing-guide/mobile-example-${width}.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `.local/drawing-guide/workspace-${width}.png`, animations: "disabled" });
  }
  expect(fixture.errors).toEqual([]);
});
