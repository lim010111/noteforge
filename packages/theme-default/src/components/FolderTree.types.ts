/**
 * View-model for `<FolderTree />`.
 *
 * The `root` is a `FolderNode` whose own `name`/`path` are ignored — only its
 * `children` and `notes` are rendered. Both `activeSlug` and `activeFolderPath`
 * are optional; when present they drive `aria-current="page"` placement and
 * the auto-`<details open>` chain on ancestors.
 *
 * `slotCount` is passed in (rather than imported here) so the consumer
 * decides which token slot ring is in effect — `apps/blog`'s sidebar payload
 * imports `CATEGORY_ACCENT_SLOT_COUNT` from `@noteforge/theme-default` and
 * threads it through. This keeps the component agnostic of the SSOT location.
 */
import type { FolderNode } from "../lib/folderTree.types";

export interface FolderTreeProps {
  /** Root folder node — its `name`/`path` are ignored; only `children`/`notes` render. */
  root: FolderNode;
  /** Current note slug, e.g. 'AI/Claude/agents'. Marks the matching <a aria-current="page">. */
  activeSlug?: string;
  /** Current folder index path, e.g. 'AI/Claude/' (trailing slash optional). Marks the folder name link. */
  activeFolderPath?: string;
  /** Number of `--color-accent-cat-N` slots in tokens.css. Pass `CATEGORY_ACCENT_SLOT_COUNT`. */
  slotCount: number;
}
