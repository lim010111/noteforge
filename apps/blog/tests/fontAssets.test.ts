import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Self-hosted font asset audit.
 *
 * v0.2 promised in CHANGELOG / UI_GUIDE / TOKENS that the editorial-technical
 * type triad ships from `apps/blog/public/fonts/`, never via CDN. This test is
 * the structural enforcement of that promise: tokens.css advertising the
 * family names while the woff2 files are missing would silently degrade
 * everyone to system fallbacks.
 *
 * Lives under `apps/blog/tests` because the assets live in apps/blog/public —
 * the assertion is per-app even though the @font-face rules are in
 * theme-default. Runs at unit-test speed; no build required.
 */

const FONTS_DIR = path.resolve(__dirname, '..', 'public', 'fonts');
const LICENSES_DIR = path.join(FONTS_DIR, 'LICENSES');

const REQUIRED_FONT_FILES = [
  'InterVariable.woff2',
  'PretendardVariable.woff2',
  'SourceSerif4Variable-Roman.woff2',
  'SourceSerif4Variable-Italic.woff2',
  'NotoSerifKR-Regular.woff2',
  'NotoSerifKR-Bold.woff2',
  'JetBrainsMono-Variable.woff2',
  'JetBrainsMono-Italic-Variable.woff2',
  'D2Coding.woff2',
  'D2CodingBold.woff2',
] as const;

const REQUIRED_LICENSE_FILES = [
  'Inter-OFL.txt',
  'Pretendard-OFL.txt',
  'SourceSerif-OFL.txt',
  'NotoSerifKR-OFL.txt',
  'JetBrainsMono-OFL.txt',
  // D2Coding ships as README.md + OFL clause — not a separate OFL.txt.
  'D2Coding-README.md',
] as const;

describe('public/fonts/ — self-hosted triad assets', () => {
  for (const file of REQUIRED_FONT_FILES) {
    it(`ships ${file} (non-empty)`, async () => {
      const stat = await fs.stat(path.join(FONTS_DIR, file));
      expect(stat.isFile()).toBe(true);
      // woff2 minimum sane size — anything under 1 KB is almost certainly a
      // truncated download or LFS pointer.
      expect(stat.size).toBeGreaterThan(1024);
    });
  }

  for (const file of REQUIRED_LICENSE_FILES) {
    it(`ships license/notice ${file}`, async () => {
      const stat = await fs.stat(path.join(LICENSES_DIR, file));
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(0);
    });
  }
});
