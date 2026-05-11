/**
 * Obsidian-compatible callout rendering — recognises the
 *   > [!type] Optional title
 *   > body
 * blockquote dialect (https://help.obsidian.md/Editing+and+formatting/Callouts)
 * and emits semantic HTML in place of a plain `<blockquote>`.
 *
 * Where this runs: as a `mdast-util-to-hast` blockquote handler. The detection
 * only fires at HTML-serialization time, AFTER `linkRewriter`,
 * `expandTransclusions`, and every other mdast pass has walked the tree. That
 * ordering is the privacy contract — callouts sit inside a regular `blockquote`
 * mdast node throughout the privacy pipeline, so wikilinks and transclusions
 * inside callouts are gated by the same code paths that gate everything else.
 *
 * Why not lift callouts to a custom mdast node earlier: the existing privacy
 * walkers descend by node type and would need to learn the new shape (or risk
 * skipping nested children) — keeping the blockquote shape until the very end
 * lets every existing walker descend without modification.
 */

import type { Blockquote, PhrasingContent } from 'mdast';
import type { Element, ElementContent, Properties } from 'hast';
import type { Handler, State } from 'mdast-util-to-hast';

/**
 * Canonical callout kinds — Obsidian's documented set. Aliases (`tldr`, `hint`,
 * `error`, …) collapse to one of these in {@link CALLOUT_TYPES}.
 */
export type CalloutKind =
  | 'note'
  | 'abstract'
  | 'info'
  | 'todo'
  | 'tip'
  | 'success'
  | 'question'
  | 'warning'
  | 'failure'
  | 'danger'
  | 'bug'
  | 'example'
  | 'quote';

/**
 * Obsidian alias → canonical kind. The lookup is performed on the lower-cased
 * input, so `[!Tip]` / `[!TIP]` / `[!tip]` all collapse to `'tip'`.
 *
 * Source: Obsidian docs — Callouts § "Supported types".
 */
export const CALLOUT_TYPES: ReadonlyMap<string, CalloutKind> = new Map<string, CalloutKind>([
  ['note', 'note'],
  ['abstract', 'abstract'],
  ['summary', 'abstract'],
  ['tldr', 'abstract'],
  ['info', 'info'],
  ['todo', 'todo'],
  ['tip', 'tip'],
  ['hint', 'tip'],
  ['important', 'tip'],
  ['success', 'success'],
  ['check', 'success'],
  ['done', 'success'],
  ['question', 'question'],
  ['help', 'question'],
  ['faq', 'question'],
  ['warning', 'warning'],
  ['caution', 'warning'],
  ['attention', 'warning'],
  ['failure', 'failure'],
  ['fail', 'failure'],
  ['missing', 'failure'],
  ['danger', 'danger'],
  ['error', 'danger'],
  ['bug', 'bug'],
  ['example', 'example'],
  ['quote', 'quote'],
  ['cite', 'quote'],
]);

const DEFAULT_TITLES: Readonly<Record<CalloutKind, string>> = {
  note: 'Note',
  abstract: 'Abstract',
  info: 'Info',
  todo: 'Todo',
  tip: 'Tip',
  success: 'Success',
  question: 'Question',
  warning: 'Warning',
  failure: 'Failure',
  danger: 'Danger',
  bug: 'Bug',
  example: 'Example',
  quote: 'Quote',
};

/** Result of parsing the marker `[!type][+/-] [title]` at the head of the first text node. */
export interface CalloutMarker {
  /** Canonical kind — falls back to `'note'` for unknown raw types (Obsidian behaviour). */
  kind: CalloutKind;
  /** Raw type string from the marker — preserved so unknown-type fallback titles can echo it. */
  rawKind: string;
  /** `'open'` for `+`, `'closed'` for `-`, `null` for not-foldable. */
  fold: 'open' | 'closed' | null;
  /** Explicit title text, trimmed. `null` when the user wrote no title after the marker. */
  title: string | null;
  /** Number of characters consumed from the input (marker line including its trailing `\n`). */
  consumed: number;
}

const MARKER_RE = /^\[!([A-Za-z][A-Za-z0-9_-]*)\]([+-])?/;

