import { test, expect } from "@playwright/test";

test("home renders without errors, has no gradients, and adapts to mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "반가워, 탐험가." }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: ".local/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const gradients = await page
    .locator("*")
    .evaluateAll(
      (nodes) =>
        nodes.filter((n) =>
          /gradient/.test(getComputedStyle(n).backgroundImage),
        ).length,
    );
  expect(gradients).toBe(0);
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await page
    .getByRole("button", { name: "직업 발견", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "몰랐던 직업, 새로운 나" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("diagnosis and a branching simulation update the map and survive reload", async ({
  page,
}) => {
  await page.goto("/#diagnosis");
  await page.getByRole("button", { name: "나의 출발점 알아보기" }).click();
  for (let i = 0; i < 6; i++) {
    await page.locator(".choices > button").first().click();
    await page
      .getByRole("button", {
        name: i === 5 ? "진단 결과 보기" : "다음 질문",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "이제 너의 출발점이 생겼어!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "직접 경험해 보기" }).click();
  await page.getByRole("button", { name: "이 역할로 시작하기" }).click();
  await page.locator(".choices > button").first().click();
  await page.getByRole("button", { name: "나의 생각 전달하기" }).click();
  await expect(
    page.getByText(
      "가상 인터뷰에서 20명 중 12명이 입력할 정보가 너무 많다고 했어요.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음 상황으로" }).click();
  await expect(page.locator(".previous-context")).toContainText(
    "사용자에게 불편한 점 물어보기",
  );
  await page.locator(".choices > button").nth(1).click();
  await page.getByRole("button", { name: "나의 생각 전달하기" }).click();
  await page.getByRole("button", { name: "다음 상황으로" }).click();
  await page.getByRole("button", { name: "내 생각 직접 쓰기" }).click();
  await page
    .getByRole("textbox", { name: "너라면 어떻게 할래?" })
    .fill("친구에게 사용해 보라고 하고 의견을 들어볼래요.");
  await page.getByRole("button", { name: "나의 생각 전달하기" }).click();
  await expect(
    page.getByText(/자유 답변의 의미를 AI로 분석하지 않아요/),
  ).toBeVisible();
  await page.getByRole("button", { name: "나의 경험 돌아보기" }).click();
  await page
    .getByRole("textbox", { name: /새롭게 알게 된 점/ })
    .fill("개발자는 사용자를 관찰하고 의견을 듣는 일도 하는구나.");
  await page.getByRole("button", { name: "1 별로 없어요" }).click();
  await page.getByRole("button", { name: "나의 경험 기록하기" }).click();
  await expect(
    page.getByRole("heading", { name: "오늘, 앱 개발자로 살아봤어." }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("itda-career-v1")!),
  );
  expect(stored.activities).toHaveLength(2);
  expect(stored.interests.developer).toBe(1);
  expect(stored.scores.developer[5]).toBe(10);
  await page.getByRole("button", { name: "업데이트된 지도 보기" }).click();
  await page.reload();
  await expect(page.getByText("2개의 기록이 모였어요.")).toBeVisible();
  await page.screenshot({
    path: ".local/map-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("project drafts persist, submission creates an artifact, portfolio downloads it", async ({
  page,
}) => {
  await page.goto("/#projects?career=farmer");
  await expect(
    page
      .getByRole("heading", { name: "우리 동네 스마트 온실 기획하기" })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "내 프로젝트 시작하기" }).click();
  await page
    .getByRole("textbox", { name: "나의 결과물" })
    .fill("농부가 온도와 습도, 토양 상태를 한눈에 살펴볼 수 있게 만들어요.");
  await page.reload();
  await page
    .getByRole("button", { name: "작성하던 프로젝트 이어하기" })
    .click();
  await expect(page.getByRole("textbox", { name: "나의 결과물" })).toHaveValue(
    /농부가 온도/,
  );
  await page.getByRole("button", { name: "다음 미션" }).click();
  await page
    .getByRole("textbox", { name: "나의 결과물" })
    .fill("다른 센서와 비교하고 실제 온실 상태를 살핀 뒤 기록해요.");
  await page.getByRole("button", { name: "단계별 힌트 보기" }).click();
  await expect(page.locator(".hint-box").first()).toBeVisible();
  await page.getByRole("button", { name: "다음 미션" }).click();
  await page
    .getByRole("textbox", { name: "나의 결과물" })
    .fill("한 센서의 온도가 갑자기 높아졌어요. 설치 위치를 확인해 주세요.");
  await page.getByRole("button", { name: "프로젝트 제출하기" }).click();
  await expect(
    page.getByRole("heading", { name: "너만의 프로젝트가 완성됐어!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "포트폴리오에서 보기" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "다운로드", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("잇다-진로-포트폴리오.txt");
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("itda-career-v1")!),
  );
  expect(data.activities[0].careerId).toBe("farmer");
  expect(data.activities[0].answers).toHaveLength(3);
  expect(data.scores.farmer[5]).toBe(0);
});

test("onboarding, saving careers, regional navigation and teacher assignment work", async ({
  page,
}) => {
  await page.goto("/#onboarding");
  await page.getByRole("button", { name: "잇다 시작하기" }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", { name: "IT·소프트웨어", exact: true })
    .click();
  await page.getByRole("button", { name: "이 관심으로 시작하기" }).click();
  await page.getByRole("textbox", { name: "이름 / 닉네임" }).fill("하늘");
  await page.getByRole("button", { name: "나의 탐험 시작하기" }).click();
  await expect(
    page.getByRole("heading", { name: "반가워, 하늘." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "직업 발견", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "앱 개발자 저장", exact: true })
    .click();
  await page.getByRole("button", { name: "저장한 직업", exact: true }).click();
  await expect(page.locator(".career-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "저장한 직업만", exact: true })
    .click();
  await page.getByRole("textbox", { name: "직업 필터 검색" }).fill("없는 직업");
  await expect(page.getByText("아직 여기에 맞는 직업이 없어요")).toBeVisible();
  await page
    .getByRole("button", { name: "전북에서 찾기", exact: true })
    .click();
  await page.getByRole("button", { name: "김제", exact: true }).click();
  await page.getByRole("button", { name: "지역 직무체험 시작" }).click();
  await expect(
    page.getByRole("heading", { name: "스마트팜 전문가", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "교사·멘토 공간", exact: true })
    .click();
  await page.getByRole("button", { name: "활동 배정 기록" }).click();
  await expect(page.locator(".assignment-row")).toContainText(
    "앱 개발자의 하루",
  );
});

test("all pages fit mobile, have a heading, and reduced motion disables decorative animation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of [
    "home",
    "diagnosis",
    "map",
    "simulation",
    "projects",
    "discovery",
    "region",
    "recommendation",
    "portfolio",
    "teacher",
    "profile",
    "onboarding",
    "auth",
  ]) {
    await page.goto("/#" + route);
    await expect(page.locator("h1")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.goto("/");
  expect(
    await page
      .locator(".hero-ticket")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(errors).toEqual([]);
});
