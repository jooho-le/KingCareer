import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));
type Scenario = "recovered" | "offline";
type Action = "retry" | "support";
type Check = { scenario: Scenario; passed: boolean; message: string; actions: Action[] };
type Design = {
  kind: "login-recovery";
  version: 2;
  message: string;
  messagePosition: { x: number; y: number };
  retry: null | { label: string; target: null | "login" | "support"; x: number; y: number };
  support: null | { label: string; target: null | "login" | "support"; x: number; y: number };
  preserveInput: null | boolean;
};
type Scene = { elements: any[]; appState?: { viewBackgroundColor: string }; studio?: Design };
type Draft = { careerId: string; answers: string[]; version: number; interest: null | number; scene: Scene | null };

// Match FastAPI/Pydantic's response ordering, which differs from sceneFromRecovery.
// Equal saved content must stay equal when the server reconstructs its objects.
function canonicalScene(value: Scene | null): Scene | null {
  if (!value) return null;
  const scene: Scene = { elements: structuredClone(value.elements), appState: { viewBackgroundColor: "#ffffff" } };
  if (value.studio) {
    const studio = value.studio;
    const button = (control: Design["retry"]) => control && ({ x: control.x, y: control.y, label: control.label, target: control.target });
    scene.studio = {
      kind: studio.kind, version: studio.version, message: studio.message,
      messagePosition: { x: studio.messagePosition.x, y: studio.messagePosition.y },
      retry: button(studio.retry), support: button(studio.support), preserveInput: studio.preserveInput,
    };
  }
  return scene;
}

// This fake server is deliberately independent of the editor's implementation.
// It rejects stale writes and binds successful path checks to the saved design.
async function fixture(page: Page, initial?: Partial<Draft>) {
  let draft: Draft = { careerId: "developer", answers: ["", "", ""], version: 0, interest: null, scene: null, ...initial };
  draft.scene = canonicalScene(draft.scene);
  let checks: Check[] = [];
  let failure: "save" | "check" | null = null;
  const mutations: { method: string; path: string; body: any }[] = [];
  const errors: string[] = [], unexpected: string[] = [];
  const activities: any[] = [];
  const requests = new Map<string, { fingerprint: string; response: any }>();
  const sceneSignature = (scene: Scene | null) => {
    const canonical = canonicalScene(scene);
    return JSON.stringify(canonical?.studio ?? canonical);
  };
  const report = () => {
    const design = draft.scene?.studio;
    const issues = [
      !design?.message.trim() && "오류 안내 문구가 필요해요.",
      design?.retry?.target !== "login" && "다시 시도 버튼을 로그인 화면에 연결해 주세요.",
      design?.support?.target !== "support" && "도움 요청 버튼을 도움 요청 화면에 연결해 주세요.",
      design?.preserveInput == null && "이전 입력 정보를 어떻게 할지 골라 주세요.",
    ].filter(Boolean) as string[];
    return { version: draft.version, mode: "rules", checks, issues,
      ready: !issues.length && ["recovered", "offline"].every(scenario => checks.some(check => check.scenario === scenario && check.passed)) };
  };
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("kingcareer:activity-help:v1:user%3Arecovery_student:projects", "hidden"));
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), method = request.method(), path = new URL(request.url()).pathname;
    if (method === "GET" && path.endsWith("/catalog")) return route.fulfill({ json: { careers } });
    if (method === "GET" && path.endsWith("/state")) return route.fulfill({ json: {
      profile: { name: "복구 화면 설계자", username: "recovery_student", onboarded: true, interests: [] },
      saved: [], activities, activeActivities: [], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [],
    } });
    if (method === "GET" && path.endsWith("/projects/developer")) return route.fulfill({ json: draft });
    if (method === "GET" && path.endsWith("/projects/developer/checks")) return route.fulfill({ json: report() });
    if (["PUT", "POST"].includes(method) && /\/projects\/developer\/(draft|check|submit)$/.test(path)) {
      const body = request.postDataJSON();
      mutations.push({ method, path, body });
      const idempotencyKey = `${path}:${body.clientRequestId}`;
      const fingerprint = JSON.stringify(body);
      const cached = requests.get(idempotencyKey);
      if (!body.clientRequestId) return route.fulfill({ status: 422, json: { detail: "요청 식별자가 필요해요." } });
      if (cached) return route.fulfill(cached.fingerprint === fingerprint
        ? { json: cached.response }
        : { status: 409, json: { detail: "같은 요청 식별자의 내용이 달라졌어요." } });
      if (body.expectedVersion !== draft.version) return route.fulfill({ status: 409, json: { detail: "저장된 수정본이 바뀌었어요." } });
      let response: unknown;
      if (path.endsWith("/draft") && method === "PUT") {
        if (failure === "save") {
          failure = null;
          return route.fulfill({ status: 503, json: { detail: "초안을 저장하지 못했어요. 입력은 유지돼요." } });
        }
        if (sceneSignature(draft.scene) !== sceneSignature(body.scene)) checks = [];
        draft = { careerId: "developer", scene: canonicalScene(body.scene), answers: body.answers, interest: body.interest, version: draft.version + 1 };
        response = draft;
      } else if (path.endsWith("/check") && method === "POST") {
        if (failure === "check") {
          failure = null;
          return route.fulfill({ status: 503, json: { detail: "작동 확인을 저장하지 못했어요. 설계와 눌렀던 경로는 남아 있어요." } });
        }
        const design = draft.scene?.studio;
        const actions = body.actions as Action[];
        const structurallyReady = report().issues.length === 0;
        const passed = structurallyReady && (body.scenario === "recovered"
          ? actions[0] === "retry" && design?.retry?.target === "login"
          : actions[0] === "retry" && actions.at(-1) === "support" && design?.support?.target === "support");
        const check: Check = { scenario: body.scenario, passed, actions,
          message: passed ? "내가 만든 경로에서 다음 화면으로 이동했어요." : "아직 이동할 수 없는 경로가 있어요. 연결을 수정해 주세요." };
        checks = [...checks.filter(value => value.scenario !== body.scenario), check];
        response = report();
      } else if (path.endsWith("/submit") && method === "POST") {
        if (!report().ready || body.interest == null) return route.fulfill({ status: 422, json: { detail: "두 상황을 현재 설계에서 확인하고 관심도를 골라 주세요." } });
        response = { id: "recovery-artifact", careerId: "developer", kind: "project", title: "로그인 복구 화면 설계", date: "2026-09-13T01:00:00Z",
          scene: structuredClone(draft.scene), answers: draft.answers, interest: body.interest, before: [], after: [], reflection: "",
          feedback: "설계와 확인 기록을 저장했어요.", evaluationStatus: "not_connected", observations: [] };
        activities.push(response);
      } else {
        unexpected.push(`${method} ${path}`);
        return route.fulfill({ status: 405, json: { detail: "허용하지 않는 요청 방식이에요." } });
      }
      requests.set(idempotencyKey, { fingerprint, response: structuredClone(response) });
      return route.fulfill({ json: response });
    }
    unexpected.push(`${method} ${path}`);
    return route.fulfill({ status: 503, json: { detail: "이 검사에서는 외부 API나 AI를 호출하지 않아요." } });
  });
  return {
    draft: () => draft, checks: () => checks, mutations, errors, unexpected, activities,
    failNext: (kind: "save" | "check") => { failure = kind; },
  };
}

