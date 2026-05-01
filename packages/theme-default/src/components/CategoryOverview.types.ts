/**
 * View-model for `<CategoryOverview />` — the page rendered at `/categories/`.
 *
 * Caller (apps/blog) is responsible for:
 *   - Filtering through the privacy pipeline (`filterPublishable`).
 *   - Flattening the folder tree into top-level sections + an `Uncategorized`
 *     trailing section (see `buildCategoryOverviewSections` in apps/blog).
 *   - Providing absolute, slash-prefixed `href`s for both sections and notes.
 *
 * Component contract: render-only. No frontmatter access, no privacy decisions.
 */
export interface CategoryOverviewNote {
  /** Absolute href, e.g. `/AI/Claude/foo/`. */
  href: string;
  /** Display title from the allowlist-respecting view-model. */
  title: string;
  /** Public intro text from allowlisted frontmatter.description. */
  description?: string;
  /** Public tags, already blocklist-filtered upstream. */
  tags?: string[];
  /** Optional ISO 8601 date — when present, rendered as a `<time>` glyph. */
  date?: string;
  /** Decorative thumbnail URL, already privacy-gated upstream. */
  thumbnail?: string;
}

export interface CategoryOverviewSection {
  /** Folder name (top-level segment) or the literal `'Uncategorized'`. */
  name: string;
  /**
   * Deep-link to the folder index (`/<folder>/`). Undefined for the
   * `Uncategorized` bucket — root-level notes do not have a folder home.
   */
  href?: string;
  notes: CategoryOverviewNote[];
}

export interface CategoryOverviewProps {
  sections: CategoryOverviewSection[];
  /** Empty-state copy when no sections render any notes. */
  emptyMessage: string;
  /**
   * Number of category accent slots exposed by the design tokens. Mirrors
   * `CATEGORY_ACCENT_SLOT_COUNT` so a future change to the palette is a one
   * file edit. The component picks slot via the shared FNV-1a helper.
   */
  slotCount: number;
}
