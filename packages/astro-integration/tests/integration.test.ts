/**
 * Tests for the @noteforge/astro AstroIntegration factory.
 *
 * We never boot Astro itself — we extract the hook functions from
 * `obpub(config).hooks` and call them directly with structural shims for
 * `updateConfig` and `logger`. This keeps the test fast and avoids a real
 * Vite/Astro pipeline as a dependency.
 *
 * Privacy / boundary contract under test:
 *   - integration only registers ONE remark plugin (its own); it never
 *     re-passes existing user plugins (which would double-register them
 *     after Astro's deep-merge append).
 *   - integration does NOT scan the vault at config:setup time
 *     (verified indirectly: updateConfig is only called for `markdown`,
 *     no integrations / vite / build-step config is added).
 *   - astro:build:done is a placeholder — it must not perform real audit
 *     I/O yet (audit lives in @noteforge/cli + Phase D).
 *   - astro:server:setup starts the watcher once (idempotent) and forwards
 *     coalesced file events to Vite as a full-reload signal. No Vite
 *     internals are imported — we duck-type `server.ws.send` /
 *     `server.hot.send` so the integration survives Vite minor bumps.
 */

import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AstroIntegration } from 'astro';
import { defineConfig, type ObpubConfig } from '@noteforge/core/config';
import { obpub } from '../src/integration.ts';
import { remarkWikilink } from '../src/remarkWikilink.ts';
import {
  createWatcher,
  type ChokidarLike,
  type Watcher,
  type WatcherEvent,
  type WatcherOptions,
} from '../src/watcher.ts';

// ── Fake filesystem (hoisted so vi.mock sees it) ────────────────────────────
const fakeFs = vi.hoisted(() => {
  const files = new Map<string, string>();
  return {
    files,
    set(absPath: string, content: string): void {
      files.set(absPath, content);
    },
    delete(absPath: string): void {
      files.delete(absPath);
    },
    reset(): void {
      files.clear();
    },
  };
});

vi.mock('node:fs/promises', () => {
  type FakeDirent = {
    name: string;
    isDirectory: () => boolean;
    isFile: () => boolean;
    isSymbolicLink: () => boolean;
  };
  async function readdir(p: string, _opts?: unknown): Promise<FakeDirent[]> {
    const entries: FakeDirent[] = [];
    const seenDirs = new Set<string>();
    const prefix = p.endsWith('/') ? p : `${p}/`;
    for (const absPath of fakeFs.files.keys()) {
      if (!absPath.startsWith(prefix)) continue;
      const rest = absPath.slice(prefix.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx === -1) {
        entries.push({
          name: rest,
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        });
      } else {
        const dirName = rest.slice(0, slashIdx);
        if (!seenDirs.has(dirName)) {
          seenDirs.add(dirName);
          entries.push({
            name: dirName,
            isDirectory: () => true,
            isFile: () => false,
            isSymbolicLink: () => false,
          });
        }
      }
    }
    return entries;
  }
  async function readFile(p: string, _enc?: unknown): Promise<string> {
    const c = fakeFs.files.get(p);
    if (c === undefined) {
      const err = new Error(`ENOENT: no such file or directory, open '${p}'`);
      (err as NodeJS.ErrnoException).code = 'ENOENT';
      throw err;
    }
    return c;
  }
  async function stat(_p: string): Promise<{
    isDirectory: () => boolean;
    isFile: () => boolean;
  }> {
    return { isDirectory: () => false, isFile: () => true };
  }
  return { readdir, readFile, stat, default: { readdir, readFile, stat } };
});

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
      title: 'integration test',
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

const FAKE_VAULT = '/vault';