async function openStudio(page: Page) {
  await page.goto("/app/#projects?career=developer");
  await expect(page.getByRole("button", { name: "작동 확인", exact: true })).toBeVisible();
}

async function openFileMenu(page: Page) {
  const menu = page.locator(".recovery-file-menu");
  if (await menu.getAttribute("open") === null) await menu.locator("summary").click();
}

async function createDesign(page: Page, preserve = true) {
  await page.getByRole("button", { name: "화면 재료 살펴보기", exact: true }).click();
  await page.getByRole("button", { name: "안내 문구 추가", exact: true }).click();
  await page.getByRole("textbox", { name: /^안내 문구/ }).fill("연결이 잠깐 끊겼어요. 입력한 정보를 그대로 두고 다시 시도해 주세요.");
  await page.getByRole("button", { name: "다시 시도 버튼 추가", exact: true }).click();
  await page.getByRole("textbox", { name: "버튼 이름", exact: true }).fill("이어서 로그인하기");
  await page.getByRole("combobox", { name: "누르면 이동할 화면", exact: true }).selectOption("login");
  await page.getByRole("button", { name: "도움 요청 버튼 추가", exact: true }).click();
  await page.getByRole("textbox", { name: "버튼 이름", exact: true }).fill("지원팀에 물어보기");
  await page.getByRole("combobox", { name: "누르면 이동할 화면", exact: true }).selectOption("support");
  await page.getByRole("combobox", { name: /^이전 입력 정보/ }).selectOption(String(preserve));
}

