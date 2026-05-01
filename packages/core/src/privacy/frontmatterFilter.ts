/**
 * Filter a note's frontmatter down to an allowlist of keys.
 *
 * The returned object is the ONLY frontmatter representation permitted to flow into
 * rendered HTML / meta / JSON-LD / OG. privacy-first: keys outside the allowlist —
 * including ones the author forgot to declare — never reach public output.
 *
 * Matching is two-pass per allowlisted key:
 *   1. Exact (case-sensitive) match wins. This preserves authoring intent when
 *      the canonical key is present.
 *   2. Otherwise a case-insensitive fallback maps variants like `Date:` /
 *      `DATE:` to the canonical (lowercase) allowlist key. Obsidian's Property
 *      panel preserves the user's typed casing, so without this fallback notes
 *      authored as `Date: 2026-05-01` would silently lose their date in the
 *      rendered output. Only the *first* matching variant is kept; the result
 *      is keyed by the canonical (allowlisted) form so consumers always read a
 *      stable shape (e.g. `frontmatter['date']`).
 *
 * Critically the case-insensitive pass only relaxes the casing of *allowlisted*
 * semantic fields — it never lets a non-allowlisted key (e.g. `Mood`) through.
 *
 * A key whose value is `undefined` is treated as absent and dropped; an explicit
 * `null` is preserved (author intent).
 */
export function filterFrontmatter(
  frontmatter: Readonly<Record<string, unknown>>,
  allowlist: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const allowedKey of allowlist) {
    if (Object.prototype.hasOwnProperty.call(frontmatter, allowedKey)) {
      const value = frontmatter[allowedKey];
      if (value !== undefined) out[allowedKey] = value;
      continue;
    }
    const lower = allowedKey.toLowerCase();
    for (const fmKey of Object.keys(frontmatter)) {
      if (fmKey.toLowerCase() === lower) {
        const value = frontmatter[fmKey];
        if (value !== undefined) out[allowedKey] = value;
        break;
      }
    }
  }
  return out;
}
