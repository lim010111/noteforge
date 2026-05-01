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
import type { PipelineResult } from '@noteforge/core/pipeline';
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
  // mkdir/copyFile are not exercised by the watcher path; the build-done
  // attachment copy injects its own `fs` shim via ObpubIntegrationOptions, so
  // these stubs only exist to make `import * as fs from 'node:fs/promises'`
  // resolve without exploding when other consumers eagerly destructure.
  async function mkdir(_p: string, _opts?: unknown): Promise<void> {}
  async function copyFile(_src: string, _dest: string): Promise<void> {}
  return {
    readdir,
    readFile,
    stat,
    mkdir,
    copyFile,
    default: { readdir, readFile, stat, mkdir, copyFile },
  };
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

function makeBuildDoneArgs(logger: LoggerSpy, distUrl?: URL): BuildDoneArgs {
  return {
    pages: [],
    dir: distUrl ?? new URL('file:///tmp/obpub-test-dist/'),
    routes: [],
    assets: new Map(),
    logger: logger as unknown as BuildDoneArgs['logger'],
  } as BuildDoneArgs;
}

interface FakeMiddlewares {
  use: ReturnType<typeof vi.fn>;
  /** Captured handlers keyed by mount path, populated by `use()` calls. */
  handlers: Map<string, MiddlewareHandler>;
}

type MiddlewareReq = { url?: string; method?: string };
type MiddlewareRes = {
  statusCode: number;
  headersSent?: boolean;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: unknown) => void;
  write?: (chunk: unknown) => void;
};
type MiddlewareHandler = (
  req: MiddlewareReq,
  res: MiddlewareRes,
  next: () => void,
) => void;

interface FakeServer {
  ws?: { send: ReturnType<typeof vi.fn> };
  hot?: { send: ReturnType<typeof vi.fn> };
  middlewares?: FakeMiddlewares;
}

function makePipelineStub(
  closure: readonly string[],
): (config: ObpubConfig) => Promise<PipelineResult> {
  return async () => {
    // The integration only reads `attachmentClosure` from the result, so a
    // narrow stub is enough — synthesising the full PipelineResult shape
    // would lock us into upstream changes.
    return { attachmentClosure: new Set(closure) } as unknown as PipelineResult;
  };
}

function makeFakeMiddlewares(): FakeMiddlewares {
  const handlers = new Map<string, MiddlewareHandler>();
  const use = vi.fn((mount: string, handler: MiddlewareHandler) => {
    handlers.set(mount, handler);
  });
  return { use, handlers };
}

interface FakeRes extends MiddlewareRes {
  statusCode: number;
  headers: Map<string, string>;
  body: Uint8Array[];
  ended: boolean;
  endedWith?: Uint8Array | string;
}

function makeFakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    headers: new Map(),
    body: [],
    ended: false,
    setHeader(name, value) {
      res.headers.set(name.toLowerCase(), value);
    },
    write(chunk) {
      if (chunk instanceof Uint8Array) res.body.push(chunk);
      else if (typeof chunk === 'string')
        res.body.push(new TextEncoder().encode(chunk));
    },
    end(chunk) {
      if (chunk !== undefined) {
        if (chunk instanceof Uint8Array) res.body.push(chunk);
        else if (typeof chunk === 'string')
          res.body.push(new TextEncoder().encode(chunk));
        res.endedWith = chunk as Uint8Array | string;
      }
      res.ended = true;
    },
  };
  return res;
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

  it('(4) astro:build:done copies the attachment closure into dist/attachments via the injected fs seam', async () => {
    // We seed the closure with two ids — a flat one (`only-public.png`) and
    // a nested one (`attachments/AI/photo.jpg`) — so the test exercises both
    // the leaf-only case AND the recursive-mkdir case. A future regression
    // that, say, drops the `mkdir` step would still pass with a flat id;
    // the nested id is what makes the contract actionable.
    const copyCalls: { src: string; dest: string }[] = [];
    const mkdirCalls: { dir: string; opts: unknown }[] = [];
    const fakeFsImpl = {
      mkdir: vi.fn(async (dir: string, opts: { recursive: true }) => {
        mkdirCalls.push({ dir, opts });
      }),
      copyFile: vi.fn(async (src: string, dest: string) => {
        copyCalls.push({ src, dest });
      }),
      readFile: vi.fn(async (_p: string) => new Uint8Array(0)),
    };

    const closure = ['only-public.png', 'attachments/AI/photo.jpg'];
    const integration = obpub(makeConfig(), {
      fs: fakeFsImpl,
      runPipelineImpl: makePipelineStub(closure),
    });
    const buildDone = integration.hooks['astro:build:done'];
    expect(buildDone).toBeDefined();

    const distUrl = new URL('file:///tmp/obpub-test-dist/');
    const logger = makeLogger();
    await buildDone!(makeBuildDoneArgs(logger, distUrl));

    const distRoot = fileURLToPath(distUrl);
    const expected = closure.map((id) => ({
      src: path.resolve(VAULT_ROOT, id),
      dest: path.resolve(distRoot, 'attachments', id),
    }));

    // Order is not contractual (closure is a Set), so compare as sorted arrays.
    const sortedCopy = [...copyCalls].sort((a, b) => a.dest.localeCompare(b.dest));
    const sortedExpected = [...expected].sort((a, b) =>
      a.dest.localeCompare(b.dest),
    );
    expect(
      sortedCopy,
      'build-done must copy exactly the public attachment closure — not the union of all attachments, and not nothing',
    ).toEqual(sortedExpected);

    const sortedMkdir = [...mkdirCalls].sort((a, b) => a.dir.localeCompare(b.dir));
    expect(
      sortedMkdir,
      'each copy must be preceded by a recursive mkdir so deep attachment paths (attachments/AI/foo.png) land cleanly',
    ).toEqual(
      sortedExpected
        .map((e) => ({ dir: path.dirname(e.dest), opts: { recursive: true } }))
        .sort((a, b) => a.dir.localeCompare(b.dir)),
    );

    expect(
      logger.info,
      'build-done must summarise the copy count exactly once — silent success is how regressions hide',
    ).toHaveBeenCalledTimes(1);
    const summary = logger.info.mock.calls[0]?.[0] as string | undefined;
    expect(summary).toContain('copied 2/2 attachment(s)');
  });

  it('(4b) astro:build:done throws when any closure entry fails to copy and surfaces every failure via logger.warn', async () => {
    // When the OS / mocked fs rejects a copy, the integration must NOT
    // silently drop the failed attachment from dist. Throwing surfaces the
    // problem to `astro build`, which exits non-zero and prevents shipping
    // a half-broken site. The per-failure warn line keeps the post-mortem
    // single-grep-able.
    const integration = obpub(makeConfig(), {
      fs: {
        mkdir: async () => {
          throw new Error('synthetic mkdir failure');
        },
        copyFile: async () => {},
        readFile: async () => new Uint8Array(0),
      },
      runPipelineImpl: makePipelineStub(['only-public.png']),
    });
    const buildDone = integration.hooks['astro:build:done']!;
    const logger = makeLogger();
    await expect(
      buildDone(
        makeBuildDoneArgs(logger, new URL('file:///tmp/obpub-test-dist-fail/')),
      ),
      'when any attachment fails to copy, build-done must throw so the surrounding `astro build` exits non-zero — silently dropping a public attachment from dist would ship a broken site',
    ).rejects.toThrow(/attachment\(s\) failed to copy/);
    expect(
      logger.warn.mock.calls.length,
      'each failure must be reported once via logger.warn before the throw — quiet failures rot in CI logs',
    ).toBeGreaterThanOrEqual(1);
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
      runPipelineImpl: makePipelineStub([]),
    });
    const serverSetup = integration.hooks['astro:server:setup'];
    expect(serverSetup, 'astro:server:setup must be registered').toBeDefined();

    const server: FakeServer = { ws: { send: vi.fn() }, middlewares: makeFakeMiddlewares() };
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
      runPipelineImpl: makePipelineStub([]),
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
      runPipelineImpl: makePipelineStub([]),
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
      runPipelineImpl: makePipelineStub([]),
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
      runPipelineImpl: makePipelineStub([]),
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
      runPipelineImpl: makePipelineStub([]),
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

  it('(11) /attachments/* middleware streams a closure member and 404s every other request', async () => {
    // The middleware is the dev-time mirror of the build-done copier — both
    // gate on `attachmentClosure`, so a regression that lets the middleware
    // leak something the copier would never have shipped is the worst kind
    // (live-only leak that audit on dist cannot catch). This test pins the
    // four states — closure hit (200), miss (404), traversal attempt (404),
    // wrong method (next).
    const fakeWatcher: Watcher = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const factory = vi.fn((_opts: WatcherOptions) => fakeWatcher);

    const fileBytes = new TextEncoder().encode('PNG-fake-bytes');
    const fakeFsImpl: NonNullable<Parameters<typeof obpub>[1]>['fs'] = {
      mkdir: async () => {},
      copyFile: async () => {},
      readFile: vi.fn(async (_abs: string) => fileBytes),
    };

    const integration = obpub(makeConfig(), {
      createWatcherImpl: factory as unknown as typeof createWatcher,
      runPipelineImpl: makePipelineStub(['only-public.png']),
      fs: fakeFsImpl,
    });
    const serverSetup = integration.hooks['astro:server:setup']!;

    const middlewares = makeFakeMiddlewares();
    const server: FakeServer = { ws: { send: vi.fn() }, middlewares };
    await serverSetup(makeServerSetupArgs(server, makeLogger()));

    // Astro's connect-style mount strips the `/attachments` prefix before
    // handing the request off, so handler-side `req.url` is just the suffix.
    const handler = middlewares.handlers.get('/attachments');
    expect(handler, 'middleware must register on /attachments mount').toBeDefined();

    // (a) closure HIT — public attachment in the closure
    {
      const res = makeFakeRes();
      const next = vi.fn();
      handler!({ url: '/only-public.png', method: 'GET' }, res, next);
      // Wait for async readFile to settle (fake fs is async).
      await new Promise((r) => setTimeout(r, 0));
      expect(
        next,
        'a closure HIT must stream the asset, not delegate downstream — delegation would let other middleware (e.g. SSR) try to render and 500',
      ).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(res.ended).toBe(true);
      expect(res.body.map((b) => Array.from(b)).flat()).toEqual(
        Array.from(fileBytes),
      );
    }

    // (b) closure MISS — looks like a real attachment but is not in the set
    {
      const res = makeFakeRes();
      const next = vi.fn();
      handler!({ url: '/only-private.png', method: 'GET' }, res, next);
      await new Promise((r) => setTimeout(r, 0));
      expect(
        next,
        'closure miss must terminate with 404 — calling next() would expose private attachments to whatever fallback handler runs after',
      ).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(404);
      expect(res.ended).toBe(true);
    }

    // (c) path traversal attempt — `..` segments must 404, never read disk
    {
      const callsBefore = (
        fakeFsImpl.readFile as unknown as { mock: { calls: unknown[] } }
      ).mock.calls.length;
      const res = makeFakeRes();
      const next = vi.fn();
      handler!(
        { url: '/../../etc/passwd', method: 'GET' },
        res,
        next,
      );
      expect(res.statusCode).toBe(404);
      expect(res.ended).toBe(true);
      const callsAfter = (
        fakeFsImpl.readFile as unknown as { mock: { calls: unknown[] } }
      ).mock.calls.length;
      expect(
        callsAfter - callsBefore,
        'traversal attempts must short-circuit before any fs read — even an attempted read would write the path into logs',
      ).toBe(0);
    }

    // (d) non-GET/HEAD — POST should fall through to the next middleware
    {
      const res = makeFakeRes();
      const next = vi.fn();
      handler!({ url: '/only-public.png', method: 'POST' }, res, next);
      expect(
        next,
        'non-GET/HEAD methods are not the middleware\'s responsibility — passing through preserves CORS/preflight handling that real apps may install on the same path',
      ).toHaveBeenCalledTimes(1);
    }
  });
});
