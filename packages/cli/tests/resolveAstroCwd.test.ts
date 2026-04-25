import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveAstroCwd } from '../src/lib/resolveAstroCwd.ts';

let sandbox: string;

async function touch(rel: string): Promise<string> {
  const abs = path.join(sandbox, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, '', 'utf8');
  return abs;
}

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), `obpub-cwd-${randomUUID()}-`));
});
afterEach(async () => {
  await fs.rm(sandbox, { recursive: true, force: true });
});

describe('resolveAstroCwd', () => {
  it('returns apps/blog when apps/blog/astro.config.mjs exists', async () => {
    await touch('apps/blog/astro.config.mjs');
    const cwd = resolveAstroCwd(sandbox);
    expect(cwd).toBe(path.join(sandbox, 'apps', 'blog'));
  });

  it('returns startDir when astro.config.* exists at root', async () => {
    await touch('astro.config.ts');
    const cwd = resolveAstroCwd(sandbox);
    expect(cwd).toBe(sandbox);
  });

  it('prefers apps/blog when both apps/blog and root have astro configs', async () => {
    await touch('apps/blog/astro.config.mjs');
    await touch('astro.config.mjs');
    const cwd = resolveAstroCwd(sandbox);
    expect(cwd).toBe(path.join(sandbox, 'apps', 'blog'));
  });

  it('throws with the searched paths when no astro config is found', () => {
    expect(() => resolveAstroCwd(sandbox)).toThrowError(/no astro project found/);
    try {
      resolveAstroCwd(sandbox);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain(path.join(sandbox, 'apps', 'blog', 'astro.config.mjs'));
      expect(msg).toContain(path.join(sandbox, 'astro.config.mjs'));
    }
  });
});
