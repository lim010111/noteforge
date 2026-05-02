/**
 * View-model for `<Note />`.
 *
 * INTENTIONALLY a STRICT SUBSET of the public-frontmatter allowlist declared in
 * CLAUDE.md (`title`, `description`, `date`, `updated`, `tags`, …). Adding a key
 * here without first updating that allowlist would silently widen the public
 * surface and is forbidden — this type IS the contract that keeps the theme from
 * leaking arbitrary frontmatter into HTML.
 *
 * Derived view-model extensions: a small set of fields are NOT frontmatter at
 * all — they are derived from the already privacy-filtered body (`heroImage`,
 * `embeddedImages`, `headings`). These are allowed without a frontmatter
 * allowlist entry because they share the surface area of `body`: the same
 * mdast/hast pass that produced the sanitized HTML produced them. They cannot
 * leak content beyond what `body` already does.
 *
 * Caller responsibilities (the component does NOT re-derive any of these):
 *   - `tags`    has already been filtered through `publishing.tagBlocklist`.
 *   - `body`    is sanitized HTML — link-rewrite, transclude expansion, and the
 *               `%%comment%%` strip have already run in `@noteforge/core/privacy`.
 */
import type { NoteHeading } from '@noteforge/core/pipeline';

export interface NoteViewModel {
  /** Public slug, used by dev-only authoring tools. */
  slug?: string;
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
  /**
   * List thumbnail candidate. The Note page itself does not paint this; dev
   * picker UI receives it so authors can edit hero/thumbnail slots together.
   */
  thumbnailImage?: string;
  /** Public image candidates from the rendered note body for dev-only picker UI. */
  embeddedImages?: readonly string[];
  /** Vault-relative source markdown path, used only by dev-only picker UI. */
  sourcePath?: string;
  /**
   * Structured h2/h3/h4 list collected by `@noteforge/core` at the same hast
   * pass that produced `body`. Drives the layout's right-rail TOC. Empty or
   * absent means the post has no h2-h4 headings (no TOC rendered). The Note
   * component itself MUST NOT render the TOC inside the article — it is a
   * layout concern owned by `<BaseLayout tableOfContents={...} />`.
   */
  headings?: readonly NoteHeading[];
}

export interface NoteProps {
  note: NoteViewModel;
}
