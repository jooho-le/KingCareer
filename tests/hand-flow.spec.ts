import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { careerIds, drawingFixture, openDrawing, saveDrawing, editFlowNote } from "./drawing-guide-fixture";

test("all fresh projects and examples use the same connected hand-drawn composition", async ({ page }) => {
  test.setTimeout(120_000);
  const server = await drawingFixture(page);
  for (const id of careerIds) server.drafts[id].version = 0;
  for (const id of careerIds) {
    await openDrawing(page, id);
    await expect(page.locator(".recovery-studio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "그림 전체 보기", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /빈칸 찾기/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "제출하기", exact: true })).toBeDisabled();
    await saveDrawing(page);
    const scene = server.drafts[id].scene;
    expect(scene.studio).toBeUndefined();
    const shapes = scene.elements.filter((e: any) => e.type === "rectangle");
    expect(shapes).toHaveLength(7);
    for (const shape of shapes) {
      expect(shape.roughness).toBeGreaterThanOrEqual(1);
      expect(shape.roundness).toBeNull();
      const label = scene.elements.find((e: any) => e.type === "text" && e.containerId === shape.id);
      expect(label).toBeDefined();
      expect(label.fontFamily).toBe(5);
    }
    const arrows = scene.elements.filter((e: any) => e.type === "arrow");
    expect(arrows).toHaveLength(6);
    for (const arrow of arrows) {
      expect(shapes.some((s: any) => s.id === arrow.startBinding?.elementId)).toBe(true);
      expect(shapes.some((s: any) => s.id === arrow.endBinding?.elementId)).toBe(true);
    }
    const matching = await page.evaluate(async career => {
      const modulePath = "/src/fieldwork/project-templates.ts";
      const { projectTemplate } = await import(modulePath);
      const frames = (example: boolean) => projectTemplate(career, example).filter((e: any) => e.type === "rectangle").map((e: any) => ({ x: e.x, y: e.y, width: e.width, height: e.height, roughness: e.roughness, fill: e.backgroundColor }));
      return JSON.stringify(frames(false)) === JSON.stringify(frames(true));
    }, id);
    expect(matching).toBe(true);
    const before = JSON.stringify(scene);
    await page.getByRole("button", { name: "완성 그림 예시", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "완성 그림 예시" });
    await expect(dialog.getByRole("img").locator("svg")).toBeVisible();
    await expect(dialog).toContainText("내 도안과 같은 손그림 흐름도");
    await dialog.screenshot({ path: `.local/hand-flow/example-${id}.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    expect(JSON.stringify(server.drafts[id].scene)).toBe(before);
    if (id === "nurse") await page.screenshot({ path: ".local/hand-flow/nurse-starter.png", animations: "disabled" });
  }
  expect(server.errors).toEqual([]);
  expect(server.unexpected).toEqual([]);
});

test("student edits remain hand-drawn in the saved scene and exported result", async ({ page }) => {
  const server = await drawingFixture(page);
  server.drafts.nurse.version = 0;
  await openDrawing(page, "nurse");
  await editFlowNote(page, 0, "물품 목록을 확인해요.");
  await editFlowNote(page, 1, "준비가 덜 된 물품은 동료에게 알려요.");
  await editFlowNote(page, 2, "다음 교대자와 남은 일을 확인해요.");
  await saveDrawing(page);
  const original = structuredClone(server.drafts.nurse.scene);
  await page.reload();
  await expect(page.getByRole("button", { name: "그림 전체 보기", exact: true })).toBeEnabled({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /빈칸 찾기 ·/ })).toHaveCount(0);
  await page.locator(".kc-drawing-exports > summary").click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "현재 설계도 SVG 받기", exact: true }).click();
  const file = await download;
  const target = test.info().outputPath("student-hand-flow.svg");
  await file.saveAs(target);
  const svg = await readFile(target, "utf8");
  expect(svg).toContain("물품 목록을 확인해요.");
  expect(svg).toContain("호출 확인");
  expect(svg).not.toContain("교대 인계 보드");
  expect(server.drafts.nurse.scene).toEqual(original);
  expect(server.errors).toEqual([]);
});
