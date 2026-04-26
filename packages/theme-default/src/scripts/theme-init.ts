/*
 * Theme init — FOUC-prevention sync helper.
 *
 * Two artefacts ship from this module:
 *   1. `applyStoredTheme(root, storage)` — pure function; the testable shape of
 *      the same logic shipped inline.
 *   2. `themeInitScript` — self-contained string that BaseLayout (step 3)
 *      embeds via `<script is:inline set:html={themeInitScript}>`. It must
 *      execute synchronously inside `<head>`, before body paints, so the
 *      explicit user toggle is honoured before the first frame.
 *
 * The pure function and the string MUST stay behaviourally aligned. Keeping
 * them as distinct artefacts (rather than `applyStoredTheme.toString()`) means
 * the inline script is independent of TypeScript helpers/imports and remains
 * minimal-byte for the head.
 *
 * Behaviour
 *   localStorage.theme === "dark"  → <html data-theme="dark">
 *   localStorage.theme === "light" → <html data-theme="light">
 *   anything else / missing        → no `data-theme` attribute, so the CSS
 *                                    @media (prefers-color-scheme) block in
 *                                    tokens.css decides instead.
 */

export interface ThemeRoot {
  readonly dataset: { theme?: string };
}

export interface ThemeStorage {
  getItem(key: string): string | null;
}

export function applyStoredTheme(root: ThemeRoot, storage: ThemeStorage): void {
  let stored: string | null = null;
  try {
    stored = storage.getItem('theme');
  } catch {
    // private mode / storage disabled — fall through to CSS-only resolution.
  }
  if (stored === 'dark' || stored === 'light') {
    root.dataset.theme = stored;
  }
}

export const themeInitScript =
  '(function(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}' +
  'if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}})();';
