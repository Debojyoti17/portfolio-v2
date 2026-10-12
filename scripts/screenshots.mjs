// Screenshot every page at 390 / 768 / 1440 in light and dark.
// Usage: node scripts/screenshots.mjs [outDir] [--base=/portfolio-v2/] [--port=4321] [--only=home,work]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const out = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '.shots/round';
const base = args.base ?? '/portfolio-v2/';
const port = args.port ?? '4321';
const only = args.only?.split(',');
const onlySizes = args.sizes?.split(',');
const onlySchemes = args.schemes?.split(',') ?? ['light', 'dark'];
const origin = `http://localhost:${port}`;
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const pages = [
  ['home', ''],
  ['work', 'work/'],
  ['project', 'work/leafscope/'],
  ['project-agent', 'work/agentic-shell/'],
  ['about', 'about/'],
  ['404', 'nope/'],
];
const sizes = [
  ['390', { width: 390, height: 844 }, 2],
  ['768', { width: 768, height: 1024 }, 1],
  ['1440', { width: 1440, height: 900 }, 1],
];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

for (const [name, p] of pages) {
  if (only && !only.includes(name)) continue;
  for (const scheme of onlySchemes) {
    for (const [sz, vp, dsf] of sizes) {
      if (onlySizes && !onlySizes.includes(sz)) continue;
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf > 1 ? 1 : 1, colorScheme: scheme, hasTouch: sz === '390', isMobile: sz === '390' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(`${m.type()}: ${m.text()}`));
      await page.goto(origin + base + p, { waitUntil: 'load' });
      await page.waitForTimeout(3800);
      const tag = `${name}-${sz}-${scheme}`;
      if (name === 'home') {
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        const step = vp.height * 0.9;
        let i = 0;
        for (let y = 0; y < total - vp.height * 0.5 && i < 30; y += step, i++) {
          await page.evaluate((yy) => (window.__lenis ? window.__lenis.scrollTo(yy, { immediate: true }) : window.scrollTo(0, yy)), y);
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(out, `${tag}-${String(i).padStart(2, '0')}.png`) });
        }
      } else {
        await page.screenshot({ path: path.join(out, `${tag}.png`), fullPage: false });
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        if (h > vp.height * 1.3) {
          for (let y = 0; y < h; y += vp.height * 0.7) { await page.evaluate((yy) => (window.__lenis ? window.__lenis.scrollTo(yy, { immediate: true }) : window.scrollTo(0, yy)), y); await page.waitForTimeout(250); }
          await page.waitForTimeout(1500);
          await page.evaluate(() => (window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0)));
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(out, `${tag}-full.png`), fullPage: true });
        }
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) errors.push('HORIZONTAL OVERFLOW');
      if (errors.length) console.log(tag, errors.slice(0, 5));
      await ctx.close();
    }
  }
}
await browser.close();
console.log('done ->', out);
