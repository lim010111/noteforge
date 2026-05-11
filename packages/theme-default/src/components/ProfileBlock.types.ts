/**
 * View-model for `<ProfileBlock />` — sidebar identity section above
 * FolderTree. Successor to AvatarBlock (v0.3) with three-input render matrix
 * and an avatar that links to `/about/`.
 *
 * Props are all optional. The component renders **nothing** when all three
 * are missing (no wrapper, no placeholder, no silhouette). An empty card
 * would itself disclose "this site has an author who chose not to set X" —
 * the same privacy contract AvatarBlock enforced, broadened to cover the
 * GitHub input as well.
 *
 * `avatarSrc` is treated as already validated by `siteSchema` (relative
 * path, external host blocked); the component does not re-derive that
 * policy. `github` mirrors the three-state contract of
 * `SocialLinksProps.github`:
 *   - `undefined` → channel hidden (no DOM remnant)
 *   - `''`        → "needs setup" stub icon (onboarding affordance)
 *   - `<url>`     → live outbound anchor
 *
 * Email is **deliberately not threaded** through this surface. The sidebar's
 * social slot is GitHub-only by design; the full social row (mail included)
 * stays on `/about/`.
 */
export interface ProfileBlockProps {
  /** Already-validated relative URL of the avatar image. */
  avatarSrc?: string;
  /** Author display name (already chosen by the route — typically `nickname || author`). */
  nickname?: string;
  /** GitHub channel value; same three-state contract as `SocialLinksProps.github`. */
  github?: string;
}
