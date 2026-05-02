/**
 * Tests for @noteforge/astro/loader.
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
import { defineConfig, type ObpubConfig } from '@noteforge/core/config';
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
  // 8 v0.1/v0.2 notes + 5 v0.3 fixture additions (case (a) deep-public branch,
  // case (c) draft+visible mix, case (d) folder-vs-note slug collision) +
  // v0.5's `public-with-math` + v0.51's frontmatter-only cover fixture.
  // Case (b) `private/secrets/diary` stays excluded by the tripwire.
  const EXPECTED_PUBLIC = new Set([
    'public-note',
    'another-public',
    'public-with-image',
    'public-with-embed',
    'public-with-comment',
    'public-with-extra-fm',
    'public-with-frontmatter-cover',
    'public-with-secret-tag',
    'public-with-math',
    'note-with-alias',
    'posts/ai/claude/agents',
    'posts/mix/visible',
    'posts/mix/wip',
    'apps',
    'apps/colliding/index',
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

  it('(1) emits exactly the 15 public slugs as note-kind store keys', () => {
    const noteKeys = store
      .values()
      .filter((e) => (e.data as Record<string, unknown>)['kind'] === 'note')
      .map((e) => e.id);
    expect(
      [...noteKeys].sort(),
      'note-kind keys must equal the canonical 8-slug public set — extras or omissions break the public contract',
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
          k === 'private/family-photos' ||
          k === 'private/secrets/diary',
        `store key '${k}' looks like a private identifier — Content Layer must never index private notes`,
      ).toBe(false);
    }
    const serialized = JSON.stringify(store.values());
    expect(
      serialized.includes('DO_NOT_LEAK_BANANA_6f3c1'),
      'canary A from Private Secret.md must not appear in any store entry — that would be a 2nd-order render leak',
    ).toBe(false);
    expect(
      serialized.includes('FOLDER_TREE_DO_NOT_LEAK_8a4f2'),
      'canary C from private/secrets/diary.md (v0.3 case b) must not surface — title or body of a tripwire-rejected note must never reach the store',
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

  it('(5b) gates cover/thumbnail attachment frontmatter and exposes safe picker metadata', () => {
    const imageEntry = store.get('public-with-image');
    expect(imageEntry).toBeDefined();
    const data = imageEntry!.data as Record<string, unknown>;

    expect(data['heroImage']).toBe('/attachments/only-public.png');
    expect(data['thumbnailImage']).toBeUndefined();
    expect(data['embeddedImages']).toEqual([
      '/attachments/only-public.png',
      'https://example.com/remote.png',
    ]);
    expect(data['sourcePath']).toBe('public-with-image.md');

    const serialized = JSON.stringify(imageEntry);
    expect(
      serialized,
      'loader must not surface a private-only attachment path via hero/thumbnail/frontmatter side channels',
    ).not.toContain('/attachments/only-private.png');
  });

  it('(6a) every note entry carries kind:"note" and alias entries are kind:"alias-redirect" with only `to`', () => {
    // The vault-mixed fixture declares `aliases: [구이름]` on another-public.md,
    // so the loader must surface a single alias entry here. (Step 2 will broaden
    // fixture coverage; step 1 only asserts the channel is wired.)
    const noteEntry = store.get('another-public');
    expect(noteEntry).toBeDefined();
    expect((noteEntry!.data as Record<string, unknown>)['kind']).toBe('note');

    const aliasEntry = store.get('구이름');
    expect(
      aliasEntry,
      'alias entry for `구이름` (declared on another-public.md) must be present in the store',
    ).toBeDefined();
    expect((aliasEntry!.data as Record<string, unknown>)['kind']).toBe(
      'alias-redirect',
    );
    expect((aliasEntry!.data as Record<string, unknown>)['to']).toBe(
      'another-public',
    );

    // Alias entries are pure URL pointers — they must not carry rendered HTML
    // or note metadata. Any of those fields would let a route accidentally
    // dereference an alias as a fully-rendered note.
    expect(
      aliasEntry!.rendered,
      'alias entry must not carry rendered HTML',
    ).toBeUndefined();
    expect(
      (aliasEntry!.data as Record<string, unknown>)['frontmatter'],
      'alias entry must not carry frontmatter — privacy-first allowlist applies to notes only',
    ).toBeUndefined();
    expect(
      (aliasEntry!.data as Record<string, unknown>)['tags'],
      'alias entry must not carry tags',
    ).toBeUndefined();
  });

  it('(6b) alias entry id never collides with a note slug', () => {
    const aliasIds = store
      .values()
      .filter(
        (e) =>
          (e.data as Record<string, unknown>)['kind'] === 'alias-redirect',
      )
      .map((e) => e.id);
    for (const aliasId of aliasIds) {
      expect(
        EXPECTED_PUBLIC.has(aliasId),
        `alias id '${aliasId}' must not duplicate a note slug — collision means store.set silently overwrites`,
      ).toBe(false);
    }
  });

  it('(7) two consecutive load() calls produce identical keys and html (determinism)', async () => {
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
