export { default as BaseLayout } from './layouts/BaseLayout.astro';
export type { BaseLayoutProps } from './layouts/BaseLayout.types.ts';
export { default as Note } from './components/Note.astro';
export { default as NotFound } from './components/NotFound.astro';
export { default as Backlinks } from './components/Backlinks.astro';
export { default as TagList } from './components/TagList.astro';
export { default as TagPage } from './components/TagPage.astro';
export { default as NoteList } from './components/NoteList.astro';
export type { NoteListEntry, NoteListProps } from './components/NoteList.types.ts';
export { default as Graph } from './components/Graph.astro';
export type { GraphProps } from './components/Graph.types.ts';
export type {
  GraphViewModel,
  GraphNode,
  GraphEdge,
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  ViewBox,
  LayoutOptions,
} from './components/Graph.layout.ts';
export { computeCircularLayout } from './components/Graph.layout.ts';
export type { NoteProps, NoteViewModel } from './components/Note.types.ts';
export type {
  BacklinksProps,
  BacklinksViewModel,
  BacklinkEntry,
} from './components/Backlinks.types.ts';
export type {
  TagListProps,
  TagListViewModel,
  TagSummary,
} from './components/TagList.types.ts';
export type {
  TagPageProps,
  TagPageViewModel,
  TagPageEntry,
} from './components/TagPage.types.ts';
export type { FolderNode } from './lib/folderTree.types.ts';
export { default as Sidebar } from './components/Sidebar.astro';
export type { SidebarProps } from './components/Sidebar.types.ts';
export { default as AvatarBlock } from './components/AvatarBlock.astro';
export type { AvatarBlockProps } from './components/AvatarBlock.types.ts';
export { default as FolderTree } from './components/FolderTree.astro';
export type { FolderTreeProps } from './components/FolderTree.types.ts';
export {
  pickCategoryAccentSlot,
  CATEGORY_ACCENT_SLOT_COUNT,
} from './lib/categoryAccent.ts';
