import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const careers = JSON.parse(readFileSync(new URL("../backend/data/careers.json", import.meta.url), "utf8"));
test("project panel fits narrow screens and overlay can close repeatedly", async ({page}) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/v1/catalog", route => route.fulfill({json:{careers}}));
  await page.route("**/api/v1/state", route => route.fulfill({json:{
    profile:{name:"화면 확인",username:"panel_preview",school:"",grade:"",region:"",interests:[],onboarded:true,notifications:true},
    saved:[],activities:[],scores:{},interests:{},drafts:{},gaps:{},recommendations:[],
  }}));
  let draft = {careerId:"developer",answers:["","",""],version:0,interest:null as number|null,scene:{elements:[],appState:{viewBackgroundColor:"#ffffff"}}};
  await page.route("**/api/v1/projects/developer", route => route.fulfill({json:draft}));
  await page.route("**/api/v1/projects/developer/draft", route => {
    const body = route.request().postDataJSON();
    draft = {...draft,answers:body.answers,scene:body.scene,interest:body.interest,version:draft.version+1};
    return route.fulfill({json:draft});
  });
  await page.goto("/app/#projects?career=developer");
  await expect(page.locator(".kc-studio")).toBeVisible();
  await page.locator(".kc-help-close").click();
  await page.getByRole("tab",{name:"과제",exact:true}).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab",{name:"내 설명",exact:true})).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab",{name:"크랩 도움",exact:true})).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab",{name:"과제",exact:true})).toBeFocused();
  for (const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.getByRole("tab",{name:"과제",exact:true}).click();
    const brief=page.locator(".studio-brief");
    await expect(brief).toBeVisible();
    await expect(brief.locator(".brief-section-heading")).toContainText("0 / 4");
    await expect.poll(()=>brief.locator("button, fieldset").evaluateAll(els=>els.every(el=>el.getBoundingClientRect().left >=0 && el.getBoundingClientRect().right <=innerWidth))).toBe(true);
    await brief.getByRole("radio",{name:"5점 · 더 해보고 싶어",exact:true}).check();
    await expect(brief.getByRole("radio",{name:"5점 · 더 해보고 싶어",exact:true})).toBeChecked();
    await expect(brief.locator(".brief-interest p")).toHaveText("더 해보고 싶어");
    await page.locator(".studio-panel-scroll").evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:`.local/ui-audit/panel-final-${width}.png`,animations:"disabled"});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(let i=0;i<5;i++){
      await page.locator(".studio-topbar").getByRole("button",{name:"화면 안내",exact:true}).click();
      await expect(page.locator(".kc-help-overlay")).toBeVisible();
      await page.locator(".kc-help-close").click();
      await expect(page.locator(".kc-help-overlay")).toHaveCount(0);
      await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    }
  }
  expect(errors).toEqual([]);
});
