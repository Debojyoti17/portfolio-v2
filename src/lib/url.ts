/** Base-aware URL helpers. Every internal link in the site goes through href(). */
const BASE = import.meta.env.BASE_URL; // always ends with "/" (see astro.config.mjs)

const ABSOLUTE = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** href('/work/') → '/portfolio-v2/work/' (or '/work/' when deployed at the root). */
export function href(path = ''): string {
  if (ABSOLUTE.test(path)) return path;
  return BASE + path.replace(/^\/+/, '');
}

/** Absolute URL (for canonical links, Open Graph, sitemap). */
export function absolute(path: string, site: URL | undefined): string {
  return new URL(href(path), site ?? 'http://localhost:4321').toString();
}

/** True when `pathname` is the page at `target` (or below it). */
export function isActive(pathname: string, target: string): boolean {
  const full = href(target);
  return pathname === full || (target !== '/' && pathname.startsWith(full));
}
