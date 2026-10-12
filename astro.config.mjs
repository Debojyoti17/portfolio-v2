// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Deployment is driven by environment variables so the preview URL can later
// move to https://debojyoti17.github.io/ (base "/") without touching code.
//   SITE_URL   e.g. https://debojyoti17.github.io
//   BASE_PATH  e.g. /portfolio-v2/   (use "/" for a root deployment)
//   NOINDEX    "true" | "false"  (defaults to true whenever BASE_PATH is not "/")
const site = (process.env.SITE_URL || 'https://debojyoti17.github.io').replace(/\/+$/, '');
const rawBase = process.env.BASE_PATH || '/portfolio-v2/';
const base = '/' + rawBase.replace(/^\/+|\/+$/g, '');
const baseWithSlash = base === '/' ? '/' : base + '/';
const noindex = process.env.NOINDEX ? process.env.NOINDEX === 'true' : baseWithSlash !== '/';

export default defineConfig({
  site,
  base: baseWithSlash,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  integrations: noindex ? [] : [sitemap()],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
  vite: {
    define: { __NOINDEX__: JSON.stringify(noindex) },
    build: { chunkSizeWarningLimit: 700 },
  },
});
