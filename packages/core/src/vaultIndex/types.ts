/**
 * VaultIndex — the single canonical answer to "what notes exist + how do they
 * reference each other," shared by `pipeline.ts` (one-shot) and the watcher
 * (incremental). Two adapters of one snapshot shape.
 *
 * Privacy contract: VaultIndex never classifies. It does not know which notes
 * are public; the public/private decision lives exclusively in
 * `privacy/classify.ts` and is called by callers AFTER reading a snapshot.
 * Splitting that decision across the indexer and classify is the most common
 * origin of leak regressions.
 */

import type { IndexedNote, WikilinkIndex } from '../resolve/wikilink.ts';
import type { ParsedNote } from '../types.ts';

export interface VaultIndexInput {
  /** Absolute filesystem path to the vault root. */
  readonly vaultPath: string;
  /** Vault id (forwarded to `parseNote` for `ParsedNote.vaultId`). */
  readonly vaultId: string;
  /** Markdown walk ignore patterns (POSIX globs, root-relative). */
  readonly noteIgnore: readonly string[];
  /**
   * Attachment walk ignore patterns. Optional — when omitted the snapshot's
   * `attachments` is empty (the watcher uses this; the pipeline supplies real
   * patterns so attachment closure works).
   */
  readonly attachmentIgnore?: readonly string[];
  /**
   * Attachment file extensions (dot-prefixed). Optional — when omitted no
   * attachment walk runs.
   */
  readonly attachmentExtensions?: readonly string[];
  /** Slug derivation mode. Forwarded to `computeSlug`. */
  readonly slugMode: 'folder' | 'category';
}

/**
 * Read-only snapshot of vault state. Both `buildVaultIndex` and
 * `createIncrementalVaultIndex().snapshot()` produce this exact shape.
 *
 * All maps are frozen / defensive — mutating them in a caller does not affect
 * the indexer's internal state.
 */
export interface VaultIndexSnapshot {
  /** All parsed notes (public + private). Order is walk order. */
  readonly notes: readonly ParsedNote[];
  /** Vault-relative POSIX path → canonical slug. */
  readonly slugByRelPath: ReadonlyMap<string, string>;
  /** Canonical slug → vault-relative POSIX path (inverse of `slugByRelPath`). */
  readonly relPathBySlug: ReadonlyMap<string, string>;
  /**
   * Indexed-note view (id, relativePath, basename, aliases) suitable for
   * passing to `buildWikilinkIndex` or `buildAliasRedirects`.
   */
  readonly indexedNotes: readonly IndexedNote[];
  /** Pre-built wikilink index over `indexedNotes`. */
  readonly wikilinkIndex: WikilinkIndex;
  /** Vault-relative POSIX paths of every discovered attachment. */
  readonly attachments: readonly string[];
  /** Lowercased attachment basename → vault-relative path. */
  readonly attachmentByBasenameLower: ReadonlyMap<string, string>;
}

/**
 * Mutable adapter consumed by the watcher. Holds prior snapshot + applies file
 * events to it without re-walking from disk. `snapshot()` returns a frozen
 * VaultIndexSnapshot equivalent to a one-shot `buildVaultIndex` over the
 * vault's current on-disk state (modulo events not yet applied).
 *
 * The incremental adapter additionally answers `dependentsOf(slug)` —
 * "who must re-render when slug changes?" — using forward + reverse edge
 * bookkeeping that's private to this module (it absorbs the responsibility
 * of the former standalone `astro-integration/src/depGraph.ts`).
 */
export interface IncrementalVaultIndex {
  /**
   * Walk the vault from disk, parse every markdown file, and seed internal
   * state in one batched pass. Equivalent to applying upsert events for every
   * file but builds the wikilink index ONCE at the end (O(N) total) instead
   * of once per upsert (O(N²)). Callers (the watcher) invoke this before
   * starting the chokidar listener.
   *
   * Read failures and malformed-frontmatter files are skipped with a warning,
   * matching the per-file `upsert` semantics.
   */
  primeFromVault(): Promise<void>;
  /**
   * Re-read the file at `absPath` (mapped to `relativePath` inside the vault),
   * re-parse, recompute its slug, and update internal state. Equivalent to a
   * `chokidar` add/change event.
   *
   * No-op if the file is unreadable or its frontmatter is unparseable — these
   * cases warn through `onWarning` (if provided at construction) and skip the
   * upsert, matching the watcher's prior behavior of not invalidating slugs
   * whose parsed shape is uncertain.
   *
   * Returns the slug the file resolved to, or `undefined` when the upsert was
   * skipped. Callers (the watcher) snapshot `dependentsOf(slug)` AFTER upsert
   * to compute the affected-slugs set for invalidation.
   */
  upsert(absPath: string, relativePath: string): Promise<string | undefined>;
  /**
   * Drop the note at `relativePath` from internal state. Returns the slug
   * that was associated with it (so callers can compute `dependentsOf` BEFORE
   * the remove, as the watcher does to preserve invalidation reach), or
   * `undefined` if no slug was tracked.
   *
   * CRITICAL: callers that need `dependentsOf` for invalidation MUST snapshot
   * it BEFORE calling `remove` — removing first tears down reverse edges and
   * leaves former dependents out of the affected set.
   */
  remove(relativePath: string): string | undefined;
  /**
   * Set of slugs that currently depend on `slug` (i.e., link to or transclude
   * `slug`). Defensive copy — caller may mutate freely.
   */
  dependentsOf(slug: string): ReadonlySet<string>;
  /** Frozen snapshot of current state. Cheap; rebuilt lazily on mutation. */
  snapshot(): VaultIndexSnapshot;
}

export interface IncrementalVaultIndexOptions extends VaultIndexInput {
  /**
   * Override file read for tests. Default: `fs.readFile(path, 'utf8')`.
   */
  readonly readFile?: (absPath: string) => Promise<string>;
  /** Optional warning sink (read errors, malformed frontmatter). */
  readonly onWarning?: (message: string) => void;
}
