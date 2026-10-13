// Cross-page field morph test on an emulated mid-range Android phone (Chromium, touch, 4x CPU throttle).
// Checks that the SAME canvas is carried across Astro view transitions, that it morphs into each
// page's form, and records frame timing during every navigation.
// Usage: node scripts/perf-morph.mjs [--throttle=4]
import { chromium, devices } from 'playwright-core';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const throttle = Number(args.throttle ?? 4);
const base = `http://localhost:${args.port ?? 4321}${args.base ?? '/portfolio-v2/'}`;
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['Pixel 5'] });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });

// frame recorder that survives Astro's client-side swaps (it lives on window)
const startFrames = () => page.evaluate(() => {
  window.__f = []; window.__lt = [];
  try { window.__po?.disconnect(); window.__po = new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))); window.__po.observe({ entryTypes: ['longtask'] }); } catch {}
  let last = performance.now();
  const tick = (n) => { window.__f.push(n - last); last = n; window.__raf = requestAnimationFrame(tick); };
  cancelAnimationFrame(window.__raf);
  window.__raf = requestAnimationFrame(tick);
});
const stopFrames = () => page.evaluate(() => {
  cancelAnimationFrame(window.__raf);
  const f = window.__f.slice(1).sort((a, b) => a - b);
  const q = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))] ?? 0;
  return { frames: f.length, p50: q(0.5), p95: q(0.95), max: f[f.length - 1] ?? 0, over33: f.filter((v) => v > 33.4).length, over50: f.filter((v) => v > 50).length, longTasks: window.__lt.length, longTaskMax: Math.round(Math.max(0, ...window.__lt)) };
});
const fmt = (r) => `frames=${r.frames} p50=${r.p50.toFixed(1)}ms p95=${r.p95.toFixed(1)}ms max=${r.max.toFixed(0)}ms >33ms=${r.over33} >50ms=${r.over50} longTasks=${r.longTasks}(max ${r.longTaskMax}ms)`;
const state = () => page.evaluate(() => ({
  url: location.pathname,
  scene: window.__stage?.scene ?? null,
  morphing: window.__stage?.morphing ?? null,
  sameCanvas: document.querySelector('[data-field-slot] canvas')?.dataset.mark === 'first',
  inSlot: !!document.querySelector('[data-field-slot] canvas'),
}));

async function navigate(label, action) {
  await startFrames();
  await action();
  await page.waitForFunction(() => document.readyState === 'complete');
  await sleep(300);
  const during = await state();
  await sleep(2400); // morph runs ~1.7 s
  const timing = await stopFrames();
  const after = await state();
  const attach = await page.evaluate(() => window.__stage?.summary?.()?.attachMs);
  console.log(`${label.padEnd(34)} ${fmt(timing)}`);
  console.log(`${''.padEnd(34)} scene=${after.scene} morphingAt+0.3s=${during.morphing} canvasInSlot=${after.inSlot} sameCanvas=${after.sameCanvas} attach=${attach?.toFixed?.(1)}ms url=${after.url}`);
  return { timing, during, after };
}

await page.goto(base);
await sleep(1000);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
await touch('touchStart', [[200, 200]]); await touch('touchEnd', []);
await page.waitForFunction(() => document.querySelector('[data-field-slot].is-live'), null, { timeout: 30000 });
await page.evaluate(() => (document.querySelector('[data-field-slot] canvas').dataset.mark = 'first'));
await sleep(2500);
console.log(`throttle=${throttle}x, device=Pixel 5 (touch)`);

await navigate('home → LeafScope (project link)', async () => {
  await page.evaluate(() => document.querySelector('#research').scrollIntoView());
  await sleep(500);
  await page.tap('#research a[href$="/work/leafscope/"]');
});
await navigate('LeafScope → home (brand, field glides)', async () => {
  await page.tap('.nav__brand');
});
await page.tap('[data-menu-btn]');
await sleep(700);
await navigate('home → Work (menu; field parks)', async () => {
  await page.tap('.menu__link[href$="/work/"]');
});
// client-side navigation from Work into a project via its still
await page.evaluate(() => (window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0)));
await navigate('Work → Ghosts in the Splat (still)', async () => {
  await page.tap('a.entry__still[href$="/work/ghosts-in-the-splat/"]');
});
await navigate('Ghosts → next project (pager)', async () => {
  await page.evaluate(() => document.querySelector('.pager--next').scrollIntoView());
  await sleep(400);
  await page.tap('.pager--next');
});
// a drag on the field after all that navigation still works without blocking scroll
const y0 = await page.evaluate(() => scrollY);
await touch('touchStart', [[200, 400]]);
for (let i = 1; i <= 25; i++) { await touch('touchMove', [[200, 400 - i * 10]]); await sleep(16); }
await touch('touchEnd', []);
await sleep(600);
console.log('drag after navigations scrolls page:', (await page.evaluate(() => scrollY)) - y0, 'px');
console.log('field CPU per frame:', JSON.stringify(await page.evaluate(() => window.__stage?.summary?.())));
console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
