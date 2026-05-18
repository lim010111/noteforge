import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_ACCENT_SLOT_COUNT } from '@noteforge/theme-default/lib/categoryAccent.ts';
import type { NoteEntry, NotesEntry } from './viewModels.ts';
import { filterPublishable } from './viewModels.ts';
import { buildCategoryTree, buildFolderTree } from './folderAggregation.ts';

// Hoisted mutable holder — vi.mock factory bodies are hoisted above all
// `import` statements, so any `let`/`const` they reference must come from a
// `vi.hoisted` block or they hit a TDZ error at import time.
const siteMock = vi.hoisted(() => ({
  avatar: undefined as string | undefined,
  nickname: undefined as string | undefined,
  social: undefined as { github?: string } | undefined,
}));

vi.mock('../../noteforge.config.ts', () => ({
  default: {
    site: {
      title: 'shine notes',
      url: 'https://noteforge.pages.dev',
      author: 'shine',
      get avatar() {
        return siteMock.avatar;
      },
      get nickname() {
        return siteMock.nickname;
      },
      get social() {
        return siteMock.social;
      },
    },
  },
}));

import { buildSidebarPayload } from './sidebarPayload.ts';

interface NoteEntryDataInput {
  title?: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[];
  backlinks?: string[];
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
    },
    rendered: { html: '', metadata: {} },
  } as unknown as NoteEntry;
}

afterEach(() => {
  siteMock.avatar = undefined;
  siteMock.nickname = undefined;
  siteMock.social = undefined;
});

describe('buildSidebarPayload — payload shape', () => {
  it('produces the same folderTree as buildFolderTree on a 3-level fixture', () => {
    const entries: NotesEntry[] = [
      makeEntry('AI/Claude/agents', { title: 'agents' }),
      makeEntry('AI/Claude/opus', { title: 'opus' }),
      makeEntry('AI/Gemini/notes', { title: 'gemini-notes' }),
      makeEntry('posts/foo', { title: 'foo' }),
    ];
    const direct = buildFolderTree(filterPublishable(entries));
    const payload = buildSidebarPayload(entries, undefined, {
      mode: 'folder',
      sidebarNotes: 'hide',
    });
    expect(payload.folderTree).toEqual(direct);
  });
});

describe('buildSidebarPayload — active markers', () => {
  it('threads activeSlug through to the payload', () => {
    const entries = [makeEntry('AI/Claude/agents', { title: 'agents' })];
    const payload = buildSidebarPayload(entries, {
      activeSlug: 'AI/Claude/agents',
    });
    expect(payload.activeSlug).toBe('AI/Claude/agents');
    expect(payload.activeFolderPath).toBeUndefined();
  });

  it('threads activeFolderPath through to the payload', () => {
    const entries = [makeEntry('AI/Claude/agents', { title: 'agents' })];
    const payload = buildSidebarPayload(entries, {
      activeFolderPath: 'AI/Claude/',
    });
    expect(payload.activeFolderPath).toBe('AI/Claude/');
    expect(payload.activeSlug).toBeUndefined();
  });
});

