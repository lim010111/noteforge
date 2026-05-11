/**
 * Tests for `renderPublicNote` — the per-note privacy render unit.
 *
 * The interface is the test surface: we hand it crafted `ParsedNote` +
 * pre-linkRewritten mdast inputs, and assert on observable `RenderedNote`
 * output. Internal seams (`expandTransclusions`, `filterFrontmatter`, etc.)
 * have their own focused tests; here we verify they are composed correctly.
 */

import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Root } from 'mdast';
import { describe, expect, it } from 'vitest';

import { renderPublicNote } from '../src/render/renderPublicNote.ts';
import { buildWikilinkIndex } from '../src/resolve/wikilink.ts';
import type { ParsedNote } from '../src/types.ts';
import type { VaultIndexSnapshot } from '../src/vaultIndex/types.ts';

const FRONTMATTER_ALLOWLIST = [
  'title',
  'description',
  'date',
  'tags',
  'cover',
  'thumbnail',
  'public',
];

function md(body: string): Root {
  return fromMarkdown(body) as unknown as Root;
}

function note(
  slug: string,
  body: string,
  frontmatter: Record<string, unknown> = {},
  tags: readonly string[] = [],
): ParsedNote {
  return {
    path: `/abs/${slug}.md`,
    vaultId: 'main',
    relativePath: `${slug}.md`,
    frontmatter: Object.freeze({ ...frontmatter }),
    tags: Object.freeze([...tags]),
    body,
  };
}

function snapshot(
  notes: readonly { id: string; relativePath: string; basename: string; aliases: readonly string[] }[],
  attachments: readonly string[] = [],
): VaultIndexSnapshot {
  const slugByRelPath = new Map(notes.map((n) => [n.relativePath, n.id]));
  const relPathBySlug = new Map(notes.map((n) => [n.id, n.relativePath]));
  const attachmentByBasenameLower = new Map<string, string>();
  for (const a of attachments) {
    const base = a.split('/').pop()?.toLowerCase() ?? '';
    attachmentByBasenameLower.set(base, a);
  }
  return {
    notes: [],
    slugByRelPath,
    relPathBySlug,
    indexedNotes: notes,
    wikilinkIndex: buildWikilinkIndex(notes),
    attachments,
    attachmentByBasenameLower,
  };
}

describe('renderPublicNote — html + headings', () => {
  it('renders a public note body to HTML and collects h2/h3/h4 headings', () => {
    const tree = md('# Title\n\n## Section\n\nbody\n\n### Sub\n');
    const result = renderPublicNote({
      rewrittenMdast: tree,
      note: note('foo', '# Title\n\n## Section\n\nbody\n\n### Sub\n'),
      slug: 'foo',
      vaultIndex: snapshot([{ id: 'foo', relativePath: 'foo.md', basename: 'foo', aliases: [] }]),
      publicSlugs: new Set(['foo']),
      getRewrittenMdast: () => undefined,
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: [],
      gateTag: 'public',
    });

    expect(result.html).toContain('<h2');
    expect(result.html).toContain('Section');
    expect(result.headings.map((h) => h.depth)).toEqual([2, 3]);
    expect(result.headings.map((h) => h.text)).toEqual(['Section', 'Sub']);
  });
});

describe('renderPublicNote — frontmatter + tags', () => {
  it('filters frontmatter to allowlist (drops keys outside)', () => {
    const result = renderPublicNote({
      rewrittenMdast: md(''),
      note: note('foo', '', {
        title: 'Foo',
        secret_key: 'should-not-leak',
        date: '2026-05-10',
      }),
      slug: 'foo',
      vaultIndex: snapshot([{ id: 'foo', relativePath: 'foo.md', basename: 'foo', aliases: [] }]),
      publicSlugs: new Set(['foo']),
      getRewrittenMdast: () => undefined,
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: [],
      gateTag: 'public',
    });

    expect(result.frontmatter).toHaveProperty('title', 'Foo');
    expect(result.frontmatter).toHaveProperty('date', '2026-05-10');
    expect(result.frontmatter).not.toHaveProperty('secret_key');
  });

  it('strips the gate tag and its `gate/...` subtags from the public tag list', () => {
    const result = renderPublicNote({
      rewrittenMdast: md(''),
      note: note('foo', '', {}, ['public', 'public/draft', 'tutorial', 'rust']),
      slug: 'foo',
      vaultIndex: snapshot([{ id: 'foo', relativePath: 'foo.md', basename: 'foo', aliases: [] }]),
      publicSlugs: new Set(['foo']),
      getRewrittenMdast: () => undefined,
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: [],
      gateTag: 'public',
    });

    expect([...result.tags].sort()).toEqual(['rust', 'tutorial']);
  });

  it('drops blocklisted tags', () => {
    const result = renderPublicNote({
      rewrittenMdast: md(''),
      note: note('foo', '', {}, ['rust', 'wip', 'tutorial']),
      slug: 'foo',
      vaultIndex: snapshot([{ id: 'foo', relativePath: 'foo.md', basename: 'foo', aliases: [] }]),
      publicSlugs: new Set(['foo']),
      getRewrittenMdast: () => undefined,
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: ['wip'],
      gateTag: 'public',
    });

    expect([...result.tags].sort()).toEqual(['rust', 'tutorial']);
  });
});

