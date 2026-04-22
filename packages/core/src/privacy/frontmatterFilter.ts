/**
 * Filter a note's frontmatter down to an allowlist of keys.
 *
 * The returned object is the ONLY frontmatter representation permitted to flow into
 * rendered HTML / meta / JSON-LD / OG. privacy-first: keys outside the allowlist —
 * including ones the author forgot to declare — never reach public output.
 *
 * Matching is exact-string, case-sensitive. YAML keys are case-sensitive by spec,
 * so `title` and `Title` are distinct keys. A key whose value is `undefined` is
 * treated as absent and dropped; an explicit `null` is preserved (author intent).
 */
export function filterFrontmatter(
  frontmatter: Readonly<Record<string, unknown>>,
  allowlist: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowlist) {
    if (!Object.prototype.hasOwnProperty.call(frontmatter, key)) continue;
    const value = frontmatter[key];
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}
