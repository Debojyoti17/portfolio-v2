/**
 * Build-time GitHub contribution calendar. Fetches the public contributions
 * fragment for a user. On any failure it returns null and the section hides.
 */
export interface Day {
  date: string;
  level: number;
  count: number;
}
export interface Contributions {
  total: number;
  /** weeks[w][d], d = 0 (Sunday) … 6 */
  weeks: (Day | null)[][];
}

export function parseContributions(html: string): Contributions | null {
  const cells = [...html.matchAll(/<td\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((t) => t.includes('data-date'));
  if (!cells.length) return null;
  const tips = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>\s*([^<]*)</g)) {
    const n = /^(\d[\d,]*)\s+contribution/i.exec(m[2].trim());
    tips.set(m[1], n ? parseInt(n[1].replace(/,/g, ''), 10) : 0);
  }
  const weeks: (Day | null)[][] = [];
  for (const tag of cells) {
    const id = /\bid="([^"]+)"/.exec(tag)?.[1] ?? '';
    const date = /data-date="([^"]+)"/.exec(tag)?.[1] ?? '';
    const level = parseInt(/data-level="(\d)"/.exec(tag)?.[1] ?? '0', 10);
    const pos = /contribution-day-component-(\d+)-(\d+)/.exec(id);
    if (!date || !pos) continue;
    const d = parseInt(pos[1], 10);
    const w = parseInt(pos[2], 10);
    (weeks[w] ??= Array(7).fill(null))[d] = { date, level, count: tips.get(id) ?? 0 };
  }
  const filled = weeks.filter(Boolean);
  if (!filled.length) return null;
  const header = /([\d,]+)\s+contributions?\s+in\s+the\s+last\s+year/i.exec(html);
  const total = header ? parseInt(header[1].replace(/,/g, ''), 10) : filled.flat().reduce((s, d) => s + (d?.count ?? 0), 0);
  return { total, weeks: filled };
}

export async function getContributions(user: string): Promise<Contributions | null> {
  if (!user) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`, {
      signal: ctl.signal,
      headers: { 'user-agent': 'portfolio-build', accept: 'text/html' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = parseContributions(await res.text());
    if (!data) throw new Error('could not parse calendar');
    return data;
  } catch (err) {
    console.warn(`[github] contribution graph skipped: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