/**
 * Parse a callout marker from raw text. Returns `null` when the text does not
 * begin with `[!type]`. Title capture is text-only — anything after the marker
 * on the same line is taken verbatim (trimmed). Rich inline content placed on
 * the marker line (e.g. `> [!warning] **bold** title`) is left in the body —
 * v1 limitation, documented in the plan.
 */
export function parseCalloutMarker(text: string): CalloutMarker | null {
  const m = MARKER_RE.exec(text);
  if (!m) return null;
  const rawKind = m[1] as string;
  const foldChar = m[2];
  const afterMarker = text.slice(m[0].length);
  // Title is everything up to the first `\n` (or end of string), with surrounding
  // whitespace stripped. The marker line — including the trailing `\n` if present
  // — is what we report as `consumed`, so callers can slice it off cleanly.
  const newlineIndex = afterMarker.indexOf('\n');
  const titleSegment = newlineIndex === -1 ? afterMarker : afterMarker.slice(0, newlineIndex);
  const trimmedTitle = titleSegment.trim();
  const consumed =
    m[0].length + (newlineIndex === -1 ? titleSegment.length : newlineIndex + 1);
  return {
    kind: CALLOUT_TYPES.get(rawKind.toLowerCase()) ?? 'note',
    rawKind,
    fold: foldChar === '+' ? 'open' : foldChar === '-' ? 'closed' : null,
    title: trimmedTitle === '' ? null : trimmedTitle,
    consumed,
  };
}

function defaultTitleFor(kind: CalloutKind, rawKind: string): string {
  // Unknown raw types echo the user's spelling (capitalised). Canonical types
  // use the documented label — `[!tldr]` shows "Abstract" because that is the
  // canonical name even though the user typed `tldr`. Mirrors Obsidian.
  if (CALLOUT_TYPES.has(rawKind.toLowerCase())) {
    return DEFAULT_TITLES[kind];
  }
  return rawKind.charAt(0).toUpperCase() + rawKind.slice(1).toLowerCase();
}

// Compact single-path Lucide-style icons (24x24, stroke 1.75, currentColor).
// Inlined to keep core dependency-free; per-note byte cost (~2KB pre-gzip) is
// documented as acceptable in the plan.
const CALLOUT_ICONS: Readonly<Record<CalloutKind, string>> = {
  note: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h4',
  abstract: 'M4 6h16 M4 12h16 M4 18h10',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 8h.01 M11 12h1v5h1',
  todo: 'M4 4h16v16H4z M8 12l3 3 6-7',
  tip: 'M12 2c-1.5 3-3.5 5-3.5 8 0 3 1.7 5.5 3.5 5.5s3.5-2.5 3.5-5.5c0-3-2-5-3.5-8z M9 18h6 M10 21h4',
  success: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M7 12l3 3 7-7',
  question: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M9.5 9a2.5 2.5 0 1 1 4 2.5c-1 0.75-1.5 1.5-1.5 2.5 M12 17h.01',
  warning: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  failure: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M9 9l6 6 M15 9l-6 6',
  danger: 'M13 2 3 14h9l-1 8 10-12h-9z',
  bug: 'M8 2l1.5 1.5 M14.5 3.5 16 2 M12 6a3 3 0 0 0-3 3v1h6V9a3 3 0 0 0-3-3z M6 14a6 6 0 0 0 12 0v-4H6z M3 11h3 M18 11h3 M3 7l3 2 M21 7l-3 2 M3 17l3-2 M21 17l-3-2',
  example: 'M21 6H8 M21 12H8 M21 18H8 M4 5v14 M4 5h2 M4 19h2',
  quote: 'M7 6c-2 0-3 2-3 4 0 1 .3 2 1 3l-1 4h4l1-3c1-1 2-2 2-4 0-2-1-4-4-4z M18 6c-2 0-3 2-3 4 0 1 .3 2 1 3l-1 4h4l1-3c1-1 2-2 2-4 0-2-1-4-4-4z',
};

function iconElement(kind: CalloutKind): Element {
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      className: ['callout-icon'],
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      width: '20',
      height: '20',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.75',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ariaHidden: 'true',
    },
    children: [
      {
        type: 'element',
        tagName: 'path',
        properties: { d: CALLOUT_ICONS[kind] },
        children: [],
      },
    ],
  };
}

