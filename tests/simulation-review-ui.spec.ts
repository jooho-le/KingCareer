import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
const workplaces = JSON.parse(
  readFileSync(
    new URL("../backend/data/workplaces.json", import.meta.url),
    "utf8",
  ),
);
const incidents = JSON.parse(
  readFileSync(
    new URL("../backend/data/developer_incidents.json", import.meta.url),
    "utf8",
  ),
);
const careers = JSON.parse(
  readFileSync(
    new URL("../backend/data/careers.json", import.meta.url),
    "utf8",
  ),
);

const presentation = { ...workplaces.developer, ...incidents.incidents[0] };
const profile = {
  name: "화면 확인",
  username: "simulation_preview",
  school: "",
  grade: "",
  region: "",
  interests: [],
  onboarded: true,
  notifications: true,
};
function session(stage = "play") {
  return {
    id: "sim-preview",
    careerId: "developer",
    mode: "template",
    coachMode: "template",
    stage,
    step: 0,
    version: 1,
    activityId: stage === "completed" ? "activity-exact" : undefined,
    scenario: {
      title: presentation.title,
      text: presentation.brief,
      choices: [],
    },
    turns: [],
    response: null,
    fieldwork: {
      schema: "developer-fieldwork-v1",
      incidentId: "login-capacity",
      presentation,
      phase: stage === "completed" ? "done" : "inspect",
      minutes: 75,
      budget: 100,
      inspected: [] as string[],
      objects: presentation.objects,
      actions: presentation.actions,
      comparison: "",
      action: null as {
        id: string;
        name: string;
        result: string;
        metricValue: number;
      } | null,
      verification: "",
      handover: "",
      ending: null,
      metricValue: presentation.before,
      log: [],
      options: {
        compare: presentation.hypotheses.map((label: string, i: number) => ({
          id: String(i),
          label,
        })),
        act: [] as { id: string; label: string }[],
        verify: [] as { id: string; label: string }[],
        handover: [],
        liked: [],
        disliked: [],
        reflection: [],
      },
    },
  };
}

async function fixtures(page: Page, initial = session()) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "kingcareer:activity-help:v1:user%3Asimulation_preview:simulation",
      "hidden",
    );
  });
  // Catch every API request so no browser test can mutate a real student's data.
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/state")
      return route.fulfill({
        json: {
          profile,
          saved: [],
          activities: [],
          activeActivities: [],
          scores: {},
          interests: {},
          drafts: {},
          gaps: {},
          recommendations: [],
        },
      });
    if (path === "/catalog") return route.fulfill({ json: { careers } });
    if (path === "/simulations/sim-preview")
      return route.fulfill({ json: initial });
    if (path === "/simulations" && route.request().method() === "POST")
      return route.fulfill({
        json: { ...session("brief"), id: "new-session" },
      });
    if (path === "/achievements")
      return route.fulfill({
        json: {
          certificates: [
            {
              id: "activity-exact",
              careerId: "developer",
              title: "앱 개발자",
              name: "화면 확인",
              date: "2026-09-13T10:00:00Z",
              summary: "재확인 보류 · 다음 교대에 확인 필요",
              reflection: "단서 찾기가 흥미로웠어요.",
              badges: [
                {
                  id: "observer",
                  name: "현장 탐색가",
                  description: "자료를 열람했어요.",
                  art: "01",
                  earnedReason: "4곳 조사 · 오류 로그, 서버 장비 외 2곳",
                },
              ],
            },
          ],
          badges: [],
          availableBadges: [],
        },
      });
    // Public catalogs are local authored data. Other API calls must remain mocked.
    if (
      path === "/careers" ||
      path.startsWith("/careers/") ||
      path === "/regions" ||
      path === "/health"
    )
      return route.continue();
    return route.fulfill({
      status: 404,
      json: { detail: "화면 검사에 없는 API입니다." },
    });
  });
}

