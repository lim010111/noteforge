/**
 * resolvePublicImageFrontmatter — single decision point for frontmatter image
 * fields (`cover`, `thumbnail`).
 *
 * Returns the resolved value, or `undefined` if the input is not a publishable
 * image reference. Callers must treat `undefined` as "do not expose" — the
 * privacy contract (CLAUDE.md CRITICAL #1) requires the public/private decision
 * to live in exactly one place, and that place is here.
 *
 * Accepted shapes:
 *   - `https://…` / `http://…` URLs (passed through, surrounding whitespace
 *     trimmed). Scheme is matched case-insensitively.
 *   - `/foo/bar.png` paths NOT under `/attachments/` (passed through — the
 *     theme owns its own static assets and we do not gate them).
 *   - `/attachments/<id>` paths where `<id>` is in the closure of attachments
 *     reachable from public notes. Anything else under `/attachments/` is
 *     rejected so that private-only attachments cannot leak via frontmatter.
 *
 * Everything else (`data:`, `javascript:`, `file:`, `ftp:`, relative paths,
 * non-string inputs, blanks) returns `undefined`.
 */
export function resolvePublicImageFrontmatter(
  value: unknown,
  attachmentClosure: ReadonlySet<string>,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  if (cleaned === '') return undefined;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (!cleaned.startsWith('/')) return undefined;
  if (!cleaned.startsWith('/attachments/')) return cleaned;
  const id = cleaned.slice('/attachments/'.length);
  return attachmentClosure.has(id) ? cleaned : undefined;
}
