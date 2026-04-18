import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { walkVault, type WalkEntry, type WalkOptions } from '../src/discover/walk.ts';

async function collect(options: WalkOptions): Promise<WalkEntry[]> {
  const out: WalkEntry[] = [];
  for await (const entry of walkVault(options)) {
    out.push(entry);
  }
  return out;
}

describe('walkVault', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'obpub-walk-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('yields a single markdown file at the root with relativePath === "note.md"', async () => {
    await fs.writeFile(path.join(tmpRoot, 'note.md'), '# hi');

    const entries = await collect({ root: tmpRoot, ignore: [] });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.relativePath).toBe('note.md');
    expect(entries[0]?.path).toBe(path.join(tmpRoot, 'note.md'));
  });

  it('yields a nested markdown file with a POSIX relativePath', async () => {
    await fs.mkdir(path.join(tmpRoot, 'a', 'b'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'a', 'b', 'c.md'), '# nested');

    const entries = await collect({ root: tmpRoot, ignore: [] });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.relativePath).toBe('a/b/c.md');
    expect(entries[0]?.relativePath).not.toContain('\\');
  });

  it('skips a subtree matched by an ignore pattern', async () => {
    await fs.mkdir(path.join(tmpRoot, 'private'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'private', 'secret.md'), 'secret');
    await fs.writeFile(path.join(tmpRoot, 'visible.md'), 'ok');

    const entries = await collect({ root: tmpRoot, ignore: ['private/**'] });

    const rels = entries.map((e) => e.relativePath).sort();
    expect(rels).toEqual(['visible.md']);
  });

  it('skips the entire .obsidian subtree without descending into it', async () => {
    await fs.mkdir(path.join(tmpRoot, '.obsidian', 'cache'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, '.obsidian', 'config.json'), '{}');
    await fs.writeFile(path.join(tmpRoot, '.obsidian', 'cache', 'x.md'), '# cache');
    await fs.writeFile(path.join(tmpRoot, 'visible.md'), 'ok');

    const entries = await collect({ root: tmpRoot, ignore: ['.obsidian/**'] });

    const rels = entries.map((e) => e.relativePath).sort();
    expect(rels).toEqual(['visible.md']);
  });

  it('excludes non-.md files with the default extensions', async () => {
    await fs.writeFile(path.join(tmpRoot, 'note.md'), '# md');
    await fs.writeFile(path.join(tmpRoot, 'readme.txt'), 'txt');

    const entries = await collect({ root: tmpRoot, ignore: [] });

    const rels = entries.map((e) => e.relativePath).sort();
    expect(rels).toEqual(['note.md']);
  });

  it('matches markdown extensions case-insensitively', async () => {
    await fs.mkdir(path.join(tmpRoot, 'notes'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'notes', 'Foo.MD'), '# upper');

    const entries = await collect({ root: tmpRoot, ignore: [] });

    expect(entries.map((e) => e.relativePath)).toEqual(['notes/Foo.MD']);
  });

  it('does not enter a symlinked directory when followSymlinks is unset (default false)', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'obpub-walk-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'leaked.md'), '# should not appear');
      try {
        await fs.symlink(outside, path.join(tmpRoot, 'linked'), 'dir');
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EPERM' || code === 'EACCES') {
          return;
        }
        throw err;
      }
      await fs.writeFile(path.join(tmpRoot, 'ok.md'), 'ok');

      const entries = await collect({ root: tmpRoot, ignore: [] });

      const rels = entries.map((e) => e.relativePath).sort();
      expect(rels).toEqual(['ok.md']);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('enters a symlinked directory when followSymlinks is true', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'obpub-walk-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'reached.md'), '# reached');
      try {
        await fs.symlink(outside, path.join(tmpRoot, 'linked'), 'dir');
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EPERM' || code === 'EACCES') {
          return;
        }
        throw err;
      }

      const entries = await collect({ root: tmpRoot, ignore: [], followSymlinks: true });

      const rels = entries.map((e) => e.relativePath).sort();
      expect(rels).toEqual(['linked/reached.md']);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('returns an empty stream and warns once when the root does not exist', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missing = path.join(tmpRoot, 'does-not-exist');

    const entries = await collect({ root: missing, ignore: [] });

    expect(entries).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]?.[0] ?? '');
    expect(msg).toContain(missing);
  });
});
