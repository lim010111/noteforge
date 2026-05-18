/**
 * Tests for `dropDanglingFootnoteReferences` — the post-transclude pass that
 * removes footnote references whose definition is not in the final tree
 * (a `![[Note#Section]]` slice can leave a reference without its definition).
 */

import { describe, expect, it } from 'vitest';
import type { Root } from 'mdast';
import { dropDanglingFootnoteReferences } from '../src/render/footnotes.ts';

/** Build a minimal root: a paragraph with a footnote reference to `id`. */
function rootWithReference(id: string, withDefinition: boolean): Root {
  const children: unknown[] = [
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'body ' },
        { type: 'footnoteReference', identifier: id, label: id },
      ],
    },
  ];
  if (withDefinition) {
    children.push({
      type: 'footnoteDefinition',
      identifier: id,
      label: id,
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'def' }] }],
    });
  }
  return { type: 'root', children } as unknown as Root;
}

function referenceCount(tree: Root): number {
  let n = 0;
  function walk(node: { type: string; children?: unknown[] }): void {
    if (node.type === 'footnoteReference') n += 1;
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c as { type: string; children?: unknown[] });
    }
  }
  walk(tree as unknown as { type: string; children?: unknown[] });
  return n;
}

describe('dropDanglingFootnoteReferences', () => {
  it('keeps a reference that has a matching definition', () => {
    const tree = rootWithReference('1', true);
    dropDanglingFootnoteReferences(tree);
    expect(referenceCount(tree)).toBe(1);
  });

  it('removes a reference with no matching definition', () => {
    const tree = rootWithReference('1', false);
    dropDanglingFootnoteReferences(tree);
    expect(referenceCount(tree)).toBe(0);
  });

  it('removes only the dangling reference, keeping the resolved one', () => {
    const tree = rootWithReference('kept', true);
    // Add a second, dangling reference in the same paragraph.
    const para = (tree.children as unknown as { children: unknown[] }[])[0];
    para?.children.push({ type: 'footnoteReference', identifier: 'gone', label: 'gone' });

    dropDanglingFootnoteReferences(tree);
    expect(referenceCount(tree)).toBe(1);
  });

  it('removes a dangling reference nested inside a footnote definition', () => {
    const tree = rootWithReference('outer', true);
    const def = (tree.children as unknown as { type: string; children: unknown[] }[])[1];
    const defPara = def?.children[0] as { children: unknown[] } | undefined;
    defPara?.children.push({ type: 'footnoteReference', identifier: 'missing', label: 'missing' });

    dropDanglingFootnoteReferences(tree);
    expect(referenceCount(tree)).toBe(1);
  });
});