async function tryPath(page: Page, scenario: Scenario) {
  await page.getByRole("button", { name: scenario === "recovered" ? "연결이 돌아왔을 때" : "계속 연결되지 않을 때", exact: true }).click();
  const screen = page.getByRole("region", { name: "내 설계 작동 화면", exact: true });
  await screen.getByRole("button", { name: "이어서 로그인하기", exact: true }).click();
  if (scenario === "offline") {
    await expect(page.locator(".recovery-runtime-notice")).toContainText("연결이 아직 돌아오지 않았어요");
    await screen.getByRole("button", { name: "지원팀에 물어보기", exact: true }).click();
    await expect(screen.getByRole("heading", { name: "도움을 요청해요", exact: true })).toBeVisible();
  } else await expect(screen.getByRole("heading", { name: "다시 만나 반가워요", exact: true })).toBeVisible();
}

const completeDesign = (): Design => ({
  kind: "login-recovery", version: 2,
  message: "연결을 확인하고 다시 시도해 주세요. 계속 안 되면 지원팀에 물어보세요.",
  messagePosition: { x: 24, y: 130 },
  retry: { label: "이어서 로그인하기", target: "login", x: 24, y: 240 },
  support: { label: "지원팀에 물어보기", target: "support", x: 24, y: 300 },
  preserveInput: true,
});
const existingStudio = (studio = completeDesign()): Partial<Draft> => ({
  version: 2, scene: { studio, elements: [{ id: "saved-design", type: "rectangle", x: 0, y: 0, width: 300, height: 420 }] },
});

