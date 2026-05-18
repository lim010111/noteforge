/**
 * Obsidian `==highlight==` → `<mark>`.
 *
 * Why a post-parse transform rather than a micromark syntax extension:
 * `micromark-extension-mark` is pinned to micromark-util v1, while this
 * pipeline runs micromark-util v2 (math + GFM). Mixing the two tokenizer
 * util majors in one parser is a real hazard, so highlight is handled the
 * same way wikilinks are — a walk over `text` nodes after `fromMarkdown`.
 *
 * Limitation (accepted): the `mark` node's children are plain text, so
 * `==**bold**==` keeps the literal asterisks. Nested inline markup inside a
 * highlight is rare in practice and would need a real grammar to support.
 *
 * The emitted `mark` node carries a standard `children` array, so the
 * privacy passes (`rewriteWikilinks`, `expandTransclusions`) — which recurse
 * structurally on `children` — still filter wikilinks/embeds nested in a
 * highlight. This transform must therefore run before those passes.
 */

import type { Root } from 'mdast';

/**
 * `==` … `==` with no whitespace adjacent to the delimiters (Obsidian does not
 * highlight `== spaced ==`). Non-greedy body so `==a== ==b==` yields two marks.
 */
const HIGHLIGHT_RE = /==(?![\s=])(.+?)(?<![\s=])==/g;

/** Node types whose text we never scan — preserve literal author content. */
const SKIP_TYPES: ReadonlySet<string> = new Set([
  'inlineCode',
  'code',
  'html',
  'yaml',
  'math',
  'inlineMath',
]);

interface AnyNode {
  type: string;
  value?: string;
  children?: AnyNode[];
}

/** Rewrite every `==highlight==` run in the tree into a `mark` node, in place. */
export function transformHighlights(tree: Root): void {
  walk(tree as unknown as AnyNode);
}

function walk(node: AnyNode): void {
  if (SKIP_TYPES.has(node.type)) return;
  const children = node.children;
  if (!Array.isArray(children)) return;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (child.type === 'text') {
      const replacement = splitHighlights(child.value ?? '');
      if (replacement !== null) {
        children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
    } else {
      walk(child);
    }
  }
}

function splitHighlights(value: string): AnyNode[] | null {
  HIGHLIGHT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let last = 0;
  const out: AnyNode[] = [];
  let found = false;
  while ((match = HIGHLIGHT_RE.exec(value)) !== null) {
    found = true;
    const start = match.index;
    if (start > last) {
      out.push({ type: 'text', value: value.slice(last, start) });
    }
    out.push({ type: 'mark', children: [{ type: 'text', value: match[1] ?? '' }] });
    last = start + match[0].length;
  }
  if (!found) return null;
  if (last < value.length) {
    out.push({ type: 'text', value: value.slice(last) });
  }
  return out;
}
