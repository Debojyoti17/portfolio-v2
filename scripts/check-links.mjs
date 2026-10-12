// Crawl dist/ and verify every internal link, asset and #fragment resolves.
// External links are listed (and only fetched with --external).
// Usage: node scripts/check-links.mjs [dist] [--external]
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'dist');
const checkExternal = process.argv.includes('--external');
const base = (process.env.BASE_PATH ?? '/portfolio-v2/').replace(/^\/*/, '/').replace(/\/*$/, '/');

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const exists = (p) => fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, 'index.html')));

const idCache = new Map();
const idsOf = (file) => {
  if (!idCache.has(file)) {
    const html = fs.readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file);
};
const resolveFile = (urlPath) => {
  let rel = urlPath.startsWith(base) ? urlPath.slice(base.length) : null;
  if (rel === null) return undefined;
  rel = decodeURIComponent(rel);
  const p = path.join(dist, rel);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(path.join(p, 'index.html'))) return path.join(p, 'index.html');
  return null;
};

const problems = [];
const externals = new Map();
let checked = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const page = '/' + path.relative(dist, file).replace(/index\.html$/, '').replace(/\\/g, '/');
  const pageUrl = base + page.replace(/^\//, '');
  for (const m of html.matchAll(/\s(?:href|src|poster)="([^"]*)"/g)) {
    const raw = m[1];
    if (!raw || raw.startsWith('data:') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;
    checked++;
    if (/^https?:\/\//.test(raw)) {
      const u = raw.split('#')[0];
      if (!externals.has(u)) externals.set(u, page);
      // canonical / og urls point at the deployed site; map them onto dist
      const site = (process.env.SITE_URL ?? 'https://debojyoti17.github.io').replace(/\/$/, '');
      if (u.startsWith(site + base)) {
        const t = resolveFile(new URL(u).pathname);
        if (t === null) problems.push(`${page}: absolute URL does not resolve → ${raw}`);
      }
      continue;
    }
    let target = raw;
    let frag = '';
    if (raw.includes('#')) [target, frag] = [raw.split('#')[0], raw.split('#')[1]];
    target = target.split('?')[0];
    let file2;
    if (target === '') file2 = file;
    else {
      const abs = target.startsWith('/') ? target : new URL(target, 'http://x' + pageUrl).pathname;
      if (!abs.startsWith(base)) {
        problems.push(`${page}: link escapes base path → ${raw}`);
        continue;
      }
      file2 = resolveFile(abs);
      if (!file2) {
        problems.push(`${page}: broken link → ${raw}`);
        continue;
      }
    }
    if (frag && file2.endsWith('.html') && !idsOf(file2).has(decodeURIComponent(frag)) && frag !== 'top') {
      problems.push(`${page}: missing anchor #${frag} in ${path.relative(dist, file2)}`);
    }
  }
}

if (checkExternal) {
  for (const [url, page] of externals) {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000) });
      if (r.status >= 400) problems.push(`${page}: external ${r.status} → ${url}`);
    } catch (e) {
      problems.push(`${page}: external unreachable → ${url} (${e.message})`);
    }
  }
}

console.log(`Checked ${checked} references in ${htmlFiles.length} pages (${externals.size} external${checkExternal ? ', fetched' : ', not fetched'}).`);
if (problems.length) {
  console.error('\nProblems:\n' + problems.map((p) => ' - ' + p).join('\n'));
  process.exit(1);
}
console.log('No broken internal links.');
