/**
 * Props for `<AboutPage />` — the editorial portrait at `/about/`.
 *
 * Mirrors the Zod schemas in `@noteforge/core/config` (`siteSchema` +
 * `aboutSchema`). The theme cannot import Zod runtime types without
 * dragging that dep into every consumer, so the contract is duplicated at
 * the prop boundary.
 *
 * `about` is independently optional: if the user has not set `site.about` at
 * all, the page still renders a meaningful identity (avatar + nickname +
 * social). Each `bio[]` / `highlights[]` entry is non-empty by schema.
 */
export interface AboutIdentity {
  /** `site.author` — the canonical real-name string. */
  author: string;
  /** Optional display nickname. Falls back to `author` for the header. */
  nickname?: string;
  /** Already-validated relative avatar path. */
  avatar?: string;
  /** Opt-in social channels (presence-based, mirrors `<SocialLinks />`). */
  social?: { github?: string; email?: string };
}

export interface AboutContent {
  /** One-line strapline shown beneath the identity block. */
  headline?: string;
  /** Bio paragraphs, in render order. Each string is one `<p>`. */
  bio: readonly string[];
  /** Mono-uppercase chips below the bio. */
  highlights: readonly string[];
}

export interface AboutPageProps {
  identity: AboutIdentity;
  /** Optional structured-content block. Whole block may be undefined. */
  about?: AboutContent;
}