test("simulation layouts keep materials, outcomes and decisions reachable across viewports", async ({ page }) => {
  test.setTimeout(120000);
  const current = session();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixtures(page, current);
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    for (const phase of ["inspect", "act", "verify", "reflection"]) {
      current.stage = phase === "reflection" ? "reflection" : "play";
      current.fieldwork.phase = phase === "reflection" ? "done" : phase;
      current.fieldwork.action = ["verify", "reflection"].includes(phase) ? presentation.actions[0] : null;
      current.fieldwork.options.act = [{ id: "reason", label: "확인한 자료의 원인에 맞는 조치인지 먼저 살펴봐요." }];
      current.fieldwork.options.verify = [{ id: "check", label: "같은 조건에서 다시 측정하고 결과가 유지되는지 살펴봐요." }];
      Object.assign(current.fieldwork.options, {
        reflection: [{ id: "learned", label: "같은 문제도 자료를 확인하며 여러 방법으로 풀 수 있다는 걸 알았어요." }],
        liked: [{ id: "clues", label: "자료에서 단서를 찾는 순간" }],
        disliked: [{ id: "choices", label: "여러 조치를 비교하는 순간" }],
      });
      await page.goto(`/app/?layout-audit=${phase}-${width}#simulation?career=developer&session=sim-preview`);
      await expect(page.locator(".kc-fieldwork")).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const controls = await page.locator(".kc-fieldwork button, .kc-fieldwork select, .kc-fieldwork .kc-reflection-interest label span").evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => {
        const box = el.getBoundingClientRect();
        return { left: box.left, right: box.right, height: box.height, width: innerWidth };
      }));
      expect(controls.every(box => box.left >= 0 && box.right <= box.width + 1 && box.height >= 44)).toBe(true);
      if (phase === "verify") {
        await expect(page.locator(".kc-task-panel .kc-action-outcome")).toBeVisible();
        await expect(page.locator(".kc-action-outcome")).toHaveCount(1);
      }
      if (phase === "reflection") {
        const layout = await page.locator(".kc-workspace").evaluate(workspace => {
          const scene = workspace.querySelector(":scope > .kc-scene-panel")!.getBoundingClientRect();
          const guide = workspace.querySelector(":scope > .kc-mission-bar")!.getBoundingClientRect();
          const form = workspace.querySelector(":scope > .kc-task-panel")!.getBoundingClientRect();
          return { sceneGap: guide.top - scene.bottom, formGap: form.top - guide.bottom,
            aligned: Math.abs(guide.left - form.left) < 2, sideBySide: form.left >= scene.right,
            topGap: Math.abs(form.top - scene.top) };
        });
        expect(layout.sceneGap).toBeGreaterThanOrEqual(0);
        expect(layout.sceneGap).toBeLessThanOrEqual(20);
        if (width > 1100) {
          expect(layout.sideBySide).toBe(true);
          expect(layout.topGap).toBeLessThanOrEqual(2);
        } else {
          expect(layout.formGap).toBeGreaterThanOrEqual(0);
          expect(layout.formGap).toBeLessThanOrEqual(20);
          expect(layout.aligned).toBe(true);
        }
        const submitPlacement = await page.locator(".kc-decision-submit").evaluate(button => ({
          position: getComputedStyle(button).position,
          gap: button.getBoundingClientRect().top - document.querySelector(".kc-reflection-interest")!.getBoundingClientRect().bottom,
        }));
        expect(submitPlacement.position).toBe("static");
        expect(submitPlacement.gap).toBeGreaterThanOrEqual(0);
        await expect(page.locator(".kc-reflection-extra")).not.toHaveAttribute("open", "");
        await page.getByRole("radio", { name: "5", exact: true }).check();
        await expect(page.getByRole("radio", { name: "5", exact: true })).toBeChecked();
        await page.locator(".kc-reflection-extra summary").click();
        await expect(page.getByRole("group", { name: "어떤 순간이 좋았어? (선택)" })).toBeVisible();
      }
      if (width === 1440 && phase === "inspect") {
        const scene = page.locator(".kc-scene");
        await scene.scrollIntoViewIfNeeded();
        await expect(scene.locator("canvas")).toBeVisible();
        const box = (await scene.boundingBox())!;
        const scroll = await page.evaluate(() => ({ page: scrollY, panel: document.querySelector(".kc-scene-panel")!.scrollTop }));
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => ({ page: scrollY, panel: document.querySelector(".kc-scene-panel")!.scrollTop }))).toEqual(scroll);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: `.local/simulation-layout/${phase}-${width}.png`, fullPage: true, animations: "disabled" });
    }
  }
  expect(errors).toEqual([]);
});

