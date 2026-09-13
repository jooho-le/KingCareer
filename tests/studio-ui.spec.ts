import { test as base, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { editFlowNote } from "./drawing-guide-fixture";

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
      // Preserve coverage of the original editor for existing saved drafts.
      // Fresh hand drawings are covered by hand-flow.spec.ts.
      const legacy = await context.request.put("/api/v1/projects/developer/draft", {
        data: { clientRequestId: `legacy-${Date.now()}`, expectedVersion: 0, answers: ["", "", ""], interest: null,
          scene: { elements: [], appState: { viewBackgroundColor: "#ffffff" } } },
      });
      expect(legacy.status(), await legacy.text()).toBe(200);
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
  await expect(page.getByRole("button", { name: /^(손그림 흐름도 넣기|그림 전체 보기)$/ })).toBeEnabled();
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
  await page.getByRole("button", { name: "손그림 흐름도 넣기", exact: true }).click();
  await editFlowNote(page, 0, "서버 연결을 확인해 주세요.");
  await editFlowNote(page, 1, "다시 시도하기");
  await editFlowNote(page, 2, "입력이 남은 로그인 화면");
  await studio.locator(".studio-topbar").getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(async () => {
    const response = await context.request.get("/api/v1/projects/developer");
    const draft = await response.json();
    return { answers: draft.answers, hasDrawing: draft.scene?.elements.length > 0, interest: draft.interest };
  }).toEqual({ answers, hasDrawing: true, interest: 5 });

  await page.locator(".kc-drawing-exports > summary").click();
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

  await page.locator(".kc-drawing-exports > summary").click();
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
        json: { mode: "template", hint: "오류 뒤 다음 행동을 찾을 수 있는지 살펴봐.", nextAction: "다시 시도 버튼 옆 안내를 확인해 봐.", example: "연결이 잠시 끊겼어요. 입력한 내용은 남아 있어요.", version: body.expectedVersion, mission: body.mission },
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
  await expect(coach).toContainText("참고 예시");
  await expect(coach).toContainText("연결이 잠시 끊겼어요. 입력한 내용은 남아 있어요.");
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

test("a new hand drawing preserves the prior revision and stays hand drawn in the portfolio", async ({ page, context, account }) => {
  await hideAutomaticHelp(page, account);
  const answers = ["사용자가 오류 뒤의 행동을 찾기 어려워요.", "오류 안내와 도움받는 길을 함께 연결했어요.", "다시 실패한 경우에도 다음 행동이 있는지 확인해요."];
  const old = await context.request.put("/api/v1/projects/developer/draft", { data: {
    clientRequestId: `original-${Date.now()}`, expectedVersion: 1, answers, interest: 4,
    scene: { elements: [{ id: "old-sketch", type: "rectangle", x: 30, y: 50, width: 200, height: 100, roughness: 1 }] },
  } });
  expect(old.status(), await old.text()).toBe(200);
  const oldVersion = (await old.json()).version;
  await openStudio(page);
  await page.locator(".kc-drawing-exports > summary").click();
  await page.getByRole("button", { name: "기존 초안 보관하고 새 손그림 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "그림 전체 보기", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: /빈칸 찾기/ })).toHaveCount(0);
  const preserved = await context.request.get(`/api/v1/projects/developer/revisions/${oldVersion}`);
  expect((await preserved.json()).scene.elements[0].id).toBe("old-sketch");
  await expect(page.getByRole("button", { name: "제출하기", exact: true })).toBeDisabled();
  await editFlowNote(page, 0, "연결이 끊겼어요. 다시 시도해 봐요.");
  await editFlowNote(page, 1, "계속 안 되면 도움 요청으로 연결해요.");
  await editFlowNote(page, 2, "입력 정보가 남아 있는지 확인해요.");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".studio-title")).toContainText("초안 저장 완료");
  const saved = await (await context.request.get("/api/v1/projects/developer")).json();
  expect(saved.scene.studio).toBeUndefined();
  expect(saved.scene.elements.filter((e: any) => e.type === "rectangle").every((e: any) => e.roughness >= 1)).toBe(true);
  expect(saved.scene.elements.filter((e: any) => e.type === "text").every((e: any) => e.fontFamily === 5)).toBe(true);
  const responseEvent = page.waitForResponse(r => r.url().endsWith("/projects/developer/submit") && r.request().method() === "POST");
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  const response = await responseEvent;
  expect(response.status(), await response.text()).toBe(200);
  const activity = await response.json();
  const artifact = await (await context.request.get(`/api/v1/portfolio/${activity.id}/artifact`)).json();
  expect(artifact.scene).toEqual(saved.scene);
  await page.goto("/app/#portfolio");
  await expect(page.locator(".portfolio-work-card")).toHaveCount(1);
  await page.locator(".portfolio-work-card").click();
  const preview = page.locator(".portfolio-artifact-image img").first();
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const svg = await preview.evaluate(async (img: HTMLImageElement) => (await fetch(img.src)).text());
  expect(svg).toContain("도움 요청");
  expect(svg).toContain("stroke-width=\"2.5\"");
  await page.getByRole("dialog").screenshot({ path: ".local/hand-flow/submitted-portfolio.png", animations: "disabled" });
});

test("previously saved interactive drafts retain checks and canonical save behavior", async ({ page, context, account }) => {
  await hideAutomaticHelp(page, account);
  const legacyAnswers = ["이전 그림에서 오류 안내를 살펴봤어요.", "다시 시도할 방법을 그렸어요.", "친구에게 안내가 이해되는지 물어볼 거예요."];
  const seeded = await context.request.put("/api/v1/projects/developer/draft", {
    data: { clientRequestId: `preserve-original-${Date.now()}`, expectedVersion: 1,
      answers: legacyAnswers, interest: 3,
      scene: { elements: [{ id: "legacy-original-layout", type: "rectangle", x: 40, y: 40, width: 200, height: 120 }],
        appState: { viewBackgroundColor: "#ffffff" } } },
  });
  expect(seeded.status(), await seeded.text()).toBe(200);
  const legacyVersion = (await seeded.json()).version;
  const draftRequests: { expectedVersion: number }[] = [];
  page.on("request", request => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/v1/projects/developer/draft")
      draftRequests.push(request.postDataJSON());
  });
  const priorInteractive = await context.request.put("/api/v1/projects/developer/draft", {
    data: { clientRequestId: `saved-interactive-${Date.now()}`, expectedVersion: legacyVersion,
      answers: ["", "", ""], interest: null,
      scene: { elements: [], studio: { kind: "login-recovery", version: 2, message: "", messagePosition: { x: 24, y: 130 }, retry: null, support: null, preserveInput: null } } },
  });
  expect(priorInteractive.status(), await priorInteractive.text()).toBe(200);
  await page.goto("/app/#projects?career=developer");
  const studio = page.getByRole("region", { name: "로그인 복구 화면 작업실", exact: true });
  await expect(studio).toBeVisible();
  await expect(studio.getByRole("button", { name: "작동 확인", exact: true })).toBeEnabled();
  await expect(studio.locator(".studio-title")).toContainText("저장한 초안");
  const oldRevision = await context.request.get(`/api/v1/projects/developer/revisions/${legacyVersion}`);
  expect(oldRevision.status()).toBe(200);
  const original = await oldRevision.json();
  expect(original.answers).toEqual(legacyAnswers);
  expect(original.scene.elements.some((element: { id: string }) => element.id === "legacy-original-layout")).toBe(true);

  const message = "연결이 잠시 끊겼어요. 다시 시도하고 계속 안 되면 지원팀에 물어봐 주세요.";
  await studio.getByRole("button", { name: "화면 재료 살펴보기", exact: true }).click();
  await studio.getByRole("button", { name: "안내 문구 추가", exact: true }).click();
  await studio.getByRole("textbox", { name: /^안내 문구/ }).fill(message);
  await studio.getByRole("button", { name: "다시 시도 버튼 추가", exact: true }).click();
  await studio.getByRole("textbox", { name: "버튼 이름", exact: true }).fill("이어서 로그인하기");
  await studio.getByRole("combobox", { name: "누르면 이동할 화면", exact: true }).selectOption("login");
  await studio.getByRole("button", { name: "도움 요청 버튼 추가", exact: true }).click();
  await studio.getByRole("textbox", { name: "버튼 이름", exact: true }).fill("지원팀에 물어보기");
  await studio.getByRole("combobox", { name: "누르면 이동할 화면", exact: true }).selectOption("support");
  await studio.getByRole("combobox", { name: /^이전 입력 정보/ }).selectOption("true");
  const menu = studio.locator(".recovery-file-menu");
  await menu.locator("summary").click();
  await menu.getByRole("button", { name: "지금 저장", exact: true }).click();
  await expect(studio.locator(".studio-title")).toContainText("초안 저장 완료");
  const savedResponse = await context.request.get("/api/v1/projects/developer");
  expect(savedResponse.status()).toBe(200);
  const saved = await savedResponse.json();
  expect(saved.scene.studio).toMatchObject({ kind: "login-recovery", version: 2, message, preserveInput: true,
    retry: { label: "이어서 로그인하기", target: "login" }, support: { label: "지원팀에 물어보기", target: "support" } });
  // The API canonicalizes property order. Saving the same design again must
  // settle without recursive PUTs or manufacturing another revision.
  const settledCount = draftRequests.length;
  await menu.getByRole("button", { name: "지금 저장", exact: true }).click();
  const unchanged = await context.request.get("/api/v1/projects/developer");
  expect((await unchanged.json()).version).toBe(saved.version);
  expect(draftRequests).toHaveLength(settledCount);
  expect(draftRequests.length).toBeLessThan(12);
  await menu.locator("summary").click();
  await page.reload();
  await expect(studio).toBeVisible();
  await expect(studio.getByRole("button", { name: "안내 문구 편집", exact: true })).toContainText(message);
  await studio.getByRole("button", { name: "작동 확인", exact: true }).click();
  const screen = page.getByRole("region", { name: "내 설계 작동 화면", exact: true });
  const inspect = async (scenario: "recovered" | "offline", finish = true) => {
    await studio.getByRole("button", { name: scenario === "recovered" ? "연결이 돌아왔을 때" : "계속 연결되지 않을 때", exact: true }).click();
    await screen.getByRole("button", { name: "이어서 로그인하기", exact: true }).click();
    if (scenario === "offline" && finish)
      await screen.getByRole("button", { name: "지원팀에 물어보기", exact: true }).click();
    const checked = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/projects/developer/check" && response.request().method() === "POST");
    await studio.getByRole("button", { name: "이 경로 확인", exact: true }).click();
    const response = await checked;
    expect(response.status(), await response.text()).toBe(200);
    await expect(studio.getByRole("button", { name: "이 경로 확인", exact: true })).toBeEnabled();
  };
  await inspect("recovered");
  await expect(studio.getByRole("button", { name: "결과 검토", exact: true })).toBeDisabled();
  await inspect("offline");
  await expect(studio.getByRole("button", { name: "결과 검토", exact: true })).toBeEnabled();
  // A repeated intentional check is a fresh attempt, not replay of an older
  // aggregate report; a later successful route replaces a failed attempt.
  await inspect("offline", false);
  await expect(studio.getByRole("button", { name: "결과 검토", exact: true })).toBeDisabled();
  await inspect("offline");
  await expect(studio.getByRole("button", { name: "결과 검토", exact: true })).toBeEnabled();
  const checks = await context.request.get("/api/v1/projects/developer/checks");
  expect((await checks.json()).ready).toBe(true);
  const beforeSubmission = await context.request.get("/api/v1/state");
  expect((await beforeSubmission.json()).activities).toEqual([]);
  await studio.getByRole("button", { name: "결과 검토", exact: true }).click();
  await studio.getByRole("radio").nth(3).check();
  const submitted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/projects/developer/submit" && response.request().method() === "POST");
  await studio.getByRole("button", { name: "포트폴리오에 제출", exact: true }).click();
  const response = await submitted;
  expect(response.status(), await response.text()).toBe(200);
  const artifact = await response.json();
  // The local server may run in either template or AI mode. Submission itself
  // never requests an evaluation; Python tests assert each mode's exact status.
  expect(["not_requested", "not_connected"]).toContain(artifact.evaluationStatus);
  expect(artifact).toMatchObject({ studioKind: "login-recovery", checkMode: "rules", interest: 4,
    answers: ["", "", ""] });
  expect(artifact.designSummary).toHaveLength(3);
  expect(artifact.checks).toHaveLength(2);
  expect(artifact.checks.every((check: { passed: boolean }) => check.passed)).toBe(true);
  expect(artifact.scene.studio).toEqual(saved.scene.studio);
  expect(artifact.scene.elements.some((element: { type: string }) => element.type === "arrow")).toBe(true);
  const downloaded = await context.request.get(`/api/v1/portfolio/${artifact.id}/artifact`);
  expect(downloaded.status()).toBe(200);
  expect((await downloaded.json()).scene).toEqual(artifact.scene);
  await expect(page.getByRole("heading", { name: "직접 고치고 확인한 화면을 남겼어요.", exact: true })).toBeVisible();
  expect(draftRequests.length).toBeLessThan(14);
});