/**
 * Inspect a blockquote's first inline text node for a callout marker. When a
 * marker is found, returns the parsed marker plus a *new* blockquote node with
 * the marker line stripped — leaving the body content intact for downstream
 * processing by the caller's `state.all()`. Returns `null` for plain quotes.
 *
 * The mdast tree is treated as immutable: we shallow-clone the blockquote, the
 * first paragraph, and the first text node only. Other children pass through
 * by reference.
 */
function detectCallout(
  node: Blockquote,
): { marker: CalloutMarker; modifiedNode: Blockquote } | null {
  const firstChild = node.children[0];
  if (firstChild === undefined || firstChild.type !== 'paragraph') return null;
  const firstInline = firstChild.children[0];
  if (firstInline === undefined || firstInline.type !== 'text') return null;

  const marker = parseCalloutMarker(firstInline.value);
  if (marker === null) return null;

  const remainingText = firstInline.value.slice(marker.consumed);
  const newParagraphChildren: PhrasingContent[] = [...firstChild.children];
  if (remainingText.length > 0) {
    newParagraphChildren[0] = { ...firstInline, value: remainingText };
  } else {
    newParagraphChildren.shift();
  }

  const newBlockquoteChildren = [...node.children];
  if (newParagraphChildren.length === 0) {
    // The marker line was the entire first paragraph — drop the paragraph so
    // the callout body starts at the second child.
    newBlockquoteChildren.shift();
  } else {
    newBlockquoteChildren[0] = { ...firstChild, children: newParagraphChildren };
  }

  return {
    marker,
    modifiedNode: { ...node, children: newBlockquoteChildren },
  };
}

function defaultBlockquote(state: State, node: Blockquote): Element {
  // Mirrors the upstream default handler so a non-callout `> quote` keeps
  // emitting `<blockquote>` exactly as before. We re-implement (instead of
  // delegating to `defaultHandlers.blockquote`) to keep the dependency surface
  // minimal and the contract obvious at the call site.
  const result: Element = {
    type: 'element',
    tagName: 'blockquote',
    properties: {},
    children: state.wrap(state.all(node), true),
  };
  state.patch(node, result);
  return state.applyData(node, result) as Element;
}

/**
 * `mdast-util-to-hast` blockquote handler with Obsidian-callout detection.
 * Register on the `handlers.blockquote` key when calling `toHast()`. When the
 * node does not match the callout shape, falls through to the standard
 * blockquote behaviour.
 */
export const calloutBlockquoteHandler: Handler = (state, node) => {
  const blockquote = node as Blockquote;
  const detected = detectCallout(blockquote);
  if (detected === null) return defaultBlockquote(state, blockquote);

  const { marker, modifiedNode } = detected;
  const bodyChildren = state.wrap(state.all(modifiedNode), true);
  const title = marker.title ?? defaultTitleFor(marker.kind, marker.rawKind);

  const titleChildren: ElementContent[] = [
    iconElement(marker.kind),
    {
      type: 'element',
      tagName: 'span',
      properties: { className: ['callout-title-text'] },
      children: [{ type: 'text', value: title }],
    },
  ];

  const isFoldable = marker.fold !== null;
  const titleEl: Element = {
    type: 'element',
    tagName: isFoldable ? 'summary' : 'div',
    properties: { className: ['callout-title'] },
    children: titleChildren,
  };

  const bodyEl: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['callout-content'] },
    children: bodyChildren,
  };

  const wrapperProps: Properties = {
    className: ['callout', `callout-${marker.kind}`],
    'data-callout': marker.kind,
  };
  if (marker.fold === 'open') {
    // hast-util-to-html serialises `open: true` as the bare attribute `open`.
    wrapperProps['open'] = true;
  }

  const result: Element = {
    type: 'element',
    tagName: isFoldable ? 'details' : 'div',
    properties: wrapperProps,
    children: [titleEl, bodyEl],
  };
  state.patch(blockquote, result);
  return state.applyData(blockquote, result) as Element;
};