test("saved incident drives material names and automatic scene quality remains adjustable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtures(page);
  await page.goto("/app/#simulation?career=developer&session=sim-preview");
  await expect(
    page.getByRole("heading", { name: presentation.title, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".kc-current-task")).toContainText(
    "서버 장비: 미확인",
  );
  await expect(page.locator(".kc-current-task")).not.toContainText(
    "배포 기록: 미확인",
  );
  const scene = await page.locator(".kc-scene").boundingBox();
  expect(scene!.height).toBeGreaterThanOrEqual(260);
  await expect(page.locator(".kc-material-index")).not.toHaveAttribute("open", "");
  await expect(page.locator(".kc-task-panel")).toBeHidden();
  await expect(page.locator(".kc-scenario-context")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.screenshot({
    path: ".local/current-review/simulation-inspect-viewport.png",
    animations: "disabled",
  });
  const quality = page.getByRole("combobox", { name: "화질" });
  await page.locator(".kc-view-settings summary").click();
  await expect(quality).toHaveValue("auto");
  await expect(quality.locator("option:checked")).toHaveText("자동 (가벼움)");
  await quality.selectOption("high");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("kingcareer.scene.quality")),
    )
    .toBe("high");
  await page.reload();
  await page.locator(".kc-view-settings summary").click();
  await expect(quality).toHaveValue("high");
  await quality.selectOption("auto");
  await expect(quality.locator("option:checked")).toHaveText("자동 (가벼움)");
  await page.getByRole("button", { name: "2D 목록 보기", exact: true }).click();
  await expect(page.locator(".kc-object-list button")).toHaveCount(6);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: ".local/current-review/simulation-variant-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "화면 안내", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "화면 이용 안내" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "화면 이용 안내" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("start briefing is above the workplace, investigation unlocks decisions and action results stay visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let current = session("brief");
  await fixtures(page, current);
  await page.route("**/api/v1/simulations/sim-preview/turn", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.expectedVersion).toBe(current.version);
    current = structuredClone(current);
    current.version++;
    if (body.kind === "start") current.stage = "play";
    if (
      body.kind === "inspect" &&
      !current.fieldwork.inspected.includes(body.objectId)
    )
      current.fieldwork.inspected.push(body.objectId);
    if (body.kind === "compare") {
      current.fieldwork.phase = "act";
      current.fieldwork.options.act = [
        { id: "reason", label: "확인한 자료에서 찾은 원인에 맞는 조치예요." },
      ];
    }
    if (body.kind === "act") {
      current.fieldwork.phase = "verify";
      current.fieldwork.action = presentation.actions.find(
        (item: { id: string }) => item.id === body.actionId,
      );
      current.fieldwork.metricValue = current.fieldwork.action?.metricValue;
      current.fieldwork.options.verify = [
        {
          id: "check",
          label: "같은 조건에서 로그인과 대기열을 다시 확인해요.",
        },
      ];
    }
    return route.fulfill({ json: current });
  });
  await page.goto("/app/#simulation?career=developer&session=sim-preview");
  const task = page.locator(".kc-current-task");
  const materials = page.locator(".kc-scene-panel");
  await expect(
    page.getByRole("button", { name: "업무 시작", exact: true }),
  ).toBeVisible();
  await expect(materials).toHaveAttribute("open", "");
  expect(
    await task.evaluate(
      (element) =>
        !!(
          element.compareDocumentPosition(
            document.querySelector(".kc-scene-panel")!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
    ),
  ).toBe(true);
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const start = page.getByRole("button", { name: "업무 시작", exact: true });
    await expect(start).toBeInViewport({ ratio: 1 });
    const buttonBox = (await start.boundingBox())!;
    const sceneBox = (await materials.boundingBox())!;
    expect(buttonBox.y + buttonBox.height).toBeLessThan(sceneBox.y);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".local/simulation-start-390.png", animations: "disabled" });
  await page.getByRole("button", { name: "업무 시작", exact: true }).click();
  await expect(materials).toHaveAttribute("open", "");
  await expect(task).toContainText("자료를 살펴보고 원인을 찾아요");
  expect(await task.evaluate(element => !!(element.compareDocumentPosition(document.querySelector(".kc-scene-panel")!) & Node.DOCUMENT_POSITION_PRECEDING))).toBe(true);
  await page.getByRole("button", { name: "2D 목록 보기", exact: true }).click();
  const choose = page.getByRole("button", {
    name: "이렇게 해볼래요",
    exact: true,
  });
  await expect(page.locator(".kc-task-panel")).toBeHidden();
  await expect(page.getByRole("button", { name: "원인 선택으로 이동", exact: true })).toBeDisabled();
  for (const id of [...presentation.required, "dashboard"]) {
    const object = presentation.objects.find(
      (item: { id: string }) => item.id === id,
    );
    await page
      .locator(".kc-object-list button")
      .filter({ hasText: object.name })
      .click();
    await expect(page.locator(".kc-inspection")).toContainText(object.reading);
  }
  await expect(
    page.getByRole("button", { name: "원인 선택으로 이동", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "원인 선택으로 이동", exact: true })
    .click();
  await expect(page.locator(".kc-task-panel h2")).toBeFocused();
  await expect(page.locator(".kc-material-reading")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".kc-task-panel")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".kc-task-panel")).toBeVisible();
  await page.locator(".kc-choice-cards label").first().click();
  await choose.click();
  await expect(materials).toHaveAttribute("open", "");
  await expect(page.locator("#current-task-title")).toBeFocused();
  await expect(task).toContainText("자료를 바탕으로 조치를 골라요");
  await page
    .locator(".kc-action-options label")
    .filter({ hasText: presentation.actions[1].name })
    .click();
  await page.locator(".kc-choice-cards label").first().click();
  await choose.click();
  await expect(page.locator(".kc-action-outcome")).toContainText(
    presentation.actions[1].result,
  );
  expect(
    await page
      .locator(".kc-action-outcome")
      .evaluate(
        (element) =>
          !!(
            element.compareDocumentPosition(
              document.querySelector(".kc-task-panel .kc-choice-cards")!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
  ).toBe(true);
  await expect(page.locator(".kc-log")).not.toHaveAttribute("open", "");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  const sizes = await page
    .locator(".kc-fieldwork .kc-button, .kc-materials-heading")
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length)
        .map((element) => ({
          height: element.getBoundingClientRect().height,
          font: parseFloat(getComputedStyle(element).fontSize),
        })),
    );
  expect(sizes.every((size) => size.height >= 44 && size.font >= 14)).toBe(
    true,
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: ".local/current-review/simulation-verify-viewport.png",
    animations: "disabled",
  });
  await page.screenshot({
    path: ".local/current-review/simulation-mobile-task-flow.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(materials).toHaveAttribute("open", "");
  await expect(page.locator(".kc-object-list button")).toHaveCount(6);
  await expect(task).toContainText("조치 뒤 무엇이 달라졌는지 확인해요");
  expect(errors).toEqual([]);
});

