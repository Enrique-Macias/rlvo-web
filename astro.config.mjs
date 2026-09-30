import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { site, pages } from './src/config/site.ts';

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
  integrations: [sitemap({
    filter: (page) => process.env.SITE_ENV !== 'preview' &&
      Boolean(pages[new URL(page).pathname.replace(/\/$/, '') || '/']?.index),
  })],
});
