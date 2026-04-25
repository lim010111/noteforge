import { defineConfig } from '@obpub/core/config';

export default defineConfig({
  site: {
    title: 'shine notes',
    url: 'https://example.com',
    author: 'shine',
  },
  vaults: [
    {
      id: 'shine',
      path: '/mnt/c/Users/shine/Documents/Obsidian',
      urlPrefix: '/',
      theme: '@obpub/theme-default',
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
