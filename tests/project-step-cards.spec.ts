import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const careers = JSON.parse(
  readFileSync(
    new URL("../backend/data/careers.json", import.meta.url),
    "utf8",
  ),
);

test("keyboard cards persist as connected artwork and survive editing, failed saves, and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let draft: any = {
    careerId: "developer",
    answers: ["", "", ""],
    version: 0,
    interest: null,
    scene: { elements: [], appState: { viewBackgroundColor: "#ffffff" } },
  };
  let failSave = false;
  await page.addInitScript(() =>
    localStorage.setItem(
      "kingcareer:activity-help:v1:user%3Acards_student:projects",
      "hidden",
    ),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/catalog")) return route.fulfill({ json: { careers } });
    if (path.endsWith("/state"))
      return route.fulfill({
        json: {
          profile: {
            name: "카드 작성",
            username: "cards_student",
            onboarded: true,
            interests: [],
          },
          saved: [],
          activities: [],
          scores: {},
          interests: {},
          drafts: {},
          gaps: {},
          recommendations: [],
        },
      });
    if (path.endsWith("/projects/developer"))
      return route.fulfill({ json: draft });
    if (path.endsWith("/projects/developer/draft")) {
      if (failSave)
        return route.fulfill({
          status: 503,
          json: { detail: "저장을 다시 시도해 주세요." },
        });
      const body = route.request().postDataJSON();
      draft = {
        ...draft,
        answers: body.answers,
        scene: body.scene,
        interest: body.interest,
        version: draft.version + 1,
      };
      return route.fulfill({ json: draft });
    }
    return route.fulfill({
      status: 503,
      json: { detail: "모델 API는 사용하지 않습니다." },
    });
  });
  await page.goto("/app/#projects?career=developer");
  const cards = page.getByRole("region", { name: "어떤 순서로 해결할까?" });
  await expect(cards).toBeVisible();
  await expect(
    page.getByRole("button", { name: "단계 카드로 만들기", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const first = cards.getByRole("textbox", {
    name: "1단계 할 일",
    exact: true,
  });
  await first.focus();
  await page.keyboard.insertText("오류 안내 확인하기");
  await page.keyboard.press("Tab");
  await expect(
    cards.getByRole("textbox", { name: "1단계 방법", exact: true }),
  ).toBeFocused();
  await page.keyboard.insertText("사용자가 다음 행동을 알 수 있는지 확인한다.");
  const add = cards.getByRole("button", { name: /단계 추가/ });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(
    cards.getByRole("textbox", { name: "2단계 할 일", exact: true }),
  ).toBeFocused();
  await page.keyboard.insertText("다시 시도 버튼 추가하기");
  await page.keyboard.press("Tab");
  await page.keyboard.insertText("입력한 내용은 유지한다.");
  await cards
    .getByRole("button", { name: "2단계 위로 이동", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(first).toBeFocused();
  await expect(first).toHaveValue("다시 시도 버튼 추가하기");
  const save = page
    .locator(".studio-topbar")
    .getByRole("button", { name: "저장", exact: true });
  await save.click();
  await expect
    .poll(
      () =>
        draft.scene.elements.filter(
          (element: any) => element.type === "rectangle",
        ).length,
    )
    .toBe(2);
  const rectangles = draft.scene.elements.filter(
    (element: any) => element.type === "rectangle",
  );
  const arrow = draft.scene.elements.find(
    (element: any) => element.type === "arrow",
  );
  expect(
    rectangles.map((element: any) => element.customData.kingCareerStep.order),
  ).toEqual([0, 1]);
  expect(arrow.startBinding.elementId).toBe(rectangles[0].id);
  expect(arrow.endBinding.elementId).toBe(rectangles[1].id);
  expect(
    new Set(draft.scene.elements.map((element: any) => element.id)).size,
  ).toBe(draft.scene.elements.length);
  await page.reload();
  await expect(first).toHaveValue("다시 시도 버튼 추가하기");
  await expect(
    cards.getByRole("textbox", { name: "2단계 방법", exact: true }),
  ).toHaveValue("사용자가 다음 행동을 알 수 있는지 확인한다.");

  // Both modes share the same saved artwork; actual SVG export contains the typed cards.
  await page
    .getByRole("button", { name: "자유롭게 그리기", exact: true })
    .click();
  const downloadWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "현재 설계도 SVG 받기", exact: true })
    .click();
  const download = await downloadWait;
  expect(await download.failure()).toBeNull();
  const path = test.info().outputPath("cards.svg");
  await download.saveAs(path);
  const svg = readFileSync(path, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("다시 시도 버튼 추가하기");
  expect(svg).toContain("오류 안내 확인하기");
  await page
    .getByRole("button", { name: "단계 카드로 만들기", exact: true })
    .click();
  await expect(first).toHaveValue("다시 시도 버튼 추가하기");

  failSave = true;
  await first.fill("입력 내용을 보존하며 재시도하기");
  await save.click();
  await expect(page.getByRole("alert")).toContainText(
    "저장을 다시 시도해 주세요.",
  );
  await expect(first).toHaveValue("입력 내용을 보존하며 재시도하기");
  expect(JSON.stringify(draft.scene)).not.toContain(
    "입력 내용을 보존하며 재시도하기",
  );
  failSave = false;
  await save.click();
  await expect
    .poll(() => JSON.stringify(draft.scene))
    .toContain("입력 내용을 보존하며 재시도하기");
  await page.reload();
  await expect(first).toHaveValue("입력 내용을 보존하며 재시도하기");

  // Simulate a saved freehand annotation on the generated connection and an extra bound arrow.
  const managedArrow = draft.scene.elements.find((element: any) => element.type === "arrow");
  const textElement = draft.scene.elements.find((element: any) => element.type === "text");
  const extraArrow = { ...managedArrow, id: "manual-extra-arrow", customData: undefined, boundElements: null };
  const arrowLabel = { ...textElement, id: "manual-arrow-label", text: "다시 확인한 뒤", originalText: "다시 확인한 뒤", containerId: managedArrow.id };
  managedArrow.boundElements = [{ id: arrowLabel.id, type: "text" }];
  for (const element of draft.scene.elements.filter((entry: any) => entry.type === "rectangle")) {
    element.boundElements = [...(element.boundElements || []), { id: extraArrow.id, type: "arrow" }];
  }
  draft.scene.elements.push(extraArrow, arrowLabel);
  await page.reload();
  await first.fill("입력 내용을 유지하고 재시도하기");
  await save.click();
  await expect.poll(() => JSON.stringify(draft.scene)).toContain("입력 내용을 유지하고 재시도하기");
  expect(draft.scene.elements.find((element: any) => element.id === arrowLabel.id).originalText).toBe("다시 확인한 뒤");
  expect(draft.scene.elements.find((element: any) => element.id === managedArrow.id).boundElements).toContainEqual({ id: arrowLabel.id, type: "text" });
  for (const element of draft.scene.elements.filter((entry: any) => entry.type === "rectangle")) {
    expect(element.boundElements).toContainEqual({ id: extraArrow.id, type: "arrow" });
  }
  const stableLeft = draft.scene.elements.filter((element: any) => element.type === "rectangle").map((element: any) => element.x);
  await first.fill("입력 내용을 유지하고 한 번 더 시도하기");
  await save.click();
  await expect.poll(() => JSON.stringify(draft.scene)).toContain("한 번 더 시도하기");
  expect(draft.scene.elements.filter((element: any) => element.type === "rectangle").map((element: any) => element.x)).toEqual(stableLeft);
  await cards.getByRole("button", { name: "2단계 위로 이동", exact: true }).click();
  await save.click();
  await expect.poll(() => draft.scene.elements.find((element: any) => element.id === arrowLabel.id)?.containerId).toBeNull();
  expect(draft.scene.elements.find((element: any) => element.id === arrowLabel.id).originalText).toBe("다시 확인한 뒤");

  for (const width of [1440, 390, 320, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect
      .poll(() =>
        cards.locator("input,textarea,button").evaluateAll((elements) =>
          elements.every((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44
            );
          }),
        ),
      )
      .toBe(true);
    const before = await page.evaluate(() => window.scrollY);
    await cards.hover();
    await page.mouse.wheel(0, 900);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    await cards.evaluate((element) => (element.scrollTop = 0));
    await page.screenshot({
      path: `.local/student-usability/cards-${width}.png`,
      animations: "disabled",
    });
  }
  expect(errors).toEqual([]);
});
