import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@noteforge/core/config';

/**
 * Vault path is loaded from the `OBPUB_VAULT_PATH` environment variable so
 * that this config file can be committed without leaking each user's local
 * Obsidian vault path. Resolution rules:
 *
 *   1. If a `.env` file exists at the repo root, load it (Node 22+ ships
 *      `process.loadEnvFile()` natively — no dotenv dependency).
 *   2. Read `process.env.OBPUB_VAULT_PATH`; refuse to start if it is unset
 *      or empty so misconfiguration surfaces with a clear message instead
 *      of a confusing "no notes found" build later.
 *
 * Resolution is anchored on this file's URL (`import.meta.url`) so the
 * lookup works regardless of `cwd` — `pnpm --filter blog dev` starts from
 * the repo root, but `obpub` CLI commands may run from elsewhere.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../');

try {
  // Node 22 stable. Optional chaining keeps older runtimes from crashing
  // before the engines field rejects them; the catch handles "no .env file".
  process.loadEnvFile?.(resolve(repoRoot, '.env'));
} catch {
  // `.env` is optional — the variable may also come from the shell
  // (`OBPUB_VAULT_PATH=... pnpm --filter blog dev`) or from CI secrets.
}

const vaultPath = process.env['OBPUB_VAULT_PATH'];
if (typeof vaultPath !== 'string' || vaultPath.length === 0) {
  throw new Error(
    [
      'OBPUB_VAULT_PATH 환경변수가 설정되지 않았습니다.',
      '저장소 루트에서 `cp .env.example .env` 후 본인의 Obsidian vault 절대 경로를 채워주세요.',
      '예: OBPUB_VAULT_PATH=/Users/you/Documents/Obsidian',
    ].join(' '),
  );
}

export default defineConfig({
  // Public identity injected into HTML <head>, sitemap, RSS, and OG meta.
  // Edit these before your first deploy — leaving the demo values ships the upstream identity.
  site: {
    title: 'shine notes',
    url: 'https://noteforge.pages.dev',
    author: 'shine',
    // avatar: '/avatar.png',     // Optional. Must live under apps/blog/public/; external URLs are rejected.
    // nickname: 'shine',         // Optional. Display name; falls back to `author`.
    social: {
      // Supported keys: `github` (URL), `email`. Both optional.
      github: 'https://github.com/lim010111',
    },
    // about: { headline: '...', bio: ['...'], highlights: ['...'] }, // Optional, powers the About page.
  },
  // Single vault entry (MVP enforces max 1). `path` comes from OBPUB_VAULT_PATH.
  vaults: [
    {
      id: 'shine',                              // Internal identifier; safe to leave as-is.
      path: vaultPath,
      urlPrefix: '/',                           // Path prefix prepended to every published URL. Default '/'.
      theme: '@noteforge/theme-default',        // Workspace package name; the only theme shipped today.
      // Vault-relative globs skipped before any privacy decision (faster builds).
      // Distinct from the `private/**` tripwire — `ignore` removes the file from consideration entirely.
      ignore: [
        'Templates/**',
        'Excalidraw/**',
        '.space/**',
        'Clippings/**',
        'attachments/**',
      ],
    },
  ],
  // Opt-in publishing rules. Defaults — requireExplicitOptIn: true, publicTag: 'public', frontmatterKey: 'public'.
  publishing: {
    requireExplicitOptIn: true,
  },
  // How [[Note]] links to private targets render. Currently only 'strip-to-text' is supported by the schema.
  privateLinkBehavior: 'strip-to-text',

  // --- Optional advanced toggles (uncomment to override defaults) ---
  // nav: { mode: 'folder' },                        // default 'category'. 'folder' uses the vault folder hierarchy as the sidebar tree.
  // unsafeAllowPrivateFolder: true,                 // Override the private/** tripwire. Do NOT enable unless you know what you are doing.
  // attachments: {                                  // Public attachment closure. uploadDir cannot live under private/** without the override above.
  //   uploadDir: 'attachments',
  //   uploadMaxBytes: 10 * 1024 * 1024,
  // },
  // graph: { enabled: true, includePrivateAsAnonymousNodes: false }, // Future graph view; private nodes may appear anonymized.
});
