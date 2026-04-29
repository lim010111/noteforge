// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { obpub } from '@noteforge/astro';
import obpubConfig from './obsidian-blog.config.ts';

// markdown.{shikiConfig,rehypePlugins} apply to author-written .astro/.mdx
// pages only — vault notes flow through @noteforge/core, which pre-renders
// HTML with the same heading-anchor rehype steps in `core/src/render/htmlFromMdast.ts`.
// Mirroring the config here keeps both code paths visually consistent.
export default defineConfig({
  site: obpubConfig.site.url,
  trailingSlash: 'always',
  output: 'static',
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { className: ['heading-anchor'], 'aria-label': 'permalink' },
          content: { type: 'text', value: '#' },
          test: (/** @type {{ tagName: string }} */ node) =>
            node.tagName === 'h2' || node.tagName === 'h3' || node.tagName === 'h4',
        },
      ],
    ],
  },
  integrations: [
    obpub(obpubConfig, {
      watcher: { usePolling: true, pollInterval: 200 },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