test("investigation saves before showing evidence, retries once and returns keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const current = session();
  await fixtures(page, current);
  const requests: { clientRequestId: string; objectId: string }[] = [];
  await page.route("**/api/v1/simulations/sim-preview/turn", async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1) return route.fulfill({ status: 503, json: { detail: "조사 기록을 저장하지 못했어요." } });
    current.version++;
    current.fieldwork.inspected.push(body.objectId);
    return route.fulfill({ json: current });
  });
  await page.goto("/app/#simulation?career=developer&session=sim-preview");
  await page.locator(".kc-material-index summary").click();
  const trigger = page.locator(".kc-object-list button").first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".kc-inspection")).toContainText("아직 저장되지 않았어요");
  await expect(page.locator(".kc-inspection h3")).toHaveCount(0);
  await page.getByRole("button", { name: "조사 다시 시도", exact: true }).click();
  await expect(page.locator(".kc-inspection h3")).toHaveText(current.fieldwork.objects[0].reading);
  expect(requests).toHaveLength(2);
  expect(requests[1].clientRequestId).toBe(requests[0].clientRequestId);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".kc-material-reading")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".kc-material-reading")).toBeVisible();
  await page.getByRole("button", { name: "조사 자료 닫기" }).click();
  await expect(page.locator(".kc-material-reading")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await expect(page.locator(".kc-material-reading")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(requests).toHaveLength(2);
});

test("certificate shows and exports earned reason, review keeps exact activity, replay starts next incident", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixtures(page, session("completed"));
  await page.goto("/app/#simulation?career=developer&session=sim-preview");
  await expect(page.locator(".kc-earned-badge")).toContainText(
    "4곳 조사 · 오류 로그, 서버 장비 외 2곳",
  );
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "수료 카드 다운로드", exact: true })
    .click();
  const download = await downloaded;
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = await readFile(path!, "utf8");
  expect(exported).toContain("4곳 조사 · 오류 로그, 서버");
  expect(exported).toContain("장비 외 2곳");
  await page
    .getByRole("button", { name: "크랩과 경험 돌아보기", exact: true })
    .click();
  await expect(page).toHaveURL(
    /#review\?career=developer&activityId=activity-exact$/,
  );
  await page.goto("/app/#simulation?career=developer&session=sim-preview");
  await page
    .getByRole("button", { name: "다른 사건으로 다시 출근", exact: true })
    .click();
  await expect(page).toHaveURL(/session=new-session$/);
  await expect(
    page.getByRole("button", { name: "업무 시작", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
