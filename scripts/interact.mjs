// Smoke tests in a real browser: desktop, touch phone, reduced motion and no WebGL.
// Covers the rules from the design reviews (no static red decoration, no numbering, one hover
// language, one entrance, one persistent field that morphs between pages) and the round-3 moments
// (name assembly, hover preview, touch specimens, specimen → project continuity, menu, cursor, contact).
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
  // ring cursor and hover preview
  log(await page.evaluate(() => !!document.querySelector('.cursor') && document.documentElement.classList.contains('has-cursor')), 'desktop: ring cursor present');
  log(await page.evaluate(() => [...document.querySelectorAll('#research .entry__spec')].every((e) => getComputedStyle(e).display === 'none')), 'desktop: inline specimens are hidden (a mouse gets the floating preview)');
  await page.evaluate(() => { const r = document.querySelector('#research .entry[data-project="ghosts-in-the-splat"]'); const y = r.getBoundingClientRect().top + scrollY - 300; window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); });
  await sleep(700);
  const row = await page.$('#research .entry[data-project="ghosts-in-the-splat"]');
  const rb = await row.boundingBox();
  await page.mouse.move(rb.x + 260, rb.y + rb.height / 2, { steps: 6 });
  await sleep(700);
  const pv = await page.evaluate(() => ({ preview: window.__stage?.preview, label: document.querySelector('.cursor')?.classList.contains('is-label') ? document.querySelector('.cursor__label').textContent : '' }));
  log(pv.preview?.shown && pv.preview.project === 'ghosts-in-the-splat' && pv.preview.scene === 'ghost' && pv.label === 'View', `hovering a row shows its specimen in the preview and the ring says View ${JSON.stringify(pv)}`);
  // the specimen grows into the project page's field (same main canvas, already in the project's form)
  await page.evaluate(() => (document.querySelector('[data-field-slot] canvas').dataset.mark = 'one'));
  await page.mouse.click(rb.x + 260, rb.y + rb.height / 2);
  await page.waitForURL('**/ghosts-in-the-splat/');
  await sleep(600);
  const p1 = await page.evaluate(() => { const s = document.querySelector('[data-field-slot]'); return { same: s.querySelector('canvas')?.dataset.mark === 'one', scene: window.__stage?.scene, shared: s.style.viewTransitionName === 'field', snapped: s.classList.contains('is-instant') }; });
  log(p1.same && p1.scene === 'ghost' && p1.shared && p1.snapped, `row → project: the specimen grows into the same persistent field ${JSON.stringify(p1)}`);
  const cap = await page.evaluate(() => document.querySelector('.field__cap').innerText.replace(/\s+/g, ' '));
  log(/GHOSTS IN THE SPLAT MOVE THE CURSOR ACROSS THE FIELD/i.test(cap), `project caption: name + hint (${cap})`);
  const fb = await page.$eval('[data-field-slot]', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(fb.x, fb.y, { steps: 4 });
  await sleep(400);
  log(await page.evaluate(() => document.querySelector('.cursor__label').textContent === 'Drag' && document.querySelector('.cursor').classList.contains('is-label')), 'ring says Drag over an interactive field');
  const next = await page.evaluate(() => ({ title: document.querySelector('.next__title')?.textContent, spec: !!document.querySelector('.next [data-spec-slot]'), prev: !!document.querySelector('[rel="prev"]') }));
  log(!!next.title && next.spec && !next.prev, `project page ends with one large Next project link with a specimen (${next.title})`);
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
  const w = await page.evaluate(() => ({ groups: document.querySelectorAll('.rgroup').length, entries: [...document.querySelectorAll('.entry[data-project]')].length, slot: !!document.querySelector('[data-field-slot]'), mainCanvas: !!document.querySelector('[data-field-slot] canvas'), filters: !!document.querySelector('[data-filters]') }));
  log(w.groups === 3 && w.entries === 5 && !w.slot && !w.mainCanvas && !w.filters, `work page: same area structure as home, field parked, no filters ${JSON.stringify(w)}`);
  await page.evaluate(() => { const r = document.querySelector('.entry[data-project="agentic-shell"]'); const y = r.getBoundingClientRect().top + scrollY - 300; window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); });
  await sleep(600);
  const ar = await page.$('.entry[data-project="agentic-shell"]');
  const ab = await ar.boundingBox();
  await page.mouse.move(ab.x + 240, ab.y + ab.height / 2, { steps: 6 });
  await sleep(500);
  await page.mouse.click(ab.x + 240, ab.y + ab.height / 2);
  await page.waitForURL('**/agentic-shell/');
  await sleep(600);
  const p3 = await page.evaluate(() => ({ same: document.querySelector('[data-field-slot] canvas')?.dataset.mark === 'one', scene: window.__stage?.scene }));
  log(p3.same && p3.scene === 'tree', `work → project: the parked field returns in the project's form ${JSON.stringify(p3)}`);
  // contact ending
  const ct = await page.evaluate(() => { const c = document.querySelector('#contact'); return { title: c.querySelector('h2').textContent, magnetic: !!c.querySelector('a[href^="mailto:"][data-magnetic]'), gh: !!c.querySelector('a[href*="github.com"]'), field: !!c.querySelector('[data-spec-slot][data-scene="gather"]'), copy: !!document.querySelector('[data-copy]') }; });
  log(ct.title === 'Contact' && ct.magnetic && ct.gh && ct.field && !ct.copy, `contact: heading, magnetic email, GitHub, gathering field, no copy button ${JSON.stringify(ct)}`);
  await ctx.close();
}

