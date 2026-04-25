/**
 * Tests for @noteforge/astro vault watcher.
 *
 * The watcher is the dev-time glue between the vault on disk and the Astro
 * Content Layer. It never decides public/private (that lives in core) — it
 * tracks "what changed, who depends on it" and hands a coalesced invalidation
 * set to the integration. These tests pin down the invariants the integration
 * relies on: debounce, coalesce, pre-remove dependent snapshotting, ignore
 * pattern enforcement, and graceful parse failure.
 *
 * Module contract (documented once):
 *   - ChokidarLike exposes on(ev, cb) + close(). Tests provide an EventEmitter
 *     subclass that structurally satisfies that interface.
 *   - fs.readFile / fs.readdir / fs.stat are mocked via `vi.mock('node:fs/promises')`
 *     backed by a hoisted in-memory file map so the watcher's initial walk +
 *     per-event reads go through the fake filesystem without touching tmp dirs.
 */

import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineConfig, type ObpubConfig } from '@noteforge/core/config';
import {
  createWatcher,
  type ChokidarLike,
  type WatcherEvent,
} from '../src/watcher.ts';

// ── Fake filesystem (hoisted so vi.mock's factory sees it) ─────────────────
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
  async function readdir(
    p: string,
    _opts?: unknown,
  ): Promise<FakeDirent[]> {
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

// ── Fake chokidar ───────────────────────────────────────────────────────────

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

const VAULT = '/vault';
const absOf = (rel: string): string => `${VAULT}/${rel}`;

function makeConfig(): ObpubConfig {
  return defineConfig({
    site: {
      title: 'watcher test',
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

interface Harness {
  chokidar: FakeChokidar;

  invalidations: WatcherEvent[][];
  warnings: string[];
  watcher: ReturnType<typeof createWatcher>;
}

function makeWatcher(): Harness {
  const chokidar = makeFakeChokidar();
  const invalidations: WatcherEvent[][] = [];
  const warnings: string[] = [];
  const watcher = createWatcher({
    vaultPath: VAULT,
    vaultId: 'fixture',
    ignore: ['.obsidian/**', '.trash/**'],
    config: makeConfig(),
    onInvalidate: (events: readonly WatcherEvent[]): void => {
      invalidations.push(
        events.map((e) => ({
          kind: e.kind,
          slug: e.slug,
          affectedSlugs: new Set(e.affectedSlugs),
        })),
      );
    },
    onWarning: (msg: string): void => {
      warnings.push(msg);
    },
    chokidarFactory: (): ChokidarLike => chokidar.inner,
  });
  return { chokidar, invalidations, warnings, watcher };
}

beforeEach(() => {
  fakeFs.reset();
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.useRealTimers();
});

describe('createWatcher', () => {
  it('(1) start() primes depGraph from initial vault — no immediate onInvalidate, but later A change pulls B in as dependent', async () => {
    fakeFs.set(absOf('A.md'), '# A\n');
    fakeFs.set(absOf('B.md'), '# B\n[[A]]\n');

    const h = makeWatcher();
    await h.watcher.start();

    expect(
      h.invalidations.length,
      'start() must not call onInvalidate for the initial snapshot — the integration populates the store via the loader, not via watcher events',
    ).toBe(0);

    // Sanity check via assert 2's mechanism: changing A should propagate to B
    // because start() recorded the A→B edge.
    h.chokidar.emit('change', absOf('A.md'));
    await vi.runAllTimersAsync();

    expect(h.invalidations.length).toBe(1);
    const events = h.invalidations[0]!;
    expect(events.length).toBe(1);
    const ev = events[0]!;
    expect(
      ev.slug,
      'change on A.md must emit an event keyed by slug "a"',
    ).toBe('a');
    // This is the whole point of seeding depGraph at start — without it,
    // b would not be in affectedSlugs because the B→A forward edge wasn't known.
    expect(
      ev.affectedSlugs.has('b'),
      'B must be in affectedSlugs because start() recorded B→A (B depends on A via [[A]]) — if start() skipped seeding, only {a} would be present',
    ).toBe(true);
    await h.watcher.stop();
  });

  it('(2) add event for a brand-new note triggers exactly one debounced invalidation with affected = {slug}', async () => {
    const h = makeWatcher();
    await h.watcher.start();

    fakeFs.set(absOf('A.md'), '# A\n');
    h.chokidar.emit('add', absOf('A.md'));

    // Before debounce window elapses, nothing fires.
    await vi.advanceTimersByTimeAsync(150);
    expect(
      h.invalidations.length,
      'onInvalidate must NOT fire inside the 200ms debounce window — premature flush defeats coalescing',
    ).toBe(0);

    await vi.advanceTimersByTimeAsync(100);
    expect(h.invalidations.length).toBe(1);
    const events = h.invalidations[0]!;
    expect(events.length).toBe(1);
    const ev = events[0]!;
    expect(ev.kind).toBe('update');
    expect(ev.slug).toBe('a');
    expect(
      [...ev.affectedSlugs].sort(),
      'affectedSlugs for an orphan note must be exactly its own slug — no phantom dependents',
    ).toEqual(['a']);
    await h.watcher.stop();
  });

  it('(3) change on a note with a dependent propagates to the dependent via dependentsOf', async () => {
    fakeFs.set(absOf('A.md'), '# A\n');
    fakeFs.set(absOf('B.md'), '# B\n[[A]]\n');

    const h = makeWatcher();
    await h.watcher.start();

    // Edit A — B depends on A via [[A]], so B must be invalidated too.
    fakeFs.set(absOf('A.md'), '# A\nupdated\n');
    h.chokidar.emit('change', absOf('A.md'));
    await vi.runAllTimersAsync();

    expect(h.invalidations.length).toBe(1);
    const ev = h.invalidations[0]![0]!;
    expect(ev.kind).toBe('update');
    expect(ev.slug).toBe('a');
    expect(
      [...ev.affectedSlugs].sort(),
      'dependent B must appear in affectedSlugs — without transitive invalidation the backlink on B would stay stale',
    ).toEqual(['a', 'b']);
    await h.watcher.stop();
  });

  it('(4) unlink captures dependents BEFORE removeNote — affected still contains the now-orphan dependents', async () => {
    fakeFs.set(absOf('A.md'), '# A\n');
    fakeFs.set(absOf('B.md'), '# B\n[[A]]\n');

    const h = makeWatcher();
    await h.watcher.start();

    fakeFs.delete(absOf('A.md'));
    h.chokidar.emit('unlink', absOf('A.md'));
    await vi.runAllTimersAsync();

    expect(h.invalidations.length).toBe(1);
    const events = h.invalidations[0]!;
    expect(events.length).toBe(1);
    const ev = events[0]!;
    expect(ev.kind, 'unlink must flush with kind "remove"').toBe('remove');
    expect(ev.slug).toBe('a');
    expect(
      ev.affectedSlugs.has('a'),
      "removed slug must be in affectedSlugs so the loader wipes it from the store",
    ).toBe(true);
    expect(
      ev.affectedSlugs.has('b'),
      'pre-removal snapshot of dependentsOf(a) must include B — computing this AFTER removeNote would lose the edge and leave B with a stale rendered link',
    ).toBe(true);
    await h.watcher.stop();
  });

  it('(5) multiple events inside the debounce window coalesce to a single onInvalidate call with deduped entries', async () => {
    fakeFs.set(absOf('A.md'), '# A\n');
    fakeFs.set(absOf('B.md'), '# B\n');

    const h = makeWatcher();
    await h.watcher.start();

    // 150ms worth of churn, 3x A + 1x B.
    h.chokidar.emit('change', absOf('A.md'));
    await vi.advanceTimersByTimeAsync(50);
    h.chokidar.emit('change', absOf('A.md'));
    await vi.advanceTimersByTimeAsync(50);
    h.chokidar.emit('change', absOf('A.md'));
    await vi.advanceTimersByTimeAsync(50);
    h.chokidar.emit('change', absOf('B.md'));

    // Still inside the rolling 200ms window after the last event.
    expect(
      h.invalidations.length,
      'intermediate events must reset the debounce timer — otherwise coalesce is broken',
    ).toBe(0);

    await vi.advanceTimersByTimeAsync(250);
    expect(
      h.invalidations.length,
      'all events in the window must coalesce to ONE onInvalidate call',
    ).toBe(1);

    const events = h.invalidations[0]!;
    const bySlug = new Map(events.map((e) => [e.slug, e]));
    expect(
      events.length,
      'coalesced batch must contain exactly 2 entries — one per slug, not one per raw event',
    ).toBe(2);
    expect(bySlug.get('a')?.kind).toBe('update');
    expect(bySlug.get('b')?.kind).toBe('update');
    await h.watcher.stop();
  });

  it('(6) changes under an ignored path do not surface as invalidations', async () => {
    const h = makeWatcher();
    await h.watcher.start();

    // Directly emit the event as chokidar might without its own ignore
    // filter — the watcher must still guard against it.
    h.chokidar.emit('change', absOf('.obsidian/workspace.json'));
    await vi.runAllTimersAsync();

    expect(
      h.invalidations.length,
      'ignore-pattern guard is the last line of defense against leaking non-vault noise into invalidations',
    ).toBe(0);
    await h.watcher.stop();
  });

  it('(7) events for non-markdown files (e.g. .png) do not produce invalidations', async () => {
    const h = makeWatcher();
    await h.watcher.start();

    h.chokidar.emit('change', absOf('note.png'));
    await vi.runAllTimersAsync();

    expect(
      h.invalidations.length,
      'attachments are not notes — routing an image change through the note invalidation path would double-invalidate or mis-register edges',
    ).toBe(0);
    await h.watcher.stop();
  });

  it('(8) malformed YAML frontmatter in a changed file emits onWarning and SKIPS onInvalidate for that slug', async () => {
    fakeFs.set(absOf('A.md'), '# A\n');
    const h = makeWatcher();
    await h.watcher.start();

    // Known gray-matter failure: unterminated flow-sequence inside frontmatter.
    fakeFs.set(absOf('A.md'), '---\nkey: [unclosed\n---\nbody\n');
    h.chokidar.emit('change', absOf('A.md'));
    await vi.runAllTimersAsync();

    expect(
      h.warnings.length,
      'parse failures must surface via onWarning so the developer sees WHY the preview went stale',
    ).toBeGreaterThanOrEqual(1);
    expect(
      h.invalidations.length,
      'a slug with uncertain parse state must not be emitted — pushing half-parsed state is worse than skipping a frame of HMR',
    ).toBe(0);
    await h.watcher.stop();
  });

  it('(9) stop() cancels any pending debounce timer and prevents later flushes; close() is awaited', async () => {
    fakeFs.set(absOf('A.md'), '# A\n');
    const h = makeWatcher();
    await h.watcher.start();

    h.chokidar.emit('change', absOf('A.md'));
    await vi.advanceTimersByTimeAsync(50); // handler async work flushes, timer armed but not fired

    await h.watcher.stop();

    // Advance past the original debounce window — must NOT fire.
    await vi.advanceTimersByTimeAsync(500);
    expect(
      h.invalidations.length,
      'stop() must clear the pending flush timer — a stale onInvalidate after stop() is a memory leak and confuses consumers mid-teardown',
    ).toBe(0);
    expect(
      h.chokidar.closed,
      'stop() must close() the underlying chokidar — leaving file handles open exhausts inotify watchers on Linux',
    ).toBe(true);
  });
});
