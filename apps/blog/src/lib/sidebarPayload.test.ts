import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_ACCENT_SLOT_COUNT } from '@noteforge/theme-default/lib/categoryAccent.ts';
import type { NoteEntry, NotesEntry } from './viewModels.ts';
import { filterPublishable } from './viewModels.ts';
import { buildFolderTree } from './folderAggregation.ts';

// Hoisted mutable holder — vi.mock factory bodies are hoisted above all
// `import` statements, so any `let`/`const` they reference must come from a
// `vi.hoisted` block or they hit a TDZ error at import time.
const siteMock = vi.hoisted(() => ({
  avatar: undefined as string | undefined,
  nickname: undefined as string | undefined,
}));

vi.mock('../../obsidian-blog.config.ts', () => ({
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
    const payload = buildSidebarPayload(entries);
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
});

describe('buildSidebarPayload — slot count SSOT', () => {
  it('emits slotCount equal to CATEGORY_ACCENT_SLOT_COUNT (no magic number)', () => {
    const payload = buildSidebarPayload([makeEntry('a', { title: 'a' })]);
    expect(payload.slotCount).toBe(CATEGORY_ACCENT_SLOT_COUNT);
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
