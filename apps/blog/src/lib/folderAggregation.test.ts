import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { defineConfig } from '@noteforge/core/config';
import { runCorePipeline, type PipelineResult } from '@noteforge/core/pipeline';
import { isPublishable } from '@noteforge/core/privacy/publishable';
import {
  assertNoAliasCollisions,
  assertNoFolderCollisions,
} from './routeCollisions.ts';
import {
  buildCategoryIndexViewModel,
  buildCategoryTree,
  buildFolderIndexViewModel,
  buildFolderTree,
  walkCategories,
  walkFolders,
} from './folderAggregation.ts';
import type { NoteEntry } from './viewModels.ts';

interface NoteEntryDataInput {
  title?: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[];
  backlinks?: string[];
  heroImage?: string;
  thumbnailImage?: string;
}

function makeEntry(id: string, data: NoteEntryDataInput = {}): NoteEntry {
  return {
    id,
    collection: 'notes',
    data: {
      kind: 'note',
      frontmatter: data.frontmatter ?? {},
      tags: data.tags ?? [],
      backlinks: data.backlinks ?? [],
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.heroImage !== undefined ? { heroImage: data.heroImage } : {}),
      ...(data.thumbnailImage !== undefined
        ? { thumbnailImage: data.thumbnailImage }
        : {}),
    },
    rendered: { html: '', metadata: {} },
  } as unknown as NoteEntry;
}

function makeAlias(id: string, to: string): NoteEntry {
  return {
    id,
    collection: 'notes',
    data: { kind: 'alias-redirect', to },
    rendered: { html: '', metadata: {} },
  } as unknown as NoteEntry;
}

describe('buildFolderTree — empty input', () => {
  it('returns an empty root', () => {
    expect(buildFolderTree([])).toEqual({
      name: '',
      path: '',
      children: [],
      notes: [],
    });
  });
});

describe('buildFolderTree — root-level notes', () => {
  it('places single root note in root.notes with no children', () => {
    const tree = buildFolderTree([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(tree.children).toEqual([]);
    expect(tree.notes).toEqual([{ slug: 'about', title: 'About' }]);
    expect(tree.name).toBe('');
    expect(tree.path).toBe('');
  });
});

describe('buildFolderTree — single-level folder', () => {
  it('groups two notes under the same first-level folder', () => {
    const tree = buildFolderTree([
      makeEntry('posts/foo', { title: 'Foo' }),
      makeEntry('posts/bar', { title: 'Bar' }),
    ]);
    expect(tree.children).toHaveLength(1);
    const posts = tree.children[0]!;
    expect(posts.name).toBe('posts');
    expect(posts.path).toBe('posts');
    expect(posts.children).toEqual([]);
    expect(posts.notes.map((n) => n.slug)).toEqual(['posts/bar', 'posts/foo']);
  });
});

describe('buildFolderTree — depth ≥ 3', () => {
  it('builds AI/Claude/agents nesting', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/agents', { title: 'agents' }),
    ]);
    expect(tree.children).toHaveLength(1);
    const ai = tree.children[0]!;
    expect(ai.name).toBe('AI');
    expect(ai.path).toBe('AI');
    expect(ai.notes).toEqual([]);
    expect(ai.children).toHaveLength(1);

    const claude = ai.children[0]!;
    expect(claude.name).toBe('Claude');
    expect(claude.path).toBe('AI/Claude');
    expect(claude.children).toEqual([]);
    expect(claude.notes).toEqual([
      { slug: 'AI/Claude/agents', title: 'agents' },
    ]);
  });

  it('handles 6-level nesting without throwing', () => {
    const tree = buildFolderTree([
      makeEntry('a/b/c/d/e/f', { title: 'f' }),
    ]);
    let cursor = tree;
    for (const seg of ['a', 'b', 'c', 'd', 'e']) {
      expect(cursor.children).toHaveLength(1);
      cursor = cursor.children[0]!;
      expect(cursor.name).toBe(seg);
    }
    expect(cursor.notes).toEqual([{ slug: 'a/b/c/d/e/f', title: 'f' }]);
  });
});

