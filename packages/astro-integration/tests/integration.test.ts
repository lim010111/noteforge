/**
 * Tests for the @obpub/astro AstroIntegration factory.
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
 *     I/O yet (audit lives in @obpub/cli + Phase D).
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AstroIntegration } from 'astro';
import { defineConfig, type ObpubConfig } from '@obpub/core/config';
import { obpub } from '../src/integration.ts';
import { remarkWikilink } from '../src/remarkWikilink.ts';

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

type ConfigSetupArgs = Parameters<ConfigSetupHook>[0];
type BuildDoneArgs = Parameters<BuildDoneHook>[0];

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

describe('obpub integration factory', () => {
  it('(1) returns { name: "@obpub/astro", hooks: { astro:config:setup, astro:build:done } }', () => {
    const integration = obpub(makeConfig());
    expect(
      integration.name,
      'integration name must be the package identifier so users can locate it in Astro logs',
    ).toBe('@obpub/astro');
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
