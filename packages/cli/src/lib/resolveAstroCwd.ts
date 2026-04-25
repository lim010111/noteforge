import * as fs from 'node:fs';
import * as path from 'node:path';

const ASTRO_CONFIG_BASENAMES = [
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.ts',
  'astro.config.mts',
];

/**
 * Resolve the directory we should hand to Astro as cwd.
 *
 * Lookup order:
 *   1. <startDir>/apps/blog containing astro.config.{mjs,js,ts,mts}.
 *   2. <startDir> itself containing astro.config.*.
 *   3. throw — nothing astro-shaped found.
 */
export function resolveAstroCwd(startDir: string): string {
  const tried: string[] = [];

  const blogDir = path.join(startDir, 'apps', 'blog');
  for (const name of ASTRO_CONFIG_BASENAMES) {
    const candidate = path.join(blogDir, name);
    tried.push(candidate);
    if (fs.existsSync(candidate)) return blogDir;
  }

  for (const name of ASTRO_CONFIG_BASENAMES) {
    const candidate = path.join(startDir, name);
    tried.push(candidate);
    if (fs.existsSync(candidate)) return startDir;
  }

  throw new Error(
    `no astro project found at any of:\n  ${tried.join('\n  ')}`,
  );
}
