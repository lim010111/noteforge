import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineConfig, ObpubConfigError, type ObpubConfig } from '@noteforge/core';
import { assertVaultPathsExist, loadConfigWithPath } from '../src/lib/loadConfig.ts';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const TMP_ROOT = path.join(TEST_DIR, '.tmp');

let sandbox: string;

beforeEach(async () => {
  // Place fixtures inside the project tree so Vite/vite-node can resolve
  // dynamic file:// imports (its module resolver rejects paths outside the
  // project root, e.g. os.tmpdir()).
  await fs.mkdir(TMP_ROOT, { recursive: true });
  sandbox = await fs.mkdtemp(path.join(TMP_ROOT, `loadconfig-${randomUUID()}-`));
});

afterEach(async () => {
  await fs.rm(sandbox, { recursive: true, force: true });
});

function makeConfig(vaultPath: string): ObpubConfig {
  return defineConfig({
    site: { title: 't', url: 'https://e.test', author: 'a' },
    vaults: [{ id: 'main', path: vaultPath }],
  });
}

describe('assertVaultPathsExist', () => {
  it('resolves when vault.path is an existing directory', async () => {
    const vaultDir = path.join(sandbox, 'vault');
    await fs.mkdir(vaultDir, { recursive: true });
    await expect(assertVaultPathsExist(makeConfig(vaultDir))).resolves.toBeUndefined();
  });

  it('throws when vault.path does not exist', async () => {
    const ghost = path.join(sandbox, 'does-not-exist');
    await expect(assertVaultPathsExist(makeConfig(ghost))).rejects.toThrow(
      /vault path does not exist/,
    );
  });

  it('throws when vault.path resolves to a file instead of a directory', async () => {
    const filePath = path.join(sandbox, 'not-a-dir');
    await fs.writeFile(filePath, 'x', 'utf8');
    await expect(assertVaultPathsExist(makeConfig(filePath))).rejects.toThrow(
      /not a directory/,
    );
  });

  it('embeds the vault id in the error so multi-vault configs are diagnosable', async () => {
    const ghost = path.join(sandbox, 'does-not-exist');
    const cfg = defineConfig({
      site: { title: 't', url: 'https://e.test', author: 'a' },
      vaults: [{ id: 'archive', path: ghost }],
    });
    await expect(assertVaultPathsExist(cfg)).rejects.toThrow(/archive/);
  });
});

describe('loadConfigWithPath — config-file errors carry configPath', () => {
  it('rewraps a missing-vault-path failure as ObpubConfigError with configPath', async () => {
    const ghost = path.join(sandbox, 'no-such-vault');
    const cfgPath = path.join(sandbox, 'noteforge.config.mjs');
    await fs.writeFile(
      cfgPath,
      `export default {
  site: { title: 't', url: 'https://e.test', author: 'a' },
  vaults: [{ id: 'main', path: ${JSON.stringify(ghost)} }],
};
`,
      'utf8',
    );

    let caught: ObpubConfigError | undefined;
    try {
      await loadConfigWithPath({ cwd: sandbox, configPath: cfgPath });
    } catch (e) {
      caught = e as ObpubConfigError;
    }
    expect(caught).toBeInstanceOf(ObpubConfigError);
    expect(caught?.configPath).toBe(cfgPath);
    expect(caught?.message).toContain(cfgPath);
    expect(caught?.message).toContain('vault path does not exist');
  });

  it('rewraps a syntax-broken config as ObpubConfigError with configPath', async () => {
    const cfgPath = path.join(sandbox, 'noteforge.config.mjs');
    await fs.writeFile(cfgPath, 'this is not ; valid javascript ===\n', 'utf8');

    let caught: ObpubConfigError | undefined;
    try {
      await loadConfigWithPath({ cwd: sandbox, configPath: cfgPath });
    } catch (e) {
      caught = e as ObpubConfigError;
    }
    expect(caught).toBeInstanceOf(ObpubConfigError);
    expect(caught?.configPath).toBe(cfgPath);
    expect(caught?.message).toContain(cfgPath);
  });

  it('rewraps "no default export" as ObpubConfigError with configPath', async () => {
    const cfgPath = path.join(sandbox, 'noteforge.config.mjs');
    await fs.writeFile(cfgPath, 'export const notDefault = 1;\n', 'utf8');

    let caught: ObpubConfigError | undefined;
    try {
      await loadConfigWithPath({ cwd: sandbox, configPath: cfgPath });
    } catch (e) {
      caught = e as ObpubConfigError;
    }
    expect(caught).toBeInstanceOf(ObpubConfigError);
    expect(caught?.configPath).toBe(cfgPath);
    expect(caught?.message).toContain(cfgPath);
    expect(caught?.message).toContain('default export');
  });
});

describe('loadConfigWithPath — fallback diagnostics', () => {
  it('emits a stderr hint with --config guidance when no config is found', async () => {
    const cwd = path.join(sandbox, 'subdir');
    await fs.mkdir(cwd, { recursive: true });

    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        return true;
      });

    try {
      const loaded = await loadConfigWithPath({ cwd });
      expect(loaded.configPath).toBeNull();
    } finally {
      spy.mockRestore();
    }

    const all = writes.join('');
    expect(all).toContain('no config found');
    expect(all).toContain('--config');
  });
});

describe('loadConfigWithPath — legacy filename backwards-compat', () => {
  it('still loads obsidian-blog.config.mjs and emits a deprecation warning to stderr', async () => {
    const vaultDir = path.join(sandbox, 'vault');
    await fs.mkdir(vaultDir, { recursive: true });

    const cfgPath = path.join(sandbox, 'obsidian-blog.config.mjs');
    await fs.writeFile(
      cfgPath,
      `export default {
  site: { title: 't', url: 'https://e.test', author: 'a' },
  vaults: [{ id: 'main', path: ${JSON.stringify(vaultDir)} }],
};
`,
      'utf8',
    );

    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        return true;
      });

    try {
      const loaded = await loadConfigWithPath({ cwd: sandbox });
      expect(loaded.configPath).toBe(cfgPath);
    } finally {
      spy.mockRestore();
    }

    const all = writes.join('');
    expect(all).toContain('deprecated');
    expect(all).toContain('obsidian-blog.config.mjs');
    expect(all).toContain('noteforge.config.mjs');
  });
});
