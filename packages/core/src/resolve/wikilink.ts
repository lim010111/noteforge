export interface IndexedNote {
  /** Stable id (usually the relativePath). */
  readonly id: string;
  readonly relativePath: string;
  /** Filename without extension. */
  readonly basename: string;
  /** Frontmatter aliases, lowercased and trimmed. */
  readonly aliases: readonly string[];
}

export interface WikilinkIndex {
  readonly byPathLower: ReadonlyMap<string, IndexedNote>;
  readonly byBasenameLower: ReadonlyMap<string, readonly IndexedNote[]>;
  readonly byAliasLower: ReadonlyMap<string, readonly IndexedNote[]>;
}

export interface WikilinkTarget {
  readonly target: string;
  readonly heading?: string;
  readonly blockId?: string;
  readonly alias?: string;
}

export interface WikilinkResolution {
  readonly resolved: boolean;
  readonly note?: IndexedNote;
  readonly matchedBy: 'path' | 'basename' | 'alias' | 'none';
  readonly heading?: string;
  readonly blockId?: string;
  readonly alias?: string;
  readonly raw: string;
}

export function buildWikilinkIndex(notes: readonly IndexedNote[]): WikilinkIndex {
  const byPathLower = new Map<string, IndexedNote>();
  const byBasenameLower = new Map<string, IndexedNote[]>();
  const byAliasLower = new Map<string, IndexedNote[]>();

  for (const note of notes) {
    // Path index only holds paths that include a folder separator — targets with `/` are
    // treated as paths; bare basenames always go through the basename index.
    if (note.relativePath.includes('/')) {
      const pathKey = note.relativePath.toLowerCase();
      byPathLower.set(pathKey, note);
      byPathLower.set(stripMdExt(pathKey), note);
    }

    const basenameKey = note.basename.toLowerCase();
    push(byBasenameLower, basenameKey, note);

    for (const alias of note.aliases) {
      push(byAliasLower, alias.trim().toLowerCase(), note);
    }
  }

  return { byPathLower, byBasenameLower, byAliasLower };

  function push<K>(map: Map<K, IndexedNote[]>, key: K, value: IndexedNote): void {
    const existing = map.get(key);
    if (existing) existing.push(value);
    else map.set(key, [value]);
  }
}

export function parseWikilinkTarget(raw: string): WikilinkTarget {
  const trimmed = raw.trim();
  const [targetPart, aliasPart] = splitOnce(trimmed, '|');
  const aliasTrimmed = aliasPart?.trim();

  const [targetOnly, fragment] = splitOnce(targetPart.trim(), '#');
  const base: WikilinkTarget = { target: targetOnly.trim(), alias: aliasTrimmed };

  if (fragment === undefined) return base;

  if (fragment.startsWith('^')) {
    return { ...base, blockId: fragment.slice(1).trim() };
  }
  return { ...base, heading: fragment.trim() };
}

export function resolveWikilink(raw: string, index: WikilinkIndex): WikilinkResolution {
  const parsed = parseWikilinkTarget(raw);
  const targetLower = parsed.target.toLowerCase();

  const passthrough = {
    heading: parsed.heading,
    blockId: parsed.blockId,
    alias: parsed.alias,
    raw,
  };

  if (targetLower.length === 0) {
    return { resolved: false, matchedBy: 'none', ...passthrough };
  }

  const byPath = index.byPathLower.get(targetLower);
  if (byPath) {
    return { resolved: true, note: byPath, matchedBy: 'path', ...passthrough };
  }

  const byBasename = index.byBasenameLower.get(targetLower);
  if (byBasename && byBasename.length > 0) {
    const pick = pickStable(byBasename);
    return { resolved: true, note: pick, matchedBy: 'basename', ...passthrough };
  }

  const byAlias = index.byAliasLower.get(targetLower);
  if (byAlias && byAlias.length > 0) {
    const pick = pickStable(byAlias);
    return { resolved: true, note: pick, matchedBy: 'alias', ...passthrough };
  }

  return { resolved: false, matchedBy: 'none', ...passthrough };
}

/**
 * When a wikilink target is ambiguous (e.g., two notes share a basename), choose a stable
 * winner: shortest relative path first, then lexicographic.
 */
function pickStable(candidates: readonly IndexedNote[]): IndexedNote {
  const sorted = [...candidates].sort((a, b) => {
    if (a.relativePath.length !== b.relativePath.length) {
      return a.relativePath.length - b.relativePath.length;
    }
    return a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0;
  });
  const first = sorted[0];
  if (first === undefined) {
    throw new Error('pickStable called with empty candidate list');
  }
  return first;
}

function stripMdExt(path: string): string {
  return path.replace(/\.(md|markdown)$/i, '');
}

function splitOnce(value: string, delimiter: string): [string, string | undefined] {
  const index = value.indexOf(delimiter);
  if (index === -1) return [value, undefined];
  return [value.slice(0, index), value.slice(index + delimiter.length)];
}
