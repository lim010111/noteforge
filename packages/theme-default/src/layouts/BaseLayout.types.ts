/**
 * Field-level props for `<BaseLayout />`.
 *
 * INTENTIONALLY does NOT accept a `frontmatter` blob. Per CLAUDE.md (privacy
 * CRITICAL): public HTML/meta must respect a frontmatter allowlist enforced in
 * `@noteforge/core/privacy`. Forwarding the entire frontmatter object to a layout
 * would bypass that allowlist — so the layout receives only field-level props
 * that the caller has already filtered.
 */
import type { SidebarProps } from '../components/Sidebar.types.ts';
import type { SocialLinksProps } from '../components/SocialLinks.types.ts';

export interface BaseLayoutProps {
  title: string;
  description?: string;
  /** BCP 47 language tag for `<html lang>`. Defaults to `"ko"`. */
  lang?: string;
  canonicalUrl?: string;
  /**
   * Open Graph type. Defaults to `"website"`.
   * `"profile"` is used for the `/about/` page (OpenGraph profile object).
   */
  ogType?: 'website' | 'article' | 'profile';
  /** Open Graph site_name. Optional — emitted only when provided. */
  siteName?: string;
  /**
   * Optional sidebar payload. When omitted, the layout falls back to the v0.2
   * single-column shell (no <aside>, no grid). When present, the same
   * `<Sidebar>` is rendered twice — once as the lg+ grid column, once inside
   * the existing mobile <details> drawer — and CSS hides whichever copy is not
   * appropriate for the current viewport. Two server renders cost nothing
   * (static output) and avoid the JS sync that DOM duplication usually demands.
   */
  sidebar?: SidebarProps;
  /**
   * Opt-in social channels rendered inside `.header-actions`, before the
   * theme toggle. Presence-based: omit to render nothing. Mirrors the Zod
   * `socialSchema` in `@noteforge/core/config`.
   */
  social?: SocialLinksProps;
}
