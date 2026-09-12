import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const careers = JSON.parse(
  readFileSync(
    new URL("../backend/data/careers.json", import.meta.url),
    "utf8",
  ),
);

async function setup(page: Page, account: () => string = () => "help_student") {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "화면 검사에서는 외부 서비스를 호출하지 않아요." },
    }),
  );
  await page.route("**/api/v1/catalog", (route) =>
    route.fulfill({ json: { careers } }),
  );
  await page.route("**/api/v1/state", (route) =>
    route.fulfill({
      json: {
        profile: {
          name: "도움말 확인",
          username: account(),
          school: "",
          grade: "",
          region: "",
          interests: [],
          onboarded: true,
          notifications: true,
        },
        saved: [],
        activities: [],
        activeActivities: [],
        scores: {},
        interests: {},
        drafts: {},
        gaps: {},
        recommendations: [],
      },
    }),
  );
  await page.route(/\/api\/v1\/projects\/[^/?]+$/, (route) =>
    route.fulfill({
      json: {
        careerId: route.request().url().split("/").pop(),
        answers: ["", "", ""],
        version: 1,
        interest: null,
        scene: { elements: [], appState: { viewBackgroundColor: "#ffffff" } },
      },
    }),
  );
}

test("a dismissed tour stays dismissed across careers and reloads, while a new screen and another account get their own first visit", async ({
  page,
}) => {
  let account = "help_student";
  await setup(page, () => account);
  const overlay = page.getByRole("dialog", { name: "화면 이용 안내" });
  await page.goto("/app/#projects?career=developer");
  await expect(overlay).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".kc-studio")).toBeVisible();
  await expect(overlay).toHaveCount(0);
  await page.goto("/app/#projects?career=nurse");
  await expect(page.locator(".kc-studio")).toBeVisible();
  await expect(overlay).toHaveCount(0);
  await page.goto("/app/#projects");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("만들고 싶은 프로젝트를 골라");
  await overlay.getByRole("button", { name: "안내 닫기", exact: true }).click();
  await page.goto("/app/#projects?career=developer");
  await expect(page.locator(".kc-studio")).toBeVisible();
  await expect(overlay).toHaveCount(0);
  await page
    .locator(".studio-topbar")
    .getByRole("button", { name: "화면 안내", exact: true })
    .click();
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "안내 닫기", exact: true }).click();
  account = "another_help_student";
  await page.reload();
  await expect(overlay).toBeVisible();
});

test("studio guidance follows the work order and restores the previous panel without covering its target", async ({
  page,
}) => {
  await setup(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/#projects?career=developer");
  const overlay = page.getByRole("dialog", { name: "화면 이용 안내" });
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "안내 닫기", exact: true }).click();
  const titles = [
    "먼저 해결할 문제를 읽어봐",
    "편한 방법으로 아이디어를 만들어",
    "내가 만든 생각을 설명해",
    "마지막으로 확인하고 제출해",
  ];
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("tab", { name: "크랩 도움", exact: true }).click();
    await page
      .locator(".studio-topbar")
      .getByRole("button", { name: "화면 안내", exact: true })
      .click();
    await expect(overlay).toBeVisible();
    for (let step = 0; step < 4; step++) {
      await expect(overlay.getByRole("heading")).toHaveText(titles[step]);
      if (step === 0)
        await expect(
          page.getByRole("tab", { name: "과제", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
      if (step === 2)
        await expect(
          page.getByRole("tab", { name: "내 설명", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
      await expect
        .poll(
          () =>
            overlay.evaluate((host) => {
              const entries = [
                ".kc-help-shade > rect[stroke]",
                ".kc-help-caption",
                ".kc-help-controls",
              ].map((selector) => ({
                selector,
                rect: host.querySelector(selector)!.getBoundingClientRect(),
              }));
              const issues: string[] = [];
              for (const { selector, rect } of entries)
                if (
                  rect.width <= 0 ||
                  rect.height <= 0 ||
                  rect.left < -1 ||
                  rect.top < -1 ||
                  rect.right > innerWidth + 1 ||
                  rect.bottom > innerHeight + 1
                )
                  issues.push(`${selector} out of viewport`);
              for (let i = 0; i < entries.length; i++)
                for (let j = i + 1; j < entries.length; j++) {
                  const a = entries[i].rect,
                    b = entries[j].rect;
                  if (
                    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
                  )
                    issues.push(
                      `${entries[i].selector} ${JSON.stringify(a)} overlaps ${entries[j].selector} ${JSON.stringify(b)}`,
                    );
                }
              return issues;
            }),
          `${width} × ${height}, step ${step + 1}`,
        )
        .toEqual([]);
      await overlay
        .getByRole("button", {
          name: step < 3 ? "다음 →" : "시작할게",
          exact: true,
        })
        .click();
    }
    await expect(overlay).toHaveCount(0);
    await expect(
      page.getByRole("tab", { name: "크랩 도움", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  }
  expect(errors).toEqual([]);
});
