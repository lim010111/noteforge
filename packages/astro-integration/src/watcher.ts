/**
 * Framework-independent vault watcher for the Astro integration's dev path.
 *
 * Responsibilities:
 *   1. At start(): walk the vault, parse each note, seed the dep-graph with the
 *      forward/reverse edges implied by each note's outgoing [[wiki]] and ![[embed]]
 *      links. We do NOT run the privacy pipeline here — the loader owns that.
 *   2. On chokidar file events: re-parse the changed file, update the dep-graph,
 *      and accumulate a coalesced invalidation set keyed by slug. Affected slugs
 *      for an unlink are snapshotted BEFORE removeNote so former dependents still
 *      learn to re-render without the torn-down link.
 *   3. Debounce onInvalidate with a configurable timer (default 200ms) so that
 *      editor-driven bursts (save-on-type, multi-file renames) collapse to one
 *      render cycle in the Astro integration above.
 *
 * Privacy contract:
 *   - This module never inspects public/private markers. The verdict lives in
 *     `packages/core/src/privacy/classify.ts`; re-deriving it here would split
 *     the rule across two paths (watcher + loader) and is the most common origin
 *     of leak regressions.
 *   - Wikilink parsing/resolution is delegated to `@noteforge/core/resolve/wikilink`.
 *     We scan the raw body for `[[...]]` and `![[...]]`, then resolve via the
 *     shared index so the watcher stays consistent with the loader's view.
 *
 * Chokidar is injected via `chokidarFactory` so tests can supply an in-memory
 * EventEmitter without booting filesystem watches.
 */

import matter from 'gray-matter';
import * as pathMod from 'node:path';
import * as fsPromises from 'node:fs/promises';
import picomatch from 'picomatch';

import type { ObpubConfig } from '@noteforge/core/config';
import { walkVault } from '../../core/src/discover/walk.ts';
import { parseNote } from '../../core/src/discover/parseNote.ts';
import { computeSlug } from '../../core/src/slug.ts';
import {
  buildWikilinkIndex,
  resolveWikilink,
  type IndexedNote,
  type WikilinkIndex,
} from '../../core/src/resolve/wikilink.ts';
import type { ParsedNote } from '../../core/src/types.ts';

import { createDepGraph, type DepGraph } from './depGraph.ts';

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
const LINK_RE = /(?<!!)\[\[([^[\]]*)\]\]/g;
const EMBED_RE = /!\[\[([^[\]]*)\]\]/g;
const LARGE_VAULT_THRESHOLD = 5000;

