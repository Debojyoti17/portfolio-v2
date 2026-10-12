import { siteConfig } from '@site';

// Every file in src/sections/ is a homepage section. The id is the lower-cased
// file name: src/sections/Hero.astro → 'hero'.
const modules = import.meta.glob('../sections/*.astro', { eager: true }) as Record<string, { default: any }>;

export const registry: Record<string, any> = Object.fromEntries(
  Object.entries(modules).map(([path, m]) => [path.split('/').pop()!.replace(/\.astro$/, '').toLowerCase(), m.default]),
);

/** The configured sections that actually exist, in order. */
export function homeSections(): { id: string; Component: any }[] {
  const out: { id: string; Component: any }[] = [];
  for (const id of siteConfig.homeSections) {
    const Component = registry[id.toLowerCase()];
    if (!Component) {
      console.warn(`[sections] "${id}" is listed in site.config.ts but src/sections/${id}.astro does not exist — skipped.`);
      continue;
    }
    out.push({ id, Component });
  }
  return out;
}
