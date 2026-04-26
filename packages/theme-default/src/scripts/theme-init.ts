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

export type ThemeMode = 'dark' | 'light';

export interface ThemeRoot {
  dataset: { theme?: string };
}

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeMediaQuery {
  readonly matches: boolean;
}

export interface ThemeToggleButton {
  addEventListener(
    type: 'click',
    listener: (event: unknown) => void,
  ): void;
}

export function applyStoredTheme(
  root: ThemeRoot,
  storage: Pick<ThemeStorage, 'getItem'>,
): void {
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

/**
 * Decide which theme is currently rendered. Honours an explicit `data-theme`
 * (set either by the user's last toggle or by `applyStoredTheme` from
 * localStorage); when neither is present the CSS @media (prefers-color-scheme)
 * block in tokens.css is what's painting the UI, so we mirror that here so the
 * toggle's "next" computation matches what the user sees.
 */
export function resolveCurrentTheme(
  root: ThemeRoot,
  prefersDarkMq: ThemeMediaQuery,
): ThemeMode {
  const stored = root.dataset.theme;
  if (stored === 'dark' || stored === 'light') return stored;
  return prefersDarkMq.matches ? 'dark' : 'light';
}

/**
 * Set the theme in both the DOM (so styles update immediately) and storage
 * (so the choice persists across page loads and `applyStoredTheme` can
 * restore it before paint). Storage failures are swallowed — we never break
 * the UI for a Safari private-mode quota error.
 */
export function setTheme(
  root: ThemeRoot,
  storage: Pick<ThemeStorage, 'setItem'>,
  next: ThemeMode,
): void {
  root.dataset.theme = next;
  try {
    storage.setItem('theme', next);
  } catch {
    // Storage write blocked (private mode, quota) — DOM update still stands.
  }
}

/**
 * Wire the theme toggle button to flip between dark/light and persist the
 * choice. Single source of truth for the toggle behaviour: BaseLayout.astro
 * imports this rather than re-implementing the resolve+set dance inline,
 * avoiding silent drift between the two surfaces.
 */
export function bindThemeToggle(
  button: ThemeToggleButton,
  root: ThemeRoot,
  storage: ThemeStorage,
  prefersDarkMq: ThemeMediaQuery,
): void {
  button.addEventListener('click', () => {
    const current = resolveCurrentTheme(root, prefersDarkMq);
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
    setTheme(root, storage, next);
  });
}

export const themeInitScript =
  '(function(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}' +
  'if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}})();';
