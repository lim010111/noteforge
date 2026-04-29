import { describe, expect, it } from 'vitest';
import {
  assertNoAliasCollisions,
  assertNoFolderCollisions,
} from './routeCollisions.ts';

describe('assertNoAliasCollisions', () => {
  it('does not throw when alias slugs are disjoint from note slugs', () => {
    expect(() =>
      assertNoAliasCollisions(new Set(['posts/a', 'posts/b']), [
        { slug: 'legacy-name', to: 'posts/a' },
      ]),
    ).not.toThrow();
  });

  it('throws when an alias would overwrite a note slug', () => {
    expect(() =>
      assertNoAliasCollisions(new Set(['posts']), [
        { slug: 'posts', to: 'posts/new' },
      ]),
    ).toThrow(/route collision: alias 'posts'/);
  });

  it('throw message includes the file-path trailer for navigability', () => {
    try {
      assertNoAliasCollisions(new Set(['x']), [{ slug: 'x', to: 'y' }]);
      expect.fail('expected throw');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('apps/blog/src/pages/[...slug].astro');
      expect(msg).toContain("would overwrite a note slug");
      expect(msg).toContain("Resolve in vault frontmatter before building");
    }
  });
});

describe('assertNoFolderCollisions', () => {
  it('does not throw when folder slugs do not collide with claimed routes', () => {
    expect(() =>
      assertNoFolderCollisions(new Set(['about']), [{ slug: 'AI/Claude' }]),
    ).not.toThrow();
  });

  it('throws when a folder slug collides with an existing note slug', () => {
    expect(() =>
      assertNoFolderCollisions(new Set(['posts']), [{ slug: 'posts' }]),
    ).toThrow(/route collision: folder 'posts\/'/);
  });

  it('throws when a folder slug collides with an existing alias slug', () => {
    // aliases land in `claimed` alongside notes — the folder guard treats
    // either origin the same way.
    expect(() =>
      assertNoFolderCollisions(new Set(['legacy', 'posts']), [
        { slug: 'legacy' },
      ]),
    ).toThrow(/route collision: folder 'legacy\/'/);
  });

  it('throw message names the folder path with trailing slash + file trailer', () => {
    try {
      assertNoFolderCollisions(new Set(['AI']), [{ slug: 'AI' }]);
      expect.fail('expected throw');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("folder 'AI/'");
      expect(msg).toContain('shares its slug with an existing note or alias');
      expect(msg).toContain('apps/blog/src/pages/[...slug].astro');
    }
  });

  it('parallels the alias throw format (same trailer + same file path)', () => {
    let aliasMsg = '';
    let folderMsg = '';
    try {
      assertNoAliasCollisions(new Set(['x']), [{ slug: 'x', to: 'y' }]);
    } catch (e) {
      aliasMsg = (e as Error).message;
    }
    try {
      assertNoFolderCollisions(new Set(['x']), [{ slug: 'x' }]);
    } catch (e) {
      folderMsg = (e as Error).message;
    }
    const trailer = '(apps/blog/src/pages/[...slug].astro)';
    expect(aliasMsg).toContain(trailer);
    expect(folderMsg).toContain(trailer);
    expect(aliasMsg.startsWith('[...slug] route collision:')).toBe(true);
    expect(folderMsg.startsWith('[...slug] route collision:')).toBe(true);
  });
});
