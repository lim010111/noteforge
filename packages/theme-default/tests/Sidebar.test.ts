/**
 * Container-API tests for `<Sidebar />` (and the FolderTree / AvatarBlock
 * compositions it owns).
 *
 * Why these eight assertions:
 *   - DOM nesting (1)             : guards the recursive markup contract — every
 *                                   folder is a <details> with a sibling <a>
 *                                   for the name and a nested <ul> for kids.
 *                                   A regression in the recursion that flattened
 *                                   the tree would silently break navigation.
 *   - aria-current=page (2)        : the only mechanism for "active row". Must
 *                                   appear on the matching note link, nowhere
 *                                   else. Multiple aria-current="page" attrs
 *                                   on a page is a WCAG violation.
 *   - <details open> chain (3)     : when the active note lives several levels
 *                                   deep, every ancestor must auto-open so the
 *                                   user can see "where they are". Sibling
 *                                   folders must stay collapsed.
 *   - active folder index (4)      : when activeFolderPath matches a folder,
 *                                   that folder's NAME link gets aria-current,
 *                                   not any contained note. The note links in
 *                                   that case must NOT carry aria-current.
 *   - empty tree silent (5)        : an empty `<nav aria-label="Folder tree">`
 *                                   is a leak signal. The wrapper must be
 *                                   omitted entirely when there are no public
 *                                   children.
 *   - empty AvatarBlock silent (6) : same principle for identity. Missing both
 *                                   avatar and nickname → no card, no
 *                                   placeholder. (privacy-adjacent.)
 *   - category-accent determinism (7): the same first-segment must map to the
 *                                   same `--color-accent-cat-N` slot every
 *                                   render — anything else makes the tree
 *                                   colours flicker between page loads.
 *   - canary regression (8)        : the privacy-CRITICAL gate. Tree input is
 *                                   already `filterPublishable`-filtered; the
 *                                   component must not synthesise any text
 *                                   from a hypothetical private branch.
 *                                   `DO_NOT_LEAK_BANANA_6f3c1` must be 0 in
 *                                   the rendered HTML.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Sidebar from '../src/components/Sidebar.astro';
import FolderTree from '../src/components/FolderTree.astro';
import AvatarBlock from '../src/components/AvatarBlock.astro';
import type { SidebarProps } from '../src/components/Sidebar.types';
import type { FolderTreeProps } from '../src/components/FolderTree.types';
import type { AvatarBlockProps } from '../src/components/AvatarBlock.types';
import type { FolderNode } from '../src/lib/folderTree.types';
import { CATEGORY_ACCENT_SLOT_COUNT } from '../src/lib/categoryAccent';

async function renderSidebar(props: SidebarProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Sidebar as never, {
    props: props as unknown as Record<string, unknown>,
  });
}

async function renderTree(props: FolderTreeProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(FolderTree as never, {
    props: props as unknown as Record<string, unknown>,
  });
}

async function renderAvatar(props: AvatarBlockProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(AvatarBlock as never, {
    props: props as unknown as Record<string, unknown>,
  });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

/**
 * Locate the <a href={folderHref}> link in the rendered HTML, walk back to
 * the most recent `<details` opening, and report whether its attribute string
 * contains the boolean `open` token.
 *
 * Why this and not a coarse single-shot regex: a lazy `[\s\S]*?` between
 * `<details>` and the next `<a href="/foo/">` will happily match a different
 * <details> than the one we mean to inspect (the regex engine starts at the
 * leftmost <details> and looks forward, so a sibling's <details> can satisfy
 * the pattern). Locality matters — the *nearest* preceding <details> is the
 * one that actually wraps this folder.
 */
function detailsOpenForFolder(html: string, folderHref: string): boolean {
  const linkPattern = new RegExp(
    `<a\\s[^>]*\\bhref="${folderHref.replace(/[/.]/g, '\\$&')}"`,
  );
  const linkIdx = html.search(linkPattern);
  if (linkIdx < 0) {
    throw new Error(`folder link <a href="${folderHref}"> not found in HTML`);
  }
  const before = html.slice(0, linkIdx);
  const lastDetailsIdx = before.lastIndexOf('<details');
  if (lastDetailsIdx < 0) {
    throw new Error(`no <details> precedes <a href="${folderHref}">`);
  }
  const detailsTagEnd = before.indexOf('>', lastDetailsIdx);
  const openingTag = before.slice(lastDetailsIdx, detailsTagEnd + 1);
  return /\bopen\b/.test(openingTag);
}

/**
 * Fixture (depth 3):
 *   posts/
 *     ├─ a (note)
 *     └─ b (note)
 *   AI/
 *     └─ Claude/
 *         └─ agents (note)
 *   about (root-level note)
 *
 * Sorted alphabetically (case-insensitive) just like buildFolderTree's
 * output: AI, posts at root; about as the only root-level note. (Folders
 * sort before notes at each level by virtue of being separate fields.)
 */
