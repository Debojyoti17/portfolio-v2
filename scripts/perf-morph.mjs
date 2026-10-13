// Frame timing of the signature moments, on an emulated mid-range Android phone (Chromium, touch,
// 4x CPU throttle) and on a desktop with a mouse (same throttle):
//   phone    first-visit name assembly, dragging the hero, scrolling the touch specimens, opening a
//            project from its specimen (shared-element transition), next project, back, menu, contact
//   desktop  the hover preview following the cursor and morphing from row to row, opening a project
// Usage: node scripts/perf-morph.mjs [--throttle=4]   (preview server on :4321)
import { chromium, devices } from 'playwright-core';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const throttle = Number(args.throttle ?? 4);
const base = `http://localhost:${args.port ?? 4321}${args.base ?? '/portfolio-v2/'}`;
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(ok ? '  PASS' : '  FAIL', msg); };

async function session(contextOpts) {
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await ctx.newCDPSession(page);
  // frame recorder on window, installed in every document (survives Astro's client-side swaps)
  const recorder = () => {
    window.__rec = () => {
      window.__f = []; window.__lt = [];
      try { window.__po?.disconnect(); window.__po = new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))); window.__po.observe({ entryTypes: ['longtask'] }); } catch {}
      let last = performance.now();
      const tick = (n) => { window.__f.push(n - last); last = n; window.__raf = requestAnimationFrame(tick); };
      cancelAnimationFrame(window.__raf);
      window.__raf = requestAnimationFrame(tick);
      window.__stage?.resetStats?.();
    };
    window.__rec();
  };
  await ctx.addInitScript(recorder);
  const start = () => page.evaluate(() => window.__rec?.());
  const stop = () => page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const f = (window.__f ?? []).slice(1).sort((a, b) => a - b);
    const q = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))] ?? 0;
    const s = window.__stage?.summary?.();
    return { frames: f.length, p50: q(0.5), p95: q(0.95), max: f[f.length - 1] ?? 0, over33: f.filter((v) => v > 33.4).length, over50: f.filter((v) => v > 50).length, longTasks: window.__lt.length, longTaskMax: Math.round(Math.max(0, ...window.__lt)), fieldMs: s?.avgMs ?? 0, fieldP95: s?.p95Ms ?? 0 };
  });
  const measure = async (label, action, settle = 2200) => {
    await start();
    await action();
    await sleep(settle);
    const r = await stop();
    console.log(`${label.padEnd(44)} frames=${String(r.frames).padStart(3)} p50=${r.p50.toFixed(1)}ms p95=${r.p95.toFixed(1)}ms max=${r.max.toFixed(0)}ms >33ms=${r.over33} >50ms=${r.over50} longTasks=${r.longTasks}(max ${r.longTaskMax}ms) fieldJS=${r.fieldMs.toFixed(1)}ms/frame (p95 ${r.fieldP95.toFixed(1)})`);
    return r;
  };
  return { ctx, page, cdp, measure };
}

