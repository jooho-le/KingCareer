import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));

test.beforeEach(async ({page}) => {
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if(path.endsWith("/catalog"))return route.fulfill({json:{careers}});
    if(path.endsWith("/state"))return route.fulfill({status:401,json:{detail:"로그인이 필요해요."}});
    return route.fulfill({status:503,json:{detail:"화면 검사에서는 서버 기록을 변경하지 않아요."}});
  });
  await page.addInitScript(()=>{
    for(const topic of ["simulation","projects"])localStorage.setItem(`kingcareer:activity-help:v1:guest:${topic}`,"hidden");
  });
});

test("landing leads to the chosen student experience and login",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/KingCareer/);
  await expect(page.locator(".kc-cube-stage")).toBeVisible();
  await page.getByRole("link",{name:"바로 체험하기",exact:true}).click();
  await expect(page).toHaveURL(/#simulation\?career=developer/);
  await expect(page.getByRole("heading",{name:"멈춘 서비스를 다시 움직여 줘.",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"로그인하고 체험 시작",exact:true}).click();
  await expect(page).toHaveURL(/#auth/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("student navigation and compact project list fit mobile",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/app/#home");
  await expect(page.getByRole("heading",{name:"반가워, 탐험가.",exact:true})).toBeVisible();
  await expect(page.locator(".app-sidebar")).not.toContainText("교사");
  await expect(page.locator(".app-sidebar")).not.toContainText("전북에서 찾기");
  await expect(page.locator(".app-sidebar nav button")).toHaveText(["홈", "직무체험", "미니 프로젝트", "포트폴리오"]);
  await expect(page.locator(".app-sidebar")).not.toContainText("관심·경험 진단");
  await expect(page.locator(".app-sidebar")).not.toContainText("다음 경험 추천");
  await expect(page.locator(".basecamp-hero button")).toHaveCount(1);
  await expect(page.locator(".basecamp-job-preview")).not.toBeVisible();
  await page.locator(".basecamp-browse summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".basecamp-job-preview")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(".basecamp-job-preview")).not.toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator(".app-sidebar")).toHaveAttribute("inert", "");
  await page.getByRole("button",{name:"메뉴 열기",exact:true}).click();
  await expect(page.locator(".app-sidebar")).not.toHaveAttribute("inert", "");
  await page.locator(".app-sidebar").getByRole("button",{name:"미니 프로젝트",exact:true}).click();
  await expect(page.getByRole("heading",{name:"어떤 아이디어를 만들어볼까?",exact:true})).toBeVisible();
  await expect(page.locator(".app-sidebar")).toHaveAttribute("inert", "");
  const first=page.locator(".project-card").first();
  await expect(first).toBeVisible();
  await expect.poll(async()=>{const box=await first.boundingBox();return !!box&&box.y<500;}).toBe(true);
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await first.click();
  await expect(page).toHaveURL(/#projects\?career=developer/);
  await expect(page.getByRole("button",{name:"로그인하고 프로젝트 시작",exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test("career discovery works inside the experience list before login", async ({page}) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/app/#home");
  await page.getByRole("button", {name: "첫 직무체험 골라보기", exact: true}).click();
  await expect(page).toHaveURL(/#simulation$/);
  await expect(page.locator(".simulation-career-option")).toHaveCount(5);
  await page.getByRole("combobox", {name: "관심 분야로 좁히기"}).selectOption("의료·보건");
  await expect(page.locator(".simulation-career-option")).toHaveCount(1);
  await expect(page.locator(".simulation-career-option h3")).toHaveText("간호사");
  await page.getByRole("searchbox", {name: "체험할 직업 검색"}).fill("찾을수없는직업");
  await expect(page.getByRole("heading", {name: "이 조건에 맞는 직업이 없어"})).toBeVisible();
  await page.getByRole("button", {name: "전체 직업 보기", exact: true}).click();
  await page.getByRole("searchbox", {name: "체험할 직업 검색"}).fill("컴퓨터");
  await expect(page.locator(".simulation-career-option")).toHaveCount(1);
  await page.locator(".simulation-career-info summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".simulation-career-info dl")).toContainText("컴퓨터공학");
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width, height: 900});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => page.locator(".career-scene img").evaluate(image => {
      const art = image.closest(".career-art")!.getBoundingClientRect();
      const picture = image.getBoundingClientRect();
      return picture.height <= art.height + 1 && picture.bottom <= art.bottom + 1;
    })).toBe(true);
  }
  await page.screenshot({path: ".local/usability-navigation/experience-list.png", animations:"disabled"});
  await page.locator(".career-card-body").click();
  await expect(page).toHaveURL(/#simulation\?career=developer/);
  await expect(page.getByRole("button", {name: "로그인하고 체험 시작", exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});

test("old map links resolve to records inside profile",async({page})=>{
  await page.goto("/app/#map?career=developer");
  await expect(page).toHaveURL(/#profile\?.*tab=records/);
  await expect(page.locator("main")).toContainText("로그인");
});
