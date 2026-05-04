import { describe, expect, it } from 'vitest';
import { resolvePublicImageFrontmatter } from '../src/privacy/imageFrontmatterResolver.ts';

describe('resolvePublicImageFrontmatter', () => {
  const closure = new Set(['hero.png', 'sub/dir/banner.jpg']);

  it('returns undefined for non-string input', () => {
    expect(resolvePublicImageFrontmatter(undefined, closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter(null, closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter(42, closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter({ url: 'hero.png' }, closure)).toBeUndefined();
  });

  it('returns undefined for empty / whitespace-only strings', () => {
    expect(resolvePublicImageFrontmatter('', closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter('   ', closure)).toBeUndefined();
  });

  it('passes http(s):// URLs through after trimming surrounding whitespace', () => {
    expect(resolvePublicImageFrontmatter('https://cdn.example.com/x.png', closure)).toBe(
      'https://cdn.example.com/x.png',
    );
    expect(resolvePublicImageFrontmatter('http://example.com/x.png', closure)).toBe(
      'http://example.com/x.png',
    );
    expect(resolvePublicImageFrontmatter('  https://cdn.example.com/x.png  ', closure)).toBe(
      'https://cdn.example.com/x.png',
    );
    expect(resolvePublicImageFrontmatter('HTTPS://Cdn.Example.com/x.png', closure)).toBe(
      'HTTPS://Cdn.Example.com/x.png',
    );
  });

  it('rejects values that are neither absolute http(s) nor root-rooted paths', () => {
    expect(resolvePublicImageFrontmatter('relative/path.png', closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter('./hero.png', closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter('hero.png', closure)).toBeUndefined();
  });

  it('passes non-/attachments root paths through (caller controls non-vault publics)', () => {
    expect(resolvePublicImageFrontmatter('/static/hero.png', closure)).toBe('/static/hero.png');
    expect(resolvePublicImageFrontmatter('/og/cover.jpg', closure)).toBe('/og/cover.jpg');
  });

  it('accepts /attachments/<id> only when id is in the closure', () => {
    expect(resolvePublicImageFrontmatter('/attachments/hero.png', closure)).toBe(
      '/attachments/hero.png',
    );
    expect(resolvePublicImageFrontmatter('/attachments/sub/dir/banner.jpg', closure)).toBe(
      '/attachments/sub/dir/banner.jpg',
    );
  });

  it('rejects /attachments/<id> when id is not in the closure (privacy gate)', () => {
    expect(resolvePublicImageFrontmatter('/attachments/private.png', closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter('/attachments/sub/dir/secret.jpg', closure)).toBeUndefined();
  });

  it('rejects data: URIs (defense-in-depth — never used by valid frontmatter)', () => {
    expect(
      resolvePublicImageFrontmatter('data:image/png;base64,iVBORw0KGgo=', closure),
    ).toBeUndefined();
  });

  it('rejects javascript: and other non-http schemes', () => {
    expect(resolvePublicImageFrontmatter('javascript:alert(1)', closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter('file:///etc/passwd', closure)).toBeUndefined();
    expect(resolvePublicImageFrontmatter('ftp://example.com/x.png', closure)).toBeUndefined();
  });

  it('handles an empty closure as if every /attachments/* were unknown', () => {
    const empty = new Set<string>();
    expect(resolvePublicImageFrontmatter('/attachments/anything.png', empty)).toBeUndefined();
    expect(resolvePublicImageFrontmatter('https://cdn.example.com/x.png', empty)).toBe(
      'https://cdn.example.com/x.png',
    );
  });
});
