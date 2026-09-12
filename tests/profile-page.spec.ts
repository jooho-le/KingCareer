import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));
const baseProfile = { name: "우파루파", username: "profile_preview", school: "", grade: "", region: "", interests: [], onboarded: true, notifications: true };

async function fixture(page: Page, name = baseProfile.name) {
  const state = { profile: { ...baseProfile, name }, activities: [], saved: [], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [] };
  const unexpected: string[] = [];
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/catalog") return route.fulfill({ json: { careers } });
    if (path === "/state") return route.fulfill({ json: state });
    unexpected.push(`${route.request().method()} ${path}`);
    return route.fulfill({ status: 501, json: { detail: "Unmocked request" } });
  });
  return { state, unexpected };
}

test("profile keeps edits after a failed save and retries the same intended changes", async ({ page }) => {
  const { state, unexpected } = await fixture(page);
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/api/v1/profile", route => {
    const patch = route.request().postDataJSON();
    payloads.push(patch);
    if (payloads.length === 1) return route.fulfill({ status: 503, json: { detail: "저장을 완료하지 못했어요. 다시 시도해 주세요." } });
    state.profile = { ...state.profile, ...patch };
    return route.fulfill({ json: state.profile });
  });
  await page.goto("/app/#profile");
  const form = page.getByRole("form", { name: "나를 소개할게" });
  await expect(page.getByRole("heading", { name: "우파루파의 프로필" })).toBeVisible();
  await form.getByLabel("닉네임").fill("나의 크랩");
  await form.getByRole("textbox", { name: "학교 선택", exact: true }).fill("우리학교");
  await form.getByRole("button", { name: "IT·소프트웨어", exact: true }).click();
  await form.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(form.getByRole("alert")).toContainText("저장을 완료하지 못했어요");
  await expect(form.getByLabel("닉네임")).toHaveValue("나의 크랩");
  await expect(form.getByRole("button", { name: "IT·소프트웨어", exact: true })).toHaveAttribute("aria-pressed", "true");
  await form.getByRole("button", { name: "다시 저장하기" }).click();
  await expect(page.getByRole("heading", { name: "나의 크랩의 프로필" })).toBeVisible();
  await expect(form.getByRole("alert")).toHaveCount(0);
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toEqual(payloads[1]);
  await page.reload();
  await expect(form.getByLabel("닉네임")).toHaveValue("나의 크랩");
  expect(unexpected).toEqual([]);
});

test("profile navigation keeps account controls scoped and preserves password, deletion and logout actions", async ({ page }) => {
  const { state, unexpected } = await fixture(page);
  let passwordPayload: unknown;
  let logoutCalls = 0;
  await page.route("**/api/v1/profile", route => {
    state.profile = { ...state.profile, ...route.request().postDataJSON() };
    return route.fulfill({ json: state.profile });
  });
  await page.route("**/api/v1/auth/password", route => {
    passwordPayload = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/v1/auth/logout", route => {
    logoutCalls += 1;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/app/#profile");
  const nav = page.getByRole("navigation", { name: "프로필 메뉴" });
  await nav.getByRole("button", { name: "진로 기록", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내가 해본 직업" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "진로 기록", exact: true })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("button", { name: "저장한 직업", exact: true }).click();
  await expect(page.getByText("눈길이 가는 직업을 모아봐", { exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page).toHaveURL(/#profile\?tab=settings$/);
  await expect(page.getByRole("button", { name: "프로젝트 화면 안내" })).toBeVisible();
  const switchButton = page.getByRole("switch", { name: "탐험 안내 표시" });
  await switchButton.click();
  await expect(switchButton).toHaveAttribute("aria-checked", "false");
  const passwordDetails = page.locator(".profile-password-details");
  await expect(passwordDetails).not.toHaveAttribute("open", "");
  await passwordDetails.locator("summary").click();
  await passwordDetails.getByLabel("현재 비밀번호", { exact: true }).fill("OldPassword123!");
  await passwordDetails.getByLabel("새 비밀번호", { exact: true }).fill("NewPassword123!");
  await passwordDetails.getByLabel("새 비밀번호 확인", { exact: true }).fill("WrongPassword123!");
  await passwordDetails.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("새 비밀번호가 서로 달라요");
  expect(passwordPayload).toBeUndefined();
  await passwordDetails.getByLabel("새 비밀번호 확인", { exact: true }).fill("NewPassword123!");
  await passwordDetails.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
  await expect(passwordDetails.getByLabel("현재 비밀번호", { exact: true })).toHaveValue("");
  expect(passwordPayload).toEqual({ currentPassword: "OldPassword123!", newPassword: "NewPassword123!" });
  await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("삭제 후 복원할 수 없으니");
  await expect(dialog.getByRole("button", { name: "삭제 확인" })).toBeDisabled();
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "주 메뉴", exact: true }).getByRole("button", { name: "로그아웃", exact: true })).toHaveCount(0);
  await page.locator(".profile-account-actions").getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/#auth$/);
  expect(logoutCalls).toBe(1);
  expect(unexpected).toEqual([]);
});

test("profile and settings stay readable and keyboard accessible on desktop and small phones", async ({ page }) => {
  test.setTimeout(90000);
  const { unexpected } = await fixture(page, "아주긴닉네임도차분하게보이는크랩");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    for (const tab of ["profile", "settings"]) {
      await page.goto(`/app/?profile-preview=${width}-${tab}#profile?tab=${tab}`);
      await expect(page.locator(".kc-profile-page")).toBeVisible();
      await page.locator(".profile-portrait img").evaluate((img: HTMLImageElement) => img.decode());
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const nav = page.getByRole("navigation", { name: "프로필 메뉴" });
      await expect(nav.getByRole("button", { name: tab === "profile" ? "내 프로필" : "설정", exact: true })).toHaveAttribute("aria-current", "page");
      const controls = page.locator(".kc-profile-page button:visible, .kc-profile-page input:visible, .kc-profile-page select:visible, .kc-profile-page summary:visible");
      for (let i = 0; i < await controls.count(); i++) {
        const box = (await controls.nth(i).boundingBox())!;
        expect(box.height, await controls.nth(i).textContent()).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
      if (tab === "profile") {
        const nickname = page.getByRole("textbox", { name: "닉네임", exact: true });
        expect(await nickname.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
        if (width === 1440) expect((await nickname.boundingBox())!.y).toBe((await page.getByRole("textbox", { name: "학교 선택", exact: true }).boundingBox())!.y);
      }
      await nav.getByRole("button", { name: "내 프로필", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(nav.getByRole("button", { name: "진로 기록", exact: true })).toBeFocused();
      expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe("none");
      await page.screenshot({ path: `.local/profile-review/${tab}-${width}.png`, fullPage: true, animations: "disabled" });
    }
  }
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
});