describe('buildFolderTree — sort stability', () => {
  it('produces the same tree regardless of input order', () => {
    const a = makeEntry('posts/Z', { title: 'Z' });
    const b = makeEntry('posts/a', { title: 'a' });
    const c = makeEntry('posts/m', { title: 'm' });

    const t1 = buildFolderTree([a, b, c]);
    const t2 = buildFolderTree([c, a, b]);
    const t3 = buildFolderTree([b, c, a]);
    expect(t1).toEqual(t2);
    expect(t2).toEqual(t3);
  });

  it('sorts notes case-insensitively (a, m, Z)', () => {
    const tree = buildFolderTree([
      makeEntry('posts/Z', { title: 'Z' }),
      makeEntry('posts/a', { title: 'a' }),
      makeEntry('posts/m', { title: 'm' }),
    ]);
    expect(tree.children[0]!.notes.map((n) => n.slug)).toEqual([
      'posts/a',
      'posts/m',
      'posts/Z',
    ]);
  });

  it('treats Posts/ and posts/ as different folders (case-sensitive segment id)', () => {
    const tree = buildFolderTree([
      makeEntry('Posts/a', { title: 'a' }),
      makeEntry('posts/b', { title: 'b' }),
    ]);
    const names = tree.children.map((c) => c.name);
    expect(names).toContain('Posts');
    expect(names).toContain('posts');
    expect(tree.children).toHaveLength(2);
  });

  it('sorts folders case-insensitively at each level', () => {
    const tree = buildFolderTree([
      makeEntry('Zeta/x', { title: 'x' }),
      makeEntry('alpha/x', { title: 'x' }),
      makeEntry('Mango/x', { title: 'x' }),
    ]);
    expect(tree.children.map((c) => c.name)).toEqual([
      'alpha',
      'Mango',
      'Zeta',
    ]);
  });
});

describe('buildFolderTree — does not filter', () => {
  it('keeps draft notes if caller passes them in (no filtering responsibility)', () => {
    // The contract: this function receives `filterPublishable` output.
    // If the caller violates that and passes a draft, the function must
    // include it (filtering is not its job).
    const tree = buildFolderTree([
      makeEntry('posts/draft', {
        title: 'draft',
        frontmatter: { draft: true },
      }),
    ]);
    expect(tree.children[0]!.notes.map((n) => n.slug)).toEqual([
      'posts/draft',
    ]);
  });
});

describe('buildFolderTree — alias-redirect entries', () => {
  it('silently skips alias-redirect entries without throwing', () => {
    const tree = buildFolderTree([
      makeAlias('legacy/old-slug', 'posts/new-slug'),
      makeEntry('posts/new-slug', { title: 'new' }),
    ]);
    // legacy/old-slug must not appear anywhere in the tree
    const allSlugs: string[] = [];
    function walk(n: { children: typeof tree.children; notes: typeof tree.notes }): void {
      for (const note of n.notes) allSlugs.push(note.slug);
      for (const child of n.children) walk(child);
    }
    walk(tree);
    expect(allSlugs).toEqual(['posts/new-slug']);
    // The alias's parent folder ('legacy') must not appear either,
    // since the only file inside it was the alias.
    expect(tree.children.map((c) => c.name)).not.toContain('legacy');
  });
});

describe('buildFolderTree — folder-vs-note slug collision', () => {
  it('records both a `posts` note and a `posts/` folder when both exist', () => {
    const tree = buildFolderTree([
      makeEntry('posts', { title: 'Posts index (note)' }),
      makeEntry('posts/foo', { title: 'foo' }),
    ]);
    // 'posts' as a note lives in root.notes
    expect(tree.notes.map((n) => n.slug)).toEqual(['posts']);
    // 'posts/' as a folder lives in root.children
    expect(tree.children).toHaveLength(1);
    const postsFolder = tree.children[0]!;
    expect(postsFolder.name).toBe('posts');
    expect(postsFolder.path).toBe('posts');
    expect(postsFolder.notes.map((n) => n.slug)).toEqual(['posts/foo']);
  });
});

