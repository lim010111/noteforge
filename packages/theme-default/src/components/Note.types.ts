/**
 * View-model for `<Note />`.
 *
 * INTENTIONALLY a STRICT SUBSET of the public-frontmatter allowlist declared in
 * CLAUDE.md (`title`, `description`, `date`, `updated`, `tags`, …). Adding a key
 * here without first updating that allowlist would silently widen the public
 * surface and is forbidden — this type IS the contract that keeps the theme from
 * leaking arbitrary frontmatter into HTML.
 *
 * Caller responsibilities (the component does NOT re-derive any of these):
 *   - `tags`    has already been filtered through `publishing.tagBlocklist`.
 *   - `body`    is sanitized HTML — link-rewrite, transclude expansion, and the
 *               `%%comment%%` strip have already run in `@noteforge/core/privacy`.
 */
export interface NoteViewModel {
  title: string;
  /** ISO 8601 date string (e.g. "2026-01-10"). */
  date?: string;
  /** ISO 8601 date string for the most recent update. */
  updated?: string;
  tags: string[];
  description?: string;
  /** Pre-rendered, sanitized HTML. Injected via `set:html` — see Note.astro. */
  body: string;
  /**
   * Hero background image URL — painted under the title at low opacity.
   * The pipeline only writes this when the source URL passed the public
   * attachment closure check (or is an absolute http(s)://), so the theme
   * can render it verbatim without re-deriving privacy.
   */
  heroImage?: string;
}

export interface NoteProps {
  note: NoteViewModel;
}
