import { describe, expect, it } from 'vitest';
import { computeSlug } from '../src/slug.ts';

function input(overrides: { frontmatter?: Record<string, unknown>; relativePath: string }) {
  return {
    frontmatter: overrides.frontmatter ?? {},
    relativePath: overrides.relativePath,
  };
}

describe('computeSlug', () => {
  describe('explicit overrides', () => {
    it('uses frontmatter.permalink when present', () => {
      expect(
        computeSlug(input({ frontmatter: { permalink: 'custom/path' }, relativePath: 'a/b.md' })),
      ).toBe('custom/path');
    });

    it('strips leading slash from permalink', () => {
      expect(
        computeSlug(input({ frontmatter: { permalink: '/foo/bar' }, relativePath: 'a.md' })),
      ).toBe('foo/bar');
    });

    it('strips trailing slash from permalink', () => {
      expect(
        computeSlug(input({ frontmatter: { permalink: '/foo/bar/' }, relativePath: 'a.md' })),
      ).toBe('foo/bar');
    });

    it('uses frontmatter.slug when permalink is absent', () => {
      expect(
        computeSlug(input({ frontmatter: { slug: 'short-name' }, relativePath: 'deep/path.md' })),
      ).toBe('short-name');
    });

    it('permalink wins over slug when both present', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { permalink: 'win', slug: 'lose' },
            relativePath: 'a.md',
          }),
        ),
      ).toBe('win');
    });

    it('ignores non-string permalink/slug', () => {
      expect(
        computeSlug(input({ frontmatter: { permalink: 42 }, relativePath: 'a.md' })),
      ).toBe('a');
    });
  });

  describe('path-based generation', () => {
    it('strips .md extension', () => {
      expect(computeSlug(input({ relativePath: 'foo.md' }))).toBe('foo');
    });

    it('preserves folder hierarchy', () => {
      expect(computeSlug(input({ relativePath: 'Projects/Foo.md' }))).toBe('projects/foo');
    });

    it('lowercases path segments', () => {
      expect(computeSlug(input({ relativePath: 'MyNotes/Important.md' }))).toBe(
        'mynotes/important',
      );
    });

    it('preserves spaces within a segment', () => {
      expect(computeSlug(input({ relativePath: 'Hello World.md' }))).toBe('hello world');
    });

    it('preserves spaces in folder names', () => {
      expect(computeSlug(input({ relativePath: 'My Projects/First Post.md' }))).toBe(
        'my projects/first post',
      );
    });

    it('collapses consecutive spaces to a single space', () => {
      expect(computeSlug(input({ relativePath: 'Hello   World.md' }))).toBe('hello world');
    });

    it('preserves Korean characters by default', () => {
      expect(computeSlug(input({ relativePath: '한글 노트.md' }))).toBe('한글 노트');
    });

    it('preserves Korean in nested folders', () => {
      expect(computeSlug(input({ relativePath: '프로젝트/첫 글.md' }))).toBe('프로젝트/첫 글');
    });

    it('strips leading ./', () => {
      expect(computeSlug(input({ relativePath: './foo.md' }))).toBe('foo');
    });

    it('treats .markdown the same as .md', () => {
      expect(computeSlug(input({ relativePath: 'foo.markdown' }))).toBe('foo');
    });

    it('trims trailing whitespace from segments', () => {
      expect(computeSlug(input({ relativePath: 'Hello .md' }))).toBe('hello');
    });

    it('trims leading whitespace from segments', () => {
      expect(computeSlug(input({ relativePath: ' Hello.md' }))).toBe('hello');
    });

    it('trims and collapses surrounding/internal whitespace together', () => {
      expect(computeSlug(input({ relativePath: '  Hello   World  .md' }))).toBe('hello world');
    });
  });

  describe("category mode (options.mode === 'category')", () => {
    it('prefixes filename with slugified category path', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { category: 'PEFT/LoRA' },
            relativePath: 'temp_drafts/LoRA 란.md',
          }),
          { mode: 'category' },
        ),
      ).toBe('peft/lora/lora 란');
    });

    it('uses filename only when category is missing (no vault-path leak)', () => {
      expect(
        computeSlug(
          input({ relativePath: 'temp_drafts/sub/Hello.md' }),
          { mode: 'category' },
        ),
      ).toBe('hello');
    });

    it('uses filename only when category is non-string', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { category: 42 },
            relativePath: 'temp_drafts/Hello.md',
          }),
          { mode: 'category' },
        ),
      ).toBe('hello');
    });

    it('uses filename only when category is blank', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { category: '   ' },
            relativePath: 'foo/Hello.md',
          }),
          { mode: 'category' },
        ),
      ).toBe('hello');
    });

    it('drops empty category segments and trims whitespace', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { category: 'A / / B / C ' },
            relativePath: 'x/y/Note.md',
          }),
          { mode: 'category' },
        ),
      ).toBe('a/b/c/note');
    });

    it('preserves Korean category segments', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { category: '에세이/2026' },
            relativePath: 'somewhere/첫 글.md',
          }),
          { mode: 'category' },
        ),
      ).toBe('에세이/2026/첫 글');
    });

    it('permalink wins over category mode', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { permalink: 'fixed/path', category: 'PEFT/LoRA' },
            relativePath: 'a/b.md',
          }),
          { mode: 'category' },
        ),
      ).toBe('fixed/path');
    });

    it('explicit slug wins over category mode', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { slug: 'short', category: 'PEFT/LoRA' },
            relativePath: 'a/b.md',
          }),
          { mode: 'category' },
        ),
      ).toBe('short');
    });

    it('category prefix uses last vault segment regardless of vault depth', () => {
      expect(
        computeSlug(
          input({
            frontmatter: { category: 'AI' },
            relativePath: 'a/b/c/d/Final Post.md',
          }),
          { mode: 'category' },
        ),
      ).toBe('ai/final post');
    });
  });

  describe('folder mode regression (default / explicit)', () => {
    it("default (no options) preserves existing vault-path behavior", () => {
      expect(
        computeSlug(
          input({
            frontmatter: { category: 'IGNORED/IN/FOLDER' },
            relativePath: 'Projects/Foo.md',
          }),
        ),
      ).toBe('projects/foo');
    });

    it("explicit mode='folder' ignores category", () => {
      expect(
        computeSlug(
          input({
            frontmatter: { category: 'IGNORED' },
            relativePath: 'Projects/Foo.md',
          }),
          { mode: 'folder' },
        ),
      ).toBe('projects/foo');
    });
  });
});