/* ------------------------------------------------------------------ phone */
{
  const { ctx, page, cdp, measure } = await session({ ...devices['Pixel 5'] });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const drag = async (x0, y0, x1, y1, steps = 24) => {
    await touch('touchStart', [[x0, y0]]);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]); await sleep(16); }
    await touch('touchEnd', []);
  };
  console.log(`\nphone: Pixel 5, touch, ${throttle}x CPU throttle`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await measure('first visit: name assembles, then landscape', async () => {
    await page.goto(base);
    await page.waitForFunction(() => document.documentElement.classList.contains('intro-run'), null, { timeout: 20000 });
  }, 3500);
  check(await page.evaluate(() => document.documentElement.classList.contains('intro-reveal') && window.__stage.scene === 'scene'), 'name assembled and settled into the landscape');
  await measure('drag across the hero field (horizontal)', () => drag(60, 150, 330, 170), 800);
  const y0 = await page.evaluate(() => scrollY);
  await measure('vertical drag on the hero scrolls the page', () => drag(200, 200, 200, 60, 14), 900);
  check((await page.evaluate(() => scrollY)) - y0 > 40, 'a vertical drag that starts on a field scrolls the page');
  await measure('scroll through the specimens (pool mounts)', async () => {
    for (let i = 0; i < 6; i++) { await page.evaluate(() => scrollBy(0, 260)); await sleep(260); }
  }, 1200);
  const live = await page.evaluate(() => window.__stage.live().filter((s) => s.mode === 'spec'));
  check(live.length >= 1 && live.length <= 2, `at most 2 live specimens (${live.map((s) => s.scene).join(', ')})`);
  const spec = await page.evaluate(() => { const s = [...document.querySelectorAll('#research [data-spec-slot]')].find((e) => e.classList.contains('is-live')); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: s.closest('[data-project]').dataset.project }; });
  if (spec) await measure(`touch the ${spec.id} specimen`, () => drag(spec.x - 120, spec.y, spec.x + 120, spec.y + 10), 600);
  const target = spec?.id ?? 'leafscope';
  await page.evaluate((id) => { const r = document.querySelector(`.entry[data-project="${id}"]`); scrollTo(0, r.getBoundingClientRect().top + scrollY - 120); }, target);
  await sleep(800);
  await measure(`open ${target} from its specimen`, async () => {
    await page.tap(`.entry[data-project="${target}"] .entry__link`);
    await page.waitForFunction((id) => location.pathname.endsWith(`/work/${id}/`), target);
  }, 2000);
  check(await page.evaluate(() => { const s = document.querySelector('[data-field-slot]'); return s.style.viewTransitionName === 'field' && s.classList.contains('is-instant'); }), 'the project field received the shared element and starts in the specimen form');
  await page.evaluate(() => scrollTo(0, document.querySelector('.project__next').getBoundingClientRect().top + scrollY - 160));
  await sleep(1200);
  const nextId = await page.evaluate(() => document.querySelector('.next').dataset.project);
  await measure(`next project → ${nextId}`, async () => {
    await page.tap('.next__title');
    await page.waitForFunction((id) => location.pathname.endsWith(`/work/${id}/`), nextId);
  }, 2000);
  await measure('back (field shrinks into the previous page)', async () => {
    await page.goBack();
    await page.waitForFunction((id) => location.pathname.endsWith(`/work/${id}/`), target);
  }, 2000);
  await page.evaluate(() => scrollTo(0, 0));
  await sleep(500);
  await measure('open the menu (particle horizon)', async () => {
    await page.tap('[data-menu-btn]');
  }, 1600);
  check(await page.evaluate(() => window.__stage.live().some((s) => s.scene === 'dust')), 'menu backdrop is live while the menu is open');
  await measure('menu → Contact (scroll + field gathers)', async () => {
    await page.tap('.menu a[href="#contact"]');
  }, 3000);
  check(await page.evaluate(() => { const c = document.querySelector('#contact'); let y = 0; for (let n = c; n; n = n.offsetParent) y += n.offsetTop; return Math.abs(y - scrollY - 72) < 8 && window.__stage.live().some((s) => s.scene === 'gather'); }), 'Contact lands under the header and its field gathers');
  await ctx.close();
}

/* ------------------------------------------------------------------ desktop (mouse) */
{
  const { ctx, page, cdp, measure } = await session({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => sessionStorage.setItem('dbm-intro', '1'));
  console.log(`\ndesktop: 1440x900, mouse, ${throttle}x CPU throttle`);
  await page.goto(base);
  await page.waitForFunction(() => !!window.__stage, null, { timeout: 20000 });
  await sleep(1500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(() => { const r = document.querySelector('#research'); window.__lenis.scrollTo(r.getBoundingClientRect().top + scrollY + 120, { immediate: true }); });
  await sleep(1200);
  const rows = await page.$$eval('#research .entry', (es) => es.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.project, x: r.left + 160, y: r.top + r.height / 2 }; }).filter((r) => r.y > 80 && r.y < 860));
  await measure('hover preview: follow the cursor across rows', async () => {
    for (const r of rows) await page.mouse.move(r.x + 40, r.y, { steps: 12 });
    for (const r of rows.reverse()) await page.mouse.move(r.x + 200, r.y, { steps: 12 });
  }, 900);
  const pv = await page.evaluate(() => window.__stage.preview);
  check(pv?.shown && pv.project === rows[rows.length - 1].id, `preview shows the hovered project (${pv?.project})`);
  const last = rows[rows.length - 1];
  await measure(`open ${last.id} from the preview`, async () => {
    await page.mouse.click(last.x + 200, last.y);
    await page.waitForFunction((id) => location.pathname.endsWith(`/work/${id}/`), last.id);
  }, 2000);
  await measure('back (field shrinks into the preview)', async () => {
    await page.goBack();
  }, 2000);
  await ctx.close();
}

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : '\nno page errors');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
