/**
 * Framework-independent vault watcher for the Astro integration's dev path.
 *
 * Responsibilities:
 *   1. At start(): seed the indexer via `index.primeFromVault()` and start
 *      chokidar — the indexer owns the vault state (parse + slug + wikilink
 *      index + reverse-edge bookkeeping). The watcher is the chokidar adapter.
 *   2. On chokidar events: forward to `index.upsert()` / `index.remove()` and
 *      snapshot `index.dependentsOf(slug)` to compute the affected-slugs set.
 *      For unlinks, the snapshot MUST be taken BEFORE `index.remove()` —
 *      removing first tears down reverse edges and would leave former
 *      dependents out of the affected set.
 *   3. Debounce onInvalidate with a configurable timer (default 200ms) so that
 *      editor-driven bursts (save-on-type, multi-file renames) collapse to one
 *      render cycle in the Astro integration above.
 *
 * Privacy contract:
 *   - This module never inspects public/private markers. The verdict lives in
 *     `packages/core/src/privacy/classify.ts`; the indexer doesn't classify
 *     either, so the watcher cannot accidentally re-derive the rule.
 *
 * Single cross-package import:
 *   - Only `createIncrementalVaultIndex` from `@noteforge/core`. All vault
 *     parsing/indexing/edge-tracking lives behind that one seam.
 *
 * Chokidar is injected via `chokidarFactory` so tests can supply an in-memory
 * EventEmitter without booting filesystem watches.
 */

import * as pathMod from 'node:path';
import * as fsPromises from 'node:fs/promises';
import picomatch from 'picomatch';

import {
  createIncrementalVaultIndex,
  type IncrementalVaultIndex,
  type ObpubConfig,
} from '@noteforge/core';

export type WatcherEventKind = 'update' | 'remove';

export interface WatcherEvent {
  readonly kind: WatcherEventKind;
  /** slug of the note the event is about. */
  readonly slug: string;
  /** slug ∪ dependentsOf(slug) captured at the time the event was observed. */
  readonly affectedSlugs: ReadonlySet<string>;
}

export interface ChokidarLike {
  on(event: 'add' | 'change' | 'unlink', listener: (p: string) => void): this;
  on(event: 'error', listener: (err: unknown) => void): this;
  close(): Promise<void>;
}

export interface WatcherOptions {
  readonly vaultPath: string;
  readonly vaultId: string;
  readonly ignore: readonly string[];
  readonly config: ObpubConfig;
  readonly debounceMs?: number;
  readonly onInvalidate: (events: readonly WatcherEvent[]) => void;
  readonly onWarning?: (message: string) => void;
  readonly chokidarFactory?: (
    paths: string,
    opts: unknown,
  ) => ChokidarLike | Promise<ChokidarLike>;
  readonly readFile?: (absPath: string) => Promise<string>;
  /**
   * Thin pass-through for chokidar's polling knobs. Required on WSL `/mnt/c`
   * mounts where inotify events can be silently dropped — without polling,
   * vault edits made from the Windows side never reach the dev server.
   * Production builds do not boot the watcher, so this only affects dev.
   */
  readonly chokidarOptions?: {
    usePolling?: boolean;
    pollInterval?: number;
  };
}