describe('buildFolderTree — title fallback', () => {
  it('falls back to the slug when no title is provided', () => {
    const tree = buildFolderTree([
      makeEntry('posts/no-title', { frontmatter: {} }),
    ]);
    const note = tree.children[0]!.notes[0]!;
    // The contract leaves title fallback up to the implementation,
    // but at minimum it must be a non-empty string and stable.
    expect(typeof note.title).toBe('string');
    expect(note.title.length).toBeGreaterThan(0);
  });
});

describe('buildFolderTree — thumbnail fallback', () => {
  it('stores thumbnailImage when present, otherwise falls back to heroImage', () => {
    const tree = buildFolderTree([
      makeEntry('posts/hero-only', {
        title: 'Hero',
        heroImage: '/attachments/hero.png',
      }),
      makeEntry('posts/thumb', {
        title: 'Thumb',
        heroImage: '/attachments/hero.png',
        thumbnailImage: '/attachments/thumb.png',
      }),
    ]);
    expect(tree.children[0]!.notes).toEqual([
      {
        slug: 'posts/hero-only',
        title: 'Hero',
        thumbnail: '/attachments/hero.png',
      },
      {
        slug: 'posts/thumb',
        title: 'Thumb',
        thumbnail: '/attachments/thumb.png',
      },
    ]);
  });
});

describe('walkFolders', () => {
  it('yields every non-root folder, depth-first', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/agents', { title: 'agents' }),
      makeEntry('AI/Gemini/notes', { title: 'notes' }),
      makeEntry('DB/postgres', { title: 'pg' }),
    ]);
    const paths = [...walkFolders(tree)].map((n) => n.path);
    expect(paths).toEqual([
      'AI',
      'AI/Claude',
      'AI/Gemini',
      'DB',
    ]);
  });

  it('yields nothing for an empty tree', () => {
    expect([...walkFolders(buildFolderTree([]))]).toEqual([]);
  });
});

describe('buildFolderIndexViewModel', () => {
  it('returns null for paths that do not exist in the tree', () => {
    const tree = buildFolderTree([makeEntry('posts/foo', { title: 'foo' })]);
    expect(buildFolderIndexViewModel(tree, 'missing')).toBeNull();
  });

  it('builds breadcrumb root → leaf with trailing-slash hrefs', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/opus', { title: 'opus' }),
    ]);
    const vm = buildFolderIndexViewModel(tree, 'AI/Claude');
    expect(vm).not.toBeNull();
    expect(vm!.folderName).toBe('Claude');
    expect(vm!.folderPath).toBe('AI/Claude');
    expect(vm!.breadcrumb).toEqual([
      { label: 'home', href: '/' },
      { label: 'AI', href: '/AI/' },
      { label: 'Claude', href: '/AI/Claude/' },
    ]);
  });

  it('aggregates child folder note counts recursively', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/a', { title: 'a' }),
      makeEntry('AI/Claude/b', { title: 'b' }),
      makeEntry('AI/Gemini/x', { title: 'x' }),
    ]);
    const vm = buildFolderIndexViewModel(tree, 'AI');
    expect(vm).not.toBeNull();
    expect(vm!.childFolders).toEqual([
      { name: 'Claude', href: '/AI/Claude/', noteCount: 2 },
      { name: 'Gemini', href: '/AI/Gemini/', noteCount: 1 },
    ]);
    expect(vm!.childNotes).toEqual([]);
  });

  it('emits child note hrefs with trailing slash', () => {
    const tree = buildFolderTree([
      makeEntry('posts/foo', { title: 'Foo' }),
      makeEntry('posts/bar', { title: 'Bar' }),
    ]);
    const vm = buildFolderIndexViewModel(tree, 'posts');
    expect(vm!.childNotes).toEqual([
      { title: 'Bar', href: '/posts/bar/' },
      { title: 'Foo', href: '/posts/foo/' },
    ]);
  });

  it('assigns categorySlot to depth-0 folder via the FNV-1a slot mapper', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/x', { title: 'x' }),
    ]);
    const aiVm = buildFolderIndexViewModel(tree, 'AI');
    expect(aiVm!.categorySlot).toBeDefined();
    expect([1, 2, 3, 4, 5]).toContain(aiVm!.categorySlot);
    // Deep folder still mirrors the depth-0 slot (first segment).
    const deepVm = buildFolderIndexViewModel(tree, 'AI/Claude');
    expect(deepVm!.categorySlot).toBe(aiVm!.categorySlot);
  });

  it('renders an empty viewmodel for a folder containing nothing visible', () => {
    // We can't directly construct a public-but-empty folder via the public API;
    // but a folder with only sub-folders is the same shape and is the more
    // realistic path. childNotes empty + childFolders non-empty is the
    // observable expectation here.
    const tree = buildFolderTree([
      makeEntry('AI/Claude/x', { title: 'x' }),
    ]);
    const vm = buildFolderIndexViewModel(tree, 'AI');
    expect(vm!.childNotes).toEqual([]);
    expect(vm!.childFolders.length).toBeGreaterThan(0);
  });
});

