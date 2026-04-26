/**
 * Privacy canary regression — sidebar data must never carry private content.
 *
 * Two-tier defense:
 *   1. This file pins the DATA layer: feed hostile inputs into
 *      `filterPublishable` + `getSharedSidebarRoots` and assert the projected
 *      `SidebarNode[]` carries no canary string and no private slug.
 *   2. The component layer (`packages/theme-default/tests/FolderTreeSidebar.test.ts`)
 *      pins that the rendered HTML is exactly what `SidebarNode[]` says (no
 *      set:html, escape-only, no extra fields). Together: hostile input cannot
 *      reach rendered HTML.
 *
 * Canaries borrowed from `packages/core/tests/fixtures/vault-mixed/` so any
 * regression is caught by the same string a privacy review would grep for.
 */

import { describe, expect, it } from 'vitest';
import { getSharedSidebarRoots } from '../src/lib/folderTree.ts';
import { filterPublishable } from '../src/lib/viewModels.ts';
import type { NotesEntry } from '../src/lib/viewModels.ts';

interface MakeNoteInput {
  title?: string;
  frontmatter?: Record<string, unknown>;
}

function makeNote(id: string, input: MakeNoteInput = {}): NotesEntry {
  return {
    id,
    collection: 'notes',
    data: {
      kind: 'note',
      frontmatter: input.frontmatter ?? {},
      tags: [],
      backlinks: [],
      ...(input.title !== undefined ? { title: input.title } : {}),
    },
    rendered: { html: '', metadata: {} },
  } as unknown as NotesEntry;
}

function makeAlias(from: string, to: string): NotesEntry {
  return {
    id: from,
    collection: 'notes',
    data: { kind: 'alias-redirect', to },
  } as unknown as NotesEntry;
}

const CANARIES = [
  'DO_NOT_LEAK_BANANA_6f3c1',
  'CLAUDE_COMMENT_LEAK_77b',
] as const;

function sidebarFromMixed(entries: readonly NotesEntry[]): string {
  const publishable = filterPublishable(entries);
  const roots = getSharedSidebarRoots(publishable);
  return JSON.stringify(roots);
}

describe('sidebar privacy — canary regression on derived data', () => {
  it('strips drafts via filterPublishable; their slugs/titles never reach sidebar data', () => {
    // Threat model at this layer: privacy classification (public/private) is
    // settled in core, so every entry that reaches `getCollection` is already
    // public. `filterPublishable` is the second gate — it drops `draft: true`
    // notes per `isPublishable()`. Verify drafts cannot reach the sidebar.
    const inputs: NotesEntry[] = [
      makeNote('blog/visible-note', {
        title: 'Visible Note',
        frontmatter: { public: true, title: 'Visible Note' },
      }),
      makeNote('drafts/wip-note', {
        title: 'Draft WIP',
        frontmatter: { public: true, draft: true, title: 'Draft WIP' },
      }),
    ];
    const data = sidebarFromMixed(inputs);
    expect(data).toContain('Visible Note');
    expect(data).not.toContain('Draft WIP');
    expect(data).not.toContain('drafts');
  });

  it('does not carry canary strings even when hostile frontmatter slips them in', () => {
    const mixed: NotesEntry[] = [
      makeNote('public/extra-fm', {
        title: 'Extra FM',
        frontmatter: {
          public: true,
          title: 'Extra FM',
          // Hostile case: canary smuggled into a non-rendered allowlist field
          description: 'desc with DO_NOT_LEAK_BANANA_6f3c1',
          author: 'attacker CLAUDE_COMMENT_LEAK_77b',
        },
      }),
    ];
    const data = sidebarFromMixed(mixed);
    expect(data).toContain('Extra FM');
    for (const canary of CANARIES) {
      expect(data, `canary "${canary}" must not reach sidebar data`).not.toContain(canary);
    }
    expect(data).not.toContain('description');
    expect(data).not.toContain('author');
  });

  it('rejects alias-redirect entries — they never appear in the sidebar', () => {
    const mixed: NotesEntry[] = [
      makeNote('public/canonical', {
        title: 'Canonical',
        frontmatter: { public: true, title: 'Canonical' },
      }),
      makeAlias('old-name', 'public/canonical'),
      makeAlias('private-old', 'never-published'),
    ];
    const data = sidebarFromMixed(mixed);
    expect(data).toContain('Canonical');
    expect(data).not.toContain('old-name');
    expect(data).not.toContain('private-old');
    expect(data).not.toContain('never-published');
  });

  it('omits empty folders entirely — folder existence is itself private', () => {
    // private-only-folder/* would have been on disk; filterPublishable strips them.
    // The sidebar derives from publishable-only, so the folder simply doesn't exist.
    const mixed: NotesEntry[] = [
      makeNote('public-folder/note', {
        title: 'Visible',
        frontmatter: { public: true, title: 'Visible' },
      }),
    ];
    const data = sidebarFromMixed(mixed);
    expect(data).toContain('Public Folder');
    expect(data).not.toContain('private-only-folder');
  });

  it('does not leak frontmatter beyond title/date allowlist (sidebar shape contract)', () => {
    const mixed: NotesEntry[] = [
      makeNote('public/probe', {
        title: 'Probe',
        frontmatter: {
          public: true,
          title: 'Probe',
          tags: ['shouldnotleak'],
          cover: '/private-cover.png',
          author: 'private-author',
          permalink: '/some-other-route',
          // Add an arbitrary unknown key — must not leak
          internalNote: 'PRIVATE_INTERNAL_NOTE',
        },
      }),
    ];
    const data = sidebarFromMixed(mixed);
    expect(data).toContain('Probe');
    expect(data).not.toContain('shouldnotleak');
    expect(data).not.toContain('private-cover');
    expect(data).not.toContain('private-author');
    expect(data).not.toContain('PRIVATE_INTERNAL_NOTE');
    expect(data).not.toContain('internalNote');
    expect(data).not.toContain('cover');
    expect(data).not.toContain('author');
    expect(data).not.toContain('permalink');
  });
});
