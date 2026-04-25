import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineConfig, type ObpubConfig } from '@obpub/core/config';
import { assertVaultPathsExist, loadConfigWithPath } from '../src/lib/loadConfig.ts';

let sandbox: string;

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), `obpub-loadconfig-${randomUUID()}-`));
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
