import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAuditChecks, type AuditInput } from '../../src/lib/audit/checks.ts';

let tmpDir: string;

async function writeFile(rel: string, content: string): Promise<void> {
  const abs = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
}

const DEFAULT_ALLOWLIST = new Set([
  'title',
  'description',
  'date',
  'updated',
  'tags',
  'aliases',
  'cover',
  'author',
  'draft',
  'public',
  'slug',
  'permalink',
  'lang',
  'featured',
]);

function baseInput(over: Partial<AuditInput> = {}): AuditInput {
  return {
    distDir: tmpDir,
    publicSlugs: new Set(),
    privateTitles: new Set(),
    privateAttachmentBasenames: new Set(),
    frontmatterAllowlist: DEFAULT_ALLOWLIST,
    tagBlocklist: new Set(),
    strict: false,
    ...over,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `obpub-audit-checks-${randomUUID()}-`));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('runAuditChecks', () => {
  it('flags a private note title that appears in HTML body', async () => {
    await writeFile(
      'index.html',
      '<html><body><p>see Secret Manuscript for more</p></body></html>',
    );

    const violations = await runAuditChecks(
      baseInput({ privateTitles: new Set(['Secret Manuscript']) }),
    );

    const matches = violations.filter((v) => v.rule === 'private-note-title-in-html');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.location).toContain('index.html');
    expect(matches[0]?.message).not.toContain('Secret Manuscript');
  });

  it('flags a private attachment basename that appears in dist', async () => {
    await writeFile('attachments/leaked-photo.png', 'binary');

    const violations = await runAuditChecks(
      baseInput({ privateAttachmentBasenames: new Set(['leaked-photo.png']) }),
    );

    const matches = violations.filter((v) => v.rule === 'private-attachment-in-dist');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.location).toContain('leaked-photo.png');
  });

  it('flags graph edges whose endpoints are not in publicSlugs', async () => {
    await writeFile(
      'api/graph.json',
      JSON.stringify({
        nodes: ['a', 'b'],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'leaked-private-slug' },
        ],
      }),
    );

    const violations = await runAuditChecks(
      baseInput({ publicSlugs: new Set(['a', 'b']) }),
    );

    const matches = violations.filter((v) => v.rule === 'graph-edge-leaks-private');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((m) => m.location.includes('graph.json'))).toBe(true);
  });

  it('flags graph nodes that are not in publicSlugs', async () => {
    await writeFile(
      'api/graph.json',
      JSON.stringify({
        nodes: ['a', 'leaked-private-slug'],
        edges: [],
      }),
    );

    const violations = await runAuditChecks(
      baseInput({ publicSlugs: new Set(['a']) }),
    );

    const matches = violations.filter((v) => v.rule === 'graph-edge-leaks-private');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('flags data-fm-{key} attributes whose key is not in the allowlist', async () => {
    await writeFile(
      'index.html',
      '<html><body data-fm-title="ok" data-fm-secret="leak">x</body></html>',
    );

    const violations = await runAuditChecks(baseInput());

    const matches = violations.filter((v) => v.rule === 'frontmatter-allowlist-violation');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.message.toLowerCase()).toContain('secret');
  });

  it('returns the same data-fm violations on consecutive calls (no shared regex state)', async () => {
    await writeFile(
      'index.html',
      '<html><body data-fm-title="ok" data-fm-secret="leak">x</body></html>',
    );

    const first = await runAuditChecks(baseInput());
    const second = await runAuditChecks(baseInput());

    const firstFm = first.filter((v) => v.rule === 'frontmatter-allowlist-violation');
    const secondFm = second.filter((v) => v.rule === 'frontmatter-allowlist-violation');
    expect(secondFm).toHaveLength(firstFm.length);
    expect(secondFm[0]?.message).toBe(firstFm[0]?.message);
  });

  it('flags %%...%% obsidian comment leaks in HTML', async () => {
    await writeFile('index.html', '<html><body><p>before %%hidden note%% after</p></body></html>');

    const violations = await runAuditChecks(baseInput());

    const matches = violations.filter((v) => v.rule === 'obsidian-comment-leak');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.message).not.toContain('hidden note');
  });

  it('flags tagBlocklist entries that appear in HTML as tags', async () => {
    await writeFile(
      'tags/index.html',
      '<html><body><a href="/tags/client/acme-secret">#client/acme-secret</a></body></html>',
    );

    const violations = await runAuditChecks(
      baseInput({ tagBlocklist: new Set(['client/**']) }),
    );

    const matches = violations.filter((v) => v.rule === 'tag-blocklist-leak');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('skips short (<3 chars) private titles in non-strict mode', async () => {
    await writeFile('index.html', '<html><body><p>AI is everywhere</p></body></html>');

    const violations = await runAuditChecks(
      baseInput({ privateTitles: new Set(['AI']), strict: false }),
    );

    const matches = violations.filter(
      (v) =>
        v.rule === 'private-note-title-in-html' ||
        v.rule === 'authored-private-title-mention',
    );
    expect(matches).toHaveLength(0);
  });

  it('does not flag a long ASCII title when only embedded in an unrelated word (word boundary)', async () => {
    await writeFile(
      'index.html',
      '<html><body><p>see developer for details</p></body></html>',
    );

    const violations = await runAuditChecks(
      baseInput({ privateTitles: new Set(['develop']) }),
    );

    const matches = violations.filter(
      (v) =>
        v.rule === 'private-note-title-in-html' ||
        v.rule === 'authored-private-title-mention',
    );
    expect(matches).toHaveLength(0);
  });

  it('still flags long ASCII titles that appear as a standalone word', async () => {
    await writeFile(
      'index.html',
      '<html><body><p>see develop for details</p></body></html>',
    );

    const violations = await runAuditChecks(
      baseInput({ privateTitles: new Set(['develop']) }),
    );

    const matches = violations.filter((v) => v.rule === 'private-note-title-in-html');
    expect(matches).toHaveLength(1);
  });

  it('skips common short English titles (length<6, ASCII letters) in non-strict', async () => {
    await writeFile(
      'index.html',
      '<html><body><p>see note and code and page for details</p></body></html>',
    );

    const violations = await runAuditChecks(
      baseInput({
        privateTitles: new Set(['note', 'code', 'page']),
        strict: false,
      }),
    );

    const matches = violations.filter((v) => v.rule === 'private-note-title-in-html');
    expect(matches).toHaveLength(0);
  });

  it('flags short private titles under --strict as authored-private-title-mention', async () => {
    await writeFile('index.html', '<html><body><p>AI is everywhere</p></body></html>');

    const violations = await runAuditChecks(
      baseInput({ privateTitles: new Set(['AI']), strict: true }),
    );

    const matches = violations.filter((v) => v.rule === 'authored-private-title-mention');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.strictOnly).toBe(true);
  });

  it('returns no violations on a clean dist', async () => {
    await writeFile('index.html', '<html><body data-fm-title="ok"><p>clean</p></body></html>');
    await writeFile(
      'api/graph.json',
      JSON.stringify({ nodes: ['a'], edges: [] }),
    );

    const violations = await runAuditChecks(
      baseInput({
        publicSlugs: new Set(['a']),
        privateTitles: new Set(['NotMentionedAnywhere']),
      }),
    );

    expect(violations).toHaveLength(0);
  });

  it('does not include private title characters in the violation message (redaction)', async () => {
    const secretTitle = 'CONFIDENTIAL Manuscript Title';
    await writeFile('index.html', `<p>${secretTitle}</p>`);

    const violations = await runAuditChecks(
      baseInput({ privateTitles: new Set([secretTitle]) }),
    );

    for (const v of violations) {
      expect(v.message).not.toContain(secretTitle);
      expect(v.location).not.toContain(secretTitle);
    }
  });

  it('treats tagBlocklist as a noop when the blocklist is empty', async () => {
    await writeFile(
      'tags/index.html',
      '<html><body><a href="/tags/client/acme">#client/acme</a></body></html>',
    );

    const violations = await runAuditChecks(baseInput());

    const matches = violations.filter((v) => v.rule === 'tag-blocklist-leak');
    expect(matches).toHaveLength(0);
  });
});
