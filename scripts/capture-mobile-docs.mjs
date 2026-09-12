// Documentation capture only: real UI + isolated real API, no mocked responses.
import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = process.cwd();
const desktop = process.argv.includes('--desktop');
const captureMode = desktop ? 'web' : 'mobile';
const viewport = desktop ? { width: 1440, height: 1000 } : { width: 412, height: 915 };
const out = path.join(root, `docs/images/${captureMode}-capture-v1`);
await fs.mkdir(out, { recursive: true });
const database = path.join(root, '.local', captureMode + '-docs-' + Date.now());
const server = spawn(path.join(root, '.venv/Scripts/python.exe'), ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8105'], {
  cwd: root, windowsHide: true,
  env: { ...process.env, KINGCAREER_DATA_DIR: database, KINGCAREER_DATABASE_URL: '', KINGCAREER_AI_MODE: 'template', KINGCAREER_AI_KEY: '', KINGCAREER_PUBLIC_ORIGIN: 'http://127.0.0.1:8105', KINGCAREER_COOKIE_SECURE: 'false' },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let serverLog = '';
server.stderr.on('data', chunk => { serverLog += chunk.toString(); });
let browser;
const captures = [];
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:8105/api/v1/catalog')).ok) break; } catch {}
    if (i === 59) throw new Error('Capture API startup failed: ' + serverLog.slice(-1000));
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...(desktop ? {} : devices['Pixel 7']), viewport, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'ko-KR' });
  await context.route('http://127.0.0.1:5173/api/**', route => route.continue({ url: route.request().url().replace(':5173', ':8105') }));
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  const req = async (endpoint, data) => {
    const response = await context.request.fetch('http://127.0.0.1:8105/api/v1' + endpoint, { method: data ? 'POST' : 'GET', ...(data ? { data } : {}) });
    if (!response.ok()) throw new Error(endpoint + ': ' + await response.text());
    return response.json();
  };
  const navigate = async route => {
    await page.goto('about:blank');
    await page.goto('http://127.0.0.1:5173/app/#' + route, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    const closeHelp = page.locator('.kc-help-close');
    if (await closeHelp.isVisible()) {
      await page.getByRole('checkbox', { name: '다시 보지 않기' }).check();
      await closeHelp.click();
    }
  };
  const capture = async (file, title, note) => {
    await page.screenshot({ path: path.join(out, file + '.png'), animations: 'disabled' });
    await page.screenshot({ path: path.join(out, file + '-full.png'), fullPage: true, animations: 'disabled' });
    captures.push({ file: file + '.png', title, note, route: page.url().split('#')[1] });
    await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ viewport: `${viewport.width} × ${viewport.height} CSS px`, scale: 2, environment: `${desktop ? 'Chrome desktop' : 'Chromium Android mobile emulation (Pixel 7)'}; isolated SQLite; template AI mode`, captures }, null, 2));
    console.log('Captured: ' + file);
  };
  await req('/auth/register', { username: 'capture_student', password: randomUUID(), name: '탐험가', interests: ['농업·스마트팜'] });
  await navigate('home');
  await capture('01-home', '홈', '다음 경험과 진행 중인 활동을 확인하는 시작 화면');
  await navigate('simulation');
  await capture('02-careers', '직무체험 목록', '직업을 찾고 체험할 현장을 선택');
  await navigate('diagnosis?career=farmer');
  await page.getByRole('button', { name: '나의 출발점 알아보기', exact: true }).click();
  await page.waitForTimeout(350);
  await capture('03-diagnosis', '관심·경험 진단', '한 번에 한 질문씩 답하는 객관식 카드');
  for (let i = 0; i < 6; i++) {
    await page.locator('.choices button').nth(i === 0 ? 1 : 0).click();
    await page.getByRole('button', { name: i === 5 ? '답변 함께 확인하기' : '다음 질문', exact: true }).click();
  }
  await capture('04-review-answers', '진단 답변 확인', '응답을 확인하고 수정한 뒤 저장');
  await page.getByRole('button', { name: '내 출발점과 추천 경험 보기', exact: true }).click();
  await page.locator('.result-panel .starting-point-card').waitFor();
  await page.waitForTimeout(400);
  await capture('05-starting-point', '진단 결과와 추천', '자기보고에 따른 출발점과 추천 이유');
  let session = await req('/simulations', { careerId: 'farmer' });
  const simRoute = () => 'simulation?career=farmer&session=' + session.id;
  await navigate(simRoute());
  await capture('06-simulation-brief', '직무체험 출근 안내', '역할과 목표를 확인하고 현장으로 진입');
  const turn = async (kind, extra = {}) => session = await req('/simulations/' + session.id + '/turn', { kind, expectedVersion: session.version, clientRequestId: randomUUID(), ...extra });
  await turn('start');
  await navigate(simRoute());
  await page.waitForTimeout(2500);
  await page.locator(desktop ? '.kc-workspace' : '.kc-scene-panel').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 76));
  await capture('07-simulation-scene', '3D 현장 조사', '온실과 장비를 살펴보며 필요한 자료를 수집');
  for (const object of session.fieldwork.objects) await turn('inspect', { objectId: object.id });
  await turn('compare', { optionId: session.fieldwork.options.compare[0].id });
  await turn('act', { actionId: session.fieldwork.actions[0].id, optionId: session.fieldwork.options.act[0].id });
  await navigate(simRoute());
  await page.waitForTimeout(2000);
  await page.locator(desktop ? '.kc-workspace' : '.kc-task-panel').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 76));
  await capture('08-action-result', '조치와 결과 확인', '선택한 조치 이후 현장 변화와 후속 판단');
  await turn('verify', { optionId: session.fieldwork.options.verify[0].id });
  await turn('handover', { optionId: session.fieldwork.options.handover[0].id });
  await req('/simulations/' + session.id + '/complete', { expectedVersion: session.version, clientRequestId: randomUUID(), reflection: session.fieldwork.options.reflection[0].label, interest: 4 });
  await navigate(simRoute());
  await capture('09-certificate', '체험 완료', '완료한 직무체험의 수료 카드와 다음 행동');
  await navigate('projects?career=farmer');
  await page.locator('.excalidraw').waitFor({ timeout: 45000 });
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: '그림 전체 보기', exact: true }).click();
  await page.waitForTimeout(500);
  await capture('10-project', '미니 프로젝트 작업실', '실제 그림 편집기로 설계도를 만드는 화면');
  await navigate('portfolio');
  await capture('11-portfolio', '포트폴리오', '캡처용 계정의 체험 수료 기록 확인');
  await navigate('profile?tab=records');
  await capture('12-records', '나의 진로 기록', '계정에 저장된 직업 경험과 완료 상태');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
