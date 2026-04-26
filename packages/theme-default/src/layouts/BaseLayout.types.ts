import type { SidebarNode } from '../components/FolderTreeSidebar.types.ts';

/**
 * Field-level props for `<BaseLayout />`.
 *
 * INTENTIONALLY does NOT accept a `frontmatter` blob. Per CLAUDE.md (privacy
 * CRITICAL): public HTML/meta must respect a frontmatter allowlist enforced in
 * `@noteforge/core/privacy`. Forwarding the entire frontmatter object to a layout
 * would bypass that allowlist — so the layout receives only field-level props
 * that the caller has already filtered.
 */
export interface BaseLayoutProps {
  title: string;
  description?: string;
  /** BCP 47 language tag for `<html lang>`. Defaults to `"ko"`. */
  lang?: string;
  canonicalUrl?: string;
  /** Open Graph type. Defaults to `"website"`. */
  ogType?: 'website' | 'article';
  /** Open Graph site_name. Optional — emitted only when provided. */
  siteName?: string;
  /**
   * Folder-tree sidebar data. When provided, BaseLayout wraps <main> in
   * `.site-shell` and renders the tree at two positions: the desktop sidebar
   * column and the mobile menu panel. When omitted, the layout is the
   * pre-existing single-column shape (zero regression).
   *
   * The caller MUST pass already-public-only data (see
   * `apps/blog/src/lib/folderTree.ts`). BaseLayout does not filter privacy.
   */
  sidebarRoots?: readonly SidebarNode[];
  /** Slug of the current page — drives auto-expand + active-leaf highlight. */
  currentSlug?: string;
}
