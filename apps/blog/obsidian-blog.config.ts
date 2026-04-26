import { defineConfig } from '@noteforge/core/config';

/**
 * Vault path resolution.
 *
 * Default: the author's real vault. CI/prod builds use this default unchanged.
 *
 * Override: `OBPUB_VAULT_PATH=...` lets developers point at any other vault
 * (e.g. a small fixture vault for design dogfooding) without committing the
 * change. Only consumed at build/dev start — Zod still validates the path is
 * absolute, so the env override cannot smuggle a relative or empty value past
 * the schema. Reverting is just unsetting the env var.
 */
const vaultPath =
  process.env['OBPUB_VAULT_PATH'] ?? '/mnt/c/Users/shine/Documents/Obsidian';

export default defineConfig({
  site: {
    title: 'shine notes',
    url: 'https://noteforge.pages.dev',
    author: 'shine',
  },
  vaults: [
    {
      id: 'shine',
      path: vaultPath,
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
