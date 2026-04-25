/**
 * Field-level props for `<BaseLayout />`.
 *
 * INTENTIONALLY does NOT accept a `frontmatter` blob. Per CLAUDE.md (privacy
 * CRITICAL): public HTML/meta must respect a frontmatter allowlist enforced in
 * `@obpub/core/privacy`. Forwarding the entire frontmatter object to a layout
 * would bypass that allowlist — so the layout receives only field-level props
 * that the caller has already filtered.
 */
export interface BaseLayoutProps {
  title: string;
  description?: string;
  /** BCP 47 language tag for `<html lang>`. Defaults to `"ko"`. */
  lang?: string;
  canonicalUrl?: string;
}
