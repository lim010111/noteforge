# Markdown Rendering

How a vault note's text becomes published HTML. This context covers the *dialect*
the pipeline accepts and the two mechanisms it uses to understand that dialect — it
does not cover the privacy decisions layered on top (see `packages/core` CLAUDE.md).

## Language

**Obsidian Flavored Markdown** (OFM):
The dialect every vault note is authored in — CommonMark plus Obsidian's own
additions (wikilinks, embeds, callouts, `%%comments%%`, `==highlight==`, inline
`^[footnotes]`, inline `#tags`, `$math$`).
_Avoid_: "Obsidian markdown", "markdown" (ambiguous — say which dialect).

**GitHub Flavored Markdown** (GFM):
The CommonMark superset that Obsidian and GitHub share — footnotes, tables,
strikethrough, task lists, autolink literals. The portion of OFM covered by
official micromark/mdast extensions.

**Syntax extension**:
A micromark/mdast extension that teaches the parser a grammar *at parse time*.
Used when an official, version-compatible extension exists (math, GFM).

**Post-parse transform**:
A walk over the parsed tree that rewrites text nodes *after* parsing. The
fallback mechanism when no version-compatible syntax extension exists — used
for wikilinks, `==highlight==`, inline `^[footnotes]`, and `#tag` pills.

**Highlight**:
`==text==` → a `<mark>`. An OFM addition with no GFM equivalent.

## Relationships

- A vault note is authored in **OFM**; **GFM** is the subset of OFM the pipeline
  reads via a **syntax extension**.
- Every OFM feature is handled by exactly one mechanism — a **syntax extension**
  or a **post-parse transform**, never both.
- A **post-parse transform** must emit nodes carrying a standard `children`
  array, so the privacy passes (which recurse structurally) keep filtering
  wikilinks and embeds nested inside them.

## Example dialogue

> **Dev:** "Why is `==highlight==` a post-parse transform when footnotes are a
> syntax extension? They're both OFM."
> **Maintainer:** "Footnotes are also GFM, so there's an official micromark
> extension on our micromark version. `==highlight==` only has a v1 extension
> that conflicts with our v2 parser stack — so it's a post-parse transform,
> same as wikilinks."

## Flagged ambiguities

- "markdown" was used to mean both the input dialect and the GitHub subset —
  resolved: **OFM** is the input, **GFM** is the subset with official extensions.
