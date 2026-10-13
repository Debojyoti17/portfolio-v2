// In-page anchors and menu links across Astro view transitions, with Lenis, on phone and desktop.
// For every page: Contact scrolls to the footer contact block just under the header; Work and About
// navigate and land at the top; the menu always closes. Navigations are client-side (one session),
// so this also covers anchors after view transitions. Usage: node scripts/anchors.mjs (preview on :4321)
import { chromium, devices } from 'playwright-core';
const base = 'http://localhost:4321/portfolio-v2/';
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const log = (ok, msg) => { if (!ok) failed++; console.log(ok ? 'PASS' : 'FAIL', msg); };
const errors = [];
const pages = ['', 'work/', 'about/', 'work/leafscope/'];

for (const mode of ['phone', 'desktop']) {
  const ctx = await browser.newContext(mode === 'phone' ? { ...devices['Pixel 5'] } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const tapLink = async (label) => {
    if (mode === 'phone') {
      await page.tap('[data-menu-btn]');
      await sleep(450);
      await page.tap(`.menu a:has-text("${label}")`);
    } else await page.click(`.nav__links a:has-text("${label}")`);
  };
  const state = () => page.evaluate(() => ({
    path: location.pathname.replace('/portfolio-v2', '') + location.hash,
    y: Math.round(scrollY),
    contactTop: Math.round(document.querySelector('#contact').getBoundingClientRect().top),
    pad: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
    menuOpen: document.querySelector('[data-menu]').classList.contains('is-open'),
    focus: document.activeElement?.id || document.activeElement?.tagName,
    inert: !!document.querySelector('main')?.inert,
  }));
  await page.goto(base);
  await sleep(2500);
  if (mode === 'phone') await page.touchscreen.tap(200, 700); // wakes the phone field like a visitor would
  for (const from of pages) {
    // arrive on the page client-side when possible (exercises view transitions)
    const link = await page.$(`a[href="/portfolio-v2/${from}"]`);
    if (link && from !== '') { await page.evaluate((h) => document.querySelector(`a[href="${h}"]`).click(), `/portfolio-v2/${from}`); }
    else await page.evaluate(() => document.querySelector('.nav__brand').click());
    await sleep(1600);
    await tapLink('Contact');
    await sleep(2200);
    const c = await state(); c.dTop = await page.evaluate(() => { let y = 0; for (let n = document.querySelector("#contact"); n; n = n.offsetParent) y += n.offsetTop; return Math.round(y - scrollY); });
    log(c.path === `/${from}#contact` && Math.abs(c.dTop - c.pad) <= 6 && !c.menuOpen && !c.inert && c.focus === 'contact',
      `${mode} /${from}: Contact scrolls to the contact block under the header ${JSON.stringify(c)}`);
    await sleep(800);
    const c2 = await state();
    log(Math.abs(c2.y - c.y) < 4, `${mode} /${from}: stays there (no snap back) y=${c.y}→${c2.y}`);
    for (const label of ['Work', 'About']) {
      await page.evaluate(() => document.querySelector('.nav__brand').click());
      await sleep(1400);
      const pathBefore = `/${from}`;
      if (pathBefore !== '/') {
        await page.evaluate((h) => document.querySelector(`a[href="${h}"]`)?.click(), `/portfolio-v2/${from}`);
        await sleep(1400);
      }
      await tapLink(label);
      await sleep(1600);
      const s = await state();
      const want = label === 'Work' ? '/work/' : '/about/';
      log(s.path === want && s.y < 4 && !s.menuOpen && !s.inert, `${mode} /${from} → ${label} ${JSON.stringify({ path: s.path, y: s.y, menuOpen: s.menuOpen })}`);
    }
  }
  // an anchor on another page: navigate, then land on the target under the header
  await page.goto(base + 'work/');
  await sleep(1500);
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '/portfolio-v2/#research'; a.textContent = 'x'; a.id = 'cross'; document.querySelector('main').prepend(a); a.click(); });
  await sleep(2500);
  const x = await page.evaluate(() => ({ path: location.pathname + location.hash, top: Math.round(document.querySelector('#research').getBoundingClientRect().top), pad: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) }));
  log(x.path === '/portfolio-v2/#research' && Math.abs(x.top - x.pad) <= 6, `${mode}: cross-page anchor /work/ → /#research lands under the header ${JSON.stringify(x)}`);
  // direct load with a hash
  await page.goto(base + 'about/#contact');
  await sleep(2000);
  const d = await state();
  log(Math.abs(d.contactTop - d.pad) <= 6, `${mode}: opening /about/#contact directly lands on it (top ${d.contactTop})`);
  // back to top
  await page.evaluate(() => document.querySelector('a[href="#top"]').click());
  await sleep(2200);
  log((await state()).y < 4, `${mode}: "Back to top" returns to the top`);
  await ctx.close();
}
log(errors.length === 0, errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
process.exit(failed ? 1 : 0);