// ── Fixture-driven privacy guards (v0.3 step 9) ──────────────────────────────
// Run the core privacy pipeline against the vault-mixed fixture once, then
// verify that `buildFolderTree` (the apps/blog tree builder) and the route-
// collision guards behave correctly across the four cases (a/b/c/d) added in
// step 9. Pipeline output is cached in `beforeAll` so the integration cost is
// paid once per file, not once per test.

const VAULT_MIXED_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'packages',
  'core',
  'tests',
  'fixtures',
  'vault-mixed',
);

interface PublishableLike {
  readonly id: string;
  readonly title: string;
  readonly frontmatter: Record<string, unknown>;
}

/**
 * Convert pipeline output into the shape `buildFolderTree` expects.
 * `filterPublishable` (apps/blog viewModels) drops `draft: true` entries; we
 * mirror that here so the tree we feed in matches what the routing layer sees.
 */
function publishableFromPipeline(result: PipelineResult): PublishableLike[] {
  const out: PublishableLike[] = [];
  for (const slug of result.publicSlugs) {
    const fm = result.publicFrontmatter.get(slug) ?? {};
    if (!isPublishable(fm)) continue;
    const titleRaw = fm['title'];
    const title = typeof titleRaw === 'string' && titleRaw.length > 0 ? titleRaw : slug;
    out.push({ id: slug, title, frontmatter: fm });
  }
  return out;
}

function toEntries(ps: readonly PublishableLike[]): NoteEntry[] {
  return ps.map((p) =>
    makeEntry(p.id, { title: p.title, frontmatter: p.frontmatter }),
  );
}

function collectAllSlugs(tree: ReturnType<typeof buildFolderTree>): string[] {
  const out: string[] = [];
  function walk(n: { children: typeof tree.children; notes: typeof tree.notes }): void {
    for (const note of n.notes) out.push(note.slug);
    for (const child of n.children) walk(child);
  }
  walk(tree);
  return out;
}

