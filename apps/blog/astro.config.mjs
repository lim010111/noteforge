// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { obpub } from '@obpub/astro';
import obpubConfig from './obsidian-blog.config.ts';

export default defineConfig({
  site: obpubConfig.site.url,
  trailingSlash: 'never',
  output: 'static',
  integrations: [
    obpub(obpubConfig, {
      watcher: { usePolling: true, pollInterval: 200 },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
