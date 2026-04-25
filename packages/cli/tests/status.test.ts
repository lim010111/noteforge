import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineConfig, type ObpubConfig } from '@noteforge/core/config';
import { formatStatusJson, formatStatusLine, runStatus } from '../src/commands/status.ts';
import { ObpubInputError } from '../src/lib/errors.ts';

interface Sandbox {
  readonly vaultRoot: string;
}

let sandbox: Sandbox;

function makeConfig(opts: { vaultPath: string; unsafeAllowPrivateFolder?: boolean }): ObpubConfig {
  return defineConfig({
    site: {
      title: 'Test',
      url: 'https://example.test',
      author: 'tester',
    },
    vaults: [
      {
        id: 'main',
        path: opts.vaultPath,
      },
    ],
    unsafeAllowPrivateFolder: opts.unsafeAllowPrivateFolder ?? false,
  });
}

async function writeNote(rel: string, content: string): Promise<string> {
  const abs = path.join(sandbox.vaultRoot, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return abs;
}

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `obpub-cli-status-${randomUUID()}-`));
  sandbox = { vaultRoot: dir };
});

afterEach(async () => {
  await fs.rm(sandbox.vaultRoot, { recursive: true, force: true });
});

describe('runStatus', () => {
  it('reports PUBLIC with frontmatter reason when public: true is set', async () => {
    const abs = await writeNote('foo.md', '---\npublic: true\n---\nbody\n');
    const result = await runStatus(abs, makeConfig({ vaultPath: sandbox.vaultRoot }));
    expect(result.verdict).toBe('PUBLIC');
    expect(result.reason).toContain('frontmatter public: true');
    expect(result.relativePath).toBe('foo.md');
    expect(result.tripwireFired).toBe(false);
  });

  it('reports PUBLIC with #public tag reason', async () => {
    const abs = await writeNote('notes/foo.md', '---\ntags: [public]\n---\nbody\n');
    const result = await runStatus(abs, makeConfig({ vaultPath: sandbox.vaultRoot }));
    expect(result.verdict).toBe('PUBLIC');
    expect(result.reason).toContain('tag #public');
    expect(result.relativePath).toBe('notes/foo.md');
  });

  it('reports PRIVATE with "no public marker" when nothing opts in', async () => {
    const abs = await writeNote('foo.md', '---\ntitle: secret\n---\nbody\n');
    const result = await runStatus(abs, makeConfig({ vaultPath: sandbox.vaultRoot }));
    expect(result.verdict).toBe('PRIVATE');
    expect(result.reason).toBe('no public marker');
    expect(result.tripwireFired).toBe(false);
  });

  it('fires tripwire on private/** even with public: true', async () => {
    const abs = await writeNote('private/secret.md', '---\npublic: true\n---\nshh\n');
    const result = await runStatus(abs, makeConfig({ vaultPath: sandbox.vaultRoot }));
    expect(result.verdict).toBe('PRIVATE');
    expect(result.tripwireFired).toBe(true);
    expect(result.reason).toMatch(/tripwire/i);
  });

  it('throws ObpubInputError with file:1 prefix when given an absolute path outside the vault root', async () => {
    const outside = path.join(os.tmpdir(), `outside-${randomUUID()}.md`);
    await fs.writeFile(outside, '---\npublic: true\n---\nbody\n', 'utf8');
    try {
      const err = await runStatus(
        outside,
        makeConfig({ vaultPath: sandbox.vaultRoot }),
      ).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(ObpubInputError);
      const inputErr = err as ObpubInputError;
      expect(inputErr.filePath).toBe(outside);
      expect(inputErr.line).toBe(1);
      expect(inputErr.column).toBeUndefined();
      expect(inputErr.message.startsWith(`${outside}:1: `)).toBe(true);
      expect(inputErr.message).toContain('outside vault root');
      expect(inputErr.message).toContain(sandbox.vaultRoot);
    } finally {
      await fs.rm(outside, { force: true });
    }
  });

  it('throws ObpubInputError with file:1 prefix when given a non-.md extension', async () => {
    const abs = await writeNote('foo.txt', 'not markdown');
    const err = await runStatus(
      abs,
      makeConfig({ vaultPath: sandbox.vaultRoot }),
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ObpubInputError);
    const inputErr = err as ObpubInputError;
    expect(inputErr.filePath).toBe(abs);
    expect(inputErr.line).toBe(1);
    expect(inputErr.message.startsWith(`${abs}:1: `)).toBe(true);
    expect(inputErr.message).toContain('.md');
  });

  it('throws ObpubInputError with file:1 prefix when the file does not exist (ENOENT rewrap)', async () => {
    const abs = path.join(sandbox.vaultRoot, 'missing.md');
    const err = await runStatus(
      abs,
      makeConfig({ vaultPath: sandbox.vaultRoot }),
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ObpubInputError);
    const inputErr = err as ObpubInputError;
    expect(inputErr.filePath).toBe(abs);
    expect(inputErr.line).toBe(1);
    expect(inputErr.message.startsWith(`${abs}:1: `)).toBe(true);
    expect(inputErr.message).toContain('file not found');
    expect(inputErr.cause).toBeDefined();
  });

  it('accepts a vault-relative path and classifies correctly', async () => {
    await writeNote('a/b/post.md', '---\npublic: true\n---\nhi\n');
    const result = await runStatus('a/b/post.md', makeConfig({ vaultPath: sandbox.vaultRoot }));
    expect(result.verdict).toBe('PUBLIC');
    expect(result.relativePath).toBe('a/b/post.md');
  });

  it('treats private/** as PUBLIC when unsafeAllowPrivateFolder is true', async () => {
    const abs = await writeNote('private/secret.md', '---\npublic: true\n---\ncleared\n');
    const result = await runStatus(
      abs,
      makeConfig({ vaultPath: sandbox.vaultRoot, unsafeAllowPrivateFolder: true }),
    );
    expect(result.verdict).toBe('PUBLIC');
    expect(result.tripwireFired).toBe(false);
  });
});

