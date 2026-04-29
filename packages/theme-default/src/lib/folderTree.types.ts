/**
 * Folder tree node — produced by apps/blog/src/lib/folderAggregation.ts,
 * consumed by FolderTree.astro / FolderIndex.astro / Sidebar.astro.
 *
 * Type SSOT lives here in theme-default because the consumer is here, and
 * apps → packages import direction is the only one allowed by the workspace.
 */
export interface FolderNode {
  /** 폴더 이름. 루트는 빈 문자열 ''. 그 외는 해당 segment 자체(예: 'AI', 'Claude'). */
  name: string;
  /** 슬래시 구분 절대 경로. 루트는 ''. URL은 `/path/`(trailingSlash always는 step6 책임). */
  path: string;
  /** 자식 폴더(이름 alphabetical, 안정적). */
  children: FolderNode[];
  /** 이 폴더에 직접 속한 publishable 노트(슬러그 alphabetical, 안정적). */
  notes: { slug: string; title: string }[];
}
