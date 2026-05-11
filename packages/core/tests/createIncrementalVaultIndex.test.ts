/**
 * Tests for `createIncrementalVaultIndex` — the mutable adapter consumed by
 * the dev watcher. Two layers of assertions:
 *
 * 1. **Snapshot equivalence with `buildVaultIndex`.** A sequence of upsert/remove
 *    events produces the same observable snapshot as a one-shot indexer over the
 *    final vault state. This equivalence test does not exist today and is the
 *    regression net for the duplicated indexing path
 *    (pipeline.ts vs. watcher.ts).
 *
 * 2. **`dependentsOf` invariants.** Migrated from the former `depGraph.test.ts`,
 *    rephrased through the public interface (`upsert` for forward-edge updates,
 *    `remove` for unlink, `dependentsOf` for the read).
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildVaultIndex } from '../src/vaultIndex/buildVaultIndex.ts';
import { createIncrementalVaultIndex } from '../src/vaultIndex/createIncrementalVaultIndex.ts';

async function write(root: string, rel: string, content: string): Promise<void> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
}

describe('createIncrementalVaultIndex — primeFromVault', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'obpub-prime-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('seeds the index from disk in one batched walk; subsequent dependentsOf reflects forward edges', async () => {
    await write(tmpRoot, 'a.md', '# A');
    await write(tmpRoot, 'b.md', '[[a]]');
    await write(tmpRoot, 'c.md', '![[a]]');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.primeFromVault();

    expect([...incremental.dependentsOf('a')].sort()).toEqual(['b', 'c']);
    expect(incremental.snapshot().notes.map((n) => n.relativePath).sort()).toEqual([
      'a.md',
      'b.md',
      'c.md',
    ]);
  });

  it('skips a file with malformed frontmatter and reports it via onWarning', async () => {
    await write(tmpRoot, 'good.md', '# Good');
    await write(tmpRoot, 'broken.md', '---\nkey: [unclosed\n---\nbody');

    const warnings: string[] = [];
    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
      onWarning: (m) => warnings.push(m),
    });
    await incremental.primeFromVault();

    expect(incremental.snapshot().notes.map((n) => n.relativePath)).toEqual(['good.md']);
    expect(warnings.some((m) => m.includes('broken.md'))).toBe(true);
  });
});

describe('createIncrementalVaultIndex — snapshot equivalence', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'obpub-incindex-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('after upserting every file, the snapshot equals a one-shot snapshot of the same vault', async () => {
    await write(tmpRoot, 'a.md', '---\ntitle: A\n---\n[[b]]');
    await write(tmpRoot, 'sub/b.md', '---\ntitle: B\n---\n[[a]]');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');
    await incremental.upsert(path.join(tmpRoot, 'sub/b.md'), 'sub/b.md');
    const incSnap = incremental.snapshot();

    const oneShot = await buildVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    // Notes (compare by relativePath since walk order is implementation-defined).
    expect(incSnap.notes.map((n) => n.relativePath).sort()).toEqual(
      oneShot.notes.map((n) => n.relativePath).sort(),
    );
    // Slug map identical.
    expect(new Map(incSnap.slugByRelPath)).toEqual(new Map(oneShot.slugByRelPath));
    expect(new Map(incSnap.relPathBySlug)).toEqual(new Map(oneShot.relPathBySlug));
    // Wikilink index resolves the same way for both.
    for (const idx of oneShot.indexedNotes) {
      const incEntry = incSnap.indexedNotes.find((n) => n.id === idx.id);
      expect(incEntry, `missing indexedNote ${idx.id}`).toBeDefined();
      expect([...(incEntry?.aliases ?? [])].sort()).toEqual([...idx.aliases].sort());
    }
  });

  it('upsert that changes a note slug deletes the old slug from snapshot maps', async () => {
    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });

    await write(tmpRoot, 'note.md', '# N');
    await incremental.upsert(path.join(tmpRoot, 'note.md'), 'note.md');
    expect(incremental.snapshot().slugByRelPath.get('note.md')).toBe('note');

    // Author adds a `permalink` — slug now changes for the same file.
    await write(tmpRoot, 'note.md', '---\npermalink: custom\n---\n');
    await incremental.upsert(path.join(tmpRoot, 'note.md'), 'note.md');

    const snap = incremental.snapshot();
    expect(snap.slugByRelPath.get('note.md')).toBe('custom');
    expect(snap.relPathBySlug.has('note')).toBe(false);
    expect(snap.relPathBySlug.get('custom')).toBe('note.md');
  });

  it('remove drops the note from snapshot maps and indexed list', async () => {
    await write(tmpRoot, 'a.md', '# A');
    await write(tmpRoot, 'b.md', '# B');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');
    await incremental.upsert(path.join(tmpRoot, 'b.md'), 'b.md');

    expect(incremental.remove('a.md')).toBe('a');

    const snap = incremental.snapshot();
    expect(snap.slugByRelPath.has('a.md')).toBe(false);
    expect(snap.relPathBySlug.has('a')).toBe(false);
    expect(snap.indexedNotes.map((n) => n.id)).toEqual(['b']);
  });

  it('upsert skips silently and warns when the file is unreadable', async () => {
    const warnings: string[] = [];
    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
      readFile: async () => {
        throw new Error('synthetic ENOENT');
      },
      onWarning: (m) => warnings.push(m),
    });

    const slug = await incremental.upsert(path.join(tmpRoot, 'ghost.md'), 'ghost.md');
    expect(slug).toBeUndefined();
    expect(warnings.some((m) => m.includes('ghost.md'))).toBe(true);
    expect(incremental.snapshot().notes).toHaveLength(0);
  });

  it('upsert skips silently and warns when frontmatter cannot be parsed', async () => {
    await write(tmpRoot, 'broken.md', '---\nbroken: [unclosed\n---\nbody');

    const warnings: string[] = [];
    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
      onWarning: (m) => warnings.push(m),
    });

    const slug = await incremental.upsert(path.join(tmpRoot, 'broken.md'), 'broken.md');
    expect(slug).toBeUndefined();
    expect(warnings.some((m) => m.includes('broken.md'))).toBe(true);
    expect(incremental.snapshot().notes).toHaveLength(0);
  });

  it('snapshot maps are defensive — caller mutation does not affect internal state', async () => {
    await write(tmpRoot, 'a.md', '# A');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');

    const snap = incremental.snapshot();
    // Attempt to mutate; in strict mode this either throws or is ignored.
    expect(() => {
      (snap.slugByRelPath as Map<string, string>).set('hacked', 'x');
    }).toThrow();

    const fresh = incremental.snapshot();
    expect(fresh.slugByRelPath.has('hacked')).toBe(false);
  });
});

describe('createIncrementalVaultIndex — dependentsOf', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'obpub-incdeps-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('returns empty for an unknown slug', async () => {
    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    expect(incremental.dependentsOf('nope').size).toBe(0);
  });

  it('records reverse edges so dependentsOf(target) lists every linker (forward + reverse in lock-step)', async () => {
    await write(tmpRoot, 'a.md', '[[b]] [[c]]');
    await write(tmpRoot, 'b.md', '');
    await write(tmpRoot, 'c.md', '');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'b.md'), 'b.md');
    await incremental.upsert(path.join(tmpRoot, 'c.md'), 'c.md');
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');

    expect([...incremental.dependentsOf('b')]).toEqual(['a']);
    expect([...incremental.dependentsOf('c')]).toEqual(['a']);
  });

  it('upserting a note with new outgoing links prunes stale reverse entries (was: depGraph case 3)', async () => {
    await write(tmpRoot, 'a.md', '[[b]] [[c]]');
    await write(tmpRoot, 'b.md', '');
    await write(tmpRoot, 'c.md', '');
    await write(tmpRoot, 'd.md', '');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'b.md'), 'b.md');
    await incremental.upsert(path.join(tmpRoot, 'c.md'), 'c.md');
    await incremental.upsert(path.join(tmpRoot, 'd.md'), 'd.md');
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');

    // Author rewrites a.md — drops [[c]], adds [[d]].
    await write(tmpRoot, 'a.md', '[[b]] [[d]]');
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');

    expect(incremental.dependentsOf('c').has('a')).toBe(false);
    expect([...incremental.dependentsOf('d')]).toEqual(['a']);
    expect([...incremental.dependentsOf('b')]).toEqual(['a']);
  });

  it('embed (`![[...]]`) targets are tracked the same as link targets', async () => {
    await write(tmpRoot, 'a.md', '![[b]]');
    await write(tmpRoot, 'b.md', '# B');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'b.md'), 'b.md');
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');

    expect([...incremental.dependentsOf('b')]).toEqual(['a']);
  });

  it('remove drops the note from forward edges and prunes its reverse entries (was: depGraph case 5)', async () => {
    await write(tmpRoot, 'a.md', '[[b]]');
    await write(tmpRoot, 'b.md', '');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'b.md'), 'b.md');
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');

    incremental.remove('a.md');
    expect(incremental.dependentsOf('b').has('a')).toBe(false);
  });

  it('remove preserves incoming reverse edges — other notes still believe they link the removed one (was: case 6)', async () => {
    await write(tmpRoot, 'a.md', '[[b]]');
    await write(tmpRoot, 'b.md', '');
    await write(tmpRoot, 'c.md', '[[b]]');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'b.md'), 'b.md');
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');
    await incremental.upsert(path.join(tmpRoot, 'c.md'), 'c.md');

    incremental.remove('b.md');

    // Reverse edges retained — A and C have not been re-parsed.
    expect([...incremental.dependentsOf('b')].sort()).toEqual(['a', 'c']);
  });

  it('cycle a↔b: removing a prunes a from dependentsOf(b) (was: case 8)', async () => {
    await write(tmpRoot, 'a.md', '[[b]]');
    await write(tmpRoot, 'b.md', '[[a]]');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    // The incremental adapter only resolves outgoing wikilinks against the
    // index in effect at upsert time — same behavior the standalone watcher
    // had. Establishing a true cycle takes three events: a (target unresolved),
    // b (resolves [[a]]), then a re-upsert (now resolves [[b]]).
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');
    await incremental.upsert(path.join(tmpRoot, 'b.md'), 'b.md');
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');

    expect([...incremental.dependentsOf('a')]).toEqual(['b']);
    expect([...incremental.dependentsOf('b')]).toEqual(['a']);

    incremental.remove('a.md');
    expect(incremental.dependentsOf('b').has('a')).toBe(false);
  });

  it('returns a defensive copy — external mutation of the result does not affect internal state (was: case 9)', async () => {
    await write(tmpRoot, 'a.md', '[[b]]');
    await write(tmpRoot, 'b.md', '');

    const incremental = createIncrementalVaultIndex({
      vaultPath: tmpRoot,
      vaultId: 'main',
      noteIgnore: [],
      slugMode: 'folder',
    });
    await incremental.upsert(path.join(tmpRoot, 'b.md'), 'b.md');
    await incremental.upsert(path.join(tmpRoot, 'a.md'), 'a.md');

    const dependents = incremental.dependentsOf('b') as Set<string>;
    dependents.clear();
    dependents.add('HACKED');

    expect([...incremental.dependentsOf('b')]).toEqual(['a']);
  });
});
