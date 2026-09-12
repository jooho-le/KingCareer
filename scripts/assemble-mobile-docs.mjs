import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = path.resolve('docs/images/mobile-capture-v1');
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
const groups = [
  ['탐색과 진단', '홈에서 직업을 살펴보고, 필요한 경우 경험 진단으로 출발점을 확인합니다.'],
  ['추천과 직무체험', '진단 결과를 확인하고 현장 조사와 조치 결과로 이어집니다.'],
  ['제작과 기록', '수료 후 프로젝트를 만들거나, 포트폴리오와 진로 기록을 확인합니다.'],
];
const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>KingCareer 모바일 실제 화면</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#e8ecf2;color:#172033;font-family:'Malgun Gothic',sans-serif}main{width:1800px;margin:auto}.board{background:#f7f8fa;padding:54px 52px 36px;margin:28px 0}.eyebrow{font-size:14px;letter-spacing:3px;color:#0967ff;font-weight:700}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #d8deea;padding-bottom:28px;margin-bottom:30px}h1{font-size:38px;letter-spacing:-1.4px;margin:12px 0}header p{font-size:17px;color:#566176;margin:0;line-height:1.7}.meta{text-align:right;font-size:14px;line-height:1.9;color:#627088}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:27px}.label{display:flex;align-items:center;gap:10px;min-height:36px;margin-bottom:14px}.number{font-size:15px;font-weight:800;color:#0967ff;border:1px solid #ccdaee;border-radius:7px;padding:6px 8px;background:white}.card:nth-child(3n+1) .number{color:#c64b0b}.card:nth-child(3n) .number{color:#7c3aed}h2{font-size:20px;letter-spacing:-.5px;margin:0}.frame{border:1px solid #ccd4e1;background:white;border-radius:17px;padding:7px;overflow:hidden}.frame img{display:block;width:100%;height:auto;border-radius:10px}.note{font-size:15px;line-height:1.7;margin:15px 2px 0;color:#45536b;min-height:51px}footer{display:flex;justify-content:space-between;gap:28px;border-top:1px solid #d8deea;padding-top:20px;margin-top:25px;font-size:13px;line-height:1.7;color:#637084}a{color:inherit;text-decoration:none}.index{width:1800px;background:white;padding:24px 52px;font-size:16px;line-height:1.8}.index a{color:#0967ff;margin-right:25px}@media print{.board{break-after:page;margin:0}.index{display:none}body{background:white}}
</style><main><nav class="index">실제 앱 캡처 · 기능 설명용 화면 흐름<br>${groups.map((g,i)=>`<a href="#board-${i+1}">${String(i+1).padStart(2,'0')} ${g[0]}</a>`).join('')}</nav>
${groups.map(([title, subtitle], index) => `<section class="board" id="board-${index+1}"><header><div><span class="eyebrow">KINGCAREER / MOBILE SCREEN FLOW</span><h1>${String(index+1).padStart(2,'0')}. ${title}</h1><p>${subtitle}</p></div><div class="meta">실제 UI · 모바일 브라우저 렌더링<br>412 × 915 CSS px / PNG 2×<br>캡처용 계정 · AI 템플릿 모드</div></header><div class="grid">${manifest.captures.slice(index*4,index*4+4).map((capture, n)=>`<article class="card"><div class="label"><span class="number">${String(index*4+n+1).padStart(2,'0')}</span><h2>${escape(capture.title)}</h2></div><a class="frame" style="display:block" href="${capture.file}"><img src="${capture.file}" alt="${escape(capture.title)} 실제 모바일 화면"></a><p class="note">${escape(capture.note)}</p></article>`).join('')}</div><footer><span>실제 앱 화면을 그대로 캡처했습니다. 프레임과 화면 설명만 문서 편집으로 추가했습니다.<br>Chrome의 Android 모바일 에뮬레이션이며, 실기기·Android OS 화면 캡처는 아닙니다.</span><span>진단과 프로젝트는 선택 경로입니다.<br>전체 스크롤 원본은 별도 PNG로 제공합니다.</span></footer></section>`).join('')}
</main></html>`;
await fs.writeFile(path.join(dir, 'mobile-wireframes.html'), html);
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1800,height:1400},deviceScaleFactor:2});
  await page.goto(pathToFileURL(path.join(dir,'mobile-wireframes.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  for(let i=1;i<=3;i++) await page.locator('#board-'+i).screenshot({path:path.join(dir,`mobile-flow-${i}.png`)});
  await page.screenshot({path:path.join(dir,'mobile-flow-overview.png'),fullPage:true});
  console.log('Saved 3 flow boards, overview, and linked HTML.');
} finally { await browser.close(); }
