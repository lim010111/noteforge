const COMMENT_RE = /%%[\s\S]*?%%/g;

/**
 * Remove Obsidian private comment blocks (`%%...%%`) from a markdown string.
 * These comments are author-private by convention and must NEVER reach rendered HTML,
 * regardless of the note's public/private classification.
 *
 * Applied eagerly at Phase A (discovery), before any downstream parsing that might
 * preserve the text in AST nodes. Operates at the raw string level because comments can
 * span markdown block boundaries and sit inside code fences (Obsidian treats them as
 * author-only regardless of context).
 */
export function stripObsidianComments(markdown: string): string {
  return markdown.replace(COMMENT_RE, '');
}
