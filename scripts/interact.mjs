// Smoke-test interactive behaviour in a real browser (desktop, touch phone, reduced motion, no WebGL).
import { chromium, devices } from 'playwright-core';
const base = 'http://localhost:4321/portfolio-v2/';
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launch = { executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
const browser = await chromium.launch(launch);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const log = (ok, msg) => { if (!ok) failed++; console.log(ok ? 'PASS' : 'FAIL', msg); };
const errors = [];

// ---- desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await sleep(4000);
  log(await page.evaluate(() => document.querySelector('.stage--hero.is-live') !== null), 'hero field goes live on desktop');
  log(await page.evaluate(() => [...document.querySelectorAll('canvas')].every((c) => c.closest('.hero'))), 'no particle canvas exists outside the hero');
  log(await page.evaluate(() => !!window.__lenis), 'smooth scroll active');
  log(await page.evaluate(() => !document.querySelector('.hud') && !/SCROLL\s*0/.test(document.body.innerText)), 'no fixed scroll/progress bar');
  const hero = await page.evaluate(() => ({ text: document.querySelector('.hero').innerText }));
  log(!/B\.Tech Computer Science student working/.test(hero.text) && /THIRD-YEAR/i.test(hero.text), 'hero has no tagline paragraph, keeps the status line');
  await page.click('[data-theme-toggle]');
  log(['light', 'dark'].includes(await page.evaluate(() => document.documentElement.dataset.theme)), 'theme toggle');
  // cursor part: pixels around the cursor change
  await page.mouse.move(900, 400);
  await sleep(600);
  const clip = { x: 780, y: 300, width: 240, height: 200 };
  const a = await page.screenshot({ clip });
  await page.mouse.move(900, 400, { steps: 5 });
  await page.mouse.move(905, 402);
  await sleep(500);
  const b = await page.screenshot({ clip });
  log(!a.equals(b), 'cursor changes the field around it');
  const text = await page.evaluate(() => document.querySelector('#focus').innerText);
  log(/Computer vision/.test(text) && /Ghosts in the Splat/.test(text) && !/projects?\b\s*→/.test(text), '"What I work on" lists areas with project names');
  await page.click('.nav__link[href$="/work/"]');
  await page.waitForURL('**/work/');
  await sleep(2500);
  log(await page.evaluate(() => !document.querySelector('[data-filters]')), 'work page has no filter bars by default');
  const heads = await page.evaluate(() => [...document.querySelectorAll('.wg__title')].map((h) => h.textContent));
  log(JSON.stringify(heads) === JSON.stringify(['Computer vision', 'Self-supervised learning', 'Reliable multi-agent AI']), `work page grouped by research area (${heads.join(' | ')})`);
  log(await page.evaluate(() => document.querySelectorAll('.card').length === 5), 'each project appears exactly once');
  const lines = await page.evaluate(() => [...document.querySelectorAll('.card .status')].map((s) => s.textContent));
  log(lines.every((l) => /^(Research project|Team project|Course project)( · (In progress|Early stage|Completed))?$/.test(l)), `type · stage lines (${lines.join(' / ')})`);
  log(await page.evaluate(() => [...document.querySelectorAll('.quiet-tags')].every((t) => t.textContent.split(' · ').length <= 2)), 'at most 2 tags per project');
  log(!(await page.evaluate(() => /arxiv/i.test(document.documentElement.innerHTML))), 'no mention of arXiv');
  log(await page.evaluate(() => [...document.querySelectorAll('.card__media')].every((m) => !m.closest('a'))), 'card visuals are interactive in place (not wrapped in links)');
  await page.click('.card__link >> nth=1');
  await page.waitForURL('**/work/*/');
  await sleep(2500);
  const cap = await page.evaluate(() => document.querySelector('.viewport__cap')?.innerText.replace(/\s+/g, ' '));
  log(/Move the cursor across the field/i.test(cap) && !/particle|form/i.test(cap), `project caption pattern (${cap})`);
  await page.goto(base + 'about/');
  await sleep(1500);
  const about = await page.evaluate(() => document.body.innerText);
  log(/2024 – 2028\s*\(expected\)/.test(about.replace(/\s+/g, ' ')) && !/Index card/i.test(about), 'about: education reads "2024 – 2028 (expected)", no index card');
  await ctx.close();
}

// ---- touch phone
{
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  await page.goto(base);
  await sleep(1200);
  log(await page.evaluate(() => !document.querySelector('.stage.is-live')), 'phone: live field waits for the first touch');
  await touch('touchStart', [[200, 300]]); await touch('touchEnd', []);
  await page.waitForFunction(() => document.querySelector('.stage--hero.is-live'), null, { timeout: 20000 }).then(() => log(true, 'phone: field goes live after first touch'), () => log(false, 'phone: field goes live after first touch'));
  await sleep(2500);
  const url = page.url();
  await touch('touchStart', [[40, 300]]);
  for (let i = 1; i <= 30; i++) { await touch('touchMove', [[40 + i * 10, 300 + i]]); await sleep(16); }
  await touch('touchEnd', []);
  await sleep(500);
  log(page.url() === url, 'phone: horizontal drag never navigates (no history swipe)');
  const y0 = await page.evaluate(() => scrollY);
  await touch('touchStart', [[200, 560]]);
  for (let i = 1; i <= 25; i++) { await touch('touchMove', [[200, 560 - i * 12]]); await sleep(16); }
  await touch('touchEnd', []);
  await sleep(700);
  log((await page.evaluate(() => scrollY)) - y0 > 100, 'phone: dragging over the field still scrolls the page');
  await page.evaluate(() => (window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0)));
  await sleep(500);
  await page.tap('[data-menu-btn]');
  await sleep(900);
  log((await page.getAttribute('[data-menu-btn]', 'aria-expanded')) === 'true', 'phone: menu opens');
  await page.keyboard.press('Escape');
  await ctx.close();
}

// ---- reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await sleep(3000);
  const st = await page.evaluate(() => ({ live: !!document.querySelector('.stage.is-live'), lenis: !!window.__lenis, hiddenReveals: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length, staticVisible: getComputedStyle(document.querySelector('.stage__static')).opacity !== '0' }));
  log(!st.live && !st.lenis && st.hiddenReveals === 0 && st.staticVisible, `reduced motion: static fallback, nothing hidden ${JSON.stringify(st)}`);
  await ctx.close();
}
// ---- no WebGL
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('noGL ' + String(e)));
  await page.goto(base + 'work/');
  await sleep(3500);
  log(await page.evaluate(() => !document.querySelector('.stage.is-live') && [...document.querySelectorAll('.stage__static')].every((s) => getComputedStyle(s).opacity !== '0')), 'no WebGL: static SVG visuals stay visible');
  await ctx.close();
}
console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(failed ? 1 : 0);