describe('buildFolderTree — vault-mixed fixture-driven (v0.3 step 9)', () => {
  let publishable: PublishableLike[];

  beforeAll(async () => {
    const config = defineConfig({
      site: {
        title: 'fixture-driven',
        url: 'https://example.com',
        author: 'tester',
      },
      vaults: [
        {
          id: 'fixture',
          path: VAULT_MIXED_ROOT,
          ignore: ['.obsidian/**', '.trash/**'],
        },
      ],
      publishing: { tagBlocklist: ['client/**'] },
      nav: { mode: 'folder' },
    });
    const result = await runCorePipeline(config);
    publishable = publishableFromPipeline(result);
  });

  it('case (a): deep-nested public note posts/ai/claude/agents survives the pipeline → publishable → tree path', () => {
    // Slugs are lowercased by `computeSlug` (see slugifySegment), so the on-disk
    // `posts/AI/Claude/agents.md` surfaces as `posts/ai/claude/agents`. The tree
    // must materialise the full folder chain.
    const ids = publishable.map((p) => p.id);
    expect(ids).toContain('posts/ai/claude/agents');

    const tree = buildFolderTree(toEntries(publishable));
    const allSlugs = collectAllSlugs(tree);
    expect(allSlugs).toContain('posts/ai/claude/agents');

    // The folder chain must exist depth-3, otherwise the note slug would have
    // been emitted at a shallower level (which would silently break the URL).
    const posts = tree.children.find((c) => c.name === 'posts');
    expect(posts).toBeDefined();
    const ai = posts!.children.find((c) => c.name === 'ai');
    expect(ai).toBeDefined();
    const claude = ai!.children.find((c) => c.name === 'claude');
    expect(claude).toBeDefined();
    expect(claude!.notes.map((n) => n.slug)).toContain('posts/ai/claude/agents');
  });

  it('case (b): tripwire-rejected private/secrets/diary is absent from the publishable set and from the tree', () => {
    // Trivial in the success case (the tripwire keeps the slug out of
    // publicSlugs upstream), but this is the regression guard the step-9 spec
    // explicitly asks for: if `forcedIgnore` or the classify rule weakens in a
    // future refactor, this assertion is the last visual-layer check before
    // the canary leaks into a folder-tree URL.
    const ids = publishable.map((p) => p.id);
    expect(ids).not.toContain('private/secrets/diary');
    expect(ids.some((s) => s.startsWith('private/'))).toBe(false);

    const tree = buildFolderTree(toEntries(publishable));
    expect(tree.children.find((c) => c.name === 'private')).toBeUndefined();
    expect(collectAllSlugs(tree)).not.toContain('private/secrets/diary');
  });

  it('case (c): draft posts/mix/wip is dropped by filterPublishable while sibling visible note remains', () => {
    // `posts/mix/wip` reaches `runCorePipeline.publicSlugs` (it has
    // `public: true`) but `isPublishable` rejects `draft: true`, so by the time
    // the routing layer builds the tree, only `posts/mix/visible` is left.
    const ids = publishable.map((p) => p.id);
    expect(ids).toContain('posts/mix/visible');
    expect(ids).not.toContain('posts/mix/wip');

    const tree = buildFolderTree(toEntries(publishable));
    const posts = tree.children.find((c) => c.name === 'posts');
    const mix = posts?.children.find((c) => c.name === 'mix');
    expect(mix).toBeDefined();
    expect(mix!.notes.map((n) => n.slug)).toEqual(['posts/mix/visible']);
  });

  it('case (d): folder-vs-note slug collision (apps note + apps/colliding/index) does NOT throw at the tree-building layer', () => {
    // Data layer contract: throwing is the routing layer's job (step 6).
    // `buildFolderTree` records both sides and lets the caller decide.
    const ids = publishable.map((p) => p.id);
    expect(ids).toContain('apps');
    expect(ids).toContain('apps/colliding/index');

    expect(() => buildFolderTree(toEntries(publishable))).not.toThrow();

    const tree = buildFolderTree(toEntries(publishable));
    expect(tree.notes.map((n) => n.slug)).toContain('apps');
    const appsFolder = tree.children.find((c) => c.name === 'apps');
    expect(appsFolder).toBeDefined();
    const collidingIds = collectAllSlugs(appsFolder!);
    expect(collidingIds).toContain('apps/colliding/index');
  });
});