export interface Watcher {
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface PendingEntry {
  kind: WatcherEventKind;
  affectedSlugs: Set<string>;
}

const MD_EXT_RE = /\.(md|markdown)$/i;

export function createWatcher(options: WatcherOptions): Watcher {
  const debounceMs = options.debounceMs ?? 200;
  const readFile =
    options.readFile ??
    ((p: string) => fsPromises.readFile(p, 'utf8') as Promise<string>);
  const chokidarFactory = options.chokidarFactory ?? defaultChokidarFactory;
  const isIgnored =
    options.ignore.length > 0
      ? picomatch(options.ignore as string[], { dot: true })
      : (): boolean => false;

  const index: IncrementalVaultIndex = createIncrementalVaultIndex({
    vaultPath: options.vaultPath,
    vaultId: options.vaultId,
    noteIgnore: options.ignore,
    slugMode: options.config.nav.mode,
    readFile,
    onWarning: (msg: string) => options.onWarning?.(msg),
  });

  const pending = new Map<string, PendingEntry>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chokidarInstance: ChokidarLike | undefined;
  let stopped = false;

  function mergePending(slug: string, kind: WatcherEventKind, affected: Set<string>): void {
    const existing = pending.get(slug);
    if (existing === undefined) {
      pending.set(slug, { kind, affectedSlugs: affected });
      return;
    }
    for (const s of affected) existing.affectedSlugs.add(s);
    // Latest event wins for kind — update→remove yields remove, remove→update yields update.
    existing.kind = kind;
  }

  function armTimer(): void {
    if (stopped) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  function flush(): void {
    timer = undefined;
    if (stopped) return;
    if (pending.size === 0) return;
    const snapshot = [...pending.entries()];
    pending.clear();
    const events: WatcherEvent[] = snapshot.map(([slug, entry]) => ({
      kind: entry.kind,
      slug,
      affectedSlugs: entry.affectedSlugs,
    }));
    options.onInvalidate(events);
  }

  function toRelative(absPath: string): string | undefined {
    const rel = pathMod.relative(options.vaultPath, absPath);
    if (rel.length === 0 || rel.startsWith('..')) return undefined;
    return rel.split(pathMod.sep).join('/');
  }

  function isMarkdown(rel: string): boolean {
    return MD_EXT_RE.test(rel);
  }

  async function handleUpsert(absPath: string): Promise<void> {
    if (stopped) return;
    const rel = toRelative(absPath);
    if (rel === undefined) return;
    if (!isMarkdown(rel)) return;
    if (isIgnored(rel)) return;

    const slug = await index.upsert(absPath, rel);
    if (stopped) return;
    if (slug === undefined) return; // read or parse failure — already warned

    const affected = new Set<string>([slug]);
    for (const d of index.dependentsOf(slug)) affected.add(d);

    mergePending(slug, 'update', affected);
    armTimer();
  }

  function handleUnlink(absPath: string): void {
    if (stopped) return;
    const rel = toRelative(absPath);
    if (rel === undefined) return;
    if (!isMarkdown(rel)) return;
    if (isIgnored(rel)) return;

    // CRITICAL: snapshot dependents BEFORE remove — removing first would
    // tear down the reverse edges and leave affectedSlugs = {slug} only,
    // so former dependents would never learn that their link target vanished.
    // We don't yet know the slug here; remove() returns it after teardown.
    // To preserve the pre-remove dependents, query before calling remove.
    // Since the indexer's `remove` accepts a relative path (not a slug), we
    // need the slug-from-rel mapping ahead of time — read it from the snapshot.
    const snapshot = index.snapshot();
    const slug = snapshot.slugByRelPath.get(rel);
    if (slug === undefined) return;

    const dependents = index.dependentsOf(slug);
    const affected = new Set<string>([slug]);
    for (const d of dependents) affected.add(d);

    index.remove(rel);

    mergePending(slug, 'remove', affected);
    armTimer();
  }

  return {
    async start(): Promise<void> {
      await index.primeFromVault();
      const baseOpts: Record<string, unknown> = {
        ignored: [...options.ignore],
        ignoreInitial: true,
        persistent: true,
      };
      const co = options.chokidarOptions;
      if (co !== undefined) {
        if (co.usePolling !== undefined) baseOpts['usePolling'] = co.usePolling;
        if (co.pollInterval !== undefined) baseOpts['interval'] = co.pollInterval;
      }
      const instance = await chokidarFactory(options.vaultPath, baseOpts);
      chokidarInstance = instance;
      instance.on('add', (p) => {
        void handleUpsert(p);
      });
      instance.on('change', (p) => {
        void handleUpsert(p);
      });
      instance.on('unlink', (p) => {
        handleUnlink(p);
      });
      instance.on('error', (err) => {
        options.onWarning?.(`[obpub:watcher] chokidar error: ${errMsg(err)}`);
      });
    },
    async stop(): Promise<void> {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      pending.clear();
      const instance = chokidarInstance;
      chokidarInstance = undefined;
      if (instance !== undefined) await instance.close();
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function defaultChokidarFactory(
  paths: string,
  opts: unknown,
): Promise<ChokidarLike> {
  // Dynamic import keeps production chokidar lazy AND keeps tests from needing
  // the native chokidar dep graph when they inject their own factory.
  const mod = await import('chokidar');
  const watcher = mod.watch(paths, opts as Parameters<typeof mod.watch>[1]);
  return watcher as unknown as ChokidarLike;
}