describe('renderPublicNote — transclusion', () => {
  it('expands a public transclusion target via getRewrittenMdast', () => {
    const transcludedTree = md('## Embedded section\n\nembedded body');
    const sourceTree = md('![[other]]');

    const result = renderPublicNote({
      rewrittenMdast: sourceTree,
      note: note('source', '![[other]]'),
      slug: 'source',
      vaultIndex: snapshot([
        { id: 'source', relativePath: 'source.md', basename: 'source', aliases: [] },
        { id: 'other', relativePath: 'other.md', basename: 'other', aliases: [] },
      ]),
      publicSlugs: new Set(['source', 'other']),
      getRewrittenMdast: (slug) => (slug === 'other' ? transcludedTree : undefined),
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: [],
      gateTag: 'public',
    });

    expect(result.html).toContain('Embedded section');
    expect(result.html).toContain('embedded body');
  });

  it('drops a transclusion of a private target — no leaked title or body', () => {
    const sourceTree = md('before ![[private-note]] after');

    const result = renderPublicNote({
      rewrittenMdast: sourceTree,
      note: note('source', 'before ![[private-note]] after'),
      slug: 'source',
      vaultIndex: snapshot([
        { id: 'source', relativePath: 'source.md', basename: 'source', aliases: [] },
        {
          id: 'private-note',
          relativePath: 'private-note.md',
          basename: 'private-note',
          aliases: [],
        },
      ]),
      publicSlugs: new Set(['source']), // private-note is not public
      // getRewrittenMdast SHOULDN'T even be called for the private target —
      // the privacy gate intercepts before the lookup.
      getRewrittenMdast: () => {
        throw new Error('getRewrittenMdast must not be called for a private target');
      },
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: [],
      gateTag: 'public',
    });

    expect(result.html).not.toContain('private-note');
    expect(result.html).toContain('before');
    expect(result.html).toContain('after');
  });
});

describe('renderPublicNote — image extraction', () => {
  it('returns raw image URLs when no closure is provided', () => {
    const tree = md('![alt1](/attachments/img-a.png)\n\n![alt2](/attachments/img-b.png)');

    const result = renderPublicNote({
      rewrittenMdast: tree,
      note: note('foo', '![alt1](/attachments/img-a.png)'),
      slug: 'foo',
      vaultIndex: snapshot(
        [{ id: 'foo', relativePath: 'foo.md', basename: 'foo', aliases: [] }],
        ['img-a.png', 'img-b.png'],
      ),
      publicSlugs: new Set(['foo']),
      getRewrittenMdast: () => undefined,
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: [],
      gateTag: 'public',
    });

    expect(result.embeddedImages).toEqual([
      '/attachments/img-a.png',
      '/attachments/img-b.png',
    ]);
    expect(result.firstImage).toBe('/attachments/img-a.png');
  });

  it('emits raw frontmatter image fields verbatim — closure gating is the orchestrator’s job', () => {
    const result = renderPublicNote({
      rewrittenMdast: md(''),
      note: note('foo', '', { cover: '/attachments/foo.png' }),
      slug: 'foo',
      vaultIndex: snapshot(
        [{ id: 'foo', relativePath: 'foo.md', basename: 'foo', aliases: [] }],
        ['foo.png'],
      ),
      publicSlugs: new Set(['foo']),
      getRewrittenMdast: () => undefined,
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: [],
      gateTag: 'public',
    });

    expect(result.frontmatter).toHaveProperty('cover', '/attachments/foo.png');
  });
});

describe('renderPublicNote — attachment refs', () => {
  it('collects attachment refs from raw body (`![[image.png]]` form) and frontmatter (cover/thumbnail)', () => {
    const body = '![[img-a.png]] some text ![[img-b.png|alt]]';
    const result = renderPublicNote({
      rewrittenMdast: md(body),
      note: note('foo', body, {
        cover: '/attachments/img-cover.png',
        thumbnail: '/attachments/img-b.png',
      }),
      slug: 'foo',
      vaultIndex: snapshot(
        [{ id: 'foo', relativePath: 'foo.md', basename: 'foo', aliases: [] }],
        ['img-a.png', 'img-b.png', 'img-cover.png'],
      ),
      publicSlugs: new Set(['foo']),
      getRewrittenMdast: () => undefined,
      frontmatterAllowlist: FRONTMATTER_ALLOWLIST,
      tagBlocklist: [],
      gateTag: 'public',
    });

    const ids = result.attachmentRefs.map((r) => r.id).sort();
    // body: img-a, img-b   frontmatter: img-cover, img-b
    expect(ids).toEqual(['img-a.png', 'img-b.png', 'img-b.png', 'img-cover.png']);
    expect(result.attachmentRefs.every((r) => r.sourceNoteId === 'foo')).toBe(true);
  });
});
