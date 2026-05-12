/**
 * Resolves the public-facing identity (avatar + nickname) from `site.*` with
 * an opt-in GitHub fallback. When the user leaves `site.avatar` or
 * `site.nickname` unset, we synthesize them from `site.social.github`:
 *
 *   - avatar   → `https://github.com/<username>.png` (GitHub's public CDN)
 *   - nickname → `<username>` (the first path segment of the URL)
 *
 * If neither the explicit field nor a derivable GitHub URL is present, the
 * field stays `undefined` so consumers (ProfileBlock, AboutPage) can omit
 * themselves cleanly via their existing `!== undefined` gates.
 *
 * Why the avatar bypasses `siteSchema`'s "no external host" rule: that rule
 * targets user-typed avatar strings (which we want self-hosted under
 * `apps/blog/public/`). The GitHub URL synthesized here is *derived* from a
 * value the user already opted into (their GitHub URL), so the same privacy
 * tradeoff (visitor IP → github.com on page load) is already implicit in
 * configuring the social channel.
 *
 * Empty-string `''` github (the "needs setup" sentinel from `socialSchema`)
 * is preserved verbatim for downstream stub rendering but yields no derived
 * username — there is nothing to derive from yet.
 */
export interface SiteIdentityInput {
  avatar?: string;
  nickname?: string;
  social?: { github?: string };
}

export interface ResolvedSiteIdentity {
  avatar?: string;
  nickname?: string;
  /** Pass-through of `social.github` (preserves the `''` stub sentinel). */
  github?: string;
}

/**
 * Extracts the username from a `https://github.com/<username>[/...]` URL.
 * Returns `undefined` for non-github.com hosts, malformed URLs, the empty
 * "stub" sentinel, or URLs with no username path segment.
 */
export function githubUsernameFromUrl(url: string | undefined): string | undefined {
  if (typeof url !== 'string' || url.length === 0) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') return undefined;
  const first = parsed.pathname.split('/').find((seg) => seg.length > 0);
  return first;
}

export function resolveSiteIdentity(site: SiteIdentityInput): ResolvedSiteIdentity {
  const username = githubUsernameFromUrl(site.social?.github);
  const out: ResolvedSiteIdentity = {};

  if (site.avatar !== undefined) {
    out.avatar = site.avatar;
  } else if (username !== undefined) {
    out.avatar = `https://github.com/${username}.png`;
  }

  if (site.nickname !== undefined) {
    out.nickname = site.nickname;
  } else if (username !== undefined) {
    out.nickname = username;
  }

  // Preserve the `''` stub sentinel so SocialLinks can render the
  // onboarding affordance even when there's no derivable username.
  if (typeof site.social?.github === 'string') {
    out.github = site.social.github;
  }

  return out;
}