// ---- touch phone (repeat visit in the session: no name assembly, the field waits for a touch)
{
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  await ctx.addInitScript(() => sessionStorage.setItem('dbm-intro', '1'));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  await page.goto(base);
  await sleep(1200);
  const block = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { field: r('.hero__field .field__slot').bottom, name: r('.hero__name').top, actions: r('.hero__actions').bottom }; });
  log(block.name - block.field < 80 && block.actions < 844, `phone hero reads as one block (gap field→name ${Math.round(block.name - block.field)}px, actions end at ${Math.round(block.actions)}px)`);
  log(await page.evaluate(() => !document.querySelector('[data-field-slot].is-live') && !document.documentElement.classList.contains('intro')), 'phone, repeat visit: no name assembly, live field waits for the first touch');
  log(await page.evaluate(() => !document.querySelector('.cursor') && !document.documentElement.classList.contains('has-cursor')), 'phone: no ring cursor on touch');
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
  // inline specimens: shown on touch, lazily live, at most two at a time
  await page.evaluate(() => scrollTo(0, document.querySelector('#research').getBoundingClientRect().top + scrollY));
  await sleep(1500);
  const sp = await page.evaluate(() => ({ shown: [...document.querySelectorAll('#research .entry__spec')].filter((e) => getComputedStyle(e).display !== 'none').length, live: window.__stage.live().filter((s) => s.mode === 'spec').length }));
  log(sp.shown === 5 && sp.live >= 1 && sp.live <= 2, `phone: every row shows its specimen inline; ${sp.live} live (max 2)`);
  for (let i = 0; i < 8; i++) { await page.evaluate(() => scrollBy(0, 220)); await sleep(200); }
  await sleep(600);
  log(await page.evaluate(() => window.__stage.live().filter((s) => s.mode === 'spec').length <= 2), 'phone: still at most two live specimens after scrolling the list');
  await page.evaluate(() => (window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0)));
  await sleep(500);
  await page.tap('[data-menu-btn]');
  await sleep(1200);
  const menu = await page.evaluate(() => ({ open: document.querySelector('[data-menu-btn]').getAttribute('aria-expanded') === 'true', desc: [...document.querySelectorAll('.menu__desc')].map((d) => d.textContent), email: !!document.querySelector('.menu__foot a[href^="mailto:"]'), dust: window.__stage.live().some((s) => s.scene === 'dust') }));
  log(menu.open && menu.desc.join('|') === 'Research and projects|Background, education and skills|Email and GitHub' && menu.email && menu.dust, `phone: menu opens with one-line descriptions, email and a particle backdrop ${JSON.stringify(menu)}`);
  await page.tap('.menu a[href$="/about/"]');
  await page.waitForURL('**/about/');
  await sleep(600);
  log((await page.getAttribute('[data-menu-btn]', 'aria-expanded')) === 'false', 'phone: the menu closes on selection');
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
  log(await page.evaluate(() => !document.documentElement.classList.contains('intro') && !document.querySelector('.cursor') && !document.querySelector('.preview') && getComputedStyle(document.querySelector('.hero__name')).opacity === '1'), 'reduced motion: no name assembly, no ring cursor, no preview');
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
