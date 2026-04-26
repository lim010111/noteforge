import { describe, expect, it } from 'vitest';
import { buildAliasRedirects } from '../../src/aliases/buildAliasMap.ts';
import type { IndexedNote } from '../../src/resolve/wikilink.ts';

function n(
  id: string,
  aliases: readonly string[] = [],
  overrides: Partial<IndexedNote> = {},
): IndexedNote {
  const relativePath = overrides.relativePath ?? `${id}.md`;
  const basename = overrides.basename ?? (relativePath.split('/').pop() ?? '').replace(/\.md$/, '');
  return { id, relativePath, basename, aliases };
}

describe('buildAliasRedirects', () => {
  it('emits a single redirect for a clean 1:1 alias', () => {
    const result = buildAliasRedirects([n('projects/foo', ['legacy-foo'])]);
    expect(result.redirects).toEqual([
      { from: 'legacy-foo', to: 'projects/foo', noteId: 'projects/foo' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('skips an alias that collides with another note slug, with a warning', () => {
    const result = buildAliasRedirects([
      n('projects/foo', ['bar']),
      n('bar'),
    ]);
    expect(result.redirects).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    const [warn] = result.warnings;
    expect(warn).toContain("'bar'");
    expect(warn).toContain("'projects/foo'");
    expect(warn).toContain("'bar'"); // also the otherId
  });

  it('silently skips an alias that equals the note own slug', () => {
    const result = buildAliasRedirects([n('projects/foo', ['projects/foo'])]);
    expect(result.redirects).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('preserves Korean alias verbatim (lowercase no-op on hangul)', () => {
    const result = buildAliasRedirects([n('새이름', ['옛이름'])]);
    expect(result.redirects).toEqual([
      { from: '옛이름', to: '새이름', noteId: '새이름' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('lowercases and dashes whitespace in alias', () => {
    const result = buildAliasRedirects([n('projects/foo', ['Old Name'])]);
    expect(result.redirects).toEqual([
      { from: 'old-name', to: 'projects/foo', noteId: 'projects/foo' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('preserves slashes between alias segments while slugifying each segment', () => {
    const result = buildAliasRedirects([n('projects/foo', ['Old/Path Name'])]);
    expect(result.redirects).toEqual([
      { from: 'old/path-name', to: 'projects/foo', noteId: 'projects/foo' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('keeps the first declarer when two notes claim the same alias and warns about the loser', () => {
    const result = buildAliasRedirects([
      n('a-note', ['shared']),
      n('b-note', ['shared']),
    ]);
    expect(result.redirects).toEqual([
      { from: 'shared', to: 'a-note', noteId: 'a-note' },
    ]);
    expect(result.warnings).toHaveLength(1);
    const [warn] = result.warnings;
    expect(warn).toContain("'shared'");
    expect(warn).toContain("'a-note'");
    expect(warn).toContain("'b-note'");
  });

  it('handles missing/empty alias declarations and warns only on empty entries', () => {
    const result = buildAliasRedirects([
      n('no-alias-array'),
      n('empty-array', []),
      n('with-empty', ['', '   ', 'real-alias']),
    ]);
    expect(result.redirects).toEqual([
      { from: 'real-alias', to: 'with-empty', noteId: 'with-empty' },
    ]);
    expect(result.warnings).toHaveLength(2);
    for (const w of result.warnings) {
      expect(w).toContain("'with-empty'");
    }
  });
});