describe('apps-level collision throw — case (d) routing-layer guard', () => {
  // The vault-mixed fixture intentionally seeds the case-(d) collision but
  // does NOT trigger the routing-layer throw at the integration level (the
  // fixture is consumed by core tests, never by `apps/blog`'s build). To keep
  // the routing guard exercised, we drive `assertNoFolderCollisions` from a
  // mini in-memory fixture that mirrors what `getStaticPaths` would assemble
  // if vault-mixed were the apps/blog vault: `apps` as a note slug and
  // `apps` as a folder-index slug. The throw must reference both the folder
  // path with trailing slash and the catch-all astro file path so reviewers
  // can land on the routing layer in one click.

  it('routing layer throws when an `apps` note slug collides with an `apps/` folder slug', () => {
    const claimedNoteSlugs = new Set(['apps', 'apps/colliding/index']);
    expect(() =>
      assertNoFolderCollisions(claimedNoteSlugs, [{ slug: 'apps' }]),
    ).toThrow(/route collision: folder 'apps\/'/);
  });

  it('throw message names the colliding folder and the catch-all file path (case d trailer convention)', () => {
    let msg = '';
    try {
      assertNoFolderCollisions(new Set(['apps']), [{ slug: 'apps' }]);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("folder 'apps/'");
    expect(msg).toContain('shares its slug with an existing note or alias');
    expect(msg).toContain('apps/blog/src/pages/[...slug].astro');
  });

  it('alias collisions parallel folder collisions — the case-d trailer is shared', () => {
    let folderMsg = '';
    let aliasMsg = '';
    try {
      assertNoFolderCollisions(new Set(['apps']), [{ slug: 'apps' }]);
    } catch (e) {
      folderMsg = (e as Error).message;
    }
    try {
      assertNoAliasCollisions(new Set(['apps']), [{ slug: 'apps', to: 'other' }]);
    } catch (e) {
      aliasMsg = (e as Error).message;
    }
    const trailer = '(apps/blog/src/pages/[...slug].astro)';
    expect(folderMsg).toContain(trailer);
    expect(aliasMsg).toContain(trailer);
  });
});

// ── buildCategoryTree (v0.7) ────────────────────────────────────────────────
// Mirrors the buildFolderTree contract but takes its tree position from the
// frontmatter `category` field instead of `entry.id`. The leaf `slug` stays
// `entry.id` so URLs continue to resolve via the existing vault-path routes.

describe('buildCategoryTree — empty input', () => {
  it('returns an empty root', () => {
    expect(buildCategoryTree([])).toEqual({
      name: '',
      path: '',
      children: [],
      notes: [],
    });
  });
});

describe('buildCategoryTree — single-segment category', () => {
  it('places a note under one folder when category is a bare string', () => {
    const tree = buildCategoryTree([
      makeEntry('AI/Claude/agents', {
        title: 'agents',
        frontmatter: { category: 'Tech' },
      }),
    ]);
    expect(tree.children).toHaveLength(1);
    const tech = tree.children[0]!;
    expect(tech.name).toBe('Tech');
    // path is slugified (URL-safe) while name preserves the original casing —
    // the sidebar/category-index uses path for the href and name for display.
    expect(tech.path).toBe('tech');
    expect(tech.notes).toEqual([{ slug: 'AI/Claude/agents', title: 'agents' }]);
  });

  it('keeps name original-cased while slugifying path (URL identity)', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: 'PEFT/LoRA' } }),
    ]);
    const peft = tree.children[0]!;
    expect(peft.name).toBe('PEFT');
    expect(peft.path).toBe('peft');
    const lora = peft.children[0]!;
    expect(lora.name).toBe('LoRA');
    expect(lora.path).toBe('peft/lora');
  });

  it('collapses two display names that slugify to the same key into one node', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: 'PEFT' } }),
      makeEntry('b', { title: 'B', frontmatter: { category: 'peft' } }),
    ]);
    expect(tree.children).toHaveLength(1);
    const peft = tree.children[0]!;
    expect(peft.path).toBe('peft');
    // First-seen casing wins as the display name.
    expect(peft.name).toBe('PEFT');
    expect(peft.notes.map((n) => n.slug)).toEqual(['a', 'b']);
  });
});

