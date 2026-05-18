/**
 * Container-API tests for `<Sidebar />` (and the FolderTree / ProfileBlock
 * compositions it owns).
 *
 * Why these assertions:
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
 *   - empty ProfileBlock silent (6): same principle for identity. Missing all
 *                                   three of avatar / nickname / github → no
 *                                   card, no placeholder. (privacy-adjacent.)
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
 *   - ProfileBlock avatar link (13): avatar wraps in `<a href="/about/">` so
 *                                   the screenshot's single entry-point
 *                                   contract holds.
 *   - ProfileBlock github states (14): three-state contract (off / stub / live)
 *                                   threads through from props to DOM.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Sidebar from '../src/components/Sidebar.astro';
import FolderTree from '../src/components/FolderTree.astro';
import ProfileBlock from '../src/components/ProfileBlock.astro';
import type { SidebarProps } from '../src/components/Sidebar.types';
import type { FolderTreeProps } from '../src/components/FolderTree.types';
import type { ProfileBlockProps } from '../src/components/ProfileBlock.types';
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

async function renderProfile(props: ProfileBlockProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(ProfileBlock as never, {
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
            noteCount: 1,
          },
        ],
        notes: [],
        noteCount: 1,
      },
      {
        name: 'posts',
        path: 'posts',
        children: [],
        notes: [
          { slug: 'posts/a', title: 'a' },
          { slug: 'posts/b', title: 'b' },
        ],
        noteCount: 2,
      },
    ],
    notes: [{ slug: 'about', title: 'about' }],
    noteCount: 4,
  };
}

describe('Sidebar (composition + FolderTree + ProfileBlock)', () => {
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
    const empty: FolderNode = {
      name: '',
      path: '',
      children: [],
      notes: [],
      noteCount: 0,
    };
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

  it('(6) ProfileBlock silent when all three of avatarSrc / nickname / github are missing', async () => {
    const html = await renderProfile({});
    expect(
      countMatches(html, /<img\b/g),
      'no <img> when avatarSrc is missing',
    ).toBe(0);
    expect(
      countMatches(html, /<div\b/g),
      'no wrapper <div> when all three inputs are missing — empty card is a leak signal',
    ).toBe(0);

    // Sanity: avatarSrc only → image (wrapped in /about/ link) renders, no name-row.
    const avatarOnly = await renderProfile({ avatarSrc: '/avatar.webp' });
    expect(avatarOnly).toMatch(/<img\s/);
    expect(avatarOnly).not.toMatch(/profile-block__nickname/);
    expect(avatarOnly).not.toMatch(/profile-block__name-row/);

    // nickname only → text renders, no <img>, no SocialLinks.
    const nameOnly = await renderProfile({ nickname: 'limwoohyun' });
    expect(nameOnly).not.toMatch(/<img\s/);
    expect(nameOnly).toMatch(/limwoohyun/);
    expect(nameOnly).not.toMatch(/social-links/);

    // github stub only → name-row renders with the stub button, no <img>, no name.
    const stubOnly = await renderProfile({ github: '' });
    expect(stubOnly).not.toMatch(/<img\s/);
    expect(stubOnly).not.toMatch(/profile-block__nickname/);
    expect(stubOnly).toMatch(/data-social-stub="github"/);
  });

  it('(7) v0.5 — folder-tree no longer emits the category-accent dot', async () => {
    // The v0.5 design refresh dropped the per-folder colour dot from the
    // sidebar. The accent token ring (`--color-accent-cat-1..N`) still
    // exists for FolderIndex's breadcrumb, so this assertion narrows to
    // the sidebar surface only — neither the legacy dot class nor any
    // inline `--color-accent-cat-N` style must appear in the rendered HTML.
    const html = await renderSidebar({
      folderTree: buildFixture(),
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(
      html,
      'folder-tree__dot class must be removed — keeping it as dead markup invites a future style regression to "wake the dot back up"',
    ).not.toMatch(/folder-tree__dot/);
    expect(
      html,
      '--color-accent-cat-N must not be inlined anywhere in folder-tree output',
    ).not.toMatch(/--color-accent-cat-/);
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
      noteCount: 1,
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

  /**
   * Mixed fixture for the v0.71 count-badge / leaf-category alignment tests.
   *
   *   PEFT/                     (no notes of its own; one child LoRA)
   *     └ LoRA  (1 note)        → leaf-category
   *   news/                     (3 notes, no children) → leaf-category
   *
   * `hideLeafNotes: true` so:
   *   - PEFT renders as <details> (has child); subtree count = 1
   *   - LoRA renders as leaf-category; subtree count = 1
   *   - news renders as leaf-category; subtree count = 3
   */
  function buildCountFixture(): FolderNode {
    return {
      name: '',
      path: '',
      children: [
        {
          name: 'PEFT',
          path: 'peft',
          children: [
            {
              name: 'LoRA',
              path: 'peft/lora',
              children: [],
              notes: [{ slug: 'peft/lora/lora-란', title: 'LoRA 란' }],
              noteCount: 1,
            },
          ],
          notes: [],
          noteCount: 1,
        },
        {
          name: 'news',
          path: 'news',
          children: [],
          notes: [
            { slug: 'news/a', title: 'a' },
            { slug: 'news/b', title: 'b' },
            { slug: 'news/c', title: 'c' },
          ],
          noteCount: 3,
        },
      ],
      notes: [],
      noteCount: 4,
    };
  }

  it('(11) noteCount > 0 emits a folder-tree__count badge; 0 emits none', async () => {
    const html = await renderTree({
      root: buildCountFixture(),
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
      hideLeafNotes: true,
    });
    // PEFT is a <details> — count badge sits inside <summary>.
    expect(
      html,
      'PEFT subtree count (1) must surface as a folder-tree__count span',
    ).toMatch(/<span\s[^>]*\bclass="folder-tree__count"[^>]*>1<\/span>/);
    // news is a leaf-category — count badge sits inside the row span.
    expect(
      html,
      'news subtree count (3) must surface as a folder-tree__count span',
    ).toMatch(/<span\s[^>]*\bclass="folder-tree__count"[^>]*>3<\/span>/);
    // Two count badges total: PEFT(1), LoRA(1), news(3) → three "count" spans.
    expect(
      countMatches(html, /\bclass="folder-tree__count"/g),
      'every node with noteCount > 0 (PEFT, LoRA, news) gets a badge',
    ).toBe(3);

    // 0-count nodes (root.notes empty in this fixture) get no badge: the empty
    // tree case is the right baseline — render nothing, surface no count.
    const empty: FolderNode = {
      name: '',
      path: '',
      children: [],
      notes: [],
      noteCount: 0,
    };
    const emptyHtml = await renderTree({
      root: empty,
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
      hideLeafNotes: true,
    });
    expect(
      emptyHtml,
      'empty tree must not emit a count badge',
    ).not.toMatch(/folder-tree__count/);
  });

  it('(12) leaf-category aligns with details rows via a chevron placeholder', async () => {
    const html = await renderTree({
      root: buildCountFixture(),
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
      hideLeafNotes: true,
    });
    // Both leaf-category nodes (LoRA, news) get a placeholder chevron span so
    // their name lines up with sibling <details> rows that carry a real
    // chevron. The placeholder shares the .folder-tree__chevron class so the
    // 1.25rem reservation is identical.
    expect(
      countMatches(html, /\bclass="folder-tree__chevron folder-tree__chevron--placeholder"/g),
      'every leaf-category gets a chevron placeholder (LoRA, news = 2)',
    ).toBe(2);
    // The placeholder must be hidden from a11y — the row already has the
    // <a> link as the focusable target.
    expect(
      html,
      'placeholder chevrons are aria-hidden so screen readers skip them',
    ).toMatch(/folder-tree__chevron--placeholder[^>]*\baria-hidden="true"/);
    // The leaf-category <li> wraps its row in a folder-tree__row span (vs.
    // the <summary> branch). This is what guarantees the same flex layout.
    expect(
      countMatches(html, /\bclass="folder-tree__row"/g),
      'leaf-category rows use folder-tree__row to mirror summary layout',
    ).toBe(2);
  });

  it('(13) ProfileBlock avatar wraps in <a href="/about/"> — single entry point to the detailed About page', async () => {
    const html = await renderProfile({
      avatarSrc: '/avatar.webp',
      nickname: 'limwoohyun',
    });
    // The avatar <img> must live inside an <a> wrapper that carries both
    // class="profile-block__avatar-link" and href="/about/". Astro is free to
    // emit attributes in any order, so we match each attribute independently
    // inside the same opening tag rather than imposing a specific sequence.
    const avatarLinkOpenTag = html.match(
      /<a\b[^>]*\bclass="profile-block__avatar-link"[^>]*>/,
    );
    expect(
      avatarLinkOpenTag,
      'an <a> tag carrying class="profile-block__avatar-link" must exist',
    ).not.toBeNull();
    expect(
      avatarLinkOpenTag![0]!,
      'the avatar-link <a> tag must include href="/about/" — single entry point to the detailed About page',
    ).toMatch(/\bhref="\/about\/"/);
    expect(
      avatarLinkOpenTag![0]!,
      'the avatar-link <a> tag must carry aria-label="About" so AT users hear the destination, not the avatar alt',
    ).toMatch(/\baria-label="About"/);
    // The <img> must follow immediately inside the wrapper (no other element
    // between the opening <a> and the <img>).
    expect(
      html,
      'the avatar <img> must sit directly inside the avatar-link wrapper',
    ).toMatch(/<a\b[^>]*\bclass="profile-block__avatar-link"[^>]*>\s*<img\b/);
  });

  it('(14) ProfileBlock github three-state contract flows through to the DOM (off / stub / live)', async () => {
    // off — github omitted from props: no GitHub markup at all.
    const off = await renderProfile({
      avatarSrc: '/avatar.webp',
      nickname: 'limwoohyun',
    });
    expect(off, 'github omitted ⇒ no SocialLinks wrapper').not.toMatch(
      /class="social-links"/,
    );
    expect(off).not.toMatch(/data-social-stub="github"/);
    expect(off).not.toMatch(/href="https:\/\/github\.com/);

    // stub — empty string sentinel: <button data-social-stub="github"> appears,
    // no live <a> to github.com.
    const stub = await renderProfile({
      avatarSrc: '/avatar.webp',
      nickname: 'limwoohyun',
      github: '',
    });
    expect(stub).toMatch(/data-social-stub="github"/);
    expect(stub).not.toMatch(/<a\s[^>]*\bhref="https:\/\/github\.com/);

    // live — non-empty URL: a real <a target="_blank"> shows up, no stub button.
    const live = await renderProfile({
      avatarSrc: '/avatar.webp',
      nickname: 'limwoohyun',
      github: 'https://github.com/example',
    });
    expect(live).toMatch(
      /<a\s[^>]*\bhref="https:\/\/github\.com\/example"[^>]*\btarget="_blank"/,
    );
    expect(live).not.toMatch(/data-social-stub="github"/);
  });

  it('(15) hideLeafNotes + activeSlug → container folder marked --current-section, not aria-current', async () => {
    const html = await renderSidebar({
      folderTree: buildFixture(),
      activeSlug: 'AI/Claude/agents',
      hideLeafNotes: true,
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    // The active note itself is not in the tree — leaf notes are hidden.
    expect(
      html,
      'leaf note link must be absent when hideLeafNotes is set',
    ).not.toMatch(/href="\/AI\/Claude\/agents\/"/);
    // Its immediate container folder (AI/Claude) carries --current-section.
    // Attribute order is matched independently (Astro emits class before href).
    const claudeLink = html.match(/<a\b[^>]*\bhref="\/AI\/Claude\/"[^>]*>/);
    expect(claudeLink, 'AI/Claude folder name link must exist').not.toBeNull();
    expect(
      claudeLink![0]!,
      'AI/Claude (immediate container of the active note) is the current section',
    ).toMatch(/folder-tree__name--current-section/);
    // current-section is visual-only — it must NOT add aria-current. The note,
    // not the folder, is the current page, so no sidebar row claims it.
    expect(
      countMatches(html, /\baria-current="page"/g),
      'current-section is not aria-current — the note, not the folder, is the page',
    ).toBe(0);
    // Only the *immediate* container is the section — not the grandparent AI.
    const aiLink = html.match(/<a\b[^>]*\bhref="\/AI\/"[^>]*>/);
    expect(aiLink, 'AI folder name link must exist').not.toBeNull();
    expect(
      aiLink![0]!,
      'AI (grandparent) must not be marked --current-section',
    ).not.toMatch(/folder-tree__name--current-section/);
  });

  it('(16) full-tree mode (hideLeafNotes unset) never emits --current-section', async () => {
    // The section highlight exists only to compensate for a hidden note link.
    // When leaf notes are shown, the note carries aria-current itself (test 2)
    // and no folder should borrow the section emphasis.
    const html = await renderSidebar({
      folderTree: buildFixture(),
      activeSlug: 'AI/Claude/agents',
      slotCount: CATEGORY_ACCENT_SLOT_COUNT,
    });
    expect(
      html,
      'no --current-section class when leaf notes are visible',
    ).not.toMatch(/folder-tree__name--current-section/);
  });
});
