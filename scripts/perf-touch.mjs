// Touch + performance test on an emulated mid-range Android phone (Chromium, 4x CPU throttle).
// Measures frame cadence while dragging a finger across a particle field and while scrolling the page,
// and checks that dragging is delivered to the field without blocking page scroll.
// Usage: node scripts/perf-touch.mjs [--throttle=4] [--base=/portfolio-v2/]
import { chromium, devices } from 'playwright-core';
import { PNG } from 'pngjs';

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
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const startFrames = () => page.evaluate(() => { window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ entryTypes: ['longtask'] }); } catch {} window.__f = []; let last = performance.now(); const tick = (n) => { window.__f.push(n - last); last = n; window.__raf = requestAnimationFrame(tick); }; window.__raf = requestAnimationFrame(tick); });
const stopFrames = () => page.evaluate(() => { cancelAnimationFrame(window.__raf); const f = window.__f.slice(2).sort((a, b) => a - b); const q = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))] ?? 0; return { longTasks: window.__lt.length, longTaskMax: Math.max(0, ...window.__lt), frames: f.length, avg: f.reduce((s, v) => s + v, 0) / (f.length || 1), p50: q(0.5), p95: q(0.95), max: f[f.length - 1] ?? 0, over33: f.filter((v) => v > 33.4).length }; });
const cpu = () => page.evaluate(() => window.__stage?.summary?.());
const fmt = (r) => `longTasks=${r.longTasks}(max ${Math.round(r.longTaskMax)}ms) frames=${r.frames} avg=${r.avg.toFixed(1)}ms p50=${r.p50.toFixed(1)} p95=${r.p95.toFixed(1)} max=${r.max.toFixed(0)} >33ms=${r.over33}`;
const diff = (a, b) => { const A = PNG.sync.read(a), B = PNG.sync.read(b); let d = 0; for (let i = 0; i < A.data.length; i += 4) if (Math.abs(A.data[i] - B.data[i]) > 24) d++; return d; };

async function drag(x0, y0, x1, y1, steps = 50, hold = 16) {
  await touch('touchStart', [[x0, y0]]);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]);
    await sleep(hold);
  }
  await touch('touchEnd', []);
}

const results = {};
// ---- hero
await page.goto(base);
await sleep(1200);
await touch('touchStart', [[200, 300]]); await touch('touchEnd', []); // first touch brings the live field in
await page.waitForFunction(() => document.documentElement.querySelector('.stage.is-live'), null, { timeout: 20000 });
await sleep(2500);
await startFrames();
await drag(60, 260, 340, 330, 60);
results.heroDrag = await stopFrames();
// does the field react? compare a frame with a finger held vs without
const clip = { x: 0, y: 120, width: 393, height: 300 };
const calm = await page.screenshot({ clip });
await touch('touchStart', [[200, 270]]);
await touch('touchMove', [[205, 275]]);
await sleep(700);
const held = await page.screenshot({ clip });
await touch('touchEnd', []);
results.heroReactPixels = diff(calm, held);
results.heroDragStageCpu = await cpu();
const y0 = await page.evaluate(() => scrollY);
await startFrames();
await drag(200, 560, 200, 260, 25, 16); // vertical swipe starting on the field
await sleep(700);
results.heroScroll = await stopFrames();
results.heroScrolled = (await page.evaluate(() => scrollY)) - y0;
results.heroScrollStageCpu = await cpu();

// ---- work page cards
await page.goto(base + 'work/');
await sleep(1000);
await touch('touchStart', [[200, 400]]); await touch('touchEnd', []);
await sleep(1200);
await page.evaluate(() => { const e = document.querySelector('.card__media'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 140); });
await sleep(2500);
const box = await page.evaluate(() => { const r = document.querySelector('.card__media').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await startFrames();
await drag(box.x + 30, box.y + box.h * 0.5, box.x + box.w - 30, box.y + box.h * 0.45, 60);
results.cardDrag = await stopFrames();
const sy = await page.evaluate(() => scrollY);
await startFrames();
await drag(box.x + box.w / 2, box.y + box.h * 0.8, box.x + box.w / 2, box.y + 10, 30, 16); // vertical drag over the card
results.cardVerticalDragFrames = await stopFrames();
results.cardVerticalScrolled = (await page.evaluate(() => scrollY)) - sy;
results.stageCpu = await page.evaluate(() => window.__stage?.summary?.());
results.live = await page.evaluate(() => window.__stage?.live?.());
results.errors = errors;

console.log(`throttle=${throttle}x`);
for (const [k, v] of Object.entries(results)) console.log(k.padEnd(26), typeof v === 'object' && v && 'frames' in v && 'avg' in v && 'p95' in v ? fmt(v) : JSON.stringify(v));
await browser.close();
