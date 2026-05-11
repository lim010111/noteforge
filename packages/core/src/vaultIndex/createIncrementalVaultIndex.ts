import * as fsPromises from 'node:fs/promises';
import matter from 'gray-matter';

import { parseNote } from '../discover/parseNote.ts';
import { walkVault } from '../discover/walk.ts';
import {
  buildWikilinkIndex,
  parseWikilinkTarget,
  resolveWikilink,
  type IndexedNote,
  type WikilinkIndex,
} from '../resolve/wikilink.ts';
import { computeSlug } from '../slug.ts';
import type { ParsedNote } from '../types.ts';

import { toIndexedNote } from './buildVaultIndex.ts';
import type {
  IncrementalVaultIndex,
  IncrementalVaultIndexOptions,
  VaultIndexSnapshot,
} from './types.ts';

const LINK_RE = /(?<!!)\[\[([^[\]]*)\]\]/g;
const EMBED_RE = /!\[\[([^[\]]*)\]\]/g;

/**
 * Mutable vault indexer for the dev watcher. Holds vault state in memory and
 * updates it through `upsert(absPath, rel)` / `remove(rel)` calls, avoiding a
 * full re-walk per file event. `snapshot()` returns the same shape
 * `buildVaultIndex` produces — the equivalence is the regression net for the
 * indexing path.
 *
 * Privacy contract: same as `buildVaultIndex`. Never classifies. Callers run
 * `classify` against the snapshot's notes.
 *
 * Absorbs the responsibility of the former standalone `depGraph.ts` —
 * forward/reverse edge bookkeeping for `dependentsOf(slug)` is internal.
 */
