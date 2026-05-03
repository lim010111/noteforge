/**
 * View-model for `<Sidebar />`.
 *
 * Composes `<AvatarBlock>` and `<FolderTree>` into a single `<aside>`. Inputs
 * are pre-validated and pre-filtered by the upstream payload builder (apps
 * /blog's sidebar payload, step 8). The component renders or omits — it
 * never re-derives identity, privacy, or routing.
 *
 * Why no id props: BaseLayout (step 5) renders the same Sidebar twice — once
 * in the desktop grid column, once in the mobile <details> drawer. Identical
 * `id` on both copies would violate HTML uniqueness and break AT focus
 * targeting; the component avoids the problem by emitting no static ids.
 */
import type { FolderNode } from "../lib/folderTree.types";

export interface SidebarProps {
  /** Already-built folder tree (output of `buildFolderTree`). */
  folderTree: FolderNode;
  /** Active note slug, threaded through to FolderTree. */
  activeSlug?: string;
  /** Active folder index path, threaded through to FolderTree. */
  activeFolderPath?: string;
  /** Avatar image URL (validated by siteSchema upstream). */
  avatarSrc?: string;
  /** Author display name. */
  nickname?: string;
  /** Number of `--color-accent-cat-N` slots (typically `CATEGORY_ACCENT_SLOT_COUNT`). */
  slotCount: number;
  /**
   * Threaded through to FolderTree. In `nav.mode === 'category'` the sidebar
   * is a pure category navigator and individual notes only appear on the
   * category index page they belong to.
   */
  hideLeafNotes?: boolean;
}
