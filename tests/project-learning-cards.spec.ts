import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { projectLearning, projectStepPrompts } from "../src/fieldwork/project-learning";
import type { CareerId } from "../src/data";

const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));

async function mockWorkshop(page: Page) {
  const drafts = Object.fromEntries(Object.keys(projectLearning).map((careerId) => [careerId, {
    careerId, answers: ["", "", ""], version: 0, interest: null,
    scene: { elements: [], appState: { viewBackgroundColor: "#ffffff" } },
  }])) as Record<string, any>;
  let writes = 0;
  const unexpected: string[] = [];
  await page.addInitScript(() => localStorage.setItem("kingcareer:activity-help:v1:user%3Alearning_preview:projects", "hidden"));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/catalog")) return route.fulfill({ json: { careers } });
    if (path.endsWith("/state")) return route.fulfill({ json: {
      profile: { name: "학습 안내 확인", username: "learning_preview", onboarded: true, interests: [] },
      saved: [], activities: [], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [],
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
    return route.fulfill({ status: 503, json: { detail: "화면 검사에서는 외부 모델을 호출하지 않습니다." } });
  });
  return { drafts, writes: () => writes, unexpected };
}

test("five careers explain what to make without copying practice examples into student work", async ({ page }) => {
  test.setTimeout(90_000);
  const fixture = await mockWorkshop(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [index, id] of (Object.keys(projectLearning) as CareerId[]).entries()) {
    const width = index % 2 ? 390 : 1440;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/app/?guidance=${id}#projects?career=${id}`);
    const editor = page.getByRole("region", { name: "어떤 순서로 해결할까?" });
    await expect(editor).toBeVisible();
    await expect(editor.locator(".step-learning-goal")).toContainText(projectLearning[id].goal);
    await expect(editor.locator(".step-card-list input")).toHaveCount(1);
    await expect(editor.getByRole("textbox", { name: "1단계 할 일", exact: true })).toHaveAttribute("placeholder", projectStepPrompts[id][0].title);
    const example = editor.locator(".step-worked-example");
    await expect(example).not.toHaveAttribute("open", "");
    await example.locator("summary").click();
    await expect(example.getByRole("heading")).toHaveCount(3);
    await expect(example).toContainText("연습용 예시야");
    await expect(example).toContainText(projectLearning[id].why);
    await expect(example.locator("input,textarea,button")).toHaveCount(0);
    await page.screenshot({ path: `.local/project-learning/example-${id}-${width}.png`, animations: "disabled" });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await example.locator("summary").click();
    await editor.getByRole("button", { name: "3단계 틀로 시작", exact: true }).click();
    await expect(editor.locator(".step-card-list input")).toHaveCount(3);
    await expect(editor.getByRole("textbox", { name: "1단계 할 일", exact: true })).toBeFocused();
    expect(await editor.locator("input,textarea").evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual(["", "", "", "", "", ""]);
    await expect(page.locator(".studio-topbar").getByRole("button", { name: "제출하기", exact: true })).toBeDisabled();
    await page.locator(".studio-topbar").getByRole("button", { name: "저장", exact: true }).click();
    expect(fixture.drafts[id].scene.elements).toEqual([]);
    expect(fixture.writes()).toBe(0);
  }
  expect(fixture.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("blank scaffolds save only learner input and lead into explanations without replacing artwork", async ({ page }) => {
  const fixture = await mockWorkshop(page);
  await page.goto("/app/#projects?career=developer");
  const editor = page.getByRole("region", { name: "어떤 순서로 해결할까?" });
  await editor.getByRole("button", { name: "3단계 틀로 시작", exact: true }).click();
  await editor.getByRole("textbox", { name: "1단계 할 일", exact: true }).fill("직접 만든 안내 문구를 보여주기");
  await editor.getByRole("textbox", { name: "1단계 방법", exact: true }).fill("다시 누를 곳을 사용자가 찾아보게 한다.");
  await page.locator(".studio-topbar").getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => fixture.drafts.developer.scene.elements.filter((element: any) => element.type === "rectangle").length).toBe(1);
  expect(JSON.stringify(fixture.drafts.developer.scene)).toContain("직접 만든 안내 문구");
  for (const example of projectLearning.developer.steps) expect(JSON.stringify(fixture.drafts.developer.scene)).not.toContain(example.title);
  await editor.getByRole("button", { name: "이제 내 설명 쓰기", exact: true }).click();
  await expect(page.getByRole("tab", { name: "내 설명", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(editor.getByRole("textbox", { name: "1단계 할 일", exact: true })).toHaveValue("직접 만든 안내 문구를 보여주기");
  await expect(editor.getByRole("button", { name: "3단계 틀로 시작", exact: true })).toHaveCount(0);
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => editor.locator("input,textarea,button,summary").evaluateAll(elements => elements.every(element => {
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth && box.height >= 44;
    }))).toBe(true);
    const before = await page.evaluate(() => scrollY);
    await editor.hover();
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
    await editor.evaluate(element => element.scrollTop = 0);
    await page.screenshot({ path: `.local/project-learning/entered-${width}.png`, animations: "disabled" });
  }
  expect(fixture.unexpected).toEqual([]);
});
