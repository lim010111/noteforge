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
const CANARY_C_RE = /FOLDER_TREE_DO_NOT_LEAK_[A-Za-z0-9]+/;

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

/**
 * Canary C lives in v0.3 case (b)'s tripwire fixture (`private/secrets/diary.md`),
 * embedded both in the frontmatter `title` and once in the body. Both call sites
 * must remain absent from any rendered public HTML — the title check guards
 * against a future regression where audit's `private-note-title-in-html` is
 * weakened, and the body check parallels canary A's classic "private body never
 * leaks" invariant.
 */
async function loadCanaryC(): Promise<string> {
  const body = await readFixture('private/secrets/diary.md');
  const m = CANARY_C_RE.exec(body);
  if (m === null) {
    throw new Error(
      'fixture private/secrets/diary.md does not contain canary C',
    );
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
  let canaryC: string;

  beforeAll(async () => {
    canaryA = await loadCanaryA();
    canaryB = await loadCanaryB();
    canaryC = await loadCanaryC();
    result = await run();
    concatPublicHtml = [...result.renderedHtml.values()].join('\n');
  });

  it('[1] publicSlugs matches the exact expected set of 14 public notes', () => {
    // The set spans the v0.1/v0.2 baseline (8 notes) plus the v0.3 fixture
    // additions: case (a) deep-public branch, case (c) draft+visible mix, and
    // case (d) folder-vs-note slug collision (`apps` note + `apps/colliding/index`
    // sibling). Case (b) `private/secrets/diary` is intentionally absent — the
    // tripwire guard fires below in [12]. v0.5 adds `public-with-math` to
    // exercise the KaTeX SSR path.
    const expected = new Set([
      'public-note',
      'another-public',
      'public-with-image',
      'public-with-embed',
      'public-with-comment',
      'public-with-extra-fm',
      'public-with-secret-tag',
      'public-with-math',
      'note-with-alias',
      'posts/ai/claude/agents',
      'posts/mix/visible',
      'posts/mix/wip',
      'apps',
      'apps/colliding/index',
    ]);
    expect([...result.publicSlugs].sort()).toEqual([...expected].sort());
  });

  it('[2] canary A (DO_NOT_LEAK_BANANA_*) does not appear in any rendered public HTML', () => {
    expect(canaryA).toMatch(/^DO_NOT_LEAK_BANANA_/);
    expect(concatPublicHtml.includes(canaryA)).toBe(false);
  });

  it('[2b] canary C (FOLDER_TREE_DO_NOT_LEAK_*) — case (b) tripwire fixture\'s title + body never reach rendered HTML', () => {
    // Canary C is embedded in BOTH the frontmatter `title` and the body of
    // `private/secrets/diary.md`. Two distinct leak surfaces, one assertion —
    // a future regression that, say, renders private titles into og:image alt
    // text would surface here before reaching the audit's redacted-title path.
    expect(canaryC).toMatch(/^FOLDER_TREE_DO_NOT_LEAK_/);
    expect(concatPublicHtml.includes(canaryC)).toBe(false);
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

  it('[4b] firstImage exposes /attachments/only-public.png for public-with-image and is empty for image-less notes', () => {
    // public-with-image embeds `![[only-public.png]]` which the pipeline
    // rewrites into an mdast image with `/attachments/only-public.png` —
    // exactly the URL the theme will paint as the hero background.
    expect(result.firstImage.get('public-with-image')).toBe(
      '/attachments/only-public.png',
    );
    // public-note has no image, so firstImage should not register an entry.
    expect(result.firstImage.has('public-note')).toBe(false);
    // Privacy gate: a note pulling only-private.png (none of the public
    // fixtures do, but the closure check is the contract) would never appear
    // here because the URL is filtered through `attachmentClosure`.
    for (const url of result.firstImage.values()) {
      if (url.startsWith('/attachments/')) {
        const id = url.slice('/attachments/'.length);
        expect(result.attachmentClosure.has(id)).toBe(true);
      }
    }
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

  it('[6b] private/secrets/diary.md (v0.3 case b) is tripwire-rejected and never appears in publicSlugs', () => {
    // Case (b) is the deeper-nested mirror of [6] — the tripwire predicate
    // matches `private/**` recursively, so a note buried two folders down must
    // also be rejected even when its frontmatter declares `public: true`. This
    // assertion guards the tripwire glob against future regressions that match
    // only the immediate `private/<file>.md` pattern.
    expect(result.publicSlugs.has('private/secrets/diary')).toBe(false);
    const tripwireHits = result.warnings.filter(
      (w) =>
        w.code === 'TRIPWIRE_REJECTED' &&
        (w.file ?? '').replace(/\\/g, '/') === 'private/secrets/diary.md',
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

  it('[10] public-with-secret-tag strips client/acme-secret from tags and HTML (gate tag also dropped)', () => {
    const tags = result.publicTags.get('public-with-secret-tag');
    expect(tags).toBeDefined();
    expect(tags).not.toContain('client/acme-secret');
    expect(concatPublicHtml.includes('client/acme-secret')).toBe(false);
  });

  it('[10b] publicTags drops the publish-gate tag (#public and #public/* subtags) on every public note', () => {
    // The publish-gate tag is what opts a note INTO publication, so its
    // presence on every public note is a structural tautology. Surfacing it
    // in tag chips / tag pages would imply meaningful authorship intent,
    // when actually it is just the on/off switch.
    //
    // `another-public.md` has `tags: [public]` only — after gate-stripping
    // its publicTags must be empty.
    expect(result.publicTags.get('another-public')).toEqual([]);
    // `public-with-secret-tag.md` has `[public, client/acme-secret,
    // public/internal]`. tagBlocklist drops the `client/**` entry, the gate
    // strip drops both `public` and `public/internal` — leaving an empty
    // tag list.
    expect(result.publicTags.get('public-with-secret-tag')).toEqual([]);
    // No public note's surfaced tag list may contain a gate-shaped entry.
    for (const tags of result.publicTags.values()) {
      for (const t of tags) {
        expect(t === 'public' || t.startsWith('public/')).toBe(false);
      }
    }
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

  it('[12] public-with-math renders KaTeX HTML for $...$ and $$...$$ — raw dollars do not survive', () => {
    const html = result.renderedHtml.get('public-with-math');
    expect(html).toBeDefined();
    // KaTeX SSR wraps every formula in a `.katex` span; display formulas add
    // an outer `.katex-display`. The fixture has both an inline (`$a^2 + b^2
    // = c^2$`), a single-line display (`$$W \leftarrow W + \Delta W$$`,
    // promoted by the pipeline), and a fenced display block — so we expect
    // `katex-display` at least twice.
    expect(html).toMatch(/class="katex"/);
    const displayMatches = html!.match(/class="katex-display"/g);
    expect(displayMatches).not.toBeNull();
    expect(displayMatches!.length).toBeGreaterThanOrEqual(2);
    // Raw delimiters must not survive the render — if they do, the math
    // pipeline silently fell back to text and KaTeX never ran.
    expect(html).not.toContain('$$');
    expect(html).not.toContain('$a^2 + b^2 = c^2$');
  });
});
