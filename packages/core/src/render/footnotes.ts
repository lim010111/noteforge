/**
 * Drop `footnoteReference` nodes whose `footnoteDefinition` is not present in
 * the final tree.
 *
 * A `![[Note#Section]]` transclusion slices out a heading range; if a footnote
 * reference lives inside that range but its definition sits elsewhere in the
 * source note, the reference arrives orphaned. `mdast-util-to-hast` would then
 * emit a `<sup>` linking to a `#…` anchor that does not exist — a broken
 * footnote. This pass runs after transclusion, just before serialization, and
 * removes those dangling references so no broken anchor reaches the HTML.
 *
 * Definition-side collisions (two transcluded notes that both define `[^1]`)
 * are a known, documented limitation and are intentionally NOT reconciled here.
 */

import type { Root } from 'mdast';

interface AnyNode {
  type: string;
  identifier?: string;
  children?: AnyNode[];
}

/** Remove footnote references with no matching definition, in place. */
export function dropDanglingFootnoteReferences(tree: Root): void {
  const defined = new Set<string>();
  collectDefinitions(tree as unknown as AnyNode, defined);
  if (defined.size === 0) {
    pruneAll(tree as unknown as AnyNode);
    return;
  }
  prune(tree as unknown as AnyNode, defined);
}

function collectDefinitions(node: AnyNode, into: Set<string>): void {
  if (node.type === 'footnoteDefinition' && typeof node.identifier === 'string') {
    into.add(node.identifier);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectDefinitions(child, into);
  }
}

function prune(node: AnyNode, defined: Set<string>): void {
  const children = node.children;
  if (!Array.isArray(children)) return;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (child.type === 'footnoteReference' && !defined.has(child.identifier ?? '')) {
      children.splice(i, 1);
      i -= 1;
      continue;
    }
    prune(child, defined);
  }
}

/** No definitions exist at all — every reference is dangling. */
function pruneAll(node: AnyNode): void {
  const children = node.children;
  if (!Array.isArray(children)) return;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (child.type === 'footnoteReference') {
      children.splice(i, 1);
      i -= 1;
      continue;
    }
    pruneAll(child);
  }
}
