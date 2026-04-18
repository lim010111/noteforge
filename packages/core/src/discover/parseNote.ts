import matter from 'gray-matter';
import { stripObsidianComments } from '../privacy/commentStrip.ts';
import { normalizeTags } from '../tags.ts';
import type { ParsedNote } from '../types.ts';

export interface ParseNoteInput {
  /** Absolute filesystem path. */
  readonly path: string;
  /** Config vault id this note belongs to. */
  readonly vaultId: string;
  /** Vault-relative POSIX path, no leading slash. */
  readonly relativePath: string;
  /** Raw UTF-8 content (BOM permitted). */
  readonly content: string;
}

const BOM = '\uFEFF';

/**
 * End-to-end note parser: BOM strip → `%%...%%` comment removal →
 * YAML frontmatter parse → tag normalization. Pure function — does no I/O.
 * Malformed YAML is absorbed to `{}` with a console.warn so one bad file
 * cannot fail an entire build.
 */
export function parseNote(input: ParseNoteInput): ParsedNote {
  const raw = input.content.startsWith(BOM) ? input.content.slice(BOM.length) : input.content;
  const stripped = stripObsidianComments(raw);

  let frontmatter: Record<string, unknown>;
  let body: string;
  try {
    const parsed = matter(stripped);
    frontmatter = { ...(parsed.data as Record<string, unknown>) };
    body = parsed.content;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(
      `[obpub] frontmatter parse failed for ${input.relativePath}: ${reason}. Treating frontmatter as empty.`,
    );
    frontmatter = {};
    body = stripped;
  }

  const tags = normalizeTags(frontmatter['tags'], body);

  return Object.freeze({
    path: input.path,
    vaultId: input.vaultId,
    relativePath: input.relativePath,
    frontmatter: Object.freeze(frontmatter),
    tags: Object.freeze(tags),
    body,
  });
}
