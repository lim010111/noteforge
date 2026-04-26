/**
 * View-model for `<FolderTreeSidebar />`.
 *
 * INTENTIONAL strict subset — mirrors the allowlist discipline of NoteListEntry.
 * `path`, `slug`, and `label` are caller-controlled strings; the component
 * never reads frontmatter directly. Adding fields here without justifying
 * the privacy/allowlist implications is forbidden.
 */
export interface SidebarFolder {
  readonly kind: 'folder';
  /** POSIX-nested folder path used by the SSR auto-expand decision. */
  readonly path: string;
  /** Human-readable label rendered in the summary. */
  readonly label: string;
  /** Transitive count of public leaf descendants. Drives the count badge. */
  readonly noteCount: number;
  readonly children: readonly SidebarNode[];
}

export interface SidebarLeaf {
  readonly kind: 'leaf';
  /** Public slug, used for `href={`/${slug}`}` and the active-leaf check. */
  readonly slug: string;
  /** Human-readable label. */
  readonly label: string;
}

export type SidebarNode = SidebarFolder | SidebarLeaf;

export interface FolderTreeSidebarProps {
  /** Top-level nodes — already pruned & sorted by the caller. */
  roots: readonly SidebarNode[];
  /**
   * Slug of the current page (note / tag / etc). Used SSR-side to:
   *   - mark the matching leaf with `aria-current="page"` + `.is-active`
   *   - open `<details>` for every ancestor folder of the active leaf
   * When omitted, no folder auto-opens and no leaf is highlighted.
   */
  currentSlug?: string;
  /** Aria label for the wrapping <aside>. Defaults to the Korean wording used elsewhere. */
  ariaLabel?: string;
}