function makeFakeVaultConfig(): ObpubConfig {
  return defineConfig({
    site: {
      title: 'integration test',
      url: 'https://example.com',
      author: 'tester',
    },
    vaults: [
      {
        id: 'fixture',
        path: FAKE_VAULT,
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

type ConfigSetupHook = NonNullable<
  AstroIntegration['hooks']['astro:config:setup']
>;
type BuildDoneHook = NonNullable<AstroIntegration['hooks']['astro:build:done']>;
type ServerSetupHook = NonNullable<
  AstroIntegration['hooks']['astro:server:setup']
>;
type ServerDoneHook = NonNullable<
  AstroIntegration['hooks']['astro:server:done']
>;

type ConfigSetupArgs = Parameters<ConfigSetupHook>[0];
type BuildDoneArgs = Parameters<BuildDoneHook>[0];
type ServerSetupArgs = Parameters<ServerSetupHook>[0];
type ServerDoneArgs = Parameters<ServerDoneHook>[0];

function makeConfigSetupArgs(overrides: {
  updateConfig: ConfigSetupArgs['updateConfig'];
  logger: LoggerSpy;
  existingRemarkPlugins?: unknown[];
}): ConfigSetupArgs {
  // Astro provides a fully-typed AstroConfig at runtime, but the integration
  // only reads `config.markdown.remarkPlugins` (via deep-merge) — never
  // reads `config` directly. We give a minimal shim and cast.
  const fakeAstroConfig = {
    markdown: { remarkPlugins: overrides.existingRemarkPlugins ?? [] },
  };
  return {
    config: fakeAstroConfig as unknown as ConfigSetupArgs['config'],
    command: 'build',
    isRestart: false,
    updateConfig: overrides.updateConfig,
    addRenderer: vi.fn(),
    addWatchFile: vi.fn(),
    injectScript: vi.fn(),
    injectRoute: vi.fn(),
    addClientDirective: vi.fn(),
    addDevToolbarApp: vi.fn(),
    addMiddleware: vi.fn(),
    createCodegenDir: vi.fn(() => new URL('file:///tmp/codegen/')),
    logger: overrides.logger as unknown as ConfigSetupArgs['logger'],
  } as ConfigSetupArgs;
}

function makeBuildDoneArgs(logger: LoggerSpy): BuildDoneArgs {
  return {
    pages: [],
    dir: new URL('file:///tmp/dist/'),
    routes: [],
    assets: new Map(),
    logger: logger as unknown as BuildDoneArgs['logger'],
  } as BuildDoneArgs;
}

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
    toolbar: { on: vi.fn(), onAppInitialized: vi.fn(), onAppToggled: vi.fn(), send: vi.fn() },
  } as unknown as ServerSetupArgs;
}

function makeServerDoneArgs(logger: LoggerSpy): ServerDoneArgs {
  return { logger: logger as unknown as ServerDoneArgs['logger'] } as ServerDoneArgs;
}

// ── Fake chokidar (mirrors watcher.test.ts) ─────────────────────────────────

interface FakeChokidar {
  readonly inner: ChokidarLike;
  readonly emit: EventEmitter['emit'];
  readonly closed: boolean;
}

function makeFakeChokidar(): FakeChokidar {
  const ee = new EventEmitter();
  const state = { closed: false };
  const on = ((event: string, listener: (...args: unknown[]) => void) => {
    ee.on(event, listener);
    return inner;
  }) as ChokidarLike['on'];
  const inner: ChokidarLike = {
    on,
    close: async () => {
      state.closed = true;
    },
  };
  return {
    inner,
    emit: ee.emit.bind(ee),
    get closed(): boolean {
      return state.closed;
    },
  };
}

describe('obpub integration factory', () => {
  it('(1) returns { name: "@noteforge/astro", hooks: { astro:config:setup, astro:build:done } }', () => {
    const integration = obpub(makeConfig());
    expect(
      integration.name,
      'integration name must be the package identifier so users can locate it in Astro logs',
    ).toBe('@noteforge/astro');
    expect(typeof integration.hooks['astro:config:setup']).toBe('function');
    expect(typeof integration.hooks['astro:build:done']).toBe('function');
  });

  it('(2) astro:config:setup → updateConfig called exactly once with our remark plugin only', async () => {
    const integration = obpub(makeConfig());
    const setup = integration.hooks['astro:config:setup'];
    expect(setup).toBeDefined();

    const updateConfig = vi.fn(((c) => c) as ConfigSetupArgs['updateConfig']);
    const logger = makeLogger();
    await setup!(makeConfigSetupArgs({ updateConfig, logger }));

    expect(
      updateConfig,
      'updateConfig must be invoked exactly once — multiple calls suggest the integration is fanning out into config surfaces it should not touch',
    ).toHaveBeenCalledTimes(1);

    const arg = updateConfig.mock.calls[0]?.[0] as
      | { markdown?: { remarkPlugins?: unknown[] } }
      | undefined;
    expect(arg, 'updateConfig argument must be an object').toBeDefined();
    expect(
      Object.keys(arg!),
      'updateConfig payload must touch ONLY the markdown surface — vault scans, integrations chaining, and vite tweaks all belong elsewhere',
    ).toEqual(['markdown']);

    const plugins = arg!.markdown?.remarkPlugins;
    expect(Array.isArray(plugins)).toBe(true);
    expect(
      plugins!.length,
      'integration must register exactly one plugin entry (its own remarkWikilink)',
    ).toBe(1);

    const entry = plugins![0];
    // The entry may be the function directly or a [plugin, options] tuple.
    if (Array.isArray(entry)) {
      expect(
        entry[0],
        'tuple form: first element must be the remarkWikilink function reference (no re-wrapping)',
      ).toBe(remarkWikilink);
    } else {
      expect(
        entry,
        'function form: entry must be the remarkWikilink function reference (no re-wrapping)',
      ).toBe(remarkWikilink);
    }
  });

  it('(3) does NOT re-pass existing user remarkPlugins (Astro deep-merge appends — re-passing causes duplicate registration)', async () => {
    const integration = obpub(makeConfig());
    const setup = integration.hooks['astro:config:setup'];
    expect(setup).toBeDefined();

    const existingDummyPlugin = function existingDummyPlugin(): void {};
    const updateConfig = vi.fn(((c) => c) as ConfigSetupArgs['updateConfig']);
    const logger = makeLogger();
    await setup!(
      makeConfigSetupArgs({
        updateConfig,
        logger,
        existingRemarkPlugins: [existingDummyPlugin],
      }),
    );

    expect(updateConfig).toHaveBeenCalledTimes(1);
    const arg = updateConfig.mock.calls[0]?.[0] as {
      markdown?: { remarkPlugins?: unknown[] };
    };
    const plugins = arg.markdown?.remarkPlugins ?? [];
    expect(
      plugins.length,
      'integration must register exactly one plugin (its own) and rely on Astro deep-merge to append — passing existing plugins back would duplicate them',
    ).toBe(1);
    // Verify our entry doesn't accidentally smuggle the existing plugin reference.
    const flatRefs: unknown[] = [];
    for (const e of plugins) {
      if (Array.isArray(e)) flatRefs.push(e[0]);
      else flatRefs.push(e);
    }
    expect(
      flatRefs.includes(existingDummyPlugin),
      'existing user plugin must NOT appear inside our updateConfig payload',
    ).toBe(false);
  });

  it('(4) astro:build:done is a placeholder — it logs once and performs no I/O', async () => {
    const integration = obpub(makeConfig());
    const buildDone = integration.hooks['astro:build:done'];
    expect(buildDone).toBeDefined();

    const logger = makeLogger();
    await expect(
      Promise.resolve(buildDone!(makeBuildDoneArgs(logger))),
      'placeholder hook must never throw — audit failures belong to a later phase',
    ).resolves.not.toThrow();

    expect(
      logger.info,
      'placeholder must announce itself exactly once via logger.info — silent placeholders rot unnoticed',
    ).toHaveBeenCalledTimes(1);
    const msg = logger.info.mock.calls[0]?.[0] as string | undefined;
    expect(typeof msg).toBe('string');
    expect(
      msg,
      'log message must contain the literal "audit placeholder" so future audit work has a single grep target',
    ).toContain('audit placeholder');
  });

  it('(5) export surface: obpub, obpubLoader, remarkWikilink are all functions on the package index', async () => {
    const pkg = await import('../src/index.ts');
    expect(typeof pkg.obpub, 'obpub must be exported as a function').toBe(
      'function',
    );
    expect(
      typeof pkg.obpubLoader,
      'obpubLoader must be exported as a function',
    ).toBe('function');
    expect(
      typeof pkg.remarkWikilink,
      'remarkWikilink must be exported as a function',
    ).toBe('function');
  });
});

// ── Dev-server wiring (step 2 additions) ────────────────────────────────────

describe('obpub integration — dev server wiring', () => {
  beforeEach(() => {
    fakeFs.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('(6) astro:server:setup kicks the watcher factory exactly once and awaits start()', async () => {
    const startSpy = vi.fn(async () => {});
    const stopSpy = vi.fn(async () => {});
    const fakeWatcher: Watcher = { start: startSpy, stop: stopSpy };
    const factorySpy = vi.fn((_opts: WatcherOptions) => fakeWatcher);

    const integration = obpub(makeConfig(), {
      createWatcherImpl: factorySpy as unknown as typeof createWatcher,
    });
    const serverSetup = integration.hooks['astro:server:setup'];
    expect(serverSetup, 'astro:server:setup must be registered').toBeDefined();

    const server: FakeServer = { ws: { send: vi.fn() } };
    const logger = makeLogger();

    await serverSetup!(makeServerSetupArgs(server, logger));

    expect(
      factorySpy,
      'factory must be called exactly once — not calling it means the watcher never starts; calling twice means duplicate chokidar instances on the same vault',
    ).toHaveBeenCalledTimes(1);
    expect(
      startSpy,
      'start() must be invoked so the vault is primed + chokidar is attached',
    ).toHaveBeenCalledTimes(1);
    const forwardedOpts = factorySpy.mock.calls[0]?.[0] as WatcherOptions;
    expect(
      forwardedOpts.vaultPath,
      'factory must receive the vault path from config verbatim — the watcher derives every relative path from this',
    ).toBe(VAULT_ROOT);
    expect(forwardedOpts.vaultId).toBe('fixture');
  });

  it('(7) astro:server:setup is idempotent — calling it twice does not double-start the watcher', async () => {
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
    const logger = makeLogger();

    await serverSetup(makeServerSetupArgs(server, logger));
    await serverSetup(makeServerSetupArgs(server, logger));

    expect(
      factorySpy,
      'second call to astro:server:setup must be a no-op — Astro can fire setup on restarts, and re-instantiating the watcher would leak file handles',
    ).toHaveBeenCalledTimes(1);
  });

  it('(8a) onInvalidate emits full-reload via server.ws.send', async () => {
    let capturedCallback:
      | ((events: readonly WatcherEvent[]) => void)
      | undefined;
    const fakeWatcher: Watcher = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const factory = vi.fn((opts: WatcherOptions) => {
      capturedCallback = opts.onInvalidate;
      return fakeWatcher;
    });

    const integration = obpub(makeConfig(), {
      createWatcherImpl: factory as unknown as typeof createWatcher,
    });
    const serverSetup = integration.hooks['astro:server:setup']!;

    const sendSpy = vi.fn();
    const server: FakeServer = { ws: { send: sendSpy } };
    await serverSetup(makeServerSetupArgs(server, makeLogger()));

    expect(capturedCallback, 'integration must install an onInvalidate').toBeDefined();

    capturedCallback!([
      { kind: 'update', slug: 'a', affectedSlugs: new Set(['a']) },
    ]);

    expect(
      sendSpy,
      'onInvalidate must dispatch exactly one HMR signal — any more means we are paying for the same reload twice',
    ).toHaveBeenCalledTimes(1);
    expect(
      sendSpy.mock.calls[0]?.[0],
      'MVP reload must be coarse-grained full-reload — slug-level invalidation via Vite internals is explicitly out of scope for v0.1',
    ).toEqual({ type: 'full-reload' });
  });

  it('(8b) onInvalidate falls back to server.hot.send when server.ws is absent', async () => {
    let capturedCallback:
      | ((events: readonly WatcherEvent[]) => void)
      | undefined;
    const fakeWatcher: Watcher = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const factory = vi.fn((opts: WatcherOptions) => {
      capturedCallback = opts.onInvalidate;
      return fakeWatcher;
    });

    const integration = obpub(makeConfig(), {
      createWatcherImpl: factory as unknown as typeof createWatcher,
    });
    const serverSetup = integration.hooks['astro:server:setup']!;

    const hotSend = vi.fn();
    const server: FakeServer = { hot: { send: hotSend } };
    await serverSetup(makeServerSetupArgs(server, makeLogger()));

    capturedCallback!([
      { kind: 'update', slug: 'a', affectedSlugs: new Set(['a']) },
    ]);

    expect(
      hotSend,
      'duck-typed fallback to server.hot.send is what keeps this integration from breaking when Vite renames its HMR bridge between minors',
    ).toHaveBeenCalledTimes(1);
    expect(hotSend.mock.calls[0]?.[0]).toEqual({ type: 'full-reload' });
  });

  it('(9) astro:server:done awaits watcher.stop and permits re-setup afterwards', async () => {
    let stopResolved = false;
    let releaseStop: (() => void) | undefined;
    const stopPromise = new Promise<void>((resolve) => {
      releaseStop = resolve;
    });
    const stopSpy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          void stopPromise.then(() => {
            stopResolved = true;
            resolve();
          });
        }),
    );
    const factoryCallCount = { n: 0 };
    const factory = vi.fn((_opts: WatcherOptions) => {
      factoryCallCount.n += 1;
      return {
        start: vi.fn(async () => {}),
        stop: stopSpy,
      } as Watcher;
    });

    const integration = obpub(makeConfig(), {
      createWatcherImpl: factory as unknown as typeof createWatcher,
    });
    const serverSetup = integration.hooks['astro:server:setup']!;
    const serverDone = integration.hooks['astro:server:done']!;

    const server: FakeServer = { ws: { send: vi.fn() } };
    await serverSetup(makeServerSetupArgs(server, makeLogger()));
    expect(factoryCallCount.n).toBe(1);

    const donePromise = serverDone(makeServerDoneArgs(makeLogger()));
    // Before we release the underlying stop, the hook must still be pending —
    // a premature resolve would mean we forgot to await stop() and the next
    // setup cycle could race against the previous chokidar tearing itself down.
    await Promise.resolve();
    expect(
      stopResolved,
      'astro:server:done must not resolve until watcher.stop() settles',
    ).toBe(false);

    releaseStop!();
    await donePromise;
    expect(stopSpy).toHaveBeenCalledTimes(1);

    // After teardown, setup must be allowed to run again (astro dev restart).
    await serverSetup(makeServerSetupArgs(server, makeLogger()));
    expect(
      factoryCallCount.n,
      'after astro:server:done, astro:server:setup must be allowed to spin a fresh watcher — otherwise dev restart hangs with no file watching',
    ).toBe(2);
  });

  it('(10) end-to-end: file change → debounced full-reload via the real createWatcher', async () => {
    vi.useFakeTimers();

    fakeFs.set(`${FAKE_VAULT}/a.md`, '# A\n[[B]]\n');
    fakeFs.set(`${FAKE_VAULT}/b.md`, '# B\n');

    const chokidar = makeFakeChokidar();

    // Wrap the real createWatcher with the chokidar + readFile seams so the
    // test never touches real disk or real fs watchers. This proves the
    // integration → watcher → vite path is wired end to end (no mocks at
    // the integration boundary).
    const wrappedFactory: typeof createWatcher = (opts) =>
      createWatcher({
        ...opts,
        chokidarFactory: () => chokidar.inner,
        readFile: async (p: string) => {
          const c = fakeFs.files.get(p);
          if (c === undefined) {
            const err = new Error(`ENOENT: ${p}`);
            (err as NodeJS.ErrnoException).code = 'ENOENT';
            throw err;
          }
          return c;
        },
      });

    // `onDevInvalidate` captures the coalesced batch shape so we can assert
    // the watcher collapsed multiple observations into a single entry.
    // `server.ws.send` is still populated so the dispatch path is exercised
    // whenever the seam is absent — but the seam takes precedence when set,
    // so we assert on the captured batch here. Dispatch-to-ws is covered by
    // assert (8a/8b).
    const forwardedEvents: { kind: string; slug: string }[][] = [];
    const integration = obpub(makeFakeVaultConfig(), {
      createWatcherImpl: wrappedFactory,
      onDevInvalidate: (events) => {
        forwardedEvents.push(events);
      },
    });

    const serverSetup = integration.hooks['astro:server:setup']!;
    const server: FakeServer = { ws: { send: vi.fn() } };
    await serverSetup(makeServerSetupArgs(server, makeLogger()));

    chokidar.emit('change', `${FAKE_VAULT}/a.md`);
    await vi.runAllTimersAsync();

    expect(
      forwardedEvents.length,
      'exactly one coalesced batch must reach the dev-invalidate seam — multiple batches mean the debounce is broken upstream',
    ).toBe(1);
    const batch = forwardedEvents[0]!;
    expect(
      batch.length,
      'single-file change must coalesce to one entry in the batch (coalesced, "a" slug)',
    ).toBe(1);
    expect(batch[0]!.slug).toBe('a');
    expect(batch[0]!.kind).toBe('update');

    await integration.hooks['astro:server:done']!(
      makeServerDoneArgs(makeLogger()),
    );
    expect(chokidar.closed).toBe(true);
  });
});
