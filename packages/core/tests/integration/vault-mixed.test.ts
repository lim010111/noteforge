import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { beforeAll, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/config.ts';
import { runCorePipeline, type PipelineResult } from '../../src/pipeline.ts';
import {
  buildWikilinkIndex,
  resolveWikilink,
  type IndexedNote,
} from '../../src/resolve/wikilink.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(HERE, '..', 'fixtures', 'vault-mixed');

/**
 * Canaries are not hardcoded in this test file. We read them out of fixture files
 * (per task rule: hardcoding canaries in test code can cause the 0-occurrence assertions
 * to test-positive against themselves).
 *
 * - canary A lives in `Private Secret.md`, as `DO_NOT_LEAK_BANANA_<suffix>`.
 * - canary B lives in `public-with-comment.md` (twice), as `CLAUDE_COMMENT_LEAK_<suffix>`.
 *
 * We extract each by a strictly-shaped regex against the fixture body.
 */

const CANARY_A_RE = /DO_NOT_LEAK_BANANA_[A-Za-z0-9]+/;
const CANARY_B_RE = /CLAUDE_COMMENT_LEAK_[A-Za-z0-9]+/;

async function readFixture(rel: string): Promise<string> {
  return fs.readFile(path.join(VAULT_ROOT, rel), 'utf8');
}

async function loadCanaryA(): Promise<string> {
  const body = await readFixture('Private Secret.md');
  const m = CANARY_A_RE.exec(body);
  if (m === null) {
    throw new Error('fixture Private Secret.md does not contain canary A');
  }
  return m[0];
}

async function loadCanaryB(): Promise<string> {
  const body = await readFixture('public-with-comment.md');
  const m = CANARY_B_RE.exec(body);
  if (m === null) {
    throw new Error('fixture public-with-comment.md does not contain canary B');
  }
  return m[0];
}

async function run(): Promise<PipelineResult> {
  const config = defineConfig({
    site: {
      title: 'vault-mixed integration',
      url: 'https://example.com',
      author: 'tester',
    },
    vaults: [
      {
        id: 'fixture',
        path: VAULT_ROOT,
        ignore: ['.obsidian/**', '.trash/**'],
      },
    ],
    publishing: {
      tagBlocklist: ['client/**'],
    },
  });
  return runCorePipeline(config);
}

describe('vault-mixed integration — privacy invariants', () => {
  let result: PipelineResult;
  let concatPublicHtml: string;
  let canaryA: string;
  let canaryB: string;

  beforeAll(async () => {
    canaryA = await loadCanaryA();
    canaryB = await loadCanaryB();
    result = await run();
    concatPublicHtml = [...result.renderedHtml.values()].join('\n');
  });

  it('[1] publicSlugs matches the exact expected set of 8 public notes', () => {
    const expected = new Set([
      'public-note',
      'another-public',
      'public-with-image',
      'public-with-embed',
      'public-with-comment',
      'public-with-extra-fm',
      'public-with-secret-tag',
      'note-with-alias',
    ]);
    expect([...result.publicSlugs].sort()).toEqual([...expected].sort());
  });

  it('[2] canary A (DO_NOT_LEAK_BANANA_*) does not appear in any rendered public HTML', () => {
    expect(canaryA).toMatch(/^DO_NOT_LEAK_BANANA_/);
    expect(concatPublicHtml.includes(canaryA)).toBe(false);
  });

  it('[3] no <a ...> tag has "private secret" in its href or title attribute', () => {
    const anchorWithPrivateSecret =
      /<a\s[^>]*(?:href|title)\s*=\s*["'][^"']*private\s*secret/i;
    expect(anchorWithPrivateSecret.test(concatPublicHtml)).toBe(false);
  });

  it('[4] attachmentClosure includes only-public.png and excludes only-private.png', () => {
    expect(result.attachmentClosure.has('only-public.png')).toBe(true);
    expect(result.attachmentClosure.has('only-private.png')).toBe(false);
  });

  it('[5] publicGraph contains only public nodes and edges whose endpoints are public', () => {
    const publicSet = result.publicSlugs;
    for (const n of result.publicGraph.nodes) {
      expect(publicSet.has(n)).toBe(true);
    }
    for (const e of result.publicGraph.edges) {
      expect(publicSet.has(e.from)).toBe(true);
      expect(publicSet.has(e.to)).toBe(true);
    }
  });

  it('[6] private/family-photos.md is not public and is reported with a TRIPWIRE_REJECTED warning exactly once', () => {
    expect(result.publicSlugs.has('private/family-photos')).toBe(false);
    const tripwireHits = result.warnings.filter(
      (w) =>
        w.code === 'TRIPWIRE_REJECTED' &&
        (w.file ?? '').replace(/\\/g, '/') === 'private/family-photos.md',
    );
    expect(tripwireHits).toHaveLength(1);
  });

  it('[7] public-with-embed HTML expands Another Public and contains no canary A', () => {
    const html = result.renderedHtml.get('public-with-embed');
    expect(html).toBeDefined();
    expect(html).toContain('또 다른 공개 노트');
    expect(html!.includes(canaryA)).toBe(false);
  });

  it('[8] canary B (CLAUDE_COMMENT_LEAK_*) and raw "%%" delimiters are absent from all rendered public HTML', () => {
    expect(canaryB).toMatch(/^CLAUDE_COMMENT_LEAK_/);
    expect(concatPublicHtml.includes(canaryB)).toBe(false);
    expect(concatPublicHtml.includes('%%')).toBe(false);
  });

  it('[9] public-with-extra-fm omits review-date/personal-note/mood from both frontmatter and HTML', () => {
    const fm = result.publicFrontmatter.get('public-with-extra-fm');
    expect(fm).toBeDefined();
    expect(fm).not.toHaveProperty('review-date');
    expect(fm).not.toHaveProperty('personal-note');
    expect(fm).not.toHaveProperty('mood');

    const lower = concatPublicHtml.toLowerCase();
    expect(lower.includes('review-date')).toBe(false);
    expect(lower.includes('personal-note')).toBe(false);
    expect(lower.includes('mood')).toBe(false);
    expect(lower.includes('do not ship')).toBe(false);
    expect(lower.includes('anxious')).toBe(false);
  });

  it('[10] public-with-secret-tag strips client/acme-secret from tags and HTML (public/internal untouched)', () => {
    const tags = result.publicTags.get('public-with-secret-tag');
    expect(tags).toBeDefined();
    expect(tags).not.toContain('client/acme-secret');
    expect(concatPublicHtml.includes('client/acme-secret')).toBe(false);
  });

  it('[11] [[구이름]] resolves to another-public via the frontmatter alias', async () => {
    const raw = await readFixture('another-public.md');
    const fm = matter(raw).data as Record<string, unknown>;
    const aliases = fm['aliases'];
    expect(Array.isArray(aliases)).toBe(true);
    expect((aliases as unknown[]).includes('구이름')).toBe(true);

    const anotherPublic: IndexedNote = {
      id: 'another-public',
      relativePath: 'another-public.md',
      basename: 'another-public',
      aliases: ['구이름'],
    };
    const index = buildWikilinkIndex([anotherPublic]);
    const res = resolveWikilink('구이름', index);
    expect(res.resolved).toBe(true);
    expect(res.note?.id).toBe('another-public');
    expect(res.matchedBy).toBe('alias');
  });
});
