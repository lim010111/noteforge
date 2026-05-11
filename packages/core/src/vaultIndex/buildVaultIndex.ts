import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { parseNote } from '../discover/parseNote.ts';
import { walkVault } from '../discover/walk.ts';
import {
  buildWikilinkIndex,
  type IndexedNote,
} from '../resolve/wikilink.ts';
import { computeSlug } from '../slug.ts';
import type { ParsedNote } from '../types.ts';

import type { VaultIndexInput, VaultIndexSnapshot } from './types.ts';

const MD_EXT_RE = /\.(md|markdown)$/i;

/**
 * One-shot vault indexer. Walks `input.vaultPath`, parses every note, computes
 * slugs, builds the wikilink + attachment indices, and returns a frozen
 * snapshot. Callers that need incremental updates (the dev watcher) use
 * `createIncrementalVaultIndex` instead — both produce the same snapshot
 * shape, so the seam is real.
 *
 * The returned snapshot does NOT classify notes. Callers (pipeline.ts) call
 * `classify` on the snapshot's notes themselves; this keeps the indexer free
 * of any privacy code path.
 */
export async function buildVaultIndex(
  input: VaultIndexInput,
): Promise<VaultIndexSnapshot> {
  const notes: ParsedNote[] = [];
  for await (const entry of walkVault({
    root: input.vaultPath,
    ignore: input.noteIgnore,
    extensions: ['.md'],
  })) {
    const content = await fs.readFile(entry.path, 'utf8');
    notes.push(
      parseNote({
        path: entry.path,
        vaultId: input.vaultId,
        relativePath: entry.relativePath,
        content,
      }),
    );
  }

  const slugByRelPath = new Map<string, string>();
  const relPathBySlug = new Map<string, string>();
  for (const n of notes) {
    const slug = computeSlug(
      { frontmatter: n.frontmatter, relativePath: n.relativePath },
      { mode: input.slugMode },
    );
    slugByRelPath.set(n.relativePath, slug);
    relPathBySlug.set(slug, n.relativePath);
  }

  const indexedNotes = toIndexedNotes(notes, slugByRelPath);
  const wikilinkIndex = buildWikilinkIndex(indexedNotes);

  const attachments: string[] = [];
  const attachmentByBasenameLower = new Map<string, string>();
  if (
    input.attachmentExtensions !== undefined &&
    input.attachmentExtensions.length > 0
  ) {
    for await (const entry of walkVault({
      root: input.vaultPath,
      ignore: input.attachmentIgnore ?? [],
      extensions: input.attachmentExtensions,
    })) {
      attachments.push(entry.relativePath);
      attachmentByBasenameLower.set(
        path.posix.basename(entry.relativePath).toLowerCase(),
        entry.relativePath,
      );
    }
  }

  return Object.freeze({
    notes: Object.freeze([...notes]),
    slugByRelPath: freezeMap(slugByRelPath),
    relPathBySlug: freezeMap(relPathBySlug),
    indexedNotes: Object.freeze([...indexedNotes]),
    wikilinkIndex,
    attachments: Object.freeze([...attachments]),
    attachmentByBasenameLower: freezeMap(attachmentByBasenameLower),
  }) as VaultIndexSnapshot;
}

/**
 * Compose `IndexedNote` rows from parsed notes — the input shape `buildWikilinkIndex`
 * and `buildAliasRedirects` consume. The note's frontmatter `title` is included
 * as an implicit alias so that Obsidian-style title-case wikilinks resolve
 * even when the on-disk filename is kebab-case.
 *
 * This was duplicated in `pipeline.ts` and the watcher; the indexer is the single
 * canonical location.
 */
export function toIndexedNotes(
  notes: readonly ParsedNote[],
  slugByRelPath: ReadonlyMap<string, string>,
): IndexedNote[] {
  const out: IndexedNote[] = [];
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined) continue;
    out.push(toIndexedNote(n, slug));
  }
  return out;
}

export function toIndexedNote(note: ParsedNote, slug: string): IndexedNote {
  const basename = path.posix.basename(note.relativePath).replace(MD_EXT_RE, '');
  const aliasSet = new Set<string>();

  const rawAliases = note.frontmatter['aliases'];
  if (Array.isArray(rawAliases)) {
    for (const a of rawAliases) {
      if (typeof a === 'string') {
        const cleaned = a.trim().toLowerCase();
        if (cleaned.length > 0) aliasSet.add(cleaned);
      }
    }
  } else if (typeof rawAliases === 'string') {
    const cleaned = rawAliases.trim().toLowerCase();
    if (cleaned.length > 0) aliasSet.add(cleaned);
  }

  const title = note.frontmatter['title'];
  if (typeof title === 'string') {
    const cleaned = title.trim().toLowerCase();
    if (cleaned.length > 0) aliasSet.add(cleaned);
  }

  return {
    id: slug,
    relativePath: note.relativePath,
    basename,
    aliases: [...aliasSet],
  };
}

function freezeMap<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  // Wrap in a proxy whose mutation methods throw. Object.freeze on a Map only
  // freezes the wrapper object, so we proxy instead. Reads forward via the
  // proxy target as the receiver because internal-slot accessors like `size`
  // refuse to operate on a non-Map `this`.
  const frozen: ReadonlyMap<K, V> = new Proxy(map, {
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
  return frozen;
}
