/**
 * heroBackgroundCss — defense-in-depth gate for the inline hero overlay's
 * `background-image` value.
 *
 * The privacy pipeline (`@noteforge/core`'s `resolvePublicImageFrontmatter`)
 * already decides which URLs are publishable. This helper is a *boundary*
 * check that runs at the render seam, not a duplicate decision point: it
 * rejects anything that does not look like one of the two scheme shapes
 * the pipeline can produce (`http(s)://...` or absolute path starting with
 * `/`), and rejects any character that could break out of the surrounding
 * `url('...')` CSS string. If both checks pass it returns the wrapped
 * `url('...')` expression ready to be substituted into a CSS custom
 * property.
 *
 * Why a CSS custom property instead of `background-image: url(...)`
 * directly: keeps the templated portion to a single token (the URL value),
 * not a full property declaration. Even if the template engine ever stops
 * escaping attribute values correctly, the worst case is a broken
 * `--hero-bg`, not an attacker-supplied `background:url(...);after-rule:...`.
 */
const SAFE_SCHEME = /^(\/|https?:\/\/)/i;
const FORBIDDEN_CHARS = /['"\\\n\r()<>]/;

export function heroBackgroundCss(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (!SAFE_SCHEME.test(trimmed)) return undefined;
  if (FORBIDDEN_CHARS.test(trimmed)) return undefined;
  return `url('${trimmed}')`;
}
