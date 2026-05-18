/**
 * Task-list checkbox normalization.
 *
 * GFM's task-list extension only recognizes `[ ]` and `[x]`/`[X]`. Obsidian's
 * checkbox states are open-ended (`[/]`, `[-]`, `[>]`, `[?]`, `[!]`, …), and
 * GFM leaves those as a list item whose text literally starts with `[/]`.
 *
 * This transform makes every checkbox uniform: each task item gets a
 * `data-task` attribute (via `data.hProperties`) holding the single state
 * character. GFM-recognized items get `data-task=" "` / `"x"`; an unrecognized
 * `[c]` prefix is consumed from the text and the item is marked with `c`. The
 * theme styles a custom marker per `data-task` value, so no state ever renders
 * as literal `[…]` text.
 */

import type { Root } from 'mdast';

/** A leading `[<state>]` followed by a space/tab — the extended-checkbox form. */
const EXTENDED_RE = /^\[(\S)\][ \t]/;

interface AnyNode {
  type: string;
  value?: string;
  checked?: boolean | null;
  children?: AnyNode[];
  data?: { hProperties?: Record<string, unknown> } & Record<string, unknown>;
}

/** Tag every task-list item in the tree with a `data-task` state char, in place. */
export function transformTaskCheckboxes(tree: Root): void {
  walk(tree as unknown as AnyNode);
}

function walk(node: AnyNode): void {
  const children = node.children;
  if (!Array.isArray(children)) return;
  for (const child of children) {
    if (!child) continue;
    if (child.type === 'listItem') normalizeItem(child);
    walk(child);
  }
}

function normalizeItem(item: AnyNode): void {
  // GFM already resolved `[ ]` / `[x]` — `checked` is a boolean for those.
  if (item.checked === true) {
    setTask(item, 'x');
    return;
  }
  if (item.checked === false) {
    setTask(item, ' ');
    return;
  }

  // Otherwise: maybe an Obsidian extended state GFM didn't recognize.
  const text = firstTextNode(item);
  if (text === undefined) return;
  const match = EXTENDED_RE.exec(text.value ?? '');
  if (match === null) return;
  const state = match[1];
  if (state === undefined) return;

  text.value = (text.value ?? '').slice(match[0].length);
  item.checked = false;
  setTask(item, state);
}

/** The first `text` node of the item's first paragraph, if any. */
function firstTextNode(item: AnyNode): AnyNode | undefined {
  const firstBlock = item.children?.[0];
  if (firstBlock === undefined || firstBlock.type !== 'paragraph') return undefined;
  const firstInline = firstBlock.children?.[0];
  if (firstInline === undefined || firstInline.type !== 'text') return undefined;
  return firstInline;
}

function setTask(item: AnyNode, state: string): void {
  const data = item.data ?? {};
  data.hProperties = { ...data.hProperties, 'data-task': state };
  item.data = data;
}
