import type { Tag } from './types.ts';

const FENCED_BACKTICK_RE = /```[\s\S]*?```/g;
const FENCED_TILDE_RE = /~~~[\s\S]*?~~~/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;
const INLINE_TAG_RE = /(?<![\w`])#([A-Za-z][\w\-/]*)/g;

/**
 * Collect and normalize tags from YAML frontmatter and note body.
 * Output tags are lowercased, `#`-stripped, with nested form preserved (`a/b`).
 * Duplicates removed case-insensitively while preserving first-occurrence order
 * (frontmatter tags before body tags).
 */
export function normalizeTags(frontmatterTags: unknown, body: string): Tag[] {
  const seen = new Set<Tag>();
  const ordered: Tag[] = [];

  for (const raw of fromFrontmatter(frontmatterTags)) {
    push(raw);
  }

  const stripped = stripCode(body);
  for (const match of stripped.matchAll(INLINE_TAG_RE)) {
    const rawTag = match[1];
    if (rawTag !== undefined) push(rawTag);
  }

  return ordered;

  function push(raw: string): void {
    const cleaned = raw.replace(/^#+/, '').trim().toLowerCase();
    if (cleaned.length === 0) return;
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    ordered.push(cleaned);
  }
}

function fromFrontmatter(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return [];
}

function stripCode(body: string): string {
  return body
    .replace(FENCED_BACKTICK_RE, '')
    .replace(FENCED_TILDE_RE, '')
    .replace(INLINE_CODE_RE, '');
}
