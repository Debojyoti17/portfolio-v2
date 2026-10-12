// Run Lighthouse (mobile preset) against the preview server and print the category scores.
// Build with NOINDEX=false first, otherwise the SEO "crawlable" audit rightly fails.
// Usage: node scripts/lighthouse.mjs [path ...]   e.g. node scripts/lighthouse.mjs "" work/ about/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const base = process.env.BASE_PATH ?? '/portfolio-v2/';
const port = process.env.PORT ?? '4321';
const chrome = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : [''];
fs.mkdirSync('.lighthouse', { recursive: true });
for (const p of paths) {
  const url = `http://localhost:${port}${base}${p}`;
  const out = `.lighthouse/${p.replace(/\W+/g, '_') || 'home'}.json`;
  execFileSync(
    'npx',
    ['lighthouse', url, '--output=json', `--output-path=${out}`, '--quiet',
     '--chrome-flags=--headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist',
     '--only-categories=performance,accessibility,best-practices,seo'],
    { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chrome } },
  );
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  const s = Object.fromEntries(Object.entries(r.categories).map(([k, v]) => [k.replace('best-practices', 'bp'), Math.round(v.score * 100)]));
  const m = r.audits;
  console.log(p || 'home', s, 'LCP', m['largest-contentful-paint'].displayValue, 'TBT', m['total-blocking-time'].displayValue, 'CLS', m['cumulative-layout-shift'].displayValue, 'SI', m['speed-index'].displayValue);
  for (const [id, a] of Object.entries(m)) if (a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && !['performance'].includes(id) && r.categories.accessibility.auditRefs.concat(r.categories['best-practices'].auditRefs, r.categories.seo.auditRefs).some((x) => x.id === id)) console.log('   ✗', id, a.title);
}
