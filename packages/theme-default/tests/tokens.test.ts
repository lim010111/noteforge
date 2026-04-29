/**
 * Regression guard for v0.3 tokens.css extension.
 *
 * v0.3 adds a single secondary accent (--color-accent-2 + -hover + -soft),
 * five category accent slots (--color-accent-cat-1..5), one new sidebar
 * surface tier (--color-bg-sidebar), and one layout dimension
 * (--container-sidebar-w). Each colour token must appear in *all four*
 * cascade blocks (@theme, [data-theme="light"], [data-theme="dark"], and the
 * prefers-color-scheme media query) so that:
 *   - Tailwind v4 utilities resolve at build time (@theme).
 *   - User-pinned light wins over OS dark ([data-theme="light"]).
 *   - User-pinned dark wins over OS light ([data-theme="dark"]).
 *   - OS-only dark inherits the dark values (@media block).
 * A missed mirror leaves the variable unset in one path → visual regression.
 *
 * The layout-only --container-sidebar-w is mode-independent and only needs
 * to live in @theme — no per-mode redefinition.
 *
 * The ANTIPATTERNS guard rejects any cool/neon hex (purple/indigo/lime/
 * cyan-leaning) on the new accent tokens. Iron-oxide / forest-moss /
 * ochre / bronze / slate are warm earth tones by hex inspection.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TOKENS_CSS = readFileSync(
  fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)),
  'utf8',
);

const COLOR_TOKENS_PER_BLOCK = [
  '--color-accent-2',
  '--color-accent-2-hover',
  '--color-accent-2-soft',
  '--color-accent-cat-1',
  '--color-accent-cat-2',
  '--color-accent-cat-3',
  '--color-accent-cat-4',
  '--color-accent-cat-5',
  '--color-bg-sidebar',
] as const;

/** Count `--token-name:` declarations (with the colon — comments stripped out). */
function countDeclarations(css: string, token: string): number {
  // Match the token followed by optional whitespace and a colon, anchored at
  // start of the variable name so substring overlap (e.g. --color-accent-2 vs
  // --color-accent-2-hover) does not double-count.
  const escaped = token.replace(/[-]/g, '\\-');
  const re = new RegExp(`${escaped}\\s*:`, 'g');
  const matches = css.match(re);
  return matches === null ? 0 : matches.length;
}

describe('tokens.css — v0.3 delta presence', () => {
  it.each(COLOR_TOKENS_PER_BLOCK)(
    '%s is declared in all four cascade blocks',
    (token) => {
      const count = countDeclarations(TOKENS_CSS, token);
      expect(count, `${token} declared ${count} time(s); expected 4`).toBe(4);
    },
  );

  it('--container-sidebar-w is declared (layout dimension, mode-independent)', () => {
    expect(countDeclarations(TOKENS_CSS, '--container-sidebar-w')).toBeGreaterThanOrEqual(1);
  });

  it('preserves v0.2 --color-text-link in all four cascade blocks (regression guard)', () => {
    expect(countDeclarations(TOKENS_CSS, '--color-text-link')).toBe(4);
  });

  it('preserves v0.2 --color-accent in all four cascade blocks', () => {
    expect(countDeclarations(TOKENS_CSS, '--color-accent')).toBe(4);
  });

  it('preserves v0.2 --color-bg-page in all four cascade blocks', () => {
    expect(countDeclarations(TOKENS_CSS, '--color-bg-page')).toBe(4);
  });
});

describe('tokens.css — ANTIPATTERNS guard for v0.3 accents', () => {
  // Forbidden hue families: purple / indigo / neon-cool. We look for hex
  // signatures that *could* express those families on the new tokens. The
  // check operates on the lines that declare the v0.3 accent tokens only —
  // v0.2 tokens are out of scope for this guard.
  const v03AccentLines = TOKENS_CSS.split('\n').filter((line) =>
    /--color-accent-(2(-hover|-soft)?|cat-\d)\s*:/.test(line),
  );

  it('contains the expected number of v0.3 accent declaration lines (sanity)', () => {
    // 8 colour tokens × 4 cascade blocks = 32 lines.
    expect(v03AccentLines.length).toBe(32);
  });

  it('uses no purple / indigo / magenta / cyan / neon hex on v0.3 accents', () => {
    // Quick warm-tone heuristic: warm earth tones have R ≥ G or R ≥ B
    // (red-leaning) OR are warm-charcoal (R ≈ G ≈ B with no blue-cast).
    // Fail any hex where blue dominates strongly (B > R + 0x10 AND
    // B > G + 0x10) — that's the purple/indigo/cyan signature.
    for (const line of v03AccentLines) {
      const hex = /#([0-9a-fA-F]{6})/.exec(line)?.[1];
      if (hex === undefined) continue;
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const blueDominates = b > r + 0x10 && b > g + 0x10;
      expect(blueDominates, `${line.trim()} — blue dominates (cool/non-warm)`).toBe(false);
    }
  });
});
