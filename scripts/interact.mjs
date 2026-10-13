// Smoke tests in a real browser: desktop, touch phone, reduced motion and no WebGL.
// Covers the rules from the design reviews (no static red decoration, no numbering, one hover
// language, one entrance, one persistent field that morphs between pages).
import { chromium, devices } from 'playwright-core';
const base = 'http://localhost:4321/portfolio-v2/';
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const log = (ok, msg) => { if (!ok) failed++; console.log(ok ? 'PASS' : 'FAIL', msg); };
const errors = [];

// static red anywhere outside the field (focus ring and selection excluded)
const redScan = () => [...document.querySelectorAll('body *')].flatMap((el) => {
  if (el.closest('[data-field-slot], .entry__still, svg')) return [];
  const out = [];
  for (const pseudo of [null, '::before', '::after']) {
    const cs = getComputedStyle(el, pseudo);
    if (pseudo && cs.content === 'none') continue;
    const red = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return m && +m[1] > 180 && +m[2] < 100 && +m[3] < 100; };
    if (red(cs.backgroundColor) || red(cs.color) || red(cs.borderTopColor) && parseFloat(cs.borderTopWidth) > 0) out.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ''}`);
  }
  return out;
});
const numberScan = () => { const t = document.body.innerText; return (t.match(/(^|\s)0\d(\s|$)|\b\d+ \/ \d+\b|\b\d+ of \d+\b/gm) ?? []); };

// ---- desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const path of ['', 'work/', 'work/leafscope/', 'about/']) {
    await page.goto(base + path);
    await sleep(1200);
    const reds = await page.evaluate(redScan);
    log(reds.length === 0, `/${path}: no static red decoration ${reds.slice(0, 4).join(', ')}`);
    const nums = await page.evaluate(numberScan);
    log(nums.length === 0, `/${path}: no index numbering ${JSON.stringify(nums.slice(0, 4))}`);
  }
  await page.goto(base);
  await sleep(4000);
  const hero = await page.evaluate(() => document.querySelector('.hero').innerText);
  log(!/portfolio/i.test(hero) && !/working on machine learning/i.test(hero) && /THIRD-YEAR B\.TECH CSE · VIT VELLORE/i.test(hero), 'hero: no "Portfolio" label, no tagline, keeps the status line');
  log(await page.evaluate(() => !!document.querySelector('[data-field-slot].is-live canvas')), 'hero field is live');
  const home = await page.evaluate(() => ({
    sections: [...document.querySelectorAll('main > section')].map((s) => s.id),
    areas: [...document.querySelectorAll('#research .rgroup__title')].map((h) => h.textContent),
    entries: document.querySelectorAll('#research .entry').length,
  }));
  log(JSON.stringify(home.areas) === JSON.stringify(['Computer vision', 'Self-supervised learning', 'Reliable multi-agent AI']) && home.entries === 5 && !home.sections.includes('focus') && !home.sections.includes('work'), `home: one "Research & projects" section (${home.sections.join(', ')})`);
  // one hover language: every link uses the same underline property and timing
  const hover = await page.evaluate(() => [...document.querySelectorAll('a.link, .nav__link, .plink, .action')].map((a) => { const cs = getComputedStyle(a); return `${cs.transitionProperty.split(',')[0].trim()}|${cs.transitionDuration.split(',')[0].trim()}`; }));
  log(new Set(hover).size === 1, `one hover language for links (${[...new Set(hover)].join(' / ')})`);
  const reveal = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-reveal]')].map((e) => getComputedStyle(e).transitionDuration + ' ' + getComputedStyle(e).transitionTimingFunction))]);
  log(reveal.length === 1, `one entrance for every reveal (${reveal.join(' / ')})`);
  const contact = await page.evaluate(() => { const c = document.querySelector('footer #contact'); return { mail: !!c?.querySelector('a[href^="mailto:"]'), gh: !!c?.querySelector('a[href*="github.com"]'), copy: !!document.querySelector('[data-copy]'), text: document.querySelector('footer').innerText }; });
  log(contact.mail && contact.gh && !contact.copy && !/working on machine learning/i.test(contact.text), 'contact: compact block at the top of the footer (email + GitHub, no copy button, no tagline)');
  // the same canvas morphs into the project's form
  await page.evaluate(() => (document.querySelector('[data-field-slot] canvas').dataset.mark = 'one'));
  await page.click('#research a[href$="/work/ghosts-in-the-splat/"]');
  await page.waitForURL('**/ghosts-in-the-splat/');
  await sleep(600);
  const p1 = await page.evaluate(() => ({ same: document.querySelector('[data-field-slot] canvas')?.dataset.mark === 'one', scene: window.__stage?.scene, morphing: window.__stage?.morphing }));
  log(p1.same && p1.scene === 'ghost' && p1.morphing, `home → project: the same canvas morphs into the project form ${JSON.stringify(p1)}`);
  const cap = await page.evaluate(() => document.querySelector('.field__cap').innerText.replace(/\s+/g, ' '));
  log(/GHOSTS IN THE SPLAT MOVE THE CURSOR ACROSS THE FIELD/i.test(cap), `project caption: name + hint (${cap})`);
  await page.click('.nav__brand');
  await page.waitForURL(base);
  await sleep(600);
  const p2 = await page.evaluate(() => ({ same: document.querySelector('[data-field-slot] canvas')?.dataset.mark === 'one', scene: window.__stage?.scene }));
  log(p2.same && p2.scene === 'scene', `project → home: morphs back ${JSON.stringify(p2)}`);
  const heroCap = await page.evaluate(() => document.querySelector('.field__cap').innerText);
  log(/MOVE THE CURSOR ACROSS THE FIELD/i.test(heroCap), 'hero field carries the same hint');
  await page.click('.nav__link[href$="/work/"]');
  await page.waitForURL('**/work/');
  await sleep(800);
  const w = await page.evaluate(() => ({ groups: document.querySelectorAll('.rgroup').length, stills: [...document.querySelectorAll('.entry__still')].map((a) => a.getAttribute('href')), canvas: !!document.querySelector('canvas'), filters: !!document.querySelector('[data-filters]') }));
  log(w.groups === 3 && w.stills.length === 5 && w.stills.every((h) => /\/work\/[\w-]+\/$/.test(h)) && !w.canvas && !w.filters, 'work page: same area structure, stills link to project pages, field parked, no filters');
  await page.click('a.entry__still[href$="/work/agentic-shell/"]');
  await page.waitForURL('**/agentic-shell/');
  await sleep(600);
  const p3 = await page.evaluate(() => ({ same: document.querySelector('[data-field-slot] canvas')?.dataset.mark === 'one', scene: window.__stage?.scene }));
  log(p3.same && p3.scene === 'tree', `work → project: the parked field returns and morphs ${JSON.stringify(p3)}`);
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
  const block = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { field: r('.hero__field .field__slot').bottom, name: r('.hero__name').top, actions: r('.hero__actions').bottom }; });
  log(block.name - block.field < 80 && block.actions < 844, `phone hero reads as one block (gap field→name ${Math.round(block.name - block.field)}px, actions end at ${Math.round(block.actions)}px)`);
  log(await page.evaluate(() => !document.querySelector('[data-field-slot].is-live')), 'phone: live field waits for the first touch');
  await touch('touchStart', [[200, 200]]); await touch('touchEnd', []);
  await page.waitForFunction(() => document.querySelector('[data-field-slot].is-live'), null, { timeout: 20000 }).then(() => log(true, 'phone: field goes live after first touch'), () => log(false, 'phone: field goes live after first touch'));
  await sleep(2000);
  const hint = await page.evaluate(() => document.querySelector('[data-hint]').textContent);
  log(hint === 'Drag across the field', `phone hint wording (${hint})`);
  const url = page.url();
  await touch('touchStart', [[40, 200]]);
  for (let i = 1; i <= 30; i++) { await touch('touchMove', [[40 + i * 10, 200 + i]]); await sleep(16); }
  await touch('touchEnd', []);
  await sleep(500);
  log(page.url() === url, 'phone: horizontal drag never navigates');
  const y0 = await page.evaluate(() => scrollY);
  await touch('touchStart', [[200, 300]]);
  for (let i = 1; i <= 25; i++) { await touch('touchMove', [[200, 300 - i * 10]]); await sleep(16); }
  await touch('touchEnd', []);
  await sleep(700);
  log((await page.evaluate(() => scrollY)) - y0 > 100, 'phone: dragging over the field still scrolls the page');
  await page.evaluate(() => (window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0)));
  await sleep(500);
  await page.tap('[data-menu-btn]');
  await sleep(900);
  log((await page.getAttribute('[data-menu-btn]', 'aria-expanded')) === 'true', 'phone: menu opens');
  await ctx.close();
}

// ---- reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await sleep(3000);
  const st = await page.evaluate(() => ({ live: !!document.querySelector('[data-field-slot].is-live'), lenis: !!window.__lenis, hidden: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length, staticVisible: getComputedStyle(document.querySelector('.field__static')).opacity !== '0' }));
  log(!st.live && !st.lenis && st.hidden === 0 && st.staticVisible, `reduced motion: static field, nothing hidden ${JSON.stringify(st)}`);
  await ctx.close();
}
// ---- no WebGL
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('noGL ' + String(e)));
  await page.goto(base + 'work/leafscope/');
  await sleep(3500);
  log(await page.evaluate(() => !document.querySelector('[data-field-slot].is-live') && getComputedStyle(document.querySelector('.field__static')).opacity !== '0'), 'no WebGL: static field stays visible');
  await ctx.close();
}
console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(failed ? 1 : 0);