export function createIncrementalVaultIndex(
  options: IncrementalVaultIndexOptions,
): IncrementalVaultIndex {
  const readFile =
    options.readFile ?? ((p: string) => fsPromises.readFile(p, 'utf8') as Promise<string>);

  // Insertion-ordered: snapshot.notes mirrors the order files were upserted, so
  // a fresh `buildVaultIndex` over the same vault state and an incremental
  // adapter that has applied the events in walk order produce the same `notes`
  // sequence (ordering is not part of the public contract, but tests sort
  // before comparing).
  const notesByRelPath = new Map<string, ParsedNote>();
  const slugByRelPath = new Map<string, string>();
  const relPathBySlug = new Map<string, string>();
  const indexedBySlug = new Map<string, IndexedNote>();
  let wikilinkIndex: WikilinkIndex = buildWikilinkIndex([]);

  // Forward: slug → set of slugs it links to / embeds.
  // Reverse: slug → set of slugs that link to / embed it.
  // Kept in lock-step. Mirrors the contract of the former depGraph.
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  let cachedSnapshot: VaultIndexSnapshot | undefined;

  function invalidate(): void {
    cachedSnapshot = undefined;
  }

  function dropFromReverse(target: string, source: string): void {
    const set = reverse.get(target);
    if (set === undefined) return;
    set.delete(source);
    if (set.size === 0) reverse.delete(target);
  }

  function addToReverse(target: string, source: string): void {
    let set = reverse.get(target);
    if (set === undefined) {
      set = new Set();
      reverse.set(target, set);
    }
    set.add(source);
  }

  function setForwardEdges(slug: string, targets: Iterable<string>): void {
    const prev = forward.get(slug);
    if (prev !== undefined) {
      for (const old of prev) dropFromReverse(old, slug);
    }
    const next = new Set(targets);
    if (next.size === 0) {
      forward.delete(slug);
    } else {
      forward.set(slug, next);
      for (const t of next) addToReverse(t, slug);
    }
  }

  function dropForwardEdges(slug: string): void {
    const outgoing = forward.get(slug);
    if (outgoing !== undefined) {
      for (const t of outgoing) dropFromReverse(t, slug);
      forward.delete(slug);
    }
    // Incoming reverse entries (X → slug) are intentionally preserved so a
    // re-create of `slug` resumes invalidating its prior dependents.
  }

  function rebuildWikilinkIndex(): void {
    wikilinkIndex = buildWikilinkIndex([...indexedBySlug.values()]);
  }

  function resolvedTargets(body: string): string[] {
    const out = new Set<string>();
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(body)) !== null) {
      const res = resolveWikilink(m[1] ?? '', wikilinkIndex);
      if (res.resolved && res.note !== undefined) out.add(res.note.id);
    }
    EMBED_RE.lastIndex = 0;
    while ((m = EMBED_RE.exec(body)) !== null) {
      const raw = m[1] ?? '';
      // Embeds may target attachments by basename; the indexer doesn't track
      // those incrementally (no caller needs attachment-graph invalidation
      // today), so drop unresolved-as-note targets.
      const parsed = parseWikilinkTarget(raw);
      if (parsed.target.length === 0) continue;
      const res = resolveWikilink(raw, wikilinkIndex);
      if (res.resolved && res.note !== undefined) out.add(res.note.id);
    }
    return [...out];
  }

  async function upsert(absPath: string, relativePath: string): Promise<string | undefined> {
    let content: string;
    try {
      content = await readFile(absPath);
    } catch (err) {
      options.onWarning?.(
        `[obpub:vaultIndex] read failed for ${relativePath}: ${errMsg(err)}`,
      );
      return undefined;
    }

    // Pre-validate frontmatter: `parseNote` silently recovers from malformed
    // YAML to keep one-off typos from failing a whole build, but the indexer
    // must know recovery happened so it can SKIP an upsert whose parsed shape
    // is uncertain — same contract the standalone watcher used to enforce.
    try {
      matter(content);
    } catch (err) {
      options.onWarning?.(
        `[obpub:vaultIndex] frontmatter parse failed for ${relativePath}: ${errMsg(err)}`,
      );
      return undefined;
    }

    const note = parseNote({
      path: absPath,
      vaultId: options.vaultId,
      relativePath,
      content,
    });

    const slug = computeSlug(
      { frontmatter: note.frontmatter, relativePath },
      { mode: options.slugMode },
    );

    // The slug for this relativePath may have changed (e.g., a new permalink).
    // Tear down the old slug bindings before installing the new ones.
    const prevSlug = slugByRelPath.get(relativePath);
    if (prevSlug !== undefined && prevSlug !== slug) {
      indexedBySlug.delete(prevSlug);
      relPathBySlug.delete(prevSlug);
      dropForwardEdges(prevSlug);
    }

    notesByRelPath.set(relativePath, note);
    slugByRelPath.set(relativePath, slug);
    relPathBySlug.set(slug, relativePath);
    indexedBySlug.set(slug, toIndexedNote(note, slug));

    rebuildWikilinkIndex();
    setForwardEdges(slug, resolvedTargets(note.body));
    invalidate();
    return slug;
  }

  async function primeFromVault(): Promise<void> {
    // Single batched walk: parse every file, seed slug/indexed maps, then
    // build the wikilink index ONCE, then resolve forward edges per body.
    // Repeating per-file `upsert` here would rebuild the wikilink index N
    // times (O(N²)) — acceptable per individual change but not at startup.
    const freshNotes: { note: ParsedNote; slug: string }[] = [];
    for await (const entry of walkVault({
      root: options.vaultPath,
      ignore: options.noteIgnore,
      extensions: ['.md'],
    })) {
      let content: string;
      try {
        content = await readFile(entry.path);
      } catch (err) {
        options.onWarning?.(
          `[obpub:vaultIndex] read failed for ${entry.relativePath}: ${errMsg(err)}`,
        );
        continue;
      }
      try {
        matter(content);
      } catch (err) {
        options.onWarning?.(
          `[obpub:vaultIndex] frontmatter parse failed for ${entry.relativePath}: ${errMsg(err)}`,
        );
        continue;
      }
      const note = parseNote({
        path: entry.path,
        vaultId: options.vaultId,
        relativePath: entry.relativePath,
        content,
      });
      const slug = computeSlug(
        { frontmatter: note.frontmatter, relativePath: entry.relativePath },
        { mode: options.slugMode },
      );
      notesByRelPath.set(entry.relativePath, note);
      slugByRelPath.set(entry.relativePath, slug);
      relPathBySlug.set(slug, entry.relativePath);
      indexedBySlug.set(slug, toIndexedNote(note, slug));
      freshNotes.push({ note, slug });
    }

    rebuildWikilinkIndex();

    for (const { note, slug } of freshNotes) {
      setForwardEdges(slug, resolvedTargets(note.body));
    }

    invalidate();
  }

  function remove(relativePath: string): string | undefined {
    const slug = slugByRelPath.get(relativePath);
    if (slug === undefined) return undefined;

    notesByRelPath.delete(relativePath);
    slugByRelPath.delete(relativePath);
    relPathBySlug.delete(slug);
    indexedBySlug.delete(slug);
    dropForwardEdges(slug);
    rebuildWikilinkIndex();
    invalidate();
    return slug;
  }

  function dependentsOf(slug: string): ReadonlySet<string> {
    const set = reverse.get(slug);
    return set !== undefined ? new Set(set) : new Set();
  }

  function snapshot(): VaultIndexSnapshot {
    if (cachedSnapshot !== undefined) return cachedSnapshot;

    const built: VaultIndexSnapshot = Object.freeze({
      notes: Object.freeze([...notesByRelPath.values()]),
      slugByRelPath: freezeMap(new Map(slugByRelPath)),
      relPathBySlug: freezeMap(new Map(relPathBySlug)),
      indexedNotes: Object.freeze([...indexedBySlug.values()]),
      wikilinkIndex,
      attachments: Object.freeze([] as readonly string[]),
      attachmentByBasenameLower: freezeMap(new Map<string, string>()),
    }) as VaultIndexSnapshot;
    cachedSnapshot = built;
    return built;
  }

  return { primeFromVault, upsert, remove, dependentsOf, snapshot };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function freezeMap<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  return new Proxy(map, {
    get(target, prop): unknown {
      if (prop === 'set' || prop === 'delete' || prop === 'clear') {
        return () => {
          throw new TypeError(`Cannot mutate frozen Map (prop=${String(prop)})`);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as ReadonlyMap<K, V>;
}
