import type { FolderNode } from '@noteforge/theme-default';
// Deep-import the slot-count constant so value-level resolution does not pull
// in the barrel's `.astro` re-exports (Vitest's default project lacks the
// Astro Vite plugin needed to parse `.astro`). Type-only imports from the
// barrel above are erased at compile time and remain safe.
import { CATEGORY_ACCENT_SLOT_COUNT } from '@noteforge/theme-default/lib/categoryAccent.ts';
import { filterPublishable, type NotesEntry } from './viewModels.ts';
import { buildCategoryTree, buildFolderTree } from './folderAggregation.ts';
import { resolveSiteIdentity } from './siteIdentity.ts';
import obpubConfig from '../../noteforge.config.ts';

export type NavMode = 'folder' | 'category';

/** Whether the sidebar folder tree shows leaf notes. Mirrors `nav.sidebarNotes`. */
export type SidebarNotes = 'show' | 'hide';

/** The slice of `ObpubConfig['nav']` the sidebar payload consumes. */
export interface NavConfig {
  mode: NavMode;
  sidebarNotes: SidebarNotes;
}

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
  /**
   * GitHub channel for the sidebar ProfileBlock's inline social icon.
   * Three-state contract (mirrors `socialSchema.github`):
   *   - omitted from payload → icon hidden
   *   - `''`                 → "needs setup" stub
   *   - `<url>`              → live anchor
   * The empty-string sentinel must be preserved (do NOT collapse to
   * `undefined`) — it powers the first-run onboarding affordance.
   */
  github?: string;
  slotCount: number;
  /**
   * Set to true when the sidebar should display categories only. Driven by
   * `nav.sidebarNotes` — `'hide'` (the default) drops leaf note items from
   * the tree so the sidebar stays a category navigator; notes are reached
   * via the folder/category index page a folder click lands on. `'show'`
   * keeps the legacy full tree. `buildSidebarPayload` sets this from
   * `nav.sidebarNotes`, independent of `nav.mode`. See ADR-0015.
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
 * - `avatarSrc` / `nickname` / `github` are resolved by `resolveSiteIdentity`,
 *   which falls back to GitHub-derived values (`https://github.com/<u>.png`
 *   for the avatar, the username for the nickname) when `site.avatar` /
 *   `site.nickname` are unset but `site.social.github` is a github.com URL.
 *   Missing values stay `undefined` — never `''` — so consuming components
 *   can rely on a strict `!== undefined` check to omit themselves on
 *   incomplete identity. The empty-string `''` github "stub" sentinel is
 *   passed through verbatim so the ProfileBlock's onboarding icon survives.
 */
export function buildSidebarPayload(
  allEntries: readonly NotesEntry[],
  options?: { activeSlug?: string; activeFolderPath?: string },
  nav: NavConfig = { mode: 'folder', sidebarNotes: 'hide' },
): SidebarPayload {
  const publishable = filterPublishable(allEntries);
  const folderTree =
    nav.mode === 'category'
      ? buildCategoryTree(publishable)
      : buildFolderTree(publishable);

  const payload: SidebarPayload = {
    folderTree,
    slotCount: CATEGORY_ACCENT_SLOT_COUNT,
  };

  // `nav.sidebarNotes` is the single switch for sidebar density, applied
  // uniformly to both nav modes (ADR-0015). `'hide'` (the default) keeps the
  // sidebar a category navigator — leaf notes surface on the index page a
  // folder click lands on, not in the tree. `'show'` restores the legacy
  // full tree. The old `mode === 'category'` special-case is gone: category
  // mode now hides notes simply because the default is `'hide'`.
  if (nav.sidebarNotes === 'hide') {
    payload.hideLeafNotes = true;
  }

  if (options?.activeSlug !== undefined) {
    payload.activeSlug = options.activeSlug;
  }
  if (options?.activeFolderPath !== undefined) {
    payload.activeFolderPath = options.activeFolderPath;
  }

  const identity = resolveSiteIdentity(obpubConfig.site);
  if (identity.avatar !== undefined) payload.avatarSrc = identity.avatar;
  if (identity.nickname !== undefined) payload.nickname = identity.nickname;
  // `resolveSiteIdentity` preserves the empty-string sentinel (`''`) so the
  // ProfileBlock's stub icon stays reachable; collapsing to `undefined`
  // would silently demote the onboarding state to "off".
  if (identity.github !== undefined) payload.github = identity.github;

  return payload;
}
