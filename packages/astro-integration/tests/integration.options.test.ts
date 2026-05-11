/**
 * Tests for the obpub() integration's `watcher` option pass-through.
 *
 * The integration is a thin shim that owns the dev/build hook lifecycle.
 * Its `watcher` option exists solely to forward chokidar polling knobs to
 * createWatcher's `chokidarOptions`. We assert the forward path here so the
 * factory contract stays intact even if integration internals are reshaped.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import type { AstroIntegration } from 'astro';
import { defineConfig, type ObpubConfig } from '@noteforge/core';
import { obpub } from '../src/integration.ts';
import type {
  Watcher,
  WatcherOptions,
  createWatcher,
} from '../src/watcher.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(
  HERE,
  '..',
  '..',
  'core',
  'tests',
  'fixtures',
  'vault-mixed',
);

function makeConfig(): ObpubConfig {
  return defineConfig({
    site: {
      title: 'options integration test',
      url: 'https://example.com',
      author: 'tester',
    },
    vaults: [
      {
        id: 'fixture',
        path: VAULT_ROOT,
        ignore: ['.obsidian/**', '.trash/**'],
      },
    ],
  });
}

interface LoggerSpy {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  options: { dest: { write: () => void }; level: 'info' };
  label: string;
  fork: () => LoggerSpy;
}

function makeLogger(): LoggerSpy {
  const logger: LoggerSpy = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    options: { dest: { write: () => {} }, level: 'info' },
    label: 'test',
    fork: () => makeLogger(),
  };
  return logger;
}

type ServerSetupHook = NonNullable<
  AstroIntegration['hooks']['astro:server:setup']
>;
type ServerSetupArgs = Parameters<ServerSetupHook>[0];

interface FakeServer {
  ws?: { send: ReturnType<typeof vi.fn> };
  hot?: { send: ReturnType<typeof vi.fn> };
}

function makeServerSetupArgs(
  server: FakeServer,
  logger: LoggerSpy,
): ServerSetupArgs {
  return {
    server,
    logger,
    toolbar: {
      on: vi.fn(),
      onAppInitialized: vi.fn(),
      onAppToggled: vi.fn(),
      send: vi.fn(),
    },
  } as unknown as ServerSetupArgs;
}

describe('obpub integration — watcher polling option', () => {
  it('(I-W1) obpub(config, { watcher: { usePolling: true, pollInterval: 250 } }) forwards chokidarOptions verbatim to createWatcher', async () => {
    const fakeWatcher: Watcher = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const factorySpy = vi.fn((_opts: WatcherOptions) => fakeWatcher);

    const integration = obpub(makeConfig(), {
      createWatcherImpl: factorySpy as unknown as typeof createWatcher,
      watcher: { usePolling: true, pollInterval: 250 },
    });

    const serverSetup = integration.hooks['astro:server:setup'];
    expect(serverSetup, 'astro:server:setup must be registered').toBeDefined();

    const server: FakeServer = { ws: { send: vi.fn() } };
    await serverSetup!(makeServerSetupArgs(server, makeLogger()));

    expect(factorySpy).toHaveBeenCalledTimes(1);
    const forwardedOpts = factorySpy.mock.calls[0]?.[0] as WatcherOptions;
    expect(
      forwardedOpts.chokidarOptions,
      'integration must forward `watcher` as createWatcher\'s `chokidarOptions` — without this, WSL `/mnt/c` users see no HMR updates',
    ).toEqual({ usePolling: true, pollInterval: 250 });
  });

  it('(I-W2) obpub(config) without `watcher` option leaves chokidarOptions undefined on createWatcher', async () => {
    const fakeWatcher: Watcher = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const factorySpy = vi.fn((_opts: WatcherOptions) => fakeWatcher);

    const integration = obpub(makeConfig(), {
      createWatcherImpl: factorySpy as unknown as typeof createWatcher,
    });

    const serverSetup = integration.hooks['astro:server:setup']!;
    const server: FakeServer = { ws: { send: vi.fn() } };
    await serverSetup(makeServerSetupArgs(server, makeLogger()));

    const forwardedOpts = factorySpy.mock.calls[0]?.[0] as WatcherOptions;
    expect(
      forwardedOpts.chokidarOptions,
      'when the user did not opt into polling, the watcher must keep chokidar defaults — propagating undefined preserves the inotify-fast-path on real Linux fs',
    ).toBeUndefined();
  });
});
