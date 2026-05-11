/**
 * Tests for `buildVaultIndex` — the one-shot adapter consumed by `pipeline.ts`.
 *
 * The interface is the test surface: callers see `VaultIndexSnapshot` only.
 * These assertions exercise the snapshot's observable shape, not internals.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildVaultIndex } from '../src/vaultIndex/buildVaultIndex.ts';
import { resolveWikilink } from '../src/resolve/wikilink.ts';

async function write(root: string, rel: string, content: string): Promise<void> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
}

describe('buildVaultIndex', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'obpub-vaultindex-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('parses every markdown file under the vault root and returns them in `notes`', async () => {
    await write(tmpRoot, 'a.md', '---\ntitle: A\n---\nbody A');
    await write(tmpRoot, 'sub/b.md', '---\ntitle: B\n---\nbody B');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    const rels = snapshot.notes.map((n) => n.relativePath).sort();
    expect(rels).toEqual(['a.md', 'sub/b.md']);
    expect(snapshot.notes.every((n) => n.vaultId === 'main')).toBe(true);
  });

  it('skips paths matched by `noteIgnore` (markdown walk respects ignore globs)', async () => {
    await write(tmpRoot, 'visible.md', '# v');
    await write(tmpRoot, 'private/secret.md', '# s');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: ['private/**'],
      slugMode: 'folder',
    });

    expect(snapshot.notes.map((n) => n.relativePath)).toEqual(['visible.md']);
  });

  it('builds a `slugByRelPath` whose entries match `computeSlug` (folder mode preserves vault path)', async () => {
    await write(tmpRoot, 'projects/foo.md', '# F');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    expect(snapshot.slugByRelPath.get('projects/foo.md')).toBe('projects/foo');
    expect(snapshot.relPathBySlug.get('projects/foo')).toBe('projects/foo.md');
  });

  it('uses `slugMode` for slug derivation (category mode drops vault folder hierarchy)', async () => {
    await write(tmpRoot, 'inbox/foo.md', '---\ncategory: tech\n---\nbody');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'category',
    });

    expect(snapshot.slugByRelPath.get('inbox/foo.md')).toBe('tech/foo');
  });

  it('respects frontmatter `permalink` for slug regardless of `slugMode`', async () => {
    await write(tmpRoot, 'foo.md', '---\npermalink: custom/path\n---\n');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    expect(snapshot.slugByRelPath.get('foo.md')).toBe('custom/path');
  });

  it('builds a wikilinkIndex that resolves bare basenames AND folder paths', async () => {
    await write(tmpRoot, 'projects/foo.md', '# F');
    await write(tmpRoot, 'archive/foo.md', '# Archive F');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    // Folder path resolves uniquely.
    const byPath = resolveWikilink('projects/foo', snapshot.wikilinkIndex);
    expect(byPath.resolved).toBe(true);
    expect(byPath.note?.relativePath).toBe('projects/foo.md');

    // Bare basename resolves stably (shortest path wins).
    const byBase = resolveWikilink('foo', snapshot.wikilinkIndex);
    expect(byBase.resolved).toBe(true);
    // Either projects/foo.md or archive/foo.md is acceptable as long as it's stable
    // (pickStable in resolveWikilink chooses shortest path; both are equal length here,
    // so lexicographic — archive/foo.md sorts before projects/foo.md).
    expect(byBase.note?.relativePath).toBe('archive/foo.md');
  });

  it('makes frontmatter `aliases` resolvable through the wikilink index', async () => {
    await write(
      tmpRoot,
      'note.md',
      '---\naliases:\n  - Old Name\n  - 구이름\n---\n# Note',
    );

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    expect(resolveWikilink('Old Name', snapshot.wikilinkIndex).resolved).toBe(true);
    expect(resolveWikilink('구이름', snapshot.wikilinkIndex).resolved).toBe(true);
  });

  it('makes frontmatter `title` resolvable as an implicit alias', async () => {
    await write(tmpRoot, 'kebab-name.md', '---\ntitle: Title Case Name\n---\n');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    const res = resolveWikilink('Title Case Name', snapshot.wikilinkIndex);
    expect(res.resolved).toBe(true);
    expect(res.note?.relativePath).toBe('kebab-name.md');
  });

  it('returns an empty `attachments` list when `attachmentExtensions` is omitted', async () => {
    await write(tmpRoot, 'note.md', '# N');
    await fs.writeFile(path.join(tmpRoot, 'image.png'), 'fake-png-bytes');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    expect(snapshot.attachments).toEqual([]);
    expect(snapshot.attachmentByBasenameLower.size).toBe(0);
  });

  it('discovers attachments when `attachmentExtensions` is provided', async () => {
    await write(tmpRoot, 'note.md', '# N');
    await fs.writeFile(path.join(tmpRoot, 'image.png'), 'fake');
    await fs.mkdir(path.join(tmpRoot, 'attachments'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'attachments', 'photo.jpg'), 'fake');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      attachmentIgnore: [],
      attachmentExtensions: ['.png', '.jpg'],
      slugMode: 'folder',
    });

    expect([...snapshot.attachments].sort()).toEqual(['attachments/photo.jpg', 'image.png']);
    expect(snapshot.attachmentByBasenameLower.get('image.png')).toBe('image.png');
    expect(snapshot.attachmentByBasenameLower.get('photo.jpg')).toBe('attachments/photo.jpg');
  });

  it('does NOT classify — the snapshot exposes notes regardless of public/private markers', async () => {
    // Privacy contract: indexer never reads `public:` or tag markers. Both notes appear.
    await write(tmpRoot, 'pub.md', '---\npublic: true\n---\n');
    await write(tmpRoot, 'priv.md', '---\npublic: false\n---\n');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    // Both present — no privacy filter at this layer. The leak-regression-prone path
    // (re-deriving public/private inside the indexer) does not exist here.
    expect(snapshot.notes.map((n) => n.relativePath).sort()).toEqual(['priv.md', 'pub.md']);
  });

  it('strips Obsidian `%%...%%` comments via parseNote (Phase A discipline preserved)', async () => {
    await write(tmpRoot, 'note.md', 'before %%CLAUDE_COMMENT_LEAK_77b%% after');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    const note = snapshot.notes[0];
    expect(note?.body).not.toContain('CLAUDE_COMMENT_LEAK_77b');
  });

  it('includes a populated `indexedNotes` shaped for downstream callers (id, basename, aliases)', async () => {
    await write(tmpRoot, 'foo.md', '---\ntitle: Foo\naliases:\n  - alt\n---\n');

    const snapshot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    expect(snapshot.indexedNotes).toHaveLength(1);
    const idx = snapshot.indexedNotes[0]!;
    expect(idx.relativePath).toBe('foo.md');
    expect(idx.basename).toBe('foo');
    // Aliases include explicit `aliases` + the implicit title, all lowercased.
    expect([...idx.aliases].sort()).toEqual(['alt', 'foo']);
  });
});