test("a student places and connects a recovery design, tries both outcomes, then explicitly submits", async ({ page }) => {
  // Previously saved interactive drafts stay usable; new projects now use hand drawing.
  const server = await fixture(page, existingStudio({ kind: "login-recovery", version: 2,
    message: "", messagePosition: { x: 24, y: 130 }, retry: null, support: null, preserveInput: null }));
  await openStudio(page);
  await expect(page.getByRole("button", { name: "작동 확인", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "포트폴리오에 제출", exact: true })).toHaveCount(0);
  await createDesign(page);
  // The same insertion action should not remain after its component exists.
  for (const name of ["안내 문구 추가", "다시 시도 버튼 추가", "도움 요청 버튼 추가"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  const retry = page.getByRole("button", { name: "다시 시도 버튼 편집", exact: true });
  await retry.click();
  await page.keyboard.press("ArrowRight");
  const supportBounds = (await page.getByRole("button", { name: "도움 요청 버튼 편집", exact: true }).boundingBox())!;
  const supportCenter = { x: supportBounds.x + supportBounds.width / 2, y: supportBounds.y + supportBounds.height / 2 };
  await page.mouse.move(supportCenter.x, supportCenter.y);
  await page.mouse.down();
  await page.mouse.move(supportCenter.x + 16, supportCenter.y - 8, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "작동 확인", exact: true }).click();
  await expect.poll(() => server.draft().scene?.studio?.retry?.x).toBe(32);
  expect(server.draft().scene?.studio?.support).toMatchObject({ x: 40, y: 316 });
  expect(server.activities).toHaveLength(0);
  await expect(page.getByRole("button", { name: "결과 검토", exact: true })).toBeDisabled();
  await tryPath(page, "recovered");
  await expect(page.locator(".recovery-runtime-notice")).toContainText("이전 입력이 남아 있어요");
  expect(server.checks()).toHaveLength(0);
  await page.getByRole("button", { name: "이 경로 확인", exact: true }).click();
  await expect.poll(() => server.checks().filter(check => check.passed).length).toBe(1);
  await expect(page.getByRole("button", { name: "결과 검토", exact: true })).toBeDisabled();
  await tryPath(page, "offline");
  await page.getByRole("button", { name: "이 경로 확인", exact: true }).click();
  await expect(page.getByRole("button", { name: "결과 검토", exact: true })).toBeEnabled();
  expect(server.activities).toHaveLength(0);
  await page.getByRole("button", { name: "결과 검토", exact: true }).click();
  await page.getByRole("radio").nth(3).click();
  const submit = page.getByRole("button", { name: "포트폴리오에 제출", exact: true });
  await expect(submit).toHaveCount(1);
  await submit.click();
  await expect.poll(() => server.activities.length).toBe(1);
  await expect(page.locator(".kc-project-result")).toBeVisible();
  expect(server.activities[0].scene.studio.retry).toMatchObject({ x: 32, target: "login", label: "이어서 로그인하기" });
  expect(server.mutations.filter(request => request.path.endsWith("/submit"))).toHaveLength(1);
  expect(server.errors).toEqual([]);
  expect(server.unexpected).toEqual([]);
});

test("failed path saving can retry without losing actions; editing invalidates checks and restores the new draft", async ({ page }) => {
  const server = await fixture(page, existingStudio());
  await openStudio(page);
  await page.getByRole("button", { name: "작동 확인", exact: true }).click();
  await tryPath(page, "recovered");
  server.failNext("check");
  await page.getByRole("button", { name: "이 경로 확인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("설계와 눌렀던 경로는 남아 있어요");
  expect(server.checks()).toHaveLength(0);
  await expect(page.getByRole("button", { name: "결과 검토", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "이 경로 확인", exact: true }).click();
  await expect.poll(() => server.checks().length).toBe(1);
  const retries = server.mutations.filter(request => request.path.endsWith("/check"));
  expect(retries[0].body).toEqual(retries[1].body);
  await tryPath(page, "offline");
  await page.getByRole("button", { name: "이 경로 확인", exact: true }).click();
  await expect(page.getByRole("button", { name: "결과 검토", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "설계 수정", exact: true }).click();
  await page.getByRole("button", { name: "안내 문구 편집", exact: true }).click();
  const changed = "먼저 연결 상태를 살펴봐요. 안 되면 지원팀에 도움을 요청할 수 있어요.";
  const writesBeforeEdit = server.mutations.filter(request => request.path.endsWith("/draft")).length;
  server.failNext("save");
  await page.getByRole("textbox", { name: /^안내 문구/ }).fill(changed);
  await page.getByRole("button", { name: "작동 확인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("초안을 저장하지 못했어요");
  // The server still has the old, successful design. Those results must not be
  // relabelled as checks of the changed, unsaved work shown in the browser.
  expect(server.checks().filter(check => check.passed)).toHaveLength(2);
  await expect(page.getByRole("button", { name: "결과 검토", exact: true })).toBeDisabled();
  await openFileMenu(page);
  await page.getByRole("button", { name: "지금 저장", exact: true }).click();
  await expect.poll(() => server.draft().scene?.studio?.message).toBe(changed);
  await expect(page.locator(".studio-title [role='status']")).toContainText("저장 완료");
  // Here network idle is the assertion under test: a server-normalized response
  // must settle, rather than triggering an unbounded stream of new saves.
  await page.waitForLoadState("networkidle", { timeout: 5_000 });
  expect(server.mutations.filter(request => request.path.endsWith("/draft")).length - writesBeforeEdit).toBe(2);
  expect(Object.keys(server.draft().scene!)).toEqual(["elements", "appState", "studio"]);
  expect(Object.keys(server.draft().scene!.studio!.retry!)).toEqual(["x", "y", "label", "target"]);
  expect(server.checks()).toHaveLength(0);
  await page.reload();
  await page.getByRole("button", { name: "안내 문구 편집", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^안내 문구/ })).toHaveValue(changed);
  await page.getByRole("button", { name: "작동 확인", exact: true }).click();
  await expect(page.getByRole("button", { name: "결과 검토", exact: true })).toBeDisabled();
  expect(server.activities).toHaveLength(0);
  expect(server.errors).toEqual([]);
  expect(server.unexpected).toEqual([]);
});

test("wrong destinations visibly lead to the wrong screen; incomplete connections never unlock review", async ({ page }) => {
  const design = completeDesign();
  design.retry!.target = "support";
  design.preserveInput = false;
  const server = await fixture(page, existingStudio(design));
  await openStudio(page);
  await page.getByRole("button", { name: "작동 확인", exact: true }).click();
  await page.getByRole("button", { name: "연결이 돌아왔을 때", exact: true }).click();
  const screen = page.getByRole("region", { name: "내 설계 작동 화면", exact: true });
  await screen.getByRole("button", { name: "이어서 로그인하기", exact: true }).click();
  await expect(screen.getByRole("heading", { name: "도움을 요청해요", exact: true })).toBeVisible();
  await expect(screen.getByRole("heading", { name: "다시 만나 반가워요", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "이 경로 확인", exact: true }).click();
  await expect.poll(() => server.checks().length).toBe(1);
  expect(server.checks()[0].passed).toBe(false);
  await expect(page.getByRole("button", { name: "결과 검토", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "설계 수정", exact: true }).click();
  await page.getByRole("button", { name: "다시 시도 버튼 편집", exact: true }).click();
  await page.getByRole("combobox", { name: "누르면 이동할 화면", exact: true }).selectOption("login");
  await page.getByRole("button", { name: "작동 확인", exact: true }).click();
  await tryPath(page, "recovered");
  await expect(page.locator(".recovery-runtime-notice")).toContainText("입력 정보가 지워졌어요");
  await page.getByRole("button", { name: "이 경로 확인", exact: true }).click();
  await expect.poll(() => server.checks().some(check => check.scenario === "recovered" && check.passed)).toBe(true);
  expect(server.activities).toHaveLength(0);
  expect(server.errors).toEqual([]);
  expect(server.unexpected).toEqual([]);
});

test("desktop and phone show one readable work area with contained scrolling and reachable controls", async ({ page }) => {
  test.setTimeout(75_000);
  const server = await fixture(page, existingStudio());
  await openStudio(page);
  const savedBefore = JSON.stringify(server.draft());
  await openFileMenu(page);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "설계도 SVG 받기", exact: true }).click();
  const exported = await downloadEvent;
  const exportedPath = test.info().outputPath("recovery-design.svg");
  await exported.saveAs(exportedPath);
  const svg = readFileSync(exportedPath, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("이어서 로그인하기");
  expect(svg).toContain("지원팀에 물어보기");
  // The student's 'do not show again' setting suppresses automatic help, but
  // both manual replays must still work and leave the saved drawing alone.
  for (let replay = 0; replay < 2; replay++) {
    await openFileMenu(page);
    await page.getByRole("button", { name: "화면 안내", exact: true }).click();
    const overlay = page.getByRole("dialog", { name: "화면 이용 안내", exact: true });
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole("heading")).toHaveText("어디서 사용자가 막혔을까?");
    await overlay.getByRole("button", { name: "다음 →", exact: true }).click();
    await expect(overlay.getByRole("heading")).toHaveText("내 화면에 직접 놓아봐");
    await overlay.getByRole("button", { name: "안내 닫기", exact: true }).click();
    await expect(overlay).toHaveCount(0);
    await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  }
  expect(JSON.stringify(server.draft())).toBe(savedBefore);
  if (await page.locator(".recovery-file-menu").getAttribute("open") !== null) await page.locator(".recovery-file-menu > summary").click();
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "작동 확인", exact: true })).toBeInViewport();
    const button = page.getByRole("button", { name: "다시 시도 버튼 편집", exact: true });
    await expect(button).toBeInViewport();
    const before = await page.evaluate(() => window.scrollY);
    await button.hover();
    await page.mouse.wheel(0, 750);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    await page.screenshot({ path: `.local/recovery-studio/workspace-${width}.png`, animations: "disabled" });
    await page.getByRole("button", { name: "작동 확인", exact: true }).click();
    const screen = page.getByRole("region", { name: "내 설계 작동 화면", exact: true });
    await expect(screen).toBeVisible();
    await expect(page.getByRole("button", { name: "설계 수정", exact: true })).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/recovery-studio/preview-${width}.png`, animations: "disabled" });
    await page.getByRole("button", { name: "설계 수정", exact: true }).click();
  }
  expect(server.errors).toEqual([]);
  expect(server.unexpected).toEqual([]);
});

test("existing student drawings open unchanged and are not silently converted to the new studio", async ({ page }) => {
  const legacy = [
    { id: "student-old-card", type: "rectangle", x: 60, y: 80, width: 250, height: 110, customData: { kingCareerStep: { order: 0 } } },
    { id: "student-old-text", type: "text", x: 78, y: 108, width: 220, height: 25, fontSize: 20, text: "내가 직접 만든 로그인 화면", originalText: "내가 직접 만든 로그인 화면" },
  ];
  const server = await fixture(page, { version: 3, scene: { elements: legacy }, answers: ["로그인 화면을 직접 그려 보았어요.", "", ""] });
  await page.goto("/app/#projects?career=developer");
  await expect(page.locator(".excalidraw")).toBeVisible();
  await expect(page.getByRole("button", { name: "그림 전체 보기", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "안내 문구 추가", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "내 설명", exact: true }).click();
  await expect(page.locator(".kc-writing-grid textarea").first()).toHaveValue("로그인 화면을 직접 그려 보았어요.");
  expect(server.draft().scene?.studio).toBeUndefined();
  for (const element of legacy) expect(server.draft().scene?.elements.find(value => value.id === element.id)).toMatchObject(element);
  expect(server.activities).toHaveLength(0);
  expect(server.errors).toEqual([]);
  expect(server.unexpected).toEqual([]);
});
