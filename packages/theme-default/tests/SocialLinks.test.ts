/**
 * Container-API tests for `<SocialLinks />`.
 *
 * Pins the three-state github contract:
 *   - undefined  → no DOM remnant (full opt-out)
 *   - ''         → stub button with onboarding hint (first-run UX)
 *   - URL        → live <a target="_blank">
 *
 * The empty-string sentinel exists so the default
 * `apps/blog/noteforge.config.ts` ships with a discoverable nudge for fork
 * users to fill in their own profile, without breaking the privacy contract
 * for users who genuinely want no social channel.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import SocialLinks from '../src/components/SocialLinks.astro';
import type { SocialLinksProps } from '../src/components/SocialLinks.types';

async function render(props: SocialLinksProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(SocialLinks as never, {
    props: props as unknown as Record<string, unknown>,
  });
}

describe('SocialLinks', () => {
  it('renders nothing when neither field is provided', async () => {
    const html = await render({});
    expect(html).not.toMatch(/<a\b/);
    expect(html).not.toMatch(/<button\b/);
    expect(html).not.toMatch(/social-links/);
  });

  it('renders an outbound anchor when github is a valid URL', async () => {
    const html = await render({ github: 'https://github.com/lim010111' });
    expect(html).toMatch(
      /<a\s[^>]*href="https:\/\/github\.com\/lim010111"[^>]*target="_blank"/,
    );
    expect(html).not.toMatch(/<button\b/);
  });

  it('renders a stub button (no anchor) when github is the empty-string sentinel', async () => {
    const html = await render({ github: '' });
    // The icon must render so users can discover it in the header.
    expect(html).toMatch(/social-links/);
    expect(html).toMatch(/<button\b/);
    // It must NOT navigate — no anchor, no href.
    expect(html).not.toMatch(/<a\b/);
    // It must carry the data hook the inline script binds the click to.
    expect(html).toMatch(/data-social-stub="github"/);
  });

  it('renders a mailto anchor when email is provided', async () => {
    const html = await render({ email: 'me@example.com' });
    expect(html).toMatch(/href="mailto:me@example\.com"/);
  });
});
