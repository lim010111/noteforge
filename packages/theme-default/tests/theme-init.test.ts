/**
 * `applyStoredTheme` is the pure shape of the FOUC-prevention init logic that
 * ships inline as `themeInitScript`. We test the function with injected
 * `dataset` / `getItem` mocks rather than spinning up a DOM env — the function
 * itself depends on nothing browser-specific (typed only by the local
 * `ThemeRoot` / `ThemeStorage` interfaces), and the inline string is the
 * production artefact, asserted shape-only below.
 */

import { describe, expect, it } from 'vitest';
import {
  applyStoredTheme,
  themeInitScript,
  type ThemeRoot,
  type ThemeStorage,
} from '../src/scripts/theme-init.ts';

function mkRoot(): { dataset: { theme?: string } } & ThemeRoot {
  return { dataset: {} };
}

function mkStorage(initial: Record<string, string>): ThemeStorage {
  return {
    getItem(key: string): string | null {
      const v = initial[key];
      return typeof v === 'string' ? v : null;
    },
  };
}

function mkThrowingStorage(): ThemeStorage {
  return {
    getItem(): string | null {
      throw new Error('storage disabled');
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
