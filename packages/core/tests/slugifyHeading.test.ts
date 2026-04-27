/**
 * Pin the contract that `slugifyHeadingFragment` is the single source of truth
 * for heading-fragment slugs across the pipeline. Two surfaces must agree:
 *
 *   1. `pipeline.ts` `hrefFor` — emits `/note#fragment` URLs for [[Note#H]].
 *   2. `htmlFromMdast.ts` rehype-slug — stamps `id="fragment"` onto headings.
 *
 * Before this helper existed, surface (1) used a naïve lowercase + space→dash
 * replace, while surface (2) used github-slugger. Plain-ASCII headings worked,
 * but punctuation/special-character headings produced anchors that pointed
 * nowhere ("Hello, World!" → href "#hello,-world!" vs id "hello-world").
 *
 * The cases below are the punctuation/special-char families that previously
 * diverged. If the helper ever drifts from rehype-slug's algorithm again,
 * these break before users encounter dead anchors.
 */

import { describe, expect, it } from 'vitest';
import { slugifyHeadingFragment } from '../src/render/slugifyHeading.ts';

describe('slugifyHeadingFragment', () => {
  it('lowercases plain ASCII headings (matches simple cases unchanged)', () => {
    expect(slugifyHeadingFragment('Hello World')).toBe('hello-world');
  });

  it('strips trailing punctuation from heading text', () => {
    // Old naïve impl produced "hello,-world!" — broken anchor.
    expect(slugifyHeadingFragment('Hello, World!')).toBe('hello-world');
  });

  it('drops dots inside identifiers (api: v1.0 family)', () => {
    // Old naïve impl produced "api:-v1.0" — broken anchor.
    expect(slugifyHeadingFragment('API: v1.0')).toBe('api-v10');
  });

  it('preserves Korean text (CJK passes through unchanged)', () => {
    expect(slugifyHeadingFragment('한국어 제목')).toBe('한국어-제목');
  });

  it('is deterministic — repeated calls return the same slug (no occurrence tracking)', () => {
    // The helper uses the stateless `slug` export, NOT the `BananaSlug` class.
    // Repeated calls must NOT append "-1", "-2", … because the wikilink
    // rewriter and rehype-slug are independent passes; if they tracked
    // occurrence counts separately, identical headings would produce
    // mismatched fragments.
    expect(slugifyHeadingFragment('Section')).toBe('section');
    expect(slugifyHeadingFragment('Section')).toBe('section');
    expect(slugifyHeadingFragment('Section')).toBe('section');
  });
});