describe('buildSidebarPayload — site identity propagation', () => {
  it('omits avatarSrc and nickname when neither is configured (no empty-string fallthrough)', () => {
    siteMock.avatar = undefined;
    siteMock.nickname = undefined;
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    // Strict undefined — never '' or null — so AvatarBlock's `!== undefined`
    // gate omits itself cleanly on incomplete identity.
    expect(payload.avatarSrc).toBeUndefined();
    expect(payload.nickname).toBeUndefined();
    expect('avatarSrc' in payload).toBe(false);
    expect('nickname' in payload).toBe(false);
  });

  it('passes avatar and nickname through verbatim when configured', () => {
    siteMock.avatar = '/avatar.png';
    siteMock.nickname = 'shine';
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.avatarSrc).toBe('/avatar.png');
    expect(payload.nickname).toBe('shine');
  });

  it('omits github when site.social is undefined', () => {
    siteMock.social = undefined;
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.github).toBeUndefined();
    expect('github' in payload).toBe(false);
  });

  it('omits github when site.social.github is undefined (social object set but channel empty)', () => {
    siteMock.social = {};
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.github).toBeUndefined();
    expect('github' in payload).toBe(false);
  });

  it('preserves the empty-string github sentinel verbatim (stub onboarding state must reach ProfileBlock)', () => {
    siteMock.social = { github: '' };
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    // The '' sentinel is the only signal that opts the sidebar GitHub icon
    // into "needs setup" mode. Collapsing it to undefined would silently
    // demote the onboarding affordance to "off".
    expect(payload.github).toBe('');
    expect('github' in payload).toBe(true);
  });

  it('passes a live github URL through verbatim', () => {
    siteMock.social = { github: 'https://github.com/example' };
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.github).toBe('https://github.com/example');
  });
});

describe('buildSidebarPayload — GitHub fallback for unset avatar/nickname', () => {
  it('derives avatarSrc from the github URL when site.avatar is unset', () => {
    siteMock.avatar = undefined;
    siteMock.social = { github: 'https://github.com/example' };
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.avatarSrc).toBe('https://github.com/example.png');
  });

  it('derives nickname from the github username when site.nickname is unset', () => {
    siteMock.nickname = undefined;
    siteMock.social = { github: 'https://github.com/example' };
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.nickname).toBe('example');
  });

  it('configured avatar/nickname win over GitHub fallback', () => {
    siteMock.avatar = '/avatar.png';
    siteMock.nickname = 'shine';
    siteMock.social = { github: 'https://github.com/example' };
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.avatarSrc).toBe('/avatar.png');
    expect(payload.nickname).toBe('shine');
  });

  it("does not derive when github is the empty '' stub (no username to derive from)", () => {
    siteMock.avatar = undefined;
    siteMock.nickname = undefined;
    siteMock.social = { github: '' };
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.avatarSrc).toBeUndefined();
    expect(payload.nickname).toBeUndefined();
    // The stub sentinel itself still propagates so ProfileBlock can render
    // the "needs setup" icon.
    expect(payload.github).toBe('');
  });

  it('omits avatarSrc and nickname when neither github nor explicit fields are set', () => {
    siteMock.avatar = undefined;
    siteMock.nickname = undefined;
    siteMock.social = undefined;
    const payload = buildSidebarPayload([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(payload.avatarSrc).toBeUndefined();
    expect(payload.nickname).toBeUndefined();
    expect('avatarSrc' in payload).toBe(false);
    expect('nickname' in payload).toBe(false);
  });
});

describe('buildSidebarPayload — slot count SSOT', () => {
  it('emits slotCount equal to CATEGORY_ACCENT_SLOT_COUNT (no magic number)', () => {
    const payload = buildSidebarPayload([makeEntry('a', { title: 'a' })]);
    expect(payload.slotCount).toBe(CATEGORY_ACCENT_SLOT_COUNT);
  });
});