export function createWatcher(options: WatcherOptions): Watcher {
  const debounceMs = options.debounceMs ?? 200;
  const readFile = options.readFile ?? ((p: string) => fsPromises.readFile(p, 'utf8') as Promise<string>);
  const chokidarFactory = options.chokidarFactory ?? defaultChokidarFactory;
  const isIgnored = options.ignore.length > 0
    ? picomatch(options.ignore as string[], { dot: true })
    : (): boolean => false;

  const depGraph: DepGraph = createDepGraph();
  const slugByRelPath = new Map<string, string>();
  const relPathBySlug = new Map<string, string>();
  const indexedBySlug = new Map<string, IndexedNote>();
  let wikilinkIndex: WikilinkIndex = buildWikilinkIndex([]);

  const pending = new Map<string, PendingEntry>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chokidarInstance: ChokidarLike | undefined;
  let stopped = false;

  async function loadNote(absPath: string, rel: string): Promise<ParsedNote | undefined> {
    let content: string;
    try {
      content = await readFile(absPath);
    } catch (err) {
      options.onWarning?.(`[obpub:watcher] read failed for ${rel}: ${errMsg(err)}`);
      return undefined;
    }
    // Pre-validate YAML: parseNote silently recovers from malformed frontmatter
    // (to keep one-off typos from failing a whole build). The watcher, however,
    // must know when recovery happened so it can SKIP emitting an invalidation
    // for a slug whose parsed shape is uncertain.
    try {
      matter(content);
    } catch (err) {
      options.onWarning?.(`[obpub:watcher] frontmatter parse failed for ${rel}: ${errMsg(err)}`);
      return undefined;
    }
    return parseNote({
      path: absPath,
      vaultId: options.vaultId,
      relativePath: rel,
      content,
    });
  }

  function upsertIndexedNote(note: ParsedNote, slug: string): void {
    const prevSlug = slugByRelPath.get(note.relativePath);
    if (prevSlug !== undefined && prevSlug !== slug) {
      indexedBySlug.delete(prevSlug);
      relPathBySlug.delete(prevSlug);
    }
    slugByRelPath.set(note.relativePath, slug);
    relPathBySlug.set(slug, note.relativePath);
    indexedBySlug.set(slug, toIndexedNote(note, slug));
    wikilinkIndex = buildWikilinkIndex([...indexedBySlug.values()]);
  }

  function deleteIndexedNote(rel: string, slug: string): void {
    slugByRelPath.delete(rel);
    relPathBySlug.delete(slug);
    indexedBySlug.delete(slug);
    wikilinkIndex = buildWikilinkIndex([...indexedBySlug.values()]);
  }

  function resolvedTargets(body: string): string[] {
    const out = new Set<string>();
    for (const raw of extractWikilinkRaws(body)) {
      const res = resolveWikilink(raw, wikilinkIndex);
      if (res.resolved && res.note !== undefined) out.add(res.note.id);
    }
    return [...out];
  }

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

    const note = await loadNote(absPath, rel);
    if (note === undefined) return;
    if (stopped) return;

    const slug = computeSlug(
      { frontmatter: note.frontmatter, relativePath: rel },
      { mode: options.config.nav.mode },
    );
    upsertIndexedNote(note, slug);

    const targets = resolvedTargets(note.body);
    depGraph.setDeps(slug, targets);

    const affected = new Set<string>([slug]);
    for (const d of depGraph.dependentsOf(slug)) affected.add(d);

    mergePending(slug, 'update', affected);
    armTimer();
  }

  function handleUnlink(absPath: string): void {
    if (stopped) return;
    const rel = toRelative(absPath);
    if (rel === undefined) return;
    if (!isMarkdown(rel)) return;
    if (isIgnored(rel)) return;

    const slug = slugByRelPath.get(rel);
    if (slug === undefined) return;

    // CRITICAL: snapshot dependents BEFORE removeNote — removing first would
    // tear down the reverse edges and leave affectedSlugs = {slug} only,
    // so former dependents would never learn that their link target vanished.
    const dependents = depGraph.dependentsOf(slug);
    const affected = new Set<string>([slug]);
    for (const d of dependents) affected.add(d);

    depGraph.removeNote(slug);
    deleteIndexedNote(rel, slug);

    mergePending(slug, 'remove', affected);
    armTimer();
  }

  async function primeFromVault(): Promise<void> {
    const walkIgnore = [...options.ignore];
    const freshNotes: ParsedNote[] = [];
    for await (const entry of walkVault({ root: options.vaultPath, ignore: walkIgnore })) {
      const note = await loadNote(entry.path, entry.relativePath);
      if (note === undefined) continue;
      const slug = computeSlug(
        {
          frontmatter: note.frontmatter,
          relativePath: entry.relativePath,
        },
        { mode: options.config.nav.mode },
      );
      slugByRelPath.set(entry.relativePath, slug);
      relPathBySlug.set(slug, entry.relativePath);
      indexedBySlug.set(slug, toIndexedNote(note, slug));
      freshNotes.push(note);
    }
    wikilinkIndex = buildWikilinkIndex([...indexedBySlug.values()]);

    if (indexedBySlug.size > LARGE_VAULT_THRESHOLD) {
      options.onWarning?.(
        `[obpub:watcher] vault has ${indexedBySlug.size} notes — wikilink index is rebuilt on every change. Expect slow HMR above ~5k notes.`,
      );
    }

    for (const note of freshNotes) {
      const slug = slugByRelPath.get(note.relativePath);
      if (slug === undefined) continue;
      depGraph.setDeps(slug, resolvedTargets(note.body));
    }
  }

  return {
    async start(): Promise<void> {
      await primeFromVault();
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

// ── helpers ─────────────────────────────────────────────────────────────────

function toIndexedNote(note: ParsedNote, slug: string): IndexedNote {
  const basename = pathMod.posix
    .basename(note.relativePath)
    .replace(MD_EXT_RE, '');
  const aliasSet = new Set<string>();
  const raw = note.frontmatter['aliases'];
  if (Array.isArray(raw)) {
    for (const a of raw) {
      if (typeof a === 'string') {
        const t = a.trim().toLowerCase();
        if (t.length > 0) aliasSet.add(t);
      }
    }
  } else if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    if (t.length > 0) aliasSet.add(t);
  }
  const title = note.frontmatter['title'];
  if (typeof title === 'string') {
    const t = title.trim().toLowerCase();
    if (t.length > 0) aliasSet.add(t);
  }
  return {
    id: slug,
    relativePath: note.relativePath,
    basename,
    aliases: [...aliasSet],
  };
}

function extractWikilinkRaws(body: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(body)) !== null) {
    out.push(m[1] ?? '');
  }
  EMBED_RE.lastIndex = 0;
  while ((m = EMBED_RE.exec(body)) !== null) {
    out.push(m[1] ?? '');
  }
  return out;
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