function buildFixture(): FolderNode {
  return {
    name: '',
    path: '',
    children: [
      {
        name: 'AI',
        path: 'AI',
        children: [
          {
            name: 'Claude',
            path: 'AI/Claude',
            children: [],
            notes: [{ slug: 'AI/Claude/agents', title: 'agents' }],
          },
        ],
        notes: [],
      },
      {
        name: 'posts',
        path: 'posts',
        children: [],
        notes: [
          { slug: 'posts/a', title: 'a' },
          { slug: 'posts/b', title: 'b' },
        ],
      },
    ],
    notes: [{ slug: 'about', title: 'about' }],
  };
}

describe('Sidebar (composition + FolderTree + AvatarBlock)', () => {
  it('(1) DOM nesting matches the input tree — folders as <details>, notes as <a>', async () => {
    const html = await renderSidebar({
      folderTree: buildFixture(),
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    // top-level <nav> + <ul>
    expect(
      countMatches(html, /<nav\s[^>]*\baria-label="Folder tree"/g),
      'exactly one <nav aria-label="Folder tree"> wraps the tree',
    ).toBe(1);
    // 2 top-level folder <details> (AI, posts), plus 1 nested (AI/Claude) = 3 total
    expect(
      countMatches(html, /<details\b/g),
      'three <details>: AI, AI/Claude, posts',
    ).toBe(3);
    // folder name links (AI, AI/Claude, posts) — trailing slash per ADR-012
    expect(html).toMatch(/<a\s[^>]*\bhref="\/AI\/"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/AI\/Claude\/"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/posts\/"/);
    // note links (one per leaf)
    expect(html).toMatch(/<a\s[^>]*\bhref="\/AI\/Claude\/agents\/"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/posts\/a\/"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/posts\/b\/"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/about\/"/);
  });

  it('(2) activeSlug=AI/Claude/agents → exactly one aria-current="page", on the note link', async () => {
    const html = await renderSidebar({
      folderTree: buildFixture(),
      activeSlug: 'AI/Claude/agents',
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(
      countMatches(html, /\baria-current="page"/g),
      'exactly one aria-current="page" — multiple is a WCAG violation',
    ).toBe(1);
    // It must be on the note link, not on a folder name link.
    expect(
      html,
      'aria-current=page must sit on /AI/Claude/agents/ link',
    ).toMatch(/<a\s[^>]*\bhref="\/AI\/Claude\/agents\/"[^>]*\baria-current="page"/);
    // No folder name link gets aria-current in this scenario.
    expect(
      html,
      'no folder link should be aria-current when only activeSlug is set',
    ).not.toMatch(/<a\s[^>]*\bhref="\/AI\/"[^>]*\baria-current="page"/);
    expect(html).not.toMatch(/<a\s[^>]*\bhref="\/AI\/Claude\/"[^>]*\baria-current="page"/);
  });

  it('(3) activeSlug deep in tree → ancestors auto-open; siblings stay collapsed', async () => {
    const html = await renderSidebar({
      folderTree: buildFixture(),
      activeSlug: 'AI/Claude/agents',
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(detailsOpenForFolder(html, '/AI/'), 'AI auto-opens (ancestor of active note)').toBe(true);
    expect(detailsOpenForFolder(html, '/AI/Claude/'), 'AI/Claude auto-opens (ancestor of active note)').toBe(true);
    expect(detailsOpenForFolder(html, '/posts/'), 'posts stays collapsed (sibling of active branch)').toBe(false);
  });

  it('(4) activeFolderPath=AI/Claude/ → AI and AI/Claude open; folder NAME has aria-current', async () => {
    const html = await renderSidebar({
      folderTree: buildFixture(),
      activeFolderPath: 'AI/Claude/',
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(detailsOpenForFolder(html, '/AI/'), 'AI auto-opens (ancestor of active folder)').toBe(true);
    expect(
      detailsOpenForFolder(html, '/AI/Claude/'),
      'AI/Claude auto-opens (is the active folder itself)',
    ).toBe(true);
    expect(detailsOpenForFolder(html, '/posts/'), 'posts stays collapsed').toBe(false);
    expect(
      countMatches(html, /\baria-current="page"/g),
      'exactly one aria-current="page" — the active folder name link',
    ).toBe(1);
    expect(
      html,
      'AI/Claude folder name link carries aria-current="page"',
    ).toMatch(/<a\s[^>]*\bhref="\/AI\/Claude\/"[^>]*\baria-current="page"/);
    expect(
      html,
      'no note link should be aria-current when activeSlug is unset',
    ).not.toMatch(/<a\s[^>]*\bhref="\/AI\/Claude\/agents\/"[^>]*\baria-current="page"/);
  });

  it('(5) empty tree (root.children=[] && root.notes=[]) → no <nav>, no folder-tree markup', async () => {
    const empty: FolderNode = { name: '', path: '', children: [], notes: [] };
    const html = await renderTree({
      root: empty,
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(
      countMatches(html, /<nav\b/g),
      'empty tree must NOT emit <nav> — empty navigation leaks "filtered here"',
    ).toBe(0);
    expect(
      countMatches(html, /<details\b/g),
      'empty tree must not emit any <details>',
    ).toBe(0);
    expect(
      html,
      '"Folder tree" aria-label must not appear',
    ).not.toMatch(/Folder tree/);
  });

  it('(6) AvatarBlock silent when both avatarSrc and nickname are missing', async () => {
    const html = await renderAvatar({});
    expect(
      countMatches(html, /<img\b/g),
      'no <img> when avatarSrc is missing',
    ).toBe(0);
    expect(
      countMatches(html, /<div\b/g),
      'no wrapper <div> when both fields are missing — empty card is a leak signal',
    ).toBe(0);

    // Sanity: avatarSrc only → image renders; nickname only → text renders.
    const avatarOnly = await renderAvatar({ avatarSrc: '/avatar.webp' });
    expect(avatarOnly).toMatch(/<img\s/);
    expect(avatarOnly).not.toMatch(/avatar-block__nickname/);

    const nameOnly = await renderAvatar({ nickname: 'limwoohyun' });
    expect(nameOnly).not.toMatch(/<img\s/);
    expect(nameOnly).toMatch(/limwoohyun/);
  });

  it('(7) category accent slot is deterministic across renders', async () => {
    const html1 = await renderSidebar({
      folderTree: buildFixture(),
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    const html2 = await renderSidebar({
      folderTree: buildFixture(),
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    const aiSlot1 = html1.match(/--color-accent-cat-(\d)\)\s*"[^>]*><\/span><a\s[^>]*\bhref="\/AI\/"/);
    const aiSlot2 = html2.match(/--color-accent-cat-(\d)\)\s*"[^>]*><\/span><a\s[^>]*\bhref="\/AI\/"/);
    expect(aiSlot1, 'AI dot must produce a --color-accent-cat-N slot').not.toBeNull();
    expect(aiSlot2).not.toBeNull();
    expect(
      aiSlot1![1],
      'same first-segment ("AI") must hash to the same slot every render',
    ).toBe(aiSlot2![1]);
    // And the same first-segment ("posts" → different slot, but stable).
    const postsSlot1 = html1.match(/--color-accent-cat-(\d)\)\s*"[^>]*><\/span><a\s[^>]*\bhref="\/posts\/"/);
    const postsSlot2 = html2.match(/--color-accent-cat-(\d)\)\s*"[^>]*><\/span><a\s[^>]*\bhref="\/posts\/"/);
    expect(postsSlot1).not.toBeNull();
    expect(postsSlot1![1]).toBe(postsSlot2![1]);
  });

  it('(8) canary text from a hypothetically-filtered private branch never reaches the DOM', async () => {
    // Simulated upstream output: filterPublishable already removed the private
    // branch (the "secret/" folder + its canary-bearing notes are absent from
    // the tree we feed to Sidebar). The component MUST NOT synthesise any text
    // for an absent branch.
    const filteredTree = buildFixture(); // private branch was never added.

    const html = await renderSidebar({
      folderTree: filteredTree,
      activeSlug: 'AI/Claude/agents',
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(
      html,
      'DO_NOT_LEAK_BANANA_6f3c1 canary must be 0 — privacy CRITICAL',
    ).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(
      html,
      'CLAUDE_COMMENT_LEAK_77b canary must be 0 — privacy CRITICAL',
    ).not.toContain('CLAUDE_COMMENT_LEAK_77b');

    // Sanity: even if a caller carelessly attached extra fields to a node,
    // the component reads only declared fields. A "secret" cast onto a note
    // record must not leak. This is the allowlist enforcement complement to
    // Backlinks/TagList tests.
    const sneakyTree: FolderNode = {
      name: '',
      path: '',
      children: [],
      notes: [
        {
          slug: 'visible',
          title: 'Visible',
          // extra fields cast on — must not appear in DOM.
          // @ts-expect-error: deliberately probing a runtime allowlist
          body: 'DO_NOT_LEAK_BANANA_6f3c1',
        },
      ],
    };
    const sneakyHtml = await renderTree({
      root: sneakyTree,
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(sneakyHtml).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(sneakyHtml).toContain('Visible');
  });

  it('(9) sidebar/folder-tree/avatar components carry no client: directive (JS-less guarantee)', async () => {
    const html = await renderSidebar({
      folderTree: buildFixture(),
      avatarSrc: '/avatar.webp',
      nickname: 'limwoohyun',
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(
      html,
      'rendered output must not include any client: hydration directives',
    ).not.toMatch(/\bclient:(load|idle|visible|media|only)\b/);
    expect(
      html,
      'no inline hex colour must reach the DOM (tokens-only contract)',
    ).not.toMatch(/style="[^"]*#[0-9a-fA-F]{3,8}/);
  });

  it('(10) <aside class="sidebar"> wraps the composition with aria-label', async () => {
    const html = await renderSidebar({
      folderTree: buildFixture(),
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(
      countMatches(html, /<aside\s[^>]*\bclass="sidebar"[^>]*\baria-label="사이트 내비게이션"/g),
      'sidebar root must be <aside class="sidebar" aria-label="사이트 내비게이션">',
    ).toBe(1);
    expect(
      html,
      '<aside> must NOT carry role="tree" — we do not implement keyboard arrow handlers',
    ).not.toMatch(/\brole="tree"/);
    expect(html).not.toMatch(/\brole="treeitem"/);
  });
});
