/**
 * Tests for the chokidarOptions pass-through on createWatcher.
 *
 * Why a dedicated file: watcher.test.ts owns the behavioral contracts (debounce,
 * coalesce, dependents propagation). The polling knob is a thin plumbing detail
 * for WSL `/mnt/c` mounts where inotify drops events. Splitting keeps the
 * behavioral tests untouched and makes the polling regression target obvious.
 *
 * The factory signature is (paths, opts) — we capture `opts` and assert on the
 * keys chokidar will see. We deliberately use the public createWatcher path
 * (not internals) so any future refactor of the option-merge site is caught
 * by this test rather than by chokidar misbehaving silently in dev.
 */

import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
import { defineConfig, type ObpubConfig } from '@noteforge/core/config';
import { createWatcher, type ChokidarLike, type WatcherEvent } from '../src/watcher.ts';

vi.mock('node:fs/promises', () => {
  type FakeDirent = {
    name: string;
    isDirectory: () => boolean;
    isFile: () => boolean;
    isSymbolicLink: () => boolean;
  };
  async function readdir(_p: string, _opts?: unknown): Promise<FakeDirent[]> {
    return [];
  }
  async function readFile(_p: string, _enc?: unknown): Promise<string> {
    const err = new Error('ENOENT');
    (err as NodeJS.ErrnoException).code = 'ENOENT';
    throw err;
  }
  async function stat(_p: string): Promise<{
    isDirectory: () => boolean;
    isFile: () => boolean;
  }> {
    return { isDirectory: () => false, isFile: () => true };
  }
  return { readdir, readFile, stat, default: { readdir, readFile, stat } };
});

const VAULT = '/vault';

function makeConfig(): ObpubConfig {
  return defineConfig({
    site: {
      title: 'options test',
      url: 'https://example.com',
      author: 'tester',
    },
    vaults: [
      {
        id: 'fixture',
        path: VAULT,
        ignore: ['.obsidian/**', '.trash/**'],
      },
    ],
  });
}

function makeFakeChokidar(): ChokidarLike {
  const ee = new EventEmitter();
  const on = ((event: string, listener: (...args: unknown[]) => void) => {
    ee.on(event, listener);
    return inner;
  }) as ChokidarLike['on'];
  const inner: ChokidarLike = {
    on,
    close: async (): Promise<void> => {},
  };
  return inner;
}

interface CapturedFactoryCall {
  paths: string;
  opts: Record<string, unknown>;
}

function makeWatcher(
  chokidarOptions?: { usePolling?: boolean; pollInterval?: number },
): { captured: CapturedFactoryCall[]; watcher: ReturnType<typeof createWatcher> } {
  const captured: CapturedFactoryCall[] = [];
  const factory = (paths: string, opts: unknown): ChokidarLike => {
    captured.push({ paths, opts: opts as Record<string, unknown> });
    return makeFakeChokidar();
  };
  const watcher = createWatcher({
    vaultPath: VAULT,
    vaultId: 'fixture',
    ignore: ['.obsidian/**', '.trash/**'],
    config: makeConfig(),
    onInvalidate: (_events: readonly WatcherEvent[]): void => {},
    chokidarFactory: factory,
    ...(chokidarOptions !== undefined ? { chokidarOptions } : {}),
  });
  return { captured, watcher };
}

describe('createWatcher — chokidarOptions pass-through', () => {
  it('(O1) chokidarOptions undefined → factory opts contain neither usePolling nor interval', async () => {
    const { captured, watcher } = makeWatcher();
    await watcher.start();

    expect(
      captured.length,
      'factory must run exactly once during start()',
    ).toBe(1);
    const opts = captured[0]!.opts;
    expect(
      Object.prototype.hasOwnProperty.call(opts, 'usePolling'),
      'when no chokidarOptions are configured, usePolling must NOT be set — leaving inotify defaults intact on real Linux fs',
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(opts, 'interval'),
      'pollInterval must not appear when polling is not enabled',
    ).toBe(false);
    // Existing keys must remain untouched.
    expect(opts['ignoreInitial']).toBe(true);
    expect(opts['persistent']).toBe(true);
    await watcher.stop();
  });

  it('(O2) usePolling: true + pollInterval: 200 → factory opts include usePolling: true, interval: 200', async () => {
    const { captured, watcher } = makeWatcher({ usePolling: true, pollInterval: 200 });
    await watcher.start();

    const opts = captured[0]!.opts;
    expect(
      opts['usePolling'],
      'usePolling must propagate verbatim — chokidar reads the same key name',
    ).toBe(true);
    expect(
      opts['interval'],
      'pollInterval must be remapped to chokidar\'s `interval` key — chokidar does NOT recognize `pollInterval`',
    ).toBe(200);
    await watcher.stop();
  });

  it('(O3) usePolling: false explicitly → factory opts include usePolling: false (do not silently drop)', async () => {
    const { captured, watcher } = makeWatcher({ usePolling: false });
    await watcher.start();

    const opts = captured[0]!.opts;
    expect(
      Object.prototype.hasOwnProperty.call(opts, 'usePolling'),
      'an explicit false must reach chokidar — silently omitting it would let upstream defaults override the user\'s explicit opt-out',
    ).toBe(true);
    expect(opts['usePolling']).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(opts, 'interval'),
      'pollInterval was not set, so interval must be absent',
    ).toBe(false);
    await watcher.stop();
  });
});
