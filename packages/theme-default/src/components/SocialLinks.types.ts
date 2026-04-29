/**
 * Field-level props for `<SocialLinks />`.
 *
 * Both fields are optional and **presence-based**: omit the prop and that
 * channel is not rendered. When both are absent the component renders
 * nothing (no wrapper, no whitespace) — see SocialLinks.astro.
 *
 * Mirrors the Zod `socialSchema` in `@noteforge/core/config`. The theme
 * cannot import from core for runtime types (Zod would become a build
 * dep of every consumer), so the contract is duplicated at the prop
 * boundary.
 */
export interface SocialLinksProps {
  /** Full URL to the blogger's GitHub profile, e.g. `https://github.com/<user>`. */
  github?: string;
  /** Bare email address; the component prepends `mailto:` at render time. */
  email?: string;
}
