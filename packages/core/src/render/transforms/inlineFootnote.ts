/**
 * Obsidian inline footnotes `^[note text]` → a `footnoteReference` plus a
 * synthesized `footnoteDefinition` appended to the document root.
 *
 * GFM only covers the reference form (`[^1]` … `[^1]: text`), which the GFM
 * micromark extension handles at parse time. The inline form is Obsidian-only,
 * so it is normalized here, after parsing, into the same footnote machinery —
 * `mdast-util-to-hast` then renders both forms into one footnotes section.
 *
 * The generated identifier (`obpub-ifn-N`) is namespaced so it cannot collide
 * with an author's own `[^label]`. The definition is parsed with the same GFM
 * + math grammar as the body, so links/formatting inside `^[…]` survive; it
 * carries a standard `children` array, so the privacy passes still reach any
 * wikilink/embed nested inside an inline footnote.
 */

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { math as mathSyntax } from 'micromark-extension-math';
import { mathFromMarkdown } from 'mdast-util-math';
import type { Root } from 'mdast';

/** `^[` … `]` — body forbids `]` so a stray bracket cannot run past the close. */
const INLINE_FOOTNOTE_RE = /\^\[([^\]]+)\]/g;

/** Node types whose text we never scan. */
const SKIP_TYPES: ReadonlySet<string> = new Set([
  'inlineCode',
  'code',
  'html',
  'yaml',
  'math',
  'inlineMath',
]);

const ID_PREFIX = 'obpub-ifn-';

interface AnyNode {
  type: string;
  value?: string;
  children?: AnyNode[];
  identifier?: string;
  label?: string;
}

/**
 * Rewrite every `^[…]` inline footnote in the tree, in place. References
 * replace the matched text; definitions are appended to `tree.children`.
 */
export function transformInlineFootnotes(tree: Root): void {
  const root = tree as unknown as AnyNode;
  const definitions: AnyNode[] = [];
  let counter = 0;

  walk(root);

  if (definitions.length > 0 && Array.isArray(root.children)) {
    root.children.push(...definitions);
  }

  function walk(node: AnyNode): void {
    if (SKIP_TYPES.has(node.type)) return;
    const children = node.children;
    if (!Array.isArray(children)) return;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      if (child.type === 'text') {
        const replacement = splitInlineFootnotes(child.value ?? '');
        if (replacement !== null) {
          children.splice(i, 1, ...replacement);
          i += replacement.length - 1;
        }
      } else {
        walk(child);
      }
    }
  }

  function splitInlineFootnotes(value: string): AnyNode[] | null {
    INLINE_FOOTNOTE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let last = 0;
    const out: AnyNode[] = [];
    let found = false;
    while ((match = INLINE_FOOTNOTE_RE.exec(value)) !== null) {
      found = true;
      const start = match.index;
      if (start > last) {
        out.push({ type: 'text', value: value.slice(last, start) });
      }
      counter += 1;
      const identifier = `${ID_PREFIX}${counter}`;
      out.push({ type: 'footnoteReference', identifier, label: identifier });
      definitions.push({
        type: 'footnoteDefinition',
        identifier,
        label: identifier,
        children: parseDefinitionContent(match[1] ?? ''),
      });
      last = start + match[0].length;
    }
    if (!found) return null;
    if (last < value.length) {
      out.push({ type: 'text', value: value.slice(last) });
    }
    return out;
  }
}

/** Parse inline-footnote body text into block content for the definition. */
function parseDefinitionContent(text: string): AnyNode[] {
  const parsed = fromMarkdown(text, {
    extensions: [gfm(), mathSyntax()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  }) as unknown as AnyNode;
  return Array.isArray(parsed.children) ? parsed.children : [];
}
