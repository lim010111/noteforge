import { describe, expect, it } from 'vitest';
import {
  buildWikilinkIndex,
  parseWikilinkTarget,
  resolveWikilink,
} from '../src/resolve/wikilink.ts';
import type { IndexedNote } from '../src/resolve/wikilink.ts';

function n(relativePath: string, aliases: readonly string[] = []): IndexedNote {
  const basename = (relativePath.split('/').pop() ?? '').replace(/\.md$/, '');
  return { id: relativePath, relativePath, basename, aliases };
}

describe('parseWikilinkTarget', () => {
  it('parses a bare target', () => {
    expect(parseWikilinkTarget('Foo')).toEqual({ target: 'Foo', alias: undefined });
  });

  it('parses an aliased target', () => {
    expect(parseWikilinkTarget('Foo|Display')).toEqual({ target: 'Foo', alias: 'Display' });
  });

  it('parses a heading fragment', () => {
    expect(parseWikilinkTarget('Foo#Heading Name')).toEqual({
      target: 'Foo',
      heading: 'Heading Name',
      alias: undefined,
    });
  });

  it('parses a block reference', () => {
    expect(parseWikilinkTarget('Foo#^abc123')).toEqual({
      target: 'Foo',
      blockId: 'abc123',
      alias: undefined,
    });
  });

  it('parses target + heading + alias', () => {
    expect(parseWikilinkTarget('Foo#Section|As Shown')).toEqual({
      target: 'Foo',
      heading: 'Section',
      alias: 'As Shown',
    });
  });

  it('trims whitespace around parts', () => {
    expect(parseWikilinkTarget('  Foo  |  Shown  ')).toEqual({
      target: 'Foo',
      alias: 'Shown',
    });
  });
});

describe('resolveWikilink', () => {
  const index = buildWikilinkIndex([
    n('projects/foo.md'),
    n('archive/foo.md'),
    n('unique.md', ['구이름', 'Old Name']),
    n('Projects/Another Public.md'),
    n('nested/deep/BlockNote.md'),
  ]);

  describe('basename match', () => {
    it('resolves by exact lowercase basename when unique', () => {
      const result = resolveWikilink('unique', index);
      expect(result.resolved).toBe(true);
      expect(result.note?.relativePath).toBe('unique.md');
      expect(result.matchedBy).toBe('basename');
    });

    it('is case-insensitive on basename', () => {
      const result = resolveWikilink('UNIQUE', index);
      expect(result.resolved).toBe(true);
      expect(result.note?.relativePath).toBe('unique.md');
    });

    it('resolves basename with spaces', () => {
      const result = resolveWikilink('Another Public', index);
      expect(result.resolved).toBe(true);
      expect(result.note?.relativePath).toBe('Projects/Another Public.md');
    });
  });

  describe('path match (for disambiguation)', () => {
    it('resolves by full path when basename is ambiguous', () => {
      const result = resolveWikilink('archive/foo', index);
      expect(result.resolved).toBe(true);
      expect(result.note?.relativePath).toBe('archive/foo.md');
      expect(result.matchedBy).toBe('path');
    });

    it('resolves by full path with .md suffix', () => {
      const result = resolveWikilink('archive/foo.md', index);
      expect(result.resolved).toBe(true);
      expect(result.note?.relativePath).toBe('archive/foo.md');
    });

    it('disambiguates via shortest path when basename has multiple candidates and no path given', () => {
      // projects/foo.md and archive/foo.md both exist. Default: pick lex-first to be stable.
      const result = resolveWikilink('foo', index);
      expect(result.resolved).toBe(true);
      // Both are length 14. Lex-first: "archive/foo.md" < "projects/foo.md"
      expect(result.note?.relativePath).toBe('archive/foo.md');
    });
  });

  describe('alias match', () => {
    it('resolves by alias (Korean)', () => {
      const result = resolveWikilink('구이름', index);
      expect(result.resolved).toBe(true);
      expect(result.note?.relativePath).toBe('unique.md');
      expect(result.matchedBy).toBe('alias');
    });

    it('is case-insensitive on alias', () => {
      const result = resolveWikilink('old name', index);
      expect(result.resolved).toBe(true);
      expect(result.note?.relativePath).toBe('unique.md');
    });
  });

  describe('non-existent', () => {
    it('returns resolved: false for unknown target', () => {
      const result = resolveWikilink('NonExistent', index);
      expect(result.resolved).toBe(false);
      expect(result.note).toBeUndefined();
      expect(result.matchedBy).toBe('none');
    });
  });

  describe('heading/block passthrough', () => {
    it('passes heading fragment through to the result', () => {
      const result = resolveWikilink('unique#Section', index);
      expect(result.resolved).toBe(true);
      expect(result.heading).toBe('Section');
    });

    it('passes block id through to the result', () => {
      const result = resolveWikilink('BlockNote#^xyz', index);
      expect(result.resolved).toBe(true);
      expect(result.blockId).toBe('xyz');
    });

    it('preserves display alias for rendering', () => {
      const result = resolveWikilink('unique|구이름 대체', index);
      expect(result.resolved).toBe(true);
      expect(result.alias).toBe('구이름 대체');
    });
  });
});
