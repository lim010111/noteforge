/**
 * View-model for `<AvatarBlock />`.
 *
 * Props are deliberately optional: when **both** are missing the component
 * renders nothing (no placeholder, no silhouette, no "Anonymous" copy).
 * Empty-slot leakage is the privacy contract — a placeholder signals
 * "someone is here but hidden", which we refuse on principle.
 *
 * `avatarSrc` is treated as already validated by `siteSchema` (relative path,
 * external host blocked); the component does not re-derive that policy.
 */
export interface AvatarBlockProps {
  /** Already-validated relative URL of the avatar image. */
  avatarSrc?: string;
  /** Author display name. */
  nickname?: string;
}
