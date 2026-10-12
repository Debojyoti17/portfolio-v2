// WCAG AA contrast check for the design tokens (src/styles/tokens.css).
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const block = (re) => Object.fromEntries([...css.match(re)[0].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const themes = {
  light: block(/:root\s*\{[\s\S]*?\n\}/),
  dark: block(/:root\[data-theme='dark'\]\s*\{[\s\S]*?\n\}/),
};
const pairs = [
  ['fg', 'bg', 4.5], ['fg-2', 'bg', 4.5], ['muted', 'bg', 4.5], ['accent-text', 'bg', 4.5],
  ['fg', 'bg-2', 4.5], ['fg-2', 'bg-2', 4.5], ['muted', 'bg-2', 4.5], ['accent-text', 'bg-2', 4.5],
  ['on-accent', 'accent', 3], ['accent', 'bg', 3],
];
let bad = 0;
for (const [name, t] of Object.entries(themes)) {
  for (const [fg, bg, min] of pairs) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(5)} ${fg.padEnd(12)} on ${bg.padEnd(6)} ${r.toFixed(2)} (min ${min})`);
  }
}
process.exit(bad ? 1 : 0);