describe('buildCategoryTree — nested slash-separated category', () => {
  it('builds 에세이/2026 nesting from frontmatter', () => {
    const tree = buildCategoryTree([
      makeEntry('temp_drafts/diary-1', {
        title: 'diary-1',
        frontmatter: { category: '에세이/2026' },
      }),
    ]);
    expect(tree.children).toHaveLength(1);
    const essay = tree.children[0]!;
    expect(essay.name).toBe('에세이');
    expect(essay.path).toBe('에세이');
    expect(essay.notes).toEqual([]);
    expect(essay.children).toHaveLength(1);
    const y2026 = essay.children[0]!;
    expect(y2026.name).toBe('2026');
    expect(y2026.path).toBe('에세이/2026');
    expect(y2026.notes).toEqual([
      { slug: 'temp_drafts/diary-1', title: 'diary-1' },
    ]);
  });

  it('groups multiple notes that share the same category path', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: '에세이/2026' } }),
      makeEntry('b', { title: 'B', frontmatter: { category: '에세이/2026' } }),
      makeEntry('c', { title: 'C', frontmatter: { category: '에세이/2025' } }),
    ]);
    const essay = tree.children[0]!;
    expect(essay.children.map((c) => c.name)).toEqual(['2025', '2026']);
    const y2026 = essay.children.find((c) => c.name === '2026')!;
    expect(y2026.notes.map((n) => n.slug)).toEqual(['a', 'b']);
    const y2025 = essay.children.find((c) => c.name === '2025')!;
    expect(y2025.notes.map((n) => n.slug)).toEqual(['c']);
  });
});

describe('buildCategoryTree — missing or invalid category', () => {
  it('drops a note with no category into root.notes (Uncategorized)', () => {
    const tree = buildCategoryTree([
      makeEntry('AI/Claude/agents', {
        title: 'agents',
        frontmatter: {},
      }),
    ]);
    expect(tree.children).toEqual([]);
    expect(tree.notes).toEqual([
      { slug: 'AI/Claude/agents', title: 'agents' },
    ]);
  });

  it('treats a non-string category (number, array, object) as Uncategorized', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: 42 } }),
      makeEntry('b', { title: 'B', frontmatter: { category: ['x'] } }),
      makeEntry('c', { title: 'C', frontmatter: { category: { x: 1 } } }),
    ]);
    expect(tree.children).toEqual([]);
    expect(tree.notes.map((n) => n.slug)).toEqual(['a', 'b', 'c']);
  });

  it('treats an empty / whitespace-only category string as Uncategorized', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: '' } }),
      makeEntry('b', { title: 'B', frontmatter: { category: '   ' } }),
      makeEntry('c', { title: 'C', frontmatter: { category: '/' } }),
    ]);
    expect(tree.children).toEqual([]);
    expect(tree.notes.map((n) => n.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('buildCategoryTree — path normalisation', () => {
  it('strips leading and trailing slashes', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: '/Tech/' } }),
    ]);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]!.path).toBe('tech');
  });

  it('collapses internal double slashes into a single segment boundary', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: 'Tech//AI' } }),
    ]);
    const tech = tree.children[0]!;
    expect(tech.name).toBe('Tech');
    expect(tech.children).toHaveLength(1);
    expect(tech.children[0]!.name).toBe('AI');
  });

  it('trims whitespace around each segment', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: ' Tech / AI ' } }),
    ]);
    const tech = tree.children[0]!;
    expect(tech.name).toBe('Tech');
    expect(tech.children[0]!.name).toBe('AI');
  });
});

describe('buildCategoryTree — leaf slug invariant', () => {
  it('keeps each leaf note slug equal to entry.id regardless of category path', () => {
    const tree = buildCategoryTree([
      makeEntry('temp_drafts/2026/일기', {
        title: 'Diary',
        frontmatter: { category: '에세이/2026' },
      }),
    ]);
    const essay = tree.children[0]!;
    const y2026 = essay.children[0]!;
    expect(y2026.notes[0]?.slug).toBe('temp_drafts/2026/일기');
  });
});

describe('walkCategories', () => {
  it('yields every non-root category node in pre-order', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: 'PEFT/LoRA' } }),
      makeEntry('b', { title: 'B', frontmatter: { category: 'PEFT/AdaLoRA' } }),
      makeEntry('c', { title: 'C', frontmatter: { category: 'RAG' } }),
    ]);
    const paths = [...walkCategories(tree)].map((n) => n.path);
    expect(paths).toEqual(['peft', 'peft/adalora', 'peft/lora', 'rag']);
  });

  it('yields nothing for an empty tree', () => {
    expect([...walkCategories(buildCategoryTree([]))]).toEqual([]);
  });
});

