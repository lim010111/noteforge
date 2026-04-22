/**
 * Rewrite non-embed wikilinks `[[Target]]` / `[[Target|alias]]` / `[[Target#heading]]`
 * in an mdast tree. Embeds (`![[...]]`) are NOT handled here — see `transclude.ts`.
 *
 * privacy-first contract:
 *   - resolved + public  → real mdast `link` node (`hrefFor(targetId, heading?)`).
 *   - resolved + private → plain text node; `targetId`/`relativePath`/`basename` never
 *                          appear in the resulting tree. No warning (strip-to-text is
 *                          the expected default).
 *   - unresolved         → plain text node; one warning emitted with source location.
 *
 * The function mutates the input tree in place (children arrays are edited directly —
 * the root object reference is preserved). Callers retain ownership and may continue
 * threading the same tree through subsequent privacy stages.
 *
 * By contract this module does NOT import `WikilinkIndex` or the graph module: callers
 * inject `resolve` / `isPublic` / `hrefFor` so that the "what is public?" decision
 * stays centralized in `classify.ts` / `graph.ts` and is never re-derived here.
 */

import type { Root } from 'mdast';
import { parseWikilinkTarget } from '../resolve/wikilink.ts';

export type LinkStatus = 'resolved-public' | 'resolved-private' | 'unresolved';

export interface OutgoingLink {
  /** Original raw content between `[[` and `]]` (alias/heading/block id included). */
  readonly raw: string;
  readonly status: LinkStatus;
  /** Target note id when resolved. Undefined when unresolved. */
  readonly targetId?: string;
}

export interface RewriteWikilinksOptions {
  readonly tree: Root;
  /** Used as a prefix on unresolved-link warnings (e.g. `"projects/foo.md"`). */
  readonly sourceFile?: string;
  readonly resolve: (raw: string) => { resolved: boolean; targetId?: string };
  readonly isPublic: (targetId: string) => boolean;
  readonly hrefFor: (targetId: string, heading?: string) => string;
}

export interface RewriteWikilinksResult {
  readonly outgoing: readonly OutgoingLink[];
}

/**
 * Match `[[...]]` where the bracket pair is NOT preceded by `!` (that's an embed).
 * The inner class forbids nested brackets so a stray `]` can't confuse the closer.
 */
const WIKILINK_RE = /(?<!!)\[\[([^[\]]*)\]\]/g;

/** Node types whose contents we do NOT scan (preserve literal author text). */
const SKIP_TYPES: ReadonlySet<string> = new Set(['inlineCode', 'code', 'html', 'yaml']);

interface AnyNode {
  type: string;
  value?: string;
  children?: AnyNode[];
  url?: string;
  title?: string | null;
  position?: {
    start?: { line?: number; column?: number };
  };
}

export function rewriteWikilinks(options: RewriteWikilinksOptions): RewriteWikilinksResult {
  const outgoing: OutgoingLink[] = [];

  walk(options.tree as unknown as AnyNode);

  return { outgoing };

  function walk(node: AnyNode): void {
    if (SKIP_TYPES.has(node.type)) return;
    const children = node.children;
    if (!Array.isArray(children)) return;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      if (child.type === 'text') {
        const replacement = rewriteText(child);
        if (replacement !== null) {
          children.splice(i, 1, ...replacement);
          i += replacement.length - 1;
        }
      } else {
        walk(child);
      }
    }
  }

  function rewriteText(node: AnyNode): AnyNode[] | null {
    const value = node.value ?? '';
    WIKILINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let last = 0;
    const out: AnyNode[] = [];
    let found = false;
    while ((match = WIKILINK_RE.exec(value)) !== null) {
      found = true;
      const start = match.index;
      const end = start + match[0].length;
      if (start > last) {
        out.push({ type: 'text', value: value.slice(last, start) });
      }
      const raw = match[1] ?? '';
      out.push(buildReplacement(raw, node));
      last = end;
    }
    if (!found) return null;
    if (last < value.length) {
      out.push({ type: 'text', value: value.slice(last) });
    }
    return out;
  }

  function buildReplacement(raw: string, source: AnyNode): AnyNode {
    const parsed = parseWikilinkTarget(raw);
    const display = parsed.alias ?? parsed.target;
    const resolution = options.resolve(raw);

    if (resolution.resolved && resolution.targetId !== undefined) {
      const targetId = resolution.targetId;
      if (options.isPublic(targetId)) {
        outgoing.push({ raw, status: 'resolved-public', targetId });
        return {
          type: 'link',
          url: options.hrefFor(targetId, parsed.heading),
          title: null,
          children: [{ type: 'text', value: display }],
        };
      }
      outgoing.push({ raw, status: 'resolved-private', targetId });
      return { type: 'text', value: display };
    }

    outgoing.push({ raw, status: 'unresolved' });
    warnUnresolved(raw, source);
    return { type: 'text', value: display };
  }

  function warnUnresolved(raw: string, source: AnyNode): void {
    const line = source.position?.start?.line;
    const file = options.sourceFile ?? '<unknown>';
    const locus = line !== undefined ? `${file}:${line}` : file;
    console.warn(`[obpub/linkRewriter] ${locus}: unresolved wikilink [[${raw}]]`);
  }
}
