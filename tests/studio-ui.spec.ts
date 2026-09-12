import { test as base, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

// These tests use disposable local accounts. Coach responses are intercepted;
// they never consume a model API quota or touch an existing student's work.
const test = base.extend<{ account: string; pageErrors: string[] }>({
  account: async ({ context }, use) => {
    const username = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const password = `Studio-local-${Date.now()}!`;
    const registration = await context.request.post("/api/v1/auth/register", {
      data: { username, password, name: "작업실 화면 확인" },
    });
    expect(registration.status(), await registration.text()).toBe(201);
    try {
      await use(username);
    } finally {
      const removed = await context.request.delete("/api/v1/auth/account", {
        data: { password },
      });
      expect(removed.status(), "The disposable UI test account must be removed").toBe(200);
    }
  },
  pageErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Guard against accidental calls to actual generation/evaluation endpoints.
    await page.route(/\/api\/v1\/.*\/(?:help|generate|evaluate)(?:\?.*)?$/, async (route) => {
      await route.fulfill({ status: 503, json: { detail: "화면 검사에서는 모델에 연결하지 않아요." } });
    });
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

async function hideAutomaticHelp(page: Page, account: string) {
  await page.addInitScript((username) => {
    for (const topic of ["projects", "simulation"]) {
      localStorage.setItem(`kingcareer:activity-help:v1:${encodeURIComponent(`user:${username}`)}:${topic}`, "hidden");
    }
  }, account);
}

async function openStudio(page: Page) {
  await page.goto("/app/#projects?career=developer");
  await expect(page.locator(".kc-studio")).toBeVisible();
  await page.getByRole("button", { name: "자유롭게 그리기", exact: true }).click();
  await expect(page.getByRole("button", { name: "직무 설계 도안 넣기", exact: true })).toBeEnabled();
}

test("studio saves real drafts, keeps tab state and coach replies, and contains canvas scrolling", async ({ page, context, account }) => {
  await hideAutomaticHelp(page, account);
  await openStudio(page);
  const studio = page.locator(".kc-studio");
  await expect(studio.locator(".brief-interest").getByRole("radio", { checked: true })).toHaveCount(0);
  await studio.getByRole("radio", { name: "5점 · 더 해보고 싶어", exact: true }).check();
  await expect(studio.getByRole("region", { name: "제출 전 확인" })).toContainText("0 / 4");
  await expect(studio.locator(".studio-topbar").getByRole("button", { name: "제출하기", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  const answers = [
    "로그인 오류가 발생했을 때 사용자가 다음 행동을 알기 어렵습니다.",
    "오류 안내 옆에 다시 시도 버튼과 계정 찾기 안내를 함께 배치했습니다.",
    "친구에게 화면을 보여주고 다음 행동을 찾는 시간과 성공 여부를 확인합니다.",
  ];
  const inputs = studio.locator(".kc-writing-grid textarea");
  for (let i = 0; i < answers.length; i++) await inputs.nth(i).fill(answers[i]);
  await page.getByRole("button", { name: "직무 설계 도안 넣기", exact: true }).click();
  await studio.locator(".studio-topbar").getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(async () => {
    const response = await context.request.get("/api/v1/projects/developer");
    const draft = await response.json();
    return { answers: draft.answers, hasDrawing: draft.scene?.elements.length > 0, interest: draft.interest };
  }).toEqual({ answers, hasDrawing: true, interest: 5 });

  for (const [label, extension] of [["현재 설계도 SVG 받기", "svg"], ["PNG 그림 받기", "png"]]) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe(`KingCareer-developer-설계도.${extension}`);
    const file = base.info().outputPath(`project.${extension}`);
    await download.saveAs(file);
    const content = await readFile(file);
    if (extension === "svg") expect(content.toString("utf8")).toContain("<svg");
    else expect([...content.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  }

  let failCoach = true;
  const coachBodies: { expectedVersion: number; mission: number; intent: string }[] = [];
  await page.route("**/api/v1/projects/developer/help", async (route) => {
    const body = route.request().postDataJSON();
    coachBodies.push(body);
    if (failCoach) {
      await route.fulfill({ status: 503, json: { detail: "코치 연결을 다시 시도해 주세요." } });
    } else {
      await route.fulfill({
        status: 200,
        json: { mode: "template", hint: "오류 뒤 다음 행동을 찾을 수 있는지 살펴봐.", nextAction: "다시 시도 버튼 옆 안내를 확인해 봐.", version: body.expectedVersion, mission: body.mission },
      });
    }
  });
  await page.getByRole("tab", { name: "크랩 도움", exact: true }).click();
  const coach = page.getByRole("region", { name: "프로젝트 크랩 코치" });
  await coach.getByRole("button", { name: "어디서 시작할까?", exact: true }).click();
  await expect(coach.getByRole("alert")).toContainText("코치 연결을 다시 시도해 주세요.");
  failCoach = false;
  await coach.getByRole("button", { name: "어디서 시작할까?", exact: true }).click();
  await expect(coach).toContainText("기본 안내 · AI 미연결");
  await expect(coach).toContainText("다시 시도 버튼 옆 안내를 확인해 봐.");
  expect(coachBodies).toHaveLength(2);
  expect(coachBodies[1].expectedVersion).toBeGreaterThan(0);
  expect(coachBodies[1].expectedVersion).toBe(coachBodies[0].expectedVersion);

  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  for (let i = 0; i < answers.length; i++) await expect(inputs.nth(i)).toHaveValue(answers[i]);
  await page.getByRole("tab", { name: "크랩 도움", exact: true }).click();
  await expect(coach).toContainText("다시 시도 버튼 옆 안내를 확인해 봐.");
  const scrollBefore = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await studio.locator(".kc-drawing-board").hover({ position: { x: 200, y: 250 } });
  await page.mouse.wheel(0, 650);
  await expect.poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(scrollBefore);

  await page.reload();
  await expect(page.locator(".kc-studio")).toBeVisible();
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  for (let i = 0; i < answers.length; i++) await expect(inputs.nth(i)).toHaveValue(answers[i]);
  await page.getByRole("tab", { name: "과제", exact: true }).click();
  await expect(studio.getByRole("radio", { name: "5점 · 더 해보고 싶어", exact: true })).toBeChecked();
  const readiness = studio.getByRole("region", { name: "제출 전 확인" });
  await expect(readiness).toContainText("4 / 4");
  await expect(readiness.locator("li.is-ready")).toHaveCount(4);
  await studio.getByRole("radio", { name: "5점 · 더 해보고 싶어", exact: true }).check();
  await expect(studio.getByRole("radio", { name: "5점 · 더 해보고 싶어", exact: true })).toBeChecked();
  await expect(studio.locator(".studio-topbar").getByRole("button", { name: "제출하기", exact: true })).toBeEnabled();
  const submitted = page.waitForResponse((response) => response.url().endsWith("/api/v1/projects/developer/submit") && response.request().method() === "POST");
  await studio.locator(".studio-topbar").getByRole("button", { name: "제출하기", exact: true }).click();
  const submission = await submitted;
  expect(submission.request().postDataJSON().interest).toBe(5);
  expect(submission.status()).toBe(200);
  expect((await submission.json()).interest).toBe(5);
  await expect(page.getByRole("heading", { name: "생각이 결과물이 됐어요.", exact: true })).toBeVisible();
  await expect(studio).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await expect.poll(() => page.locator(".app-shell").evaluate((shell) => (shell as HTMLElement).inert)).toBe(false);
});

test("help closes, traps keyboard focus, remembers suppression and reopens from settings on mobile", async ({ page, account }) => {
  void account;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/#projects?career=developer");
  const overlay = page.getByRole("dialog", { name: "화면 이용 안내" });
  await expect(overlay).toBeVisible();
  await expect(page.locator(".kc-studio")).toBeVisible();
  await overlay.focus();
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest(".kc-help-overlay"))).toBe(true);
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest(".kc-help-overlay"))).toBe(true);
  }
  const before = await page.evaluate(() => window.scrollY);
  await overlay.hover({ position: { x: 50, y: 300 } });
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
  await page.locator(".studio-topbar").getByRole("button", { name: "화면 안내", exact: true }).click();
  await expect(overlay).toBeVisible();
  await overlay.getByRole("checkbox", { name: "다시 보지 않기" }).check();
  await overlay.getByRole("button", { name: "안내 닫기", exact: true }).click();
  await expect(overlay).toBeHidden();
  await page.reload();
  await expect(page.locator(".kc-studio")).toBeVisible();
  await expect(overlay).toHaveCount(0);

  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  await expect(page.locator("#studio-panel-writing")).toBeVisible();
  await page.getByRole("button", { name: "패널 접기", exact: true }).click();
  await expect(page.locator(".studio-panel-scroll")).toBeHidden();
  await page.goto("/app/#profile?tab=settings");
  await expect(page.getByRole("heading", { name: "활동 도움말", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "프로젝트 화면 안내", exact: true }).click();
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("checkbox", { name: "다시 보지 않기" })).toBeChecked();
  await overlay.getByRole("checkbox", { name: "다시 보지 않기" }).uncheck();
  await overlay.getByRole("button", { name: "안내 닫기", exact: true }).click();
  await page.goto("/app/#projects?career=developer");
  await expect(page.locator(".kc-studio")).toBeVisible();
  await expect(overlay).toHaveCount(0);
  await page.locator(".studio-topbar").getByRole("button", { name: "화면 안내", exact: true }).click();
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole("checkbox", { name: "다시 보지 않기" })).not.toBeChecked();
});

test("studio help highlights and captions stay clear of controls at desktop, narrow and landscape sizes", async ({ page, account }) => {
  await hideAutomaticHelp(page, account);
  await openStudio(page);
  const overlay = page.getByRole("dialog", { name: "화면 이용 안내" });
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator(".studio-topbar button").evaluateAll((buttons) => buttons.flatMap((button) => {
      const el = button as HTMLElement;
      const rect = el.getBoundingClientRect();
      return el.scrollWidth > el.clientWidth + 1 || rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1
        ? [`${el.textContent}: client=${el.clientWidth}, scroll=${el.scrollWidth}, rect=${JSON.stringify(rect)}`]
        : [];
    })), `All topbar controls fit at ${width}×${height}`).toEqual([]);
    await page.locator(".studio-topbar").getByRole("button", { name: "화면 안내", exact: true }).click();
    await expect(overlay).toBeVisible();
    for (let step = 1; step <= 4; step++) {
      await expect(overlay.locator(".kc-help-controls")).toContainText(`${step} / 4`);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect.poll(() => overlay.evaluate((host) => {
        const selectors = { target: ".kc-help-shade > rect[stroke]", caption: ".kc-help-caption", controls: ".kc-help-controls" };
        const rects = Object.entries(selectors).map(([name, selector]) => ({ name, rect: host.querySelector(selector)!.getBoundingClientRect() }));
        const issues: string[] = [];
        for (const { name, rect } of rects) {
          if (rect.width <= 0 || rect.height <= 0 || rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1)
            issues.push(`${name} out of bounds: ${JSON.stringify(rect)}`);
        }
        for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
          const first = rects[a], second = rects[b];
          const overlapWidth = Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left);
          const overlapHeight = Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top);
          if (overlapWidth > 1 && overlapHeight > 1) issues.push(`${first.name} overlaps ${second.name}: ${overlapWidth}×${overlapHeight}`);
        }
        return issues;
      }), `Help step ${step} at ${width}×${height}`).toEqual([]);
      await overlay.getByRole("button", { name: step < 4 ? "다음 →" : "시작할게", exact: true }).click();
    }
    await expect(overlay).toBeHidden();
  }
});
