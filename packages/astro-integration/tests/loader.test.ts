/**
 * Tests for @obpub/astro/loader.
 *
 * The loader bridges `runCorePipeline()` into Astro 5's Content Layer by writing
 * one entry per *public* slug into `context.store`. This file uses test-local
 * shims for `store` and `logger`, so we never import Astro internals — we only
 * import the `Loader` type from `astro/loaders` to assert structural conformance.
 *
 * Privacy contract under test:
 *   - private slugs MUST NOT reach `store.set` (Content Layer is a 2nd-order leak vector).
 *   - canary `DO_NOT_LEAK_BANANA_*` MUST NOT appear anywhere in serialized store values.
 *   - the public/private verdict is *re-used* from core, never re-derived here.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Loader } from 'astro/loaders';
import { defineConfig, type ObpubConfig } from '@obpub/core/config';
import { obpubLoader } from '../src/loader.ts';

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

interface StoreEntry {
  id: string;
  data?: Record<string, unknown>;
  rendered?: { html: string; metadata?: Record<string, unknown> };
}

function makeStore(): {
  set: (entry: StoreEntry) => boolean;
  has: (id: string) => boolean;
  get: (id: string) => StoreEntry | undefined;
  entries: () => Array<[string, StoreEntry]>;
  keys: () => string[];
  values: () => StoreEntry[];
  delete: (id: string) => void;
  clear: () => void;
  addModuleImport: (fileName: string) => void;
} {
  const m = new Map<string, StoreEntry>();
  return {
    set: (entry) => {
      m.set(entry.id, entry);
      return true;
    },
    has: (id) => m.has(id),
    get: (id) => m.get(id),
    entries: () => [...m.entries()],
    keys: () => [...m.keys()],
    values: () => [...m.values()],
    delete: (id) => {
      m.delete(id);
    },
    clear: () => m.clear(),
    addModuleImport: () => {},
  };
}

interface LoggerShim {
  warn: (m: string) => void;
  info: (m: string) => void;
  error: (m: string) => void;
  debug: (m: string) => void;
  options: { dest: { write: () => void }; level: 'info' };
  label: string;
  fork: () => LoggerShim;
  _warnings: string[];
  _infos: string[];
}

function makeLogger(): LoggerShim {
  const warnings: string[] = [];
  const infos: string[] = [];
  const logger: LoggerShim = {
    warn: (m: string) => {
      warnings.push(m);
    },
    info: (m: string) => {
      infos.push(m);
    },
    error: () => {},
    debug: () => {},
    options: { dest: { write: () => {} }, level: 'info' },
    label: 'test',
    fork: () => makeLogger(),
    _warnings: warnings,
    _infos: infos,
  };
  return logger;
}

function makeConfig(): ObpubConfig {
  return defineConfig({
    site: {
      title: 'loader test',
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
    publishing: {
      tagBlocklist: ['client/**'],
    },
  });
}

async function runLoad(
  loader: Loader,
  store: ReturnType<typeof makeStore>,
  logger: LoggerShim,
): Promise<void> {
  // Cast: tests inject a structural shim covering only the surface the loader
  // touches (store + logger). Astro adds extras (config, parseData, meta, ...)
  // that the loader never reads, so we don't model them.
  await loader.load({ store, logger } as unknown as Parameters<Loader['load']>[0]);
}

describe('obpubLoader (Astro Content Layer adapter)', () => {
  const EXPECTED_PUBLIC = new Set([
    'public-note',
    'another-public',
    'public-with-image',
    'public-with-embed',
    'public-with-comment',
    'public-with-extra-fm',
    'public-with-secret-tag',
  ]);

  let loader: Loader;
  let store: ReturnType<typeof makeStore>;
  let logger: LoggerShim;

  beforeAll(async () => {
    loader = obpubLoader(makeConfig());
    store = makeStore();
    logger = makeLogger();
    await runLoad(loader, store, logger);
  });

  it('(1) emits exactly the 7 public slugs as store keys', () => {
    expect(
      [...store.keys()].sort(),
      'store keys must equal the canonical 7-slug public set — extras or omissions break the public contract',
    ).toEqual([...EXPECTED_PUBLIC].sort());
  });

  it('(2) never leaks private slugs or canary into the store', () => {
    const keys = store.keys();
    for (const k of keys) {
      expect(
        k.startsWith('private/') ||
          k.startsWith('private-') ||
          k === 'private-secret' ||
          k === 'family-photos' ||
          k === 'Private Secret' ||
          k === 'private/family-photos',
        `store key '${k}' looks like a private identifier — Content Layer must never index private notes`,
      ).toBe(false);
    }
    const serialized = JSON.stringify(store.values());
    expect(
      serialized.includes('DO_NOT_LEAK_BANANA_6f3c1'),
      'canary string from Private Secret.md must not appear in any store entry — that would be a 2nd-order render leak',
    ).toBe(false);
  });

  it('(3) every entry has the documented shape: id + data{frontmatter,tags,backlinks} + rendered.html', () => {
    const sample = store.get('another-public');
    expect(sample, 'sample entry must exist for shape introspection').toBeDefined();
    expect(typeof sample!.id).toBe('string');
    expect(sample!.id).toBe('another-public');

    const data = sample!.data as Record<string, unknown> | undefined;
    expect(data, 'entry.data must be an object').toBeDefined();
    expect(typeof data!['frontmatter']).toBe('object');
    expect(Array.isArray(data!['tags'])).toBe(true);
    expect(Array.isArray(data!['backlinks'])).toBe(true);

    const fm = data!['frontmatter'] as Record<string, unknown>;
    // allowlist-passed fields from another-public.md
    expect(fm['title']).toBe('Another Public');
    // disallowed fields must not appear (allowlist contract)
    expect(fm['mood']).toBeUndefined();

    // tags must be a blocklist-filtered array (client/** is blocked in config)
    const tags = data!['tags'] as string[];
    expect(
      tags.every((t) => !t.startsWith('client/')),
      'blocklisted tag namespaces must be filtered before the entry reaches the store',
    ).toBe(true);

    const rendered = sample!.rendered;
    expect(rendered, 'entry.rendered must exist for public notes').toBeDefined();
    expect(typeof rendered!.html).toBe('string');
    expect(rendered!.html.length).toBeGreaterThan(0);
  });

  it('(4) tripwire-rejected private/family-photos surfaces via logger.warn at least once', () => {
    const tripwireMatches = logger._warnings.filter(
      (m) => m.includes('TRIPWIRE_REJECTED') || m.includes('family-photos'),
    );
    expect(
      tripwireMatches.length,
      'at least one warn entry must reference TRIPWIRE_REJECTED or the family-photos path — losing this signal hides real privacy violations',
    ).toBeGreaterThanOrEqual(1);
  });

  it('(5) backlinks reflect public→public edges only, never private sources', () => {
    const another = store.get('another-public');
    expect(another).toBeDefined();
    const backlinks = (another!.data as Record<string, unknown>)['backlinks'] as string[];

    expect(
      backlinks.includes('public-note'),
      'another-public is linked from public-note → backlink must be present',
    ).toBe(true);
    expect(
      backlinks.includes('public-with-embed'),
      'another-public is embedded in public-with-embed → embed counts as a graph edge',
    ).toBe(true);

    // No private source ids should ever appear in any entry's backlinks.
    const allBacklinks = store.values().flatMap((e) => {
      const data = e.data as Record<string, unknown> | undefined;
      const bl = data?.['backlinks'];
      return Array.isArray(bl) ? (bl as string[]) : [];
    });
    for (const src of allBacklinks) {
      expect(
        EXPECTED_PUBLIC.has(src),
        `backlink source '${src}' is not in the public set — private→public edges must be filtered`,
      ).toBe(true);
    }
  });

  it('(6) two consecutive load() calls produce identical keys and html (determinism)', async () => {
    const store2 = makeStore();
    const logger2 = makeLogger();
    await runLoad(loader, store2, logger2);

    const keys1 = [...store.keys()].sort();
    const keys2 = [...store2.keys()].sort();
    expect(keys2, 'second load must produce the same key set as the first').toEqual(keys1);

    for (const slug of keys1) {
      const a = store.get(slug);
      const b = store2.get(slug);
      expect(a?.rendered?.html, `rendered.html for '${slug}' must be deterministic across loads`).toBe(
        b?.rendered?.html,
      );
    }

    // And: a stale entry from a previous build must be wiped on reload.
    // We inject a fake "ghost" id directly into the store, then run load()
    // again and assert the ghost is gone — this catches a missing
    // `store.clear()` that would otherwise let removed/renamed notes linger.
    store.set({ id: '__ghost_from_previous_build__', data: {}, rendered: { html: '' } });
    expect(store.has('__ghost_from_previous_build__')).toBe(true);
    const logger3 = makeLogger();
    await runLoad(loader, store, logger3);
    expect(
      store.has('__ghost_from_previous_build__'),
      'loader must call store.clear() before populating — stale entries from a previous build must not survive a reload',
    ).toBe(false);
  });
});
