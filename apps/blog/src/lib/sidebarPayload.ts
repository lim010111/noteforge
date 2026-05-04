import type { FolderNode } from '@noteforge/theme-default';
// Deep-import the slot-count constant so value-level resolution does not pull
// in the barrel's `.astro` re-exports (Vitest's default project lacks the
// Astro Vite plugin needed to parse `.astro`). Type-only imports from the
// barrel above are erased at compile time and remain safe.
import { CATEGORY_ACCENT_SLOT_COUNT } from '@noteforge/theme-default/lib/categoryAccent.ts';
import { filterPublishable, type NotesEntry } from './viewModels.ts';
import { buildCategoryTree, buildFolderTree } from './folderAggregation.ts';
import obpubConfig from '../../noteforge.config.ts';

export type NavMode = 'folder' | 'category';

/**
 * View-model the route layer hands to `<BaseLayout sidebar={...} />`.
 *
 * Structurally compatible with `SidebarProps` from `@noteforge/theme-default`
 * — the layout accepts this object directly. Kept as a separate interface so
 * the route ↔ payload contract is searchable from apps/blog without crossing
 * the package boundary.
 */
export interface SidebarPayload {
  folderTree: FolderNode;
  activeSlug?: string;
  activeFolderPath?: string;
  avatarSrc?: string;
  nickname?: string;
  slotCount: number;
  /**
   * Set to true when the sidebar should display only categories. In
   * `nav.mode === 'category'` (the default) note items live on the
   * category-index page that lists them, so leaving them in the sidebar
   * tree as well is duplicative and crowds the navigator. `buildSidebarPayload`
   * sets this automatically based on `mode`.
   */
  hideLeafNotes?: boolean;
}

/**
 * Build the sidebar payload from a raw `getCollection('notes')` result.
 *
 * - Privacy: filtering goes through `filterPublishable` (which delegates to
 *   `@noteforge/core/privacy/publishable`). This helper never re-derives
 *   `isPublic`/`draft` rules — single source of truth lives in core/privacy.
 * - No FS / Astro access: caller passes the already-fetched collection. This
 *   keeps the helper pure and trivially testable.
 * - `slotCount` mirrors `CATEGORY_ACCENT_SLOT_COUNT` so design (TOKENS.md →
 *   tokens.css → categoryAccent.ts → here) stays one SSOT chain. Hard-coding
 *   would silently desync if a future step changes the slot count.
 * - `avatarSrc` / `nickname` come from `obpubConfig.site.{avatar,nickname}`.
 *   Both are optional per `siteSchema` (step 2). Missing values stay
 *   `undefined` — never `''` — so consuming components can rely on a strict
 *   `!== undefined` check to omit themselves on incomplete identity.
 */
export function buildSidebarPayload(
  allEntries: readonly NotesEntry[],
  options?: { activeSlug?: string; activeFolderPath?: string },
  mode: NavMode = 'category',
): SidebarPayload {
  const publishable = filterPublishable(allEntries);
  const folderTree =
    mode === 'category'
      ? buildCategoryTree(publishable)
      : buildFolderTree(publishable);

  const payload: SidebarPayload = {
    folderTree,
    slotCount: CATEGORY_ACCENT_SLOT_COUNT,
  };

  // In category mode the sidebar is a pure category navigator; notes appear
  // on the category-index page they belong to. Folder mode keeps the
  // historical full-tree view because vault path *is* the URL there.
  if (mode === 'category') {
    payload.hideLeafNotes = true;
  }

  if (options?.activeSlug !== undefined) {
    payload.activeSlug = options.activeSlug;
  }
  if (options?.activeFolderPath !== undefined) {
    payload.activeFolderPath = options.activeFolderPath;
  }

  const { avatar, nickname } = obpubConfig.site;
  if (avatar !== undefined) payload.avatarSrc = avatar;
  if (nickname !== undefined) payload.nickname = nickname;

  return payload;
}
