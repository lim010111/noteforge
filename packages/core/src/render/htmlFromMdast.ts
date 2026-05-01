/**
 * mdast → html serialization with the v0.2 heading-anchor rehype steps applied.
 *
 * The rehype plugins here add `id` to h2-h4 headings (rehype-slug) and append
 * a sibling `<a class="heading-anchor">#</a>` so the theme can position it as a
 * permalink (rehype-autolink-headings). h1 is intentionally skipped — the page
 * URL already identifies it; a self-anchor on h1 would just be self-replication.
 *
 * Why heading slugs are NOT unified with `core/src/slug.ts`:
 *   `slug.ts` produces ROUTING slugs for note URLs (vault filename → URL path).
 *   rehype-slug produces FRAGMENT slugs for in-page anchors (heading text →
 *   `#section-id`). These live in different domains: a routing slug is unique
 *   per-vault, while a fragment slug only needs to be unique per-page. Forcing
 *   the same algorithm would either restrict heading text (no spaces, etc.) or
 *   break URL stability when a heading is renamed. They are deliberately separate.
 */

import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import type { Literal, Root as MdastRoot } from 'mdast';
import type { Element, Root as HastRoot } from 'hast';

const HEADING_ANCHOR_TAGS: ReadonlySet<string> = new Set(['h2', 'h3', 'h4']);
const HEADING_ANCHOR_CLASS = 'heading-anchor';

type HastTransformer = (tree: HastRoot) => void;

// mdast-util-to-hast doesn't ship handlers for the `math` / `inlineMath`
// nodes that micromark-extension-math + mdast-util-math emit, and the default
// unknown-handler degrades them to plain text — which then bypasses
// rehype-katex entirely. These two handlers wrap the raw LaTeX source in the
// `math math-inline` / `math math-display` class names that rehype-katex
// recognises, mirroring what remark-math does inside the unified pipeline.
const mathHandlers = {
  inlineMath(_state: unknown, node: Literal): Element {
    return {
      type: 'element',
      tagName: 'span',
      properties: { className: ['math', 'math-inline'] },
      children: [{ type: 'text', value: String(node.value) }],
    };
  },
  math(_state: unknown, node: Literal): Element {
    return {
      type: 'element',
      tagName: 'div',
      properties: { className: ['math', 'math-display'] },
      children: [{ type: 'text', value: String(node.value) }],
    };
  },
};

// `output: 'html'` (default is `htmlAndMathml`) keeps the DOM half the size;
// HTML alone is enough for sighted users *and* screen readers (KaTeX uses
// aria-hidden and visually-hidden text to expose the formula). `strict:
// 'ignore'` lets unknown LaTeX macros render as raw text instead of crashing
// the build — vault notes are user-authored and we don't want a typo to
// gate a release.
const katexStep = rehypeKatex({
  output: 'html',
  strict: 'ignore',
}) as HastTransformer;

// Both plugins are visitor transformers — calling them as plain functions
// (rather than spinning up `unified()`) keeps this module dependency-light.
const slugStep = rehypeSlug() as HastTransformer;
const autolinkStep = rehypeAutolinkHeadings({
  behavior: 'append',
  properties: {
    className: [HEADING_ANCHOR_CLASS],
    'aria-label': 'permalink',
  },
  content: { type: 'text', value: '#' },
  // Idempotence: skip a heading that already carries an appended `.heading-anchor`
  // child. Without this guard, re-running the visitor on the same tree (or on a
  // tree parsed back from previously rendered HTML) would stack a second anchor
  // on every heading. The pipeline only runs once per render today, but tests
  // and any future re-render path (e.g. partial-tree updates) need this contract.
  test: (node: Element) =>
    HEADING_ANCHOR_TAGS.has(node.tagName) && !hasHeadingAnchorChild(node),
}) as HastTransformer;

function hasHeadingAnchorChild(heading: Element): boolean {
  for (const child of heading.children) {
    if (child.type !== 'element' || child.tagName !== 'a') continue;
    const className = child.properties?.['className'];
    if (Array.isArray(className) && className.includes(HEADING_ANCHOR_CLASS)) {
      return true;
    }
  }
  return false;
}

/**
 * Serialize a public-mdast tree to HTML with v0.2 heading anchors applied.
 * Returns an empty string when the tree has no renderable hast representation
 * (matches the prior pipeline behaviour for empty bodies).
 */
export function renderMdastToHtml(tree: MdastRoot): string {
  const hast = toHast(tree, {
    allowDangerousHtml: false,
    handlers: mathHandlers,
  });
  if (hast === null || hast === undefined) return '';
  // Narrow to Root — toHast on an mdast Root always returns a hast Root, but
  // the upstream type is the wider Nodes union.
  if (hast.type !== 'root') return toHtml(hast);
  // KaTeX SSR runs before the heading-anchor steps because anchors target
  // h2-h4 and KaTeX never emits those tags — the order is decoupled, but
  // running math first keeps the tree closer to its final shape when slugStep
  // walks it.
  katexStep(hast);
  applyHeadingAnchors(hast);
  return toHtml(hast);
}

/**
 * Apply slug + heading-anchor transformations to an in-memory hast tree.
 * Exported so tests can verify the idempotence guard directly without round-
 * tripping through markdown — a heading that already has an anchor child
 * must not receive a second one when this function runs again.
 */
export function applyHeadingAnchors(hast: HastRoot): void {
  slugStep(hast);
  autolinkStep(hast);
}
