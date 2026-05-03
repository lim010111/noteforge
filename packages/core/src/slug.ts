export interface SlugInput {
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly relativePath: string;
}

export interface SlugOptions {
  /**
   * Strategy for deriving slugs when `frontmatter.permalink` / `frontmatter.slug`
   * are absent.
   *
   * - `'folder'` (default when omitted): use the full vault relative path,
   *   slugified per segment. Preserves backward-compatible behavior.
   * - `'category'`: use `<slugified frontmatter.category>/<slugified filename>`.
   *   The vault folder hierarchy above the filename is dropped so URLs reflect
   *   the user-curated category, not the on-disk layout. If `category` is
   *   missing/blank/non-string, only the filename is used.
   */
  readonly mode?: 'folder' | 'category';
}

const MARKDOWN_EXT_RE = /\.(md|markdown)$/i;

/**
 * Compute the canonical URL slug for a note. Does NOT resolve collisions; that is handled
 * upstream after all notes are known.
 *
 * Priority (regardless of mode):
 *   1. frontmatter.permalink (string)
 *   2. frontmatter.slug (string)
 *
 * Then, when explicit overrides are absent:
 *   - mode 'folder' (default): derive from relativePath (vault hierarchy preserved)
 *   - mode 'category': derive as `<frontmatter.category>/<filename>`; falls back
 *     to filename-only when category is missing
 *
 * The returned slug is normalized (lowercased, spaces→dashes, .md stripped) but preserves
 * non-ASCII characters (Korean/Japanese/etc.). URL-encoding happens at render time.
 */
export function computeSlug(input: SlugInput, options?: SlugOptions): string {
  const permalink = input.frontmatter['permalink'];
  if (typeof permalink === 'string' && permalink.trim().length > 0) {
    return trimSlashes(permalink.trim());
  }

  const explicitSlug = input.frontmatter['slug'];
  if (typeof explicitSlug === 'string' && explicitSlug.trim().length > 0) {
    return trimSlashes(explicitSlug.trim());
  }

  if (options?.mode === 'category') {
    return fromCategory(input.frontmatter['category'], input.relativePath);
  }

  return fromPath(input.relativePath);
}

function fromPath(relativePath: string): string {
  const cleaned = relativePath
    .replace(/^\.\//, '')
    .replace(MARKDOWN_EXT_RE, '');

  const segments = cleaned.split('/').map(slugifySegment).filter((s) => s.length > 0);
  return segments.join('/');
}

function fromCategory(rawCategory: unknown, relativePath: string): string {
  const cleaned = relativePath
    .replace(/^\.\//, '')
    .replace(MARKDOWN_EXT_RE, '');
  const lastSegment = cleaned.split('/').pop() ?? '';
  const fileSlug = slugifySegment(lastSegment);

  const categorySegments =
    typeof rawCategory === 'string'
      ? rawCategory.split('/').map(slugifySegment).filter((s) => s.length > 0)
      : [];

  if (categorySegments.length === 0) return fileSlug;
  if (fileSlug.length === 0) return categorySegments.join('/');
  return [...categorySegments, fileSlug].join('/');
}

export function slugifySegment(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}
