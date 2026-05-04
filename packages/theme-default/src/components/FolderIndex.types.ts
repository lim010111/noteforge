/**
 * View-model for `<FolderIndex />` — the page rendered at `/<folder>/` URLs.
 *
 * The component is a *pure* renderer: it never reads from Astro globals, the
 * file system, or the privacy pipeline. Caller (apps/blog) is responsible for
 * passing already-filtered `childFolders` / `childNotes` derived from
 * `filterPublishable` + `buildFolderTree` output. See docs/UI_GUIDE.md §7
 * ("FolderIndex") for the design contract.
 */
export interface FolderIndexBreadcrumbSegment {
  /** Display label for the segment (folder name; first segment is `home`). */
  label: string;
  /** Absolute href ending in `/` (trailingSlash always — ADR-012). */
  href: string;
}

export interface FolderIndexChildFolder {
  /** Folder name (last segment). */
  name: string;
  /** Absolute href ending in `/`. */
  href: string;
  /** Count of public notes contained in this child folder (recursive). */
  noteCount: number;
}

export interface FolderIndexChildNote {
  /** Note title — fed by `entry.data.title` upstream. */
  title: string;
  /** Public intro text from allowlisted frontmatter.description. */
  description?: string;
  /** Public tags, already blocklist-filtered upstream. */
  tags?: string[];
  /** Absolute href ending in `/`. */
  href: string;
  /** Optional ISO 8601 date string. */
  date?: string;
  /** Decorative thumbnail URL, already privacy-gated upstream. */
  thumbnail?: string;
}

export interface FolderIndexViewModel {
  /** Display name of the folder (last segment). */
  folderName: string;
  /** Folder path ('AI/Claude'), used purely for stable keys. */
  folderPath: string;
  /** Root-to-current breadcrumb. First segment is `home`; last is the current folder. */
  breadcrumb: FolderIndexBreadcrumbSegment[];
  /** Optional category accent slot for the *first* breadcrumb segment (depth 0). */
  categorySlot?: 1 | 2 | 3 | 4 | 5;
  childFolders: FolderIndexChildFolder[];
  childNotes: FolderIndexChildNote[];
}

export interface FolderIndexProps {
  view: FolderIndexViewModel;
}
