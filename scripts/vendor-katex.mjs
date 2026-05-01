#!/usr/bin/env node
// v0.5 — copies KaTeX's stylesheet + woff2 font assets out of node_modules
// so the blog can self-host them. Patches the CSS's relative `url(fonts/…)`
// references to the absolute `/fonts/katex/…` path they will live at in
// dist (the CSS is served from `/styles/katex/`, so a relative `fonts/…`
// would resolve to `/styles/katex/fonts/…` — wrong directory). Only woff2
// is copied; modern browsers all support it as the first format in each
// `src` list, and shipping woff/ttf duplicates would triple the asset size.
// Idempotent via mtime comparison.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PUBLIC_DIR = join(REPO_ROOT, 'apps', 'blog', 'public');

// Resolve `katex/package.json` (always allowed by the `exports` map) and
// reach into `dist/` from there — katex's exports field doesn't list the
// CSS or font files individually, so a direct `katex/dist/katex.min.css`
// resolve fails on Node ≥20. Anchor `createRequire` at packages/core
// because katex is a dep of @noteforge/core in the pnpm workspace, not of
// the repo root.
const require_ = createRequire(
  new URL('../packages/core/package.json', import.meta.url),
);
const KATEX_PKG_DIR = dirname(require_.resolve('katex/package.json'));
const KATEX_DIST = join(KATEX_PKG_DIR, 'dist');
const KATEX_CSS_SRC = join(KATEX_DIST, 'katex.min.css');
const KATEX_FONTS_SRC = join(KATEX_DIST, 'fonts');
const KATEX_LICENSE_SRC = join(KATEX_PKG_DIR, 'LICENSE');

const OUT_CSS_DIR = join(PUBLIC_DIR, 'styles', 'katex');
const OUT_CSS = join(OUT_CSS_DIR, 'katex.min.css');
const OUT_FONTS_DIR = join(PUBLIC_DIR, 'fonts', 'katex');
const OUT_LIC_DIR = join(PUBLIC_DIR, 'fonts', 'LICENSES');
const OUT_LICENSE = join(OUT_LIC_DIR, 'KaTeX-MIT.txt');

function isUpToDate() {
  if (!existsSync(OUT_CSS) || !existsSync(OUT_LICENSE)) return false;
  const srcMtime = Math.max(
    statSync(KATEX_CSS_SRC).mtimeMs,
    statSync(KATEX_LICENSE_SRC).mtimeMs,
  );
  return [OUT_CSS, OUT_LICENSE].every(
    (p) => statSync(p).mtimeMs >= srcMtime,
  );
}

function vendorCss() {
  mkdirSync(OUT_CSS_DIR, { recursive: true });
  const css = readFileSync(KATEX_CSS_SRC, 'utf8').replaceAll(
    'url(fonts/',
    'url(/fonts/katex/',
  );
  writeFileSync(OUT_CSS, css);
}

function vendorWoff2() {
  mkdirSync(OUT_FONTS_DIR, { recursive: true });
  let count = 0;
  for (const file of readdirSync(KATEX_FONTS_SRC)) {
    if (!file.endsWith('.woff2')) continue;
    copyFileSync(join(KATEX_FONTS_SRC, file), join(OUT_FONTS_DIR, file));
    count += 1;
  }
  return count;
}

function vendorLicense() {
  mkdirSync(OUT_LIC_DIR, { recursive: true });
  copyFileSync(KATEX_LICENSE_SRC, OUT_LICENSE);
}

function main() {
  if (isUpToDate()) {
    console.log('[vendor-katex] up-to-date, skipping');
    return;
  }
  vendorCss();
  const fonts = vendorWoff2();
  vendorLicense();
  console.log(
    `[vendor-katex] vendored ${OUT_CSS}, ${fonts} woff2 fonts, ${OUT_LICENSE}`,
  );
}

main();
