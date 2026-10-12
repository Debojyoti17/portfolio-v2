import type { APIRoute } from 'astro';
import { absolute } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const body = __NOINDEX__
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${absolute('/sitemap-index.xml', site)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
