import { test, expect, type Page } from "@playwright/test";

const project = { id: "project-old", careerId: "developer", kind: "project", title: "이전 로그인 설계도", date: "2026-09-01T10:00:00Z", reflection: "작은 안내도 중요했어", answers: ["<script>내가 발견한 로그인 문제</script>", "오류 뒤에 다시 시도하는 버튼을 배치했어요", "학생이 다시 로그인하는지 확인할 계획이에요"], feedback: "결과물이 저장됐어요.", interest: 4, evaluationStatus: "not_evaluated", before: [], after: [] };
const simulation = { ...project, id: "sim-latest", kind: "simulation", title: "최근 개발자 체험", date: "2026-09-03T10:00:00Z", liked: "단서 찾기", disliked: "수치 비교가 어려웠어요", interest: 2, reflection: "현장을 살피는 일이 흥미로웠어요." };
const fixtureState = { profile: { name: "흐름 확인", username: "review_fixture", school: "", grade: "", region: "", interests: [], onboarded: true, notifications: true }, saved: [], activities: [simulation, project], activeActivities: [] as Record<string, unknown>[], scores: {}, interests: {}, drafts: {}, gaps: {}, recommendations: [{ careerId: "developer", kind: "simulation", reason: "추천한 개발자 체험", missingObjectives: [], path: [] }] };
const choices = { enjoyed: { investigate: "원인 찾기", decide: "해결책 고르기", create: "결과물 만들기", unsure: "아직 잘 모르겠어요" }, difficult: { compare: "자료 비교", decide: "결정하기", tools: "도구 사용", none: "크게 어렵지 않았어요" }, again: { more: "더 해보고 싶어요", other: "다른 역할도 궁금해요", unsure: "아직 모르겠어요", interest_2: "활동 후 관심 2 / 5" } };
const reviewData = { reviews: [] as Record<string, unknown>[], mode: "template", options: choices, defaults: { "sim-latest": { answers: { enjoyed: "investigate", difficult: "compare", again: "interest_2" }, source: { reflection: simulation.reflection, liked: simulation.liked, disliked: simulation.disliked, interest: 2 } } } };
const scene = { elements: [{ id: "drawing-1", type: "rectangle", x: 20, y: 20, width: 280, height: 120, angle: 0, strokeColor: "#0967FF", backgroundColor: "#E3EDFF", fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: 0, opacity: 100, seed: 1, version: 1, versionNonce: 1, isDeleted: false, groupIds: [], boundElements: null, updated: 1, link: null, locked: false }], appState: { viewBackgroundColor: "#ffffff" } };
async function mock(page: Page, state = fixtureState, reviews = reviewData) {
  await page.route("**/api/v1/state", (r) => r.fulfill({ json: state }));
  await page.route("**/api/v1/career-reviews", (r) => r.fulfill({ json: reviews }));
  await page.route("**/api/v1/achievements", (r) => r.fulfill({ json: { certificates: [], badges: [], availableBadges: [] } }));
  await page.route("**/api/v1/portfolio/project-old/artifact", (r) => r.fulfill({ json: { ...project, scene } }));
}

test("portfolio shows latest owned type and opens the exact older activity", async ({ page }) => {
  await mock(page);
  await page.goto("/app/#portfolio");
  await expect(page.getByRole("button", { name: "수료 카드·배지", exact: true })).toHaveClass(/selected/);
  await page.getByRole("button", { name: "프로젝트 결과물", exact: true }).click();
  await expect(page.getByAltText("이전 로그인 설계도의 실제 설계도")).toBeVisible();
  await page.screenshot({ path: ".local/review-flow/portfolio-desktop.png", animations: "disabled" });
  await page.locator(".portfolio-work-card").click();
  await page.getByRole("button", { name: "크랩과 경험 돌아보기", exact: true }).click();
  await expect(page).toHaveURL(/activityId=project-old/);
  await expect(page.getByRole("combobox", { name: "돌아볼 활동", exact: true })).toHaveValue("project-old");
  await page.getByRole("combobox", { name: "돌아볼 활동", exact: true }).selectOption("sim-latest");
  await expect(page).toHaveURL(/activityId=sim-latest/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "돌아볼 활동", exact: true })).toHaveValue("sim-latest");
  await page.goto("/app/#review?career=developer&activityId=deleted-activity");
  await expect(page.getByRole("alert")).toContainText("요청한 활동 기록을 찾을 수 없어");
  await expect(page.getByRole("combobox", { name: "돌아볼 활동", exact: true })).toHaveCount(0);
});

