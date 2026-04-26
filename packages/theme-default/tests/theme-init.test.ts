/**
 * `applyStoredTheme` is the pure shape of the FOUC-prevention init logic that
 * ships inline as `themeInitScript`. We test the function with injected
 * `dataset` / `getItem` mocks rather than spinning up a DOM env — the function
 * itself depends on nothing browser-specific (typed only by the local
 * `ThemeRoot` / `ThemeStorage` interfaces), and the inline string is the
 * production artefact, asserted shape-only below.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyStoredTheme,
  bindThemeToggle,
  resolveCurrentTheme,
  setTheme,
  themeInitScript,
  type ThemeRoot,
  type ThemeStorage,
  type ThemeToggleButton,
} from '../src/scripts/theme-init.ts';

function mkRoot(): { dataset: { theme?: string } } & ThemeRoot {
  return { dataset: {} };
}

function mkStorage(initial: Record<string, string>): ThemeStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem(key: string): string | null {
      const v = store[key];
      return typeof v === 'string' ? v : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
  };
}

function mkThrowingStorage(): ThemeStorage {
  return {
    getItem(): string | null {
      throw new Error('storage disabled');
    },
    setItem(): void {
      throw new Error('storage disabled');
    },
  };
}

interface FakeButton extends ThemeToggleButton {
  fire(): void;
}

function mkButton(): FakeButton {
  let listener: ((event: unknown) => void) | null = null;
  return {
    addEventListener(_type: 'click', l: (event: unknown) => void): void {
      listener = l;
    },
    fire(): void {
      if (listener !== null) listener(new Event('click'));
    },
  };
}

describe('applyStoredTheme', () => {
  it('sets data-theme to "dark" when storage holds "dark"', () => {
    const root = mkRoot();
    applyStoredTheme(root, mkStorage({ theme: 'dark' }));
    expect(root.dataset.theme).toBe('dark');
  });

  it('sets data-theme to "light" when storage holds "light"', () => {
    const root = mkRoot();
    applyStoredTheme(root, mkStorage({ theme: 'light' }));
    expect(root.dataset.theme).toBe('light');
  });

  it('leaves data-theme undefined when storage is empty', () => {
    const root = mkRoot();
    applyStoredTheme(root, mkStorage({}));
    expect(root.dataset.theme).toBeUndefined();
  });

  it('leaves data-theme undefined when storage holds an unknown value', () => {
    // Future-proofs against typo "auto" / "system" / hex codes etc. — those
    // must fall through to prefers-color-scheme, never set the attribute.
    const root = mkRoot();
    applyStoredTheme(root, mkStorage({ theme: 'auto' }));
    expect(root.dataset.theme).toBeUndefined();
  });

  it('swallows storage exceptions and leaves data-theme undefined', () => {
    // Safari private mode throws on getItem — the inline script must not crash
    // and break <body> paint.
    const root = mkRoot();
    expect(() => {
      applyStoredTheme(root, mkThrowingStorage());
    }).not.toThrow();
    expect(root.dataset.theme).toBeUndefined();
  });
});

describe('resolveCurrentTheme', () => {
  it('returns the explicit data-theme value when present', () => {
    expect(resolveCurrentTheme({ dataset: { theme: 'dark' } }, { matches: true })).toBe('dark');
    expect(resolveCurrentTheme({ dataset: { theme: 'light' } }, { matches: false })).toBe('light');
  });

  it('falls back to prefers-color-scheme when dataset.theme is unset', () => {
    expect(resolveCurrentTheme({ dataset: {} }, { matches: true })).toBe('dark');
    expect(resolveCurrentTheme({ dataset: {} }, { matches: false })).toBe('light');
  });

  it('falls back to prefers-color-scheme for unknown dataset.theme values', () => {
    // Defensive — a typo like "auto" must be treated like absence so the toggle
    // still resolves to whatever CSS is currently painting.
    expect(resolveCurrentTheme({ dataset: { theme: 'auto' } }, { matches: true })).toBe('dark');
  });
});

describe('setTheme', () => {
  it('updates dataset.theme and persists to storage', () => {
    const root = mkRoot();
    const storage = mkStorage({});
    setTheme(root, storage, 'dark');
    expect(root.dataset.theme).toBe('dark');
    expect(storage.getItem('theme')).toBe('dark');
  });

  it('still updates dataset.theme when storage write throws', () => {
    const root = mkRoot();
    expect(() => setTheme(root, mkThrowingStorage(), 'light')).not.toThrow();
    expect(root.dataset.theme).toBe('light');
  });
});

describe('bindThemeToggle', () => {
  it('flips dark→light on click and persists the new value', () => {
    const root = mkRoot();
    root.dataset.theme = 'dark';
    const storage = mkStorage({ theme: 'dark' });
    const btn = mkButton();
    bindThemeToggle(btn, root, storage, { matches: true });
    btn.fire();
    expect(root.dataset.theme).toBe('light');
    expect(storage.getItem('theme')).toBe('light');
  });

  it('flips light→dark on click', () => {
    const root = mkRoot();
    root.dataset.theme = 'light';
    const storage = mkStorage({ theme: 'light' });
    const btn = mkButton();
    bindThemeToggle(btn, root, storage, { matches: false });
    btn.fire();
    expect(root.dataset.theme).toBe('dark');
    expect(storage.getItem('theme')).toBe('dark');
  });

  it('uses prefers-color-scheme when dataset.theme is empty before first click', () => {
    // First-load scenario: no stored value, no data-theme set. CSS is painting
    // dark via @media. Toggle must compute "current = dark", flip to light.
    const root = mkRoot();
    const storage = mkStorage({});
    const btn = mkButton();
    bindThemeToggle(btn, root, storage, { matches: true });
    btn.fire();
    expect(root.dataset.theme).toBe('light');
  });

  it('toggles back and forth across multiple clicks', () => {
    const root = mkRoot();
    root.dataset.theme = 'dark';
    const storage = mkStorage({ theme: 'dark' });
    const btn = mkButton();
    bindThemeToggle(btn, root, storage, { matches: true });
    btn.fire();
    btn.fire();
    btn.fire();
    expect(root.dataset.theme).toBe('light');
  });

  it('does not crash when storage write fails (Safari private mode)', () => {
    const root = mkRoot();
    root.dataset.theme = 'light';
    const btn = mkButton();
    bindThemeToggle(btn, root, mkThrowingStorage(), { matches: false });
    expect(() => btn.fire()).not.toThrow();
    expect(root.dataset.theme).toBe('dark');
  });

  it('only attaches one listener per button (vi.fn audit)', () => {
    const fn = vi.fn();
    const fakeButton: ThemeToggleButton = { addEventListener: fn };
    bindThemeToggle(fakeButton, mkRoot(), mkStorage({}), { matches: false });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('click', expect.any(Function));
  });
});

describe('themeInitScript', () => {
  it('is a self-invoking IIFE', () => {
    expect(themeInitScript.startsWith('(function()')).toBe(true);
    expect(themeInitScript.endsWith(';')).toBe(true);
    expect(themeInitScript).toContain('})();');
  });

  it('reads localStorage.theme and writes documentElement.dataset.theme', () => {
    expect(themeInitScript).toContain('localStorage.getItem("theme")');
    expect(themeInitScript).toContain('document.documentElement.dataset.theme');
  });

  it('guards storage access with try/catch (Safari private mode)', () => {
    expect(themeInitScript).toContain('try');
    expect(themeInitScript).toContain('catch');
  });

  it('only honours "dark" or "light" — anything else falls through to CSS', () => {
    expect(themeInitScript).toContain('"dark"');
    expect(themeInitScript).toContain('"light"');
  });
});
