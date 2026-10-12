// Smoke-test the interactive behaviour in a real browser (menu, theme, filters, hover morph, transitions).
import { chromium } from 'playwright-core';
const base = 'http://localhost:4321/portfolio-v2/';
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const log = (ok, msg) => console.log(ok ? 'PASS' : 'FAIL', msg);
const errors = [];

// desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await page.waitForTimeout(4500);
  log(await page.evaluate(() => document.documentElement.classList.contains('stage-live')), 'WebGL stage goes live on desktop');
  log(await page.evaluate(() => !!window.__lenis), 'Lenis smooth scroll active');
  // theme toggle
  await page.click('[data-theme-toggle]');
  const t1 = await page.evaluate(() => document.documentElement.dataset.theme);
  log(t1 === 'dark' || t1 === 'light', `theme toggle sets data-theme (${t1})`);
  // hover morph
  await page.evaluate(() => window.__lenis.scrollTo(document.querySelector('#work').offsetTop + 200, { immediate: true }));
  await page.waitForTimeout(1500);
  await page.hover('.row:nth-child(1) .row__link');
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => window.__stage.info());
  log(info.hoverValue > 0.5, `hover morphs the field (hover=${info.hoverValue.toFixed(2)})`);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1500);
  log((await page.evaluate(() => window.__stage.info().hoverValue)) < 0.2, 'hover releases');
  // view transition navigation
  await page.click('.nav__link[href$="/work/"]');
  await page.waitForURL('**/work/');
  await page.waitForTimeout(1500);
  log(await page.evaluate(() => !document.documentElement.classList.contains('stage-live')), 'stage disposed after client navigation to /work/');
  // filters
  await page.click('[data-filter="tag"][data-value="Computer vision"]');
  const visible = await page.evaluate(() => [...document.querySelectorAll('.plates__item')].filter((e) => !e.hidden).length);
  log(visible === 2, `filter by topic shows 2 projects (got ${visible})`);
  log(page.url().includes('tag=Computer'), 'filter state reflected in URL');
  await page.click('[data-filter="status"][data-value="Team project"]');
  const v2 = await page.evaluate(() => [...document.querySelectorAll('.plates__item')].filter((e) => !e.hidden).length);
  log(v2 === 0, `topic + status combine (got ${v2})`);
  // back to home through transition & stage re-mount
  await page.click('.nav__brand');
  await page.waitForURL(base);
  await page.waitForTimeout(4500);
  log(await page.evaluate(() => document.documentElement.classList.contains('stage-live')), 'stage re-mounts after navigating back home');
  // keyboard: tab focus visible
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.className);
  log(/skip/.test(focused), `first Tab hits skip link (${focused})`);
  await ctx.close();
}
// mobile menu
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await page.waitForTimeout(1500);
  await page.tap('[data-menu-btn]');
  await page.waitForTimeout(900);
  log((await page.getAttribute('[data-menu-btn]', 'aria-expanded')) === 'true', 'mobile menu opens');
  await page.screenshot({ path: '.shots/menu-390.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  log((await page.getAttribute('[data-menu-btn]', 'aria-expanded')) === 'false', 'Escape closes the menu');
  await ctx.close();
}
// reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => ({ live: document.documentElement.classList.contains('stage-live'), lenis: !!window.__lenis, ready: document.documentElement.classList.contains('motion-ready'), hidden: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0' || getComputedStyle(e).clipPath.includes('100%')).length }));
  log(!st.live && !st.lenis && !st.ready && st.hidden === 0, `reduced motion: static fallback, no smooth scroll, nothing hidden ${JSON.stringify(st)}`);
  await ctx.close();
}
// no WebGL
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('noGL ' + String(e)));
  await page.goto(base);
  await page.waitForTimeout(3500);
  log(await page.evaluate(() => !document.documentElement.classList.contains('stage-live') && getComputedStyle(document.querySelector('.stage__static')).opacity !== '0'), 'no WebGL: static SVG stays visible');
  await ctx.close();
}
console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
