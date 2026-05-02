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
import type { ElementContent, Element, Root as HastRoot } from 'hast';

/**
 * Structured heading record for in-page navigation (Table of Contents).
 *
 * Derived from the post-transclude, post-privacy-filter hast tree at the
 * SAME moment HTML is serialized — so headings inside private transclusions
 * cannot leak: their AST subtrees were already removed by `expandTransclusions`
 * before this collection runs.
 *
 * h1 is intentionally omitted — the page title (`<h1>{note.title}`) is
 * rendered separately by the theme outside the body, and a TOC entry would
 * just duplicate it.
 */
export interface NoteHeading {
  /** rehype-slug-derived fragment id (matches the in-body `<h2 id="...">`). */
  id: string;
  /** Heading depth — h2/h3/h4 only. */
  depth: 2 | 3 | 4;
  /** Visible text content, with the appended `.heading-anchor` "#" excluded. */
  text: string;
}

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

const TOC_HEADING_TAGS: ReadonlyMap<string, 2 | 3 | 4> = new Map([
  ['h2', 2],
  ['h3', 3],
  ['h4', 4],
]);

/**
 * Walk a hast tree and collect h2/h3/h4 headings in document order.
 *
 * Must run AFTER `applyHeadingAnchors` — it reads the `id` attribute that
 * `rehype-slug` writes (so we get the SAME slug algorithm, including dedup
 * suffixes like `-1`/`-2`, that the in-body anchors use).
 *
 * Text extraction: walks the heading's children depth-first concatenating
 * text nodes, but skips the appended `<a class="heading-anchor">#</a>` child
 * — otherwise every TOC entry would end with "#".
 *
 * Headings whose `id` is missing or non-string are skipped (defensive: should
 * never happen given the slug step ran first, but the type allows it).
 */
export function collectHeadings(hast: HastRoot): readonly NoteHeading[] {
  const out: NoteHeading[] = [];
  for (const child of hast.children) {
    if (child.type !== 'element') continue;
    const depth = TOC_HEADING_TAGS.get(child.tagName);
    if (depth === undefined) continue;
    const id = child.properties?.['id'];
    if (typeof id !== 'string' || id.length === 0) continue;
    out.push({ id, depth, text: extractHeadingText(child.children) });
  }
  return out;
}

function isHeadingAnchor(node: ElementContent): boolean {
  if (node.type !== 'element' || node.tagName !== 'a') return false;
  const className = node.properties?.['className'];
  return Array.isArray(className) && className.includes(HEADING_ANCHOR_CLASS);
}

function extractHeadingText(children: readonly ElementContent[]): string {
  let acc = '';
  for (const node of children) {
    if (isHeadingAnchor(node)) continue;
    if (node.type === 'text') {
      acc += node.value;
      continue;
    }
    if (node.type === 'element') {
      acc += extractHeadingText(node.children);
    }
  }
  return acc;
}

/**
 * Render a public-mdast tree to HTML and return the structured heading list
 * collected from the SAME hast pass. Use this entrypoint when a downstream
 * consumer needs a TOC; the older `renderMdastToHtml` (no headings) stays
 * around so unaware callers don't have to change.
 */
export function renderMdastToHtmlWithHeadings(
  tree: MdastRoot,
): { html: string; headings: readonly NoteHeading[] } {
  const hast = toHast(tree, {
    allowDangerousHtml: false,
    handlers: mathHandlers,
  });
  if (hast === null || hast === undefined) return { html: '', headings: [] };
  if (hast.type !== 'root') return { html: toHtml(hast), headings: [] };
  katexStep(hast);
  applyHeadingAnchors(hast);
  return { html: toHtml(hast), headings: collectHeadings(hast) };
}
