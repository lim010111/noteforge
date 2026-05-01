#!/usr/bin/env node
// v0.5 — extracts NotoSansKR Regular/Bold TTFs from the vendored zip and
// converts them to woff2 alongside the OFL license. Idempotent: outputs
// are skipped when their mtime is newer than the source zip. Pure JS
// (wawoff2 WASM + system unzip) so it works without native gyp builds.

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import wawoff2 from 'wawoff2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const FONTS_DIR = join(REPO_ROOT, 'apps', 'blog', 'public', 'fonts');
const LICENSES_DIR = join(FONTS_DIR, 'LICENSES');
const ZIP = join(FONTS_DIR, 'Noto_Sans_KR.zip');
const OUT_REGULAR = join(FONTS_DIR, 'NotoSansKR-Regular.woff2');
const OUT_BOLD = join(FONTS_DIR, 'NotoSansKR-Bold.woff2');
const OUT_LICENSE = join(LICENSES_DIR, 'NotoSansKR-OFL.txt');

function isUpToDate() {
  const outs = [OUT_REGULAR, OUT_BOLD, OUT_LICENSE];
  if (!outs.every(existsSync)) return false;
  if (!existsSync(ZIP)) return true;
  const zipMtime = statSync(ZIP).mtimeMs;
  return outs.every((p) => statSync(p).mtimeMs >= zipMtime);
}

async function main() {
  if (isUpToDate()) {
    console.log('[vendor-fonts] up-to-date, skipping');
    return;
  }
  // The zip is gitignored (63 MB exceeds GitHub's recommended size). When a
  // fresh checkout is missing it but the woff2 outputs already exist, treat
  // that as a no-op rather than failing the build — the only path that
  // actually needs the zip is regenerating the woff2.
  if (!existsSync(ZIP)) {
    const haveOutputs =
      existsSync(OUT_REGULAR) && existsSync(OUT_BOLD) && existsSync(OUT_LICENSE);
    if (haveOutputs) {
      console.log('[vendor-fonts] zip absent, woff2 present, skipping');
      return;
    }
    console.error(
      `[vendor-fonts] missing source: ${ZIP}\n` +
        '  download Noto Sans KR from https://fonts.google.com/noto/specimen/Noto+Sans+KR\n' +
        '  and drop the zip at the path above to regenerate the woff2 assets.',
    );
    process.exit(1);
  }

  mkdirSync(LICENSES_DIR, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'noto-sans-kr-'));
  try {
    execFileSync(
      'unzip',
      [
        '-o',
        '-q',
        ZIP,
        'static/NotoSansKR-Regular.ttf',
        'static/NotoSansKR-Bold.ttf',
        'OFL.txt',
        '-d',
        tmp,
      ],
      { stdio: 'inherit' },
    );

    for (const [src, dst] of [
      [join(tmp, 'static', 'NotoSansKR-Regular.ttf'), OUT_REGULAR],
      [join(tmp, 'static', 'NotoSansKR-Bold.ttf'), OUT_BOLD],
    ]) {
      const ttf = readFileSync(src);
      const woff2 = await wawoff2.compress(ttf);
      writeFileSync(dst, woff2);
      console.log(`[vendor-fonts] wrote ${dst} (${woff2.length} bytes)`);
    }

    copyFileSync(join(tmp, 'OFL.txt'), OUT_LICENSE);
    console.log(`[vendor-fonts] copied ${OUT_LICENSE}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[vendor-fonts] failed', err);
  process.exit(1);
});
