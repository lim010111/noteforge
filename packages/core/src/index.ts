// Public package seam for `@noteforge/core`. External callers (the Astro
// integration, the CLI, future MCP server) MUST import from this barrel —
// not from internal subpaths. The corresponding ESLint rule pins this down.

// Config
export {
  defineConfig,
  obpubConfigSchema,
  ObpubConfigError,
  getClassifyRule,
  type ObpubConfig,
  type ObpubConfigInput,
} from './config.ts';

// Pipeline (orchestrator)
export {
  runCorePipeline,
  type PipelineResult,
  type PipelineWarning,
  type PublicGraph,
  type PublicGraphEdge,
} from './pipeline.ts';

// Aliases (resolution + redirects)
export {
  buildAliasRedirects,
  type AliasRedirect,
  type AliasMapResult,
} from './aliases/buildAliasMap.ts';

// Discover (parse a single file)
export { parseNote, type ParseNoteInput } from './discover/parseNote.ts';
export type { ParsedNote, ClassifyRule, Classification, Tag } from './types.ts';

// Slug
export { computeSlug, slugifySegment, type SlugInput, type SlugOptions } from './slug.ts';

// Privacy seams that external callers compose with their own pipelines
export { classify } from './privacy/classify.ts';
export { isPublishable } from './privacy/publishable.ts';
export { resolvePublicImageFrontmatter } from './privacy/imageFrontmatterResolver.ts';
export {
  rewriteWikilinks,
  type RewriteWikilinksOptions,
  type RewriteWikilinksResult,
  type OutgoingLink,
  type LinkStatus,
} from './privacy/linkRewriter.ts';

// VaultIndex — the canonical answer to "what notes exist + how do they reference each other".
// Two adapters of one snapshot shape (one-shot for `pipeline.ts`, incremental for the dev watcher).
export { buildVaultIndex } from './vaultIndex/buildVaultIndex.ts';
export { createIncrementalVaultIndex } from './vaultIndex/createIncrementalVaultIndex.ts';
export type {
  VaultIndexInput,
  VaultIndexSnapshot,
  IncrementalVaultIndex,
  IncrementalVaultIndexOptions,
} from './vaultIndex/types.ts';

// renderPublicNote — per-note privacy render unit.
export {
  renderPublicNote,
  type RenderPublicNoteInput,
  type RenderedNote,
} from './render/renderPublicNote.ts';
export type { NoteHeading } from './render/htmlFromMdast.ts';
