import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = path.resolve('docs/images/web-capture-v1');
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
if (manifest.captures.length !== 12) throw new Error('All 12 desktop captures are required.');
const groups = [
  ['탐색과 진단', '홈에서 직업을 살펴보고, 필요한 경우 관심·경험 진단으로 출발점을 확인합니다.'],
  ['추천과 직무체험', '추천 이유와 출근 안내를 확인한 뒤, 넓은 현장에서 조사와 조치를 진행합니다.'],
  ['제작과 기록', '수료 카드를 확인하고 선택적인 프로젝트 제작과 개인 기록으로 이어갑니다.'],
];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KingCareer 웹 실제 화면</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#e8ecf2;color:#172033;font-family:'Malgun Gothic',sans-serif}main{width:min(1880px,100%);margin:auto}.board{background:#f7f8fa;padding:48px;margin:24px 0}.eyebrow{font-size:14px;letter-spacing:3px;color:#0967ff;font-weight:700}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #d8deea;padding-bottom:25px;margin-bottom:28px}h1{font-size:36px;letter-spacing:-1.3px;margin:12px 0}header p{font-size:17px;color:#566176;margin:0;line-height:1.7}.meta{text-align:right;font-size:14px;line-height:1.9;color:#627088;flex:none}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px}.label{display:flex;align-items:center;gap:10px;margin-bottom:13px}.number{font-size:16px;font-weight:800;color:#0967ff;border:1px solid #ccdaee;border-radius:7px;padding:6px 10px;background:white}.card:nth-child(3n+1) .number{color:#c64b0b}.card:nth-child(3n) .number{color:#7c3aed}h2{font-size:22px;letter-spacing:-.5px;margin:0}.frame{display:block;border:1px solid #ccd4e1;background:white;border-radius:12px;padding:6px;overflow:hidden}.frame img{display:block;width:100%;height:auto;border-radius:7px}.note{font-size:16px;line-height:1.7;margin:12px 2px 0;color:#45536b}footer{display:flex;justify-content:space-between;gap:24px;border-top:1px solid #d8deea;padding-top:18px;margin-top:28px;font-size:13px;line-height:1.7;color:#637084}a{color:inherit;text-decoration:none}.index{background:white;padding:24px 48px;font-size:16px;line-height:1.8}.index a{color:#0967ff;margin-right:25px}@media(max-width:900px){.board{padding:22px}.grid{grid-template-columns:1fr}header,footer{display:block}.meta{text-align:left;margin-top:16px}h1{font-size:28px}}@media print{.board{break-after:page;margin:0}.index{display:none}body{background:white}}
</style><main><nav class="index">실제 데스크톱 앱 캡처 · 기능 설명용 화면 흐름<br>${groups.map((g,i)=>`<a href="#board-${i+1}">${String(i+1).padStart(2,'0')} ${g[0]}</a>`).join('')}</nav>
${groups.map(([title, subtitle], index) => `<section class="board" id="board-${index+1}"><header><div><span class="eyebrow">KINGCAREER / DESKTOP SCREEN FLOW</span><h1>${String(index+1).padStart(2,'0')}. ${title}</h1><p>${subtitle}</p></div><div class="meta">실제 Chrome · 데스크톱 화면<br>1440 × 1000 CSS px / PNG 2×<br>캡처용 계정 · AI 템플릿 모드</div></header><div class="grid">${manifest.captures.slice(index*4,index*4+4).map((capture,n)=>`<article class="card"><div class="label"><span class="number">${String(index*4+n+1).padStart(2,'0')}</span><h2>${escape(capture.title)}</h2></div><a class="frame" href="${capture.file}"><img src="${capture.file}" alt="${escape(capture.title)} 실제 웹 화면"></a><p class="note">${escape(capture.note)}</p></article>`).join('')}</div><footer><span>실제 앱 화면을 그대로 캡처했습니다. 화면 내부를 재작성하거나 생성형 이미지로 대체하지 않았습니다.<br>별도 로컬 DB와 캡처용 계정을 사용했으며 기존 학생 기록을 수정하지 않았습니다.</span><span>진단과 프로젝트는 선택 경로입니다.<br>개별 PNG · 전체 스크롤 원본 제공</span></footer></section>`).join('')}
</main></html>`;
await fs.writeFile(path.join(dir, 'web-wireframes.html'), html);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1880, height: 1400 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(path.join(dir, 'web-wireframes.html')).href);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
  for (let i = 1; i <= 3; i++) await page.locator('#board-' + i).screenshot({ path: path.join(dir, `web-flow-${i}.png`) });
  await page.screenshot({ path: path.join(dir, 'web-flow-overview.png'), fullPage: true });
  console.log('Saved 3 desktop flow boards, overview, and linked HTML.');
} finally { await browser.close(); }
