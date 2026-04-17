export interface SlugInput {
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly relativePath: string;
}

const MARKDOWN_EXT_RE = /\.(md|markdown)$/i;

/**
 * Compute the canonical URL slug for a note. Does NOT resolve collisions; that is handled
 * upstream after all notes are known.
 *
 * Priority:
 *   1. frontmatter.permalink (string)
 *   2. frontmatter.slug (string)
 *   3. derived from relativePath
 *
 * The returned slug is normalized (lowercased, spaces→dashes, .md stripped) but preserves
 * non-ASCII characters (Korean/Japanese/etc.). URL-encoding happens at render time.
 */
export function computeSlug(input: SlugInput): string {
  const permalink = input.frontmatter['permalink'];
  if (typeof permalink === 'string' && permalink.trim().length > 0) {
    return trimSlashes(permalink.trim());
  }

  const explicitSlug = input.frontmatter['slug'];
  if (typeof explicitSlug === 'string' && explicitSlug.trim().length > 0) {
    return trimSlashes(explicitSlug.trim());
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

function slugifySegment(segment: string): string {
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
