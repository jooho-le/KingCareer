import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));
async function fixture(page: Page, answers = ["", "", ""]) {
  let draft = { careerId: "developer", answers, version: 0, interest: 3, scene: { elements: [{ id: "student-note", type: "text", x: 20, y: 20, width: 200, height: 40, text: "내가 직접 작성한 흐름" }], appState: { viewBackgroundColor: "#ffffff" } } };
  await page.addInitScript(() => localStorage.setItem("kingcareer:activity-help:v1:user%3Awriting_student:projects", "hidden"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/catalog")) return route.fulfill({ json: { careers } });
    if (path.endsWith("/state")) return route.fulfill({ json: { profile: { username: "writing_student", name: "빈칸 작성", onboarded: true, interests: [] }, saved: [], activities: [], activeActivities: [], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [] } });
    if (path.endsWith("/projects/developer")) return route.fulfill({ json: draft });
    if (path.endsWith("/projects/developer/draft")) {
      const body = route.request().postDataJSON();
      draft = { ...draft, ...body, version: draft.version + 1 };
      return route.fulfill({ json: draft });
    }
    return route.fulfill({ status: 503, json: { detail: "테스트에서 모델을 호출하지 않습니다." } });
  });
  return () => draft;
}

test("guided blanks autosave and restore, incomplete drafts cannot submit, examples stay separate", async ({ page }) => {
  const current = await fixture(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/#projects?career=developer");
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  const items = page.locator(".studio-writing-item");
  await items.first().locator(".writing-example summary").click();
  await expect(items.first().locator(".writing-example")).toContainText("연습용 예시");
  expect(current().answers).toEqual(["", "", ""]);
  await items.first().getByRole("button", { name: "두 칸으로 문장 만들기" }).click();
  await page.getByRole("textbox", { name: "1번 설명 자료", exact: true }).fill("내가 본 오류 안내");
  await expect(items.first().locator("textarea")).toHaveValue(/〔채우기:문제〕/);
  await expect(page.getByRole("button", { name: "제출하기", exact: true })).toBeDisabled();
  await page.locator(".studio-topbar").getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => current().answers[0]).toContain("내가 본 오류 안내");
  await page.reload();
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "1번 설명 자료", exact: true })).toHaveValue("내가 본 오류 안내");
  await page.getByRole("textbox", { name: "1번 설명 문제", exact: true }).fill("눌러야 할 버튼이 없다는 점");
  await expect(items.first().locator("textarea")).not.toHaveValue(/〔채우기:/);
  for (const [index, a, b] of [[1, "입력 유지 버튼", "친구가 다시 입력하지 않아도 되기"], [2, "다시 로그인해 보는 방법", "입력이 그대로 남은 상태"]] as const) {
    await items.nth(index).getByRole("button", { name: "두 칸으로 문장 만들기" }).click();
    const inputs = items.nth(index).locator(".writing-blanks input");
    await inputs.nth(0).fill(a); await inputs.nth(1).fill(b);
  }
  await expect(page.getByRole("button", { name: "제출하기", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "과제", exact: true }).click();
  await expect(page.locator(".brief-checklist")).toContainText("4 / 4");
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  await expect(items.first().locator("textarea")).toHaveValue(/눌러야 할 버튼이 없다는 점/);
  await page.locator(".studio-topbar").getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => current().answers.every(value => !value.includes("〔채우기:"))).toBe(true);
});

test("existing writing is preserved and guidance stays usable on small screens", async ({ page }) => {
  const text = "내가 직접 쓴 설명은 예시를 열어도 그대로 있어야 합니다.";
  const current = await fixture(page, [text, "", ""]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/#projects?career=developer");
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  const items = page.locator(".studio-writing-item");
  await items.first().locator(".writing-example summary").click();
  await expect(items.first().locator("textarea")).toHaveValue(text);
  await expect(items.first().getByRole("button", { name: "두 칸으로 문장 만들기" })).toHaveCount(0);
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("tab", { name: "내 설명", exact: true }).click();
    await items.nth(1).getByRole("button", { name: /두 칸으로 문장 만들기|빈칸 도움 접기/ }).evaluate((el: HTMLButtonElement) => { if (el.getAttribute("aria-expanded") !== "true") el.click(); });
    await items.nth(1).locator(".writing-blanks input").first().scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/writing-guide/${width}.png`, animations: "disabled" });
  }
  expect(current().answers[0]).toBe(text);
});
