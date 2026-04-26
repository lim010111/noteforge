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
import type { Root as MdastRoot } from 'mdast';
import type { Element, Root as HastRoot } from 'hast';

const HEADING_ANCHOR_TAGS: ReadonlySet<string> = new Set(['h2', 'h3', 'h4']);

type HastTransformer = (tree: HastRoot) => void;

// Both plugins are visitor transformers — calling them as plain functions
// (rather than spinning up `unified()`) keeps this module dependency-light.
const slugStep = rehypeSlug() as HastTransformer;
const autolinkStep = rehypeAutolinkHeadings({
  behavior: 'append',
  properties: {
    className: ['heading-anchor'],
    'aria-label': 'permalink',
  },
  content: { type: 'text', value: '#' },
  test: (node: Element) => HEADING_ANCHOR_TAGS.has(node.tagName),
}) as HastTransformer;

/**
 * Serialize a public-mdast tree to HTML with v0.2 heading anchors applied.
 * Returns an empty string when the tree has no renderable hast representation
 * (matches the prior pipeline behaviour for empty bodies).
 */
export function renderMdastToHtml(tree: MdastRoot): string {
  const hast = toHast(tree, { allowDangerousHtml: false });
  if (hast === null || hast === undefined) return '';
  // Narrow to Root — toHast on an mdast Root always returns a hast Root, but
  // the upstream type is the wider Nodes union.
  if (hast.type !== 'root') return toHtml(hast);
  slugStep(hast);
  autolinkStep(hast);
  return toHtml(hast);
}