describe('buildCategoryIndexViewModel', () => {
  it('returns null for paths that do not exist in the tree', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: 'PEFT' } }),
    ]);
    expect(buildCategoryIndexViewModel(tree, 'missing')).toBeNull();
  });

  it('breadcrumb labels carry original category name; hrefs use slugified path', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: 'PEFT/LoRA' } }),
    ]);
    const vm = buildCategoryIndexViewModel(tree, 'peft/lora');
    expect(vm).not.toBeNull();
    expect(vm!.folderName).toBe('LoRA');
    expect(vm!.folderPath).toBe('peft/lora');
    expect(vm!.breadcrumb).toEqual([
      { label: 'home', href: '/' },
      { label: 'PEFT', href: '/peft/' },
      { label: 'LoRA', href: '/peft/lora/' },
    ]);
  });

  it('childFolders use original name + slugified href, recursive note counts', () => {
    const tree = buildCategoryTree([
      makeEntry('a', { title: 'A', frontmatter: { category: 'PEFT/LoRA' } }),
      makeEntry('b', { title: 'B', frontmatter: { category: 'PEFT/LoRA' } }),
      makeEntry('c', { title: 'C', frontmatter: { category: 'PEFT/AdaLoRA' } }),
    ]);
    const vm = buildCategoryIndexViewModel(tree, 'peft');
    expect(vm).not.toBeNull();
    expect(vm!.childFolders).toEqual([
      { name: 'AdaLoRA', href: '/peft/adalora/', noteCount: 1 },
      { name: 'LoRA', href: '/peft/lora/', noteCount: 2 },
    ]);
    expect(vm!.childNotes).toEqual([]);
  });

  it('childNotes use entry.id slug for href (already category-prefixed upstream)', () => {
    const tree = buildCategoryTree([
      makeEntry('peft/lora/lora-란', {
        title: 'LoRA 란',
        frontmatter: { category: 'PEFT/LoRA' },
      }),
    ]);
    const vm = buildCategoryIndexViewModel(tree, 'peft/lora');
    expect(vm!.childNotes).toEqual([
      { title: 'LoRA 란', href: '/peft/lora/lora-란/' },
    ]);
  });

  it('mixed node — surfaces both child categories and direct notes', () => {
    const tree = buildCategoryTree([
      makeEntry('peft/peft-overview', {
        title: 'PEFT 개요',
        frontmatter: { category: 'PEFT' },
      }),
      makeEntry('peft/lora/x', {
        title: 'X',
        frontmatter: { category: 'PEFT/LoRA' },
      }),
    ]);
    const vm = buildCategoryIndexViewModel(tree, 'peft');
    expect(vm!.childFolders.map((f) => f.name)).toEqual(['LoRA']);
    expect(vm!.childNotes.map((n) => n.title)).toEqual(['PEFT 개요']);
  });
});

describe('buildCategoryTree — sort and skip', () => {
  it('sorts folders and notes case-insensitively', () => {
    const tree = buildCategoryTree([
      makeEntry('z', { title: 'z', frontmatter: { category: 'Zeta' } }),
      makeEntry('a', { title: 'a', frontmatter: { category: 'alpha' } }),
      makeEntry('m', { title: 'm', frontmatter: { category: 'Mango' } }),
    ]);
    expect(tree.children.map((c) => c.name)).toEqual(['alpha', 'Mango', 'Zeta']);
  });

  it('silently skips alias-redirect entries', () => {
    const tree = buildCategoryTree([
      makeAlias('legacy/old', 'posts/new'),
      makeEntry('posts/new', {
        title: 'new',
        frontmatter: { category: 'Tech' },
      }),
    ]);
    const tech = tree.children[0]!;
    expect(tech.notes.map((n) => n.slug)).toEqual(['posts/new']);
    expect(tree.children.map((c) => c.name)).not.toContain('legacy');
  });
});
