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

    it('replaces spaces with dashes within a segment', () => {
      expect(computeSlug(input({ relativePath: 'Hello World.md' }))).toBe('hello-world');
    });

    it('handles spaces in folder names', () => {
      expect(computeSlug(input({ relativePath: 'My Projects/First Post.md' }))).toBe(
        'my-projects/first-post',
      );
    });

    it('collapses consecutive spaces to a single dash', () => {
      expect(computeSlug(input({ relativePath: 'Hello   World.md' }))).toBe('hello-world');
    });

    it('preserves Korean characters by default', () => {
      expect(computeSlug(input({ relativePath: '한글 노트.md' }))).toBe('한글-노트');
    });

    it('preserves Korean in nested folders', () => {
      expect(computeSlug(input({ relativePath: '프로젝트/첫 글.md' }))).toBe('프로젝트/첫-글');
    });

    it('strips leading ./', () => {
      expect(computeSlug(input({ relativePath: './foo.md' }))).toBe('foo');
    });

    it('treats .markdown the same as .md', () => {
      expect(computeSlug(input({ relativePath: 'foo.markdown' }))).toBe('foo');
    });

    it('trims trailing dashes from segments', () => {
      expect(computeSlug(input({ relativePath: 'Hello .md' }))).toBe('hello');
    });

    it('removes leading dashes from segments', () => {
      expect(computeSlug(input({ relativePath: ' Hello.md' }))).toBe('hello');
    });
  });
});
