import { defineConfig } from '@noteforge/core/config';

export default defineConfig({
  site: {
    title: 'shine notes',
    url: 'https://noteforge.pages.dev',
    author: 'shine',
  },
  vaults: [
    {
      id: 'shine',
      path: '/mnt/c/Users/shine/Documents/Obsidian',
      urlPrefix: '/',
      theme: '@noteforge/theme-default',
      ignore: [
        'Templates/**',
        'Excalidraw/**',
        '.space/**',
        'Clippings/**',
        'attachments/**',
      ],
    },
  ],
  publishing: {
    requireExplicitOptIn: true,
  },
  privateLinkBehavior: 'strip-to-text',
});
