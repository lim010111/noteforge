import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseNote } from '../src/discover/parseNote.ts';

const baseInput = {
  path: '/abs/vault/notes/example.md',
  vaultId: 'main',
  relativePath: 'notes/example.md',
};

describe('parseNote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty frontmatter and tags when input has no frontmatter and no tags', () => {
    const content = 'plain body text';
    const result = parseNote({ ...baseInput, content });
    expect(result.frontmatter).toEqual({});
    expect(result.tags).toEqual([]);
    expect(result.body).toBe('plain body text');
    expect(result.path).toBe(baseInput.path);
    expect(result.vaultId).toBe(baseInput.vaultId);
    expect(result.relativePath).toBe(baseInput.relativePath);
  });

  it('parses frontmatter and returns body without the fence', () => {
    const content = '---\npublic: true\n---\nbody';
    const result = parseNote({ ...baseInput, content });
    expect(result.frontmatter['public']).toBe(true);
    expect(result.body).toBe('body');
  });

  it('strips %% Obsidian comments from the body (no %% remains)', () => {
    const content = 'before %%비밀 메모%% after';
    const result = parseNote({ ...baseInput, content });
    expect(result.body).not.toContain('%%');
    expect(result.body).toBe('before  after');
  });

  it('removes the canary comment from the body (CLAUDE_COMMENT_LEAK_77b)', () => {
    const content = 'visible %%CLAUDE_COMMENT_LEAK_77b%% still visible';
    const result = parseNote({ ...baseInput, content });
    expect(result.body).not.toContain('CLAUDE_COMMENT_LEAK_77b');
    expect(result.body).not.toContain('%%');
  });

  it('merges frontmatter array tags with inline body #tag, lowercased with frontmatter first', () => {
    const content = '---\ntags: [foo, BAR]\n---\nhello #baz world';
    const result = parseNote({ ...baseInput, content });
    expect(result.tags).toEqual(['foo', 'bar', 'baz']);
  });

  it('does not harvest tags from inside fenced code blocks', () => {
    const content = '---\ntags: [real]\n---\n```\n#fake\n```\n';
    const result = parseNote({ ...baseInput, content });
    expect(result.tags).toEqual(['real']);
    expect(result.tags).not.toContain('fake');
  });

  it('handles UTF-8 BOM at the start of the input', () => {
    const content = '\uFEFF---\npublic: true\ntitle: BomNote\n---\nhi';
    const result = parseNote({ ...baseInput, content });
    expect(result.frontmatter['public']).toBe(true);
    expect(result.frontmatter['title']).toBe('BomNote');
    expect(result.body).toBe('hi');
  });

  it('falls back safely on malformed YAML and warns with relativePath', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const content = '---\ntitle: "unterminated\n---\n본문';
    const result = parseNote({ ...baseInput, content });
    expect(result.frontmatter).toEqual({});
    expect(result.body).toContain('본문');
    expect(result.body).toContain('---');
    expect(result.tags).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0] ?? '');
    expect(message).toContain(baseInput.relativePath);
  });

  it('preserves Korean frontmatter values verbatim', () => {
    const content = '---\ntitle: 안녕하세요\n---\n본문입니다';
    const result = parseNote({ ...baseInput, content });
    expect(result.frontmatter['title']).toBe('안녕하세요');
    expect(result.body).toBe('본문입니다');
  });

  it('normalizes a comma-separated frontmatter tags string', () => {
    const content = '---\ntags: "a, b, c"\n---\nbody';
    const result = parseNote({ ...baseInput, content });
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  it('freezes the frontmatter object so it cannot be mutated', () => {
    const content = '---\npublic: true\n---\nbody';
    const result = parseNote({ ...baseInput, content });
    expect(Object.isFrozen(result.frontmatter)).toBe(true);
    expect(() => {
      (result.frontmatter as Record<string, unknown>)['injected'] = 1;
    }).toThrow(TypeError);
    expect(result.frontmatter['injected']).toBeUndefined();
  });
});
