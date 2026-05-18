/**
 * The single entry point that turns a note's raw body into an mdast tree.
 *
 * Grammar layered onto CommonMark:
 *   - GFM (`micromark-extension-gfm` + `mdast-util-gfm`) — footnotes, tables,
 *     strikethrough, task lists, autolink literals.
 *   - Math (`micromark-extension-math` + `mdast-util-math`) — `$…$` / `$$…$$`.
 *
 * Three post-parse transforms then cover Obsidian syntax that has no
 * version-compatible micromark extension:
 *   - `transformInlineFootnotes` — `^[inline footnote]` (runs first so the
 *     definitions it appends are visible to the highlight pass).
 *   - `transformHighlights` — `==highlight==`.
 *   - `transformTaskCheckboxes` — extended checkbox states (`[/]`, `[-]`, …).
 *
 * Wikilinks `[[…]]` and embeds `![[…]]` are deliberately NOT handled here —
 * they stay as text for `rewriteWikilinks` / `expandTransclusions` downstream.
 */

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { math as mathSyntax } from 'micromark-extension-math';
import { mathFromMarkdown } from 'mdast-util-math';
import type { Root } from 'mdast';

import { transformHighlights } from './transforms/highlight.ts';
import { transformInlineFootnotes } from './transforms/inlineFootnote.ts';
import { transformTaskCheckboxes } from './transforms/taskCheckbox.ts';

/**
 * Lift a `$$expr$$` that occupies its own line into the fenced-block form that
 * `micromark-extension-math` recognizes as display math.
 *
 * Obsidian users routinely write display formulas as a single line —
 * `$$W \leftarrow W + \Delta W$$` — but the math grammar only treats the
 * fenced form (the `$$` pair on its own line) as block math. Without this
 * normalization those formulas parse as inline math and lose the centred
 * display layout. Only lines whose entire content (after optional
 * indentation) is a single `$$…$$` group are rewritten.
 */
export function promoteSingleLineDisplayMath(body: string): string {
  // JS replacement strings read `$$` as a literal `$`, so the fence has to be
  // written `$$$$` to emit `$$`. This was the bug that quietly downgraded
  // promoted lines to a single dollar — keep the round-trip test green.
  return body.replace(/^([ \t]*)\$\$([^$\n]+?)\$\$[ \t]*$/gm, '$1$$$$\n$2\n$$$$');
}

/**
 * Parse a note body into mdast: GFM + math grammar, then the Obsidian
 * post-parse transforms. The result still contains raw `[[…]]` / `![[…]]`
 * text for the privacy stages to rewrite.
 */
export function parseMarkdownToMdast(body: string): Root {
  const tree = fromMarkdown(promoteSingleLineDisplayMath(body), {
    extensions: [gfm(), mathSyntax()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  }) as unknown as Root;

  transformInlineFootnotes(tree);
  transformHighlights(tree);
  transformTaskCheckboxes(tree);

  return tree;
}