describe('formatStatusLine', () => {
  it('formats PUBLIC results as "{path} → PUBLIC (reason: ...)"', () => {
    const line = formatStatusLine({
      relativePath: 'foo.md',
      verdict: 'PUBLIC',
      reason: 'frontmatter public: true',
      tripwireFired: false,
    });
    expect(line).toBe('foo.md → PUBLIC (reason: frontmatter public: true)');
  });

  it('formats PRIVATE results as "{path} → PRIVATE (reason: ...)"', () => {
    const line = formatStatusLine({
      relativePath: 'notes/x.md',
      verdict: 'PRIVATE',
      reason: 'no public marker',
      tripwireFired: false,
    });
    expect(line).toBe('notes/x.md → PRIVATE (reason: no public marker)');
  });

  it('passes the tripwire reason through unchanged and adds [TRIPWIRE] marker', () => {
    const line = formatStatusLine({
      relativePath: 'private/secret.md',
      verdict: 'PRIVATE',
      reason: 'tripwire — note is under a blocked path',
      tripwireFired: true,
    });
    expect(line).toContain('PRIVATE');
    expect(line).toContain('[TRIPWIRE]');
    expect(line).toContain('tripwire — note is under a blocked path');
  });

  it('omits the [TRIPWIRE] marker when tripwireFired is false', () => {
    const line = formatStatusLine({
      relativePath: 'foo.md',
      verdict: 'PUBLIC',
      reason: 'frontmatter public: true',
      tripwireFired: false,
    });
    expect(line).not.toContain('[TRIPWIRE]');
  });
});

describe('formatStatusJson', () => {
  it('emits a single-line JSON with all four StatusResult fields', () => {
    const json = formatStatusJson({
      relativePath: 'a/b.md',
      verdict: 'PUBLIC',
      reason: 'tag #public',
      tripwireFired: false,
    });
    expect(json).not.toContain('\n');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed).toEqual({
      relativePath: 'a/b.md',
      verdict: 'PUBLIC',
      reason: 'tag #public',
      tripwireFired: false,
    });
  });

  it('preserves tripwireFired=true in JSON output', () => {
    const json = formatStatusJson({
      relativePath: 'private/x.md',
      verdict: 'PRIVATE',
      reason: 'tripwire — note is under a blocked path (private/x.md); public marker (frontmatter public: true) ignored',
      tripwireFired: true,
    });
    const parsed = JSON.parse(json) as { tripwireFired: boolean; verdict: string };
    expect(parsed.tripwireFired).toBe(true);
    expect(parsed.verdict).toBe('PRIVATE');
  });
});
