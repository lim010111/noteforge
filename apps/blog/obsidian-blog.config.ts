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
  site: {
    title: 'shine notes',
    url: 'https://noteforge.pages.dev',
    author: 'shine',
    social: {
      github: 'https://github.com/lim010111',
    },
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
