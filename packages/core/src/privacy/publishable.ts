/**
 * Publishability gate for already-public notes.
 *
 * `classify.ts` answers the privacy question: "is this note allowed to leave
 * the vault?" `isPublishable()` answers the orthogonal authoring-intent
 * question: "given that it is allowed, does the author want it in *this*
 * build?" `draft: true` is the opt-out — a way to keep work-in-progress
 * notes out of output while leaving them marked public for later.
 *
 * **CRITICAL single-source-of-truth contract** (CLAUDE.md: "결정은 한 곳,
 * 호출은 여러 곳"): every adapter, theme, and app that lists or routes
 * notes (Astro pages, RSS feeds, sitemaps, alternate themes, audit tools)
 * MUST gate through this predicate. Re-deriving `frontmatter.draft !== true`
 * anywhere else fragments the rule and risks a future adapter forgetting
 * to apply it — a `draft: true` note would then ship as published output.
 *
 * The frontmatter allowlist (see `config.ts`) preserves the `draft` field
 * precisely so this predicate can read it post-filter. Do not remove
 * `draft` from the allowlist without updating this module.
 */

export function isPublishable(
  frontmatter: Readonly<Record<string, unknown>>,
): boolean {
  return frontmatter['draft'] !== true;
}
