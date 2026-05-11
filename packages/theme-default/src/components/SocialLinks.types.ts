/**
 * Field-level props for `<SocialLinks />`.
 *
 * `github` carries a three-state contract (see SocialLinks.astro):
 *   - field omitted    → channel hidden, no DOM remnant.
 *   - empty string ''  → "needs setup" stub icon + onboarding alert.
 *                        Used by the default `apps/blog/noteforge.config.ts`
 *                        so fork users discover the icon before configuring.
 *   - non-empty URL    → live outbound anchor.
 *
 * `email` is presence-based: omit (or empty string) hides it, any non-empty
 * value renders a `mailto:` anchor.
 *
 * Mirrors the Zod `socialSchema` in `@noteforge/core/config`. The theme
 * cannot import from core for runtime types (Zod would become a build dep
 * of every consumer), so the contract is duplicated at the prop boundary.
 */
export interface SocialLinksProps {
  /**
   * Full URL to the blogger's GitHub profile, e.g.
   * `https://github.com/<user>`. Pass an empty string to render the
   * "needs setup" stub instead of a live link, or omit the field entirely
   * to hide the channel.
   */
  github?: string;
  /** Bare email address; the component prepends `mailto:` at render time. */
  email?: string;
}
