/**
 * Single source of truth for in-page heading-fragment slugs.
 *
 * Why this module exists: rehype-slug stamps `id` attributes onto rendered
 * `<h2>`-`<h4>` elements (see `htmlFromMdast.ts`), while the wikilink rewriter
 * needs to emit matching `#fragment` URLs from `[[Note#Heading]]` syntax (see
 * `pipeline.ts` `hrefFor`). If those two sides drift, simple ASCII headings
 * silently work while punctuation/special-character headings produce broken
 * anchors. So both call sites delegate here.
 *
 * The implementation forwards to `github-slugger`, which is the same algorithm
 * `rehype-slug` uses internally — keeping the dependency direct (rather than
 * relying on transitive hoist) means a future major bump of rehype-slug cannot
 * silently desync the two surfaces.
 *
 * Note that this is FRAGMENT slugging (heading text → `#section-id`), distinct
 * from the ROUTING slug in `core/src/slug.ts` (vault filename → URL path). They
 * intentionally use different algorithms — see the long comment at the top of
 * `htmlFromMdast.ts` for why.
 */

import { slug as githubSlug } from 'github-slugger';

export function slugifyHeadingFragment(heading: string): string {
  return githubSlug(heading);
}