describe('buildSidebarPayload — nav.mode (v0.7)', () => {
  const entries: NotesEntry[] = [
    makeEntry('temp_drafts/diary-1', {
      title: 'diary-1',
      frontmatter: { category: '에세이/2026' },
    }),
    makeEntry('AI/Claude/agents', {
      title: 'agents',
      frontmatter: { category: 'Tech/AI' },
    }),
    makeEntry('about', { title: 'About' }),
  ];

  it("defaults to folder mode (matches buildFolderTree) when nav is omitted", () => {
    const direct = buildFolderTree(filterPublishable(entries));
    const payload = buildSidebarPayload(entries);
    expect(payload.folderTree).toEqual(direct);
  });

  it("default differs from explicit 'category' tree (category is opt-in)", () => {
    const defaulted = buildSidebarPayload(entries);
    const categoryOptIn = buildSidebarPayload(entries, undefined, {
      mode: 'category',
      sidebarNotes: 'hide',
    });
    expect(defaulted.folderTree).not.toEqual(categoryOptIn.folderTree);
  });

  it("explicit mode 'folder' produces the vault-path tree (matches the default)", () => {
    const direct = buildFolderTree(filterPublishable(entries));
    const payload = buildSidebarPayload(entries, undefined, {
      mode: 'folder',
      sidebarNotes: 'hide',
    });
    expect(payload.folderTree).toEqual(direct);
  });

  it("mode 'category' uses the frontmatter `category` field for the tree", () => {
    const direct = buildCategoryTree(filterPublishable(entries));
    const payload = buildSidebarPayload(entries, undefined, {
      mode: 'category',
      sidebarNotes: 'hide',
    });
    expect(payload.folderTree).toEqual(direct);

    const childNames = payload.folderTree.children.map((c) => c.name);
    expect(childNames).toContain('Tech');
    expect(childNames).toContain('에세이');
    expect(childNames).not.toContain('AI');
    expect(childNames).not.toContain('temp_drafts');
  });

  it("mode 'category' still threads activeSlug/activeFolderPath through", () => {
    const payload = buildSidebarPayload(
      entries,
      { activeSlug: 'temp_drafts/diary-1', activeFolderPath: '에세이/2026/' },
      { mode: 'category', sidebarNotes: 'hide' },
    );
    expect(payload.activeSlug).toBe('temp_drafts/diary-1');
    expect(payload.activeFolderPath).toBe('에세이/2026/');
  });
});

describe('buildSidebarPayload — nav.sidebarNotes (ADR-0015)', () => {
  const entries: NotesEntry[] = [
    makeEntry('AI/Claude/agents', {
      title: 'agents',
      frontmatter: { category: 'Tech/AI' },
    }),
    makeEntry('about', { title: 'About' }),
  ];

  it("hides leaf notes by default (sidebarNotes defaults to 'hide')", () => {
    expect(buildSidebarPayload(entries).hideLeafNotes).toBe(true);
  });

  it("folder mode hides leaf notes when sidebarNotes is 'hide'", () => {
    const payload = buildSidebarPayload(entries, undefined, {
      mode: 'folder',
      sidebarNotes: 'hide',
    });
    expect(payload.hideLeafNotes).toBe(true);
  });

  it("folder mode keeps the full tree when sidebarNotes is 'show'", () => {
    const payload = buildSidebarPayload(entries, undefined, {
      mode: 'folder',
      sidebarNotes: 'show',
    });
    expect(payload.hideLeafNotes).toBeUndefined();
  });

  it("category mode hides leaf notes under the default 'hide'", () => {
    const payload = buildSidebarPayload(entries, undefined, {
      mode: 'category',
      sidebarNotes: 'hide',
    });
    expect(payload.hideLeafNotes).toBe(true);
  });

  it("sidebarNotes 'show' is honoured in category mode too (no mode special-case)", () => {
    const payload = buildSidebarPayload(entries, undefined, {
      mode: 'category',
      sidebarNotes: 'show',
    });
    expect(payload.hideLeafNotes).toBeUndefined();
  });
});

describe('buildSidebarPayload — privacy guard', () => {
  it('drops draft entries via filterPublishable so canary text never reaches the tree', () => {
    const CANARY = 'DO_NOT_LEAK_BANANA_6f3c1';
    const entries: NotesEntry[] = [
      makeEntry('public-note', { title: 'visible', frontmatter: {} }),
      // A draft entry whose every observable surface (id, title, frontmatter
      // title) carries the canary. filterPublishable must drop the entry
      // entirely, so no field survives into the folder tree.
      makeEntry(`secret/${CANARY}`, {
        title: CANARY,
        frontmatter: { draft: true, title: CANARY },
      }),
    ];
    const payload = buildSidebarPayload(entries);
    const serialised = JSON.stringify(payload.folderTree);
    expect(serialised).not.toContain(CANARY);
  });
});