test("completed answers are reused without automatic AI and can be edited", async ({ page }) => {
  let mutations = 0;
  await mock(page);
  await page.route("**/api/v1/career-reviews/sim-latest/**", (r) => { mutations += 1; return r.fulfill({ status: 500, json: { detail: "테스트 중인 응답" } }); });
  await page.goto("/app/#review?career=developer&activityId=sim-latest");
  await expect(page.locator(".review-previous")).toContainText("원인 찾기 · 자료 비교 · 활동 후 관심 2 / 5");
  await expect(page.locator(".review-questions fieldset")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "회고 저장하고 기록 정리하기" })).toBeEnabled();
  await page.screenshot({ path: ".local/review-flow/review-desktop.png", animations: "disabled" });
  expect(mutations).toBe(0);
  await page.getByRole("button", { name: "내 답 수정하기" }).click();
  await expect(page.locator(".review-questions fieldset")).toHaveCount(3);
  await expect(page.getByRole("radio", { name: "자료 비교", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "다른 역할도 궁금해요", exact: true }).check();
  expect(mutations).toBe(0);
});

test("home prioritizes unfinished work, then confirmed choice, then recommendation", async ({ page }) => {
  const confirmed = { ...reviewData, reviews: [{ activityId: "sim-latest", careerId: "developer", status: "confirmed", confirmation: { date: "2026-09-04T10:00:00Z", next: { key: "farmer:project", careerId: "farmer", kind: "project", title: "내가 고른 스마트팜 프로젝트", reason: "내가 궁금했던 재배 환경" } } }] };
  await mock(page, { ...fixtureState, activeActivities: [{ id: "draft-one", careerId: "developer", kind: "project", title: "저장 중인 내 설계도", updatedAt: "2026-09-05T10:00:00Z" }] }, confirmed);
  await page.goto("/app/#home");
  await expect(page.locator(".basecamp-hero h2")).toHaveText("저장 중인 내 설계도");
  await expect(page.locator(".basecamp-hero").getByRole("button", { name: "이어서 하기" })).toBeVisible();
  await expect(page.locator(".basecamp-hero button")).toHaveCount(1);
  await page.unroute("**/api/v1/state");
  await page.route("**/api/v1/state", (r) => r.fulfill({ json: fixtureState }));
  await page.reload();
  await expect(page.locator(".basecamp-hero h2")).toHaveText("내가 고른 스마트팜 프로젝트");
  await page.unroute("**/api/v1/career-reviews");
  await page.route("**/api/v1/career-reviews", (r) => r.fulfill({ json: reviewData }));
  await page.reload();
  await expect(page.locator(".basecamp-hero")).toContainText("추천한 개발자 체험");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".local/review-flow/home-mobile.png", animations: "disabled" });
});

test("project document includes actual drawing and escaped explanations", async ({ page }) => {
  await mock(page);
  await page.goto("/app/#portfolio?tab=project&activityId=project-old");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "설계도와 설명 함께 받기" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/결과물\.html$/);
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const document = Buffer.concat(chunks).toString("utf8");
  expect(document).toContain("data:image/svg+xml");
  expect(document).toContain("&lt;script&gt;내가 발견한 로그인 문제&lt;/script&gt;");
  expect(document).toContain("개선 제안과 근거");
  expect(document).toContain("AI 평가 아님");
});
