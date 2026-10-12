/** Build-time Open Graph images (1200×630), one per page. */
import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { siteConfig } from '@site';
import { getProjects, projectForm } from '../../lib/content';
import { generateForm, type FormName } from '../../scripts/stage/forms';
import { rng } from '../../lib/hash';

const nm = (p: string) => fs.readFileSync(path.join(process.cwd(), 'node_modules', p));
const fonts = [
  { name: 'Sans', data: nm('@fontsource/instrument-sans/files/instrument-sans-latin-600-normal.woff'), weight: 600 as const, style: 'normal' as const },
  { name: 'Mono', data: nm('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Dot', data: nm('@fontsource/doto/files/doto-latin-800-normal.woff'), weight: 800 as const, style: 'normal' as const },
];

interface Card {
  title: string;
  kicker: string;
  status?: string;
  form: FormName;
}

export const getStaticPaths = (async () => {
  const projects = await getProjects();
  const cards: Record<string, Card> = {
    default: { title: siteConfig.name, kicker: 'Portfolio', form: 'scene' },
    about: { title: 'About', kicker: siteConfig.name, form: 'leaf' },
    work: { title: 'Work', kicker: siteConfig.name, form: 'graph' },
    notes: { title: 'Notes', kicker: siteConfig.name, form: 'grid' },
  };
  for (const p of projects) {
    cards[`work-${p.id}`] = { title: p.data.title, kicker: 'Project', status: p.data.status, form: projectForm(p) };
  }
  return Object.entries(cards).map(([slug, card]) => ({ params: { slug }, props: { card } }));
}) satisfies GetStaticPaths;

const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}) => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});

export const GET: APIRoute = async ({ props }) => {
  const card = props.card as Card;
  // dot field on the right
  const pts = generateForm(card.form, 700, false);
  const r = rng(5);
  const dots: unknown[] = [];
  for (let i = 0; i < 700; i++) {
    const x = pts[i * 3] * 0.98 + pts[i * 3 + 2] * 0.3;
    const y = -pts[i * 3 + 1] + pts[i * 3 + 2] * 0.1;
    const accent = r() < 0.03;
    dots.push({
      type: 'circle',
      props: { cx: 480 + x * 74, cy: 315 + y * 74, r: accent ? 3.2 : 1.2 + r() * 1.6, fill: accent ? '#ff4638' : '#eeede8', 'fill-opacity': accent ? 1 : 0.35 + r() * 0.5 },
    });
  }
  const tree = h('div', { width: 1200, height: 630, background: '#0b0b0c', color: '#eeede8', position: 'relative', fontFamily: 'Sans' }, [
    { type: 'svg', props: { width: 940, height: 630, viewBox: '0 0 940 630', style: { position: 'absolute', right: 0, top: 0 }, children: dots } },
    h('div', { position: 'absolute', left: 0, top: 0, width: 1200, height: 630, flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px', boxSizing: 'border-box' }, [
      h('div', { alignItems: 'center' }, [
        h('div', { fontFamily: 'Dot', fontWeight: 800, fontSize: 44, letterSpacing: 2 }, siteConfig.initials),
        h('div', { width: 12, height: 12, background: '#ff4638', marginLeft: 10, marginTop: 8 }),
        h('div', { fontFamily: 'Mono', fontSize: 20, marginLeft: 24, color: '#9c9b95', textTransform: 'uppercase', letterSpacing: 2 }, card.kicker),
      ]),
      h('div', { flexDirection: 'column' }, [
        card.status
          ? h('div', { alignItems: 'center', fontFamily: 'Dot', fontWeight: 800, fontSize: 26, marginBottom: 20, textTransform: 'uppercase' }, [
              h('div', { width: 12, height: 12, background: '#ff4638', marginRight: 14 }),
              h('div', {}, card.status),
            ])
          : h('div', {}, ''),
        h('div', { fontSize: card.title.length > 28 ? 64 : card.title.length > 14 ? 92 : 150, fontWeight: 600, lineHeight: 0.95, letterSpacing: -3, maxWidth: 820 }, card.title),
      ]),
      h('div', { justifyContent: 'space-between', fontFamily: 'Mono', fontSize: 20, color: '#9c9b95', textTransform: 'uppercase', letterSpacing: 2, borderTop: '1px solid #3a3a38', paddingTop: 20 }, [
        h('div', {}, 'Computer science · Machine learning · Web'),
        h('div', {}, siteConfig.name),
      ]),
    ]),
  ]);
  const svg = await satori(tree as any, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
