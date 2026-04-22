import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Root } from 'mdast';
import {
  expandTransclusions,
  type ExpandTransclusionsOptions,
} from '../src/privacy/transclude.ts';

interface FakeNote {
  readonly id: string;
  readonly isPublic: boolean;
  readonly markdown?: string;
}

interface FakeAttachment {
  readonly id: string;
  readonly url: string;
}

function parse(md: string): Root {
  return fromMarkdown(md) as unknown as Root;
}

interface HelperInput {
  readonly tree: Root;
  readonly sourceId?: string;
  readonly notes?: readonly FakeNote[];
  readonly attachments?: readonly FakeAttachment[];
  readonly extras?: Partial<ExpandTransclusionsOptions>;
}

function makeOptions(input: HelperInput): ExpandTransclusionsOptions {
  const notes = input.notes ?? [];
  const attachments = input.attachments ?? [];
  const extras = input.extras ?? {};

  const notesById = new Map<string, FakeNote>();
  for (const n of notes) notesById.set(n.id.toLowerCase(), n);
  const attachmentsById = new Map<string, FakeAttachment>();
  for (const a of attachments) attachmentsById.set(a.id.toLowerCase(), a);

  const defaultResolve = (raw: string) => {
    const target = raw.split('|')[0]?.split('#')[0]?.trim() ?? '';
    const key = target.toLowerCase();
    const attachment = attachmentsById.get(key);
    if (attachment) {
      return { resolved: true, targetId: attachment.id, kind: 'attachment' as const };
    }
    const note = notesById.get(key);
    if (note) {
      return { resolved: true, targetId: note.id, kind: 'note' as const };
    }
    return { resolved: false, kind: 'note' as const };
  };

  const defaultIsPublic = (id: string) =>
    notesById.get(id.toLowerCase())?.isPublic === true;

  const defaultMdastFor = (id: string): Root => {
    const note = notesById.get(id.toLowerCase());
    if (!note) throw new Error(`mdastFor called for unknown note ${id}`);
    const md = note.markdown ?? '';
    return parse(md);
  };

  const defaultAttachmentUrlFor = (id: string): string => {
    const hit = attachmentsById.get(id.toLowerCase());
    if (!hit) throw new Error(`attachmentUrlFor called for unknown attachment ${id}`);
    return hit.url;
  };

  return {
    tree: input.tree,
    sourceId: input.sourceId ?? 'Source',
    sourceFile: extras.sourceFile ?? 'notes/source.md',
    resolve: extras.resolve ?? defaultResolve,
    isPublic: extras.isPublic ?? defaultIsPublic,
    mdastFor: extras.mdastFor ?? defaultMdastFor,
    attachmentUrlFor: extras.attachmentUrlFor ?? defaultAttachmentUrlFor,
    ...(extras.maxDepth !== undefined ? { maxDepth: extras.maxDepth } : {}),
  };
}

/** Deep scan for a node whose `type` + `value`/`url`/`alt` match any of the given needles. */
function serialized(tree: Root): string {
  return JSON.stringify(tree);
}

describe('expandTransclusions', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('public note embed expands inline into surrounding paragraph split (1)', () => {
    const tree = parse('intro ![[A]] outro');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [{ id: 'A', isPublic: true, markdown: 'hello from A' }],
      }),
    );

    expect(tree.children).toHaveLength(3);
    expect(tree.children[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'intro ' }],
    });
    expect(tree.children[1]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'hello from A' }],
    });
    expect(tree.children[2]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: ' outro' }],
    });

    expect(result.transclusions).toEqual([
      { raw: 'A', status: 'expanded-public', targetId: 'A' },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('private note embed is removed without warning; surrounding text remains (2)', () => {
    const tree = parse('x ![[PrivateA]] y');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [{ id: 'PrivateA', isPublic: false, markdown: 'SHOULD NOT APPEAR' }],
      }),
    );

    expect(tree.children).toHaveLength(1);
    const first = tree.children[0]!;
    expect(first.type).toBe('paragraph');
    const inline = (first as unknown as { children: { type: string; value: string }[] }).children;
    const joined = inline.map((c) => c.value).join('');
    expect(joined).toBe('x  y');
    for (const c of inline) expect(c.type).toBe('text');

    expect(serialized(tree)).not.toContain('PrivateA');
    expect(serialized(tree)).not.toContain('SHOULD NOT APPEAR');

    expect(result.transclusions).toEqual([
      { raw: 'PrivateA', status: 'removed-private', targetId: 'PrivateA' },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('unresolved embed is removed and warns (3)', () => {
    const tree = parse('see ![[Missing]] here');
    const result = expandTransclusions(
      makeOptions({ tree, extras: { sourceFile: 'notes/a.md' } }),
    );

    expect(serialized(tree)).not.toContain('Missing');
    expect(result.transclusions).toEqual([
      { raw: 'Missing', status: 'removed-unresolved' },
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = String(warnSpy.mock.calls[0]?.[0] ?? '');
    expect(msg).toContain('notes/a.md');
    expect(msg).toContain('Missing');
  });

  it('attachment embed ![[image.png]] becomes an mdast image with attachmentUrlFor url (4)', () => {
    const tree = parse('look ![[image.png]] now');
    const result = expandTransclusions(
      makeOptions({
        tree,
        attachments: [{ id: 'image.png', url: '/assets/image.png' }],
      }),
    );

    expect(tree.children).toHaveLength(1);
    const paragraph = tree.children[0] as unknown as { children: { type: string; url?: string; alt?: string; value?: string }[] };
    expect(paragraph.children).toHaveLength(3);
    expect(paragraph.children[0]).toMatchObject({ type: 'text', value: 'look ' });
    expect(paragraph.children[1]).toMatchObject({
      type: 'image',
      url: '/assets/image.png',
      alt: 'image.png',
    });
    expect(paragraph.children[2]).toMatchObject({ type: 'text', value: ' now' });

    expect(result.transclusions).toEqual([
      { raw: 'image.png', status: 'attachment', targetId: 'image.png' },
    ]);
  });

  it('attachment alias ![[image.png|Logo]] uses alias as alt (5)', () => {
    const tree = parse('![[image.png|Logo]]');
    expandTransclusions(
      makeOptions({
        tree,
        attachments: [{ id: 'image.png', url: '/assets/image.png' }],
      }),
    );

    const paragraph = tree.children[0] as unknown as { children: { type: string; alt?: string; url?: string }[] };
    const image = paragraph.children.find((c) => c.type === 'image');
    expect(image).toBeDefined();
    expect(image).toMatchObject({ type: 'image', url: '/assets/image.png', alt: 'Logo' });
  });

  it('heading slice: ![[Target#Intro]] includes only the Intro section (6)', () => {
    const targetMd = [
      '## Before',
      '',
      'before-section-body',
      '',
      '## Intro',
      '',
      'intro-section-body',
      '',
      '## After',
      '',
      'after-section-body',
    ].join('\n');

    const tree = parse('![[Target#Intro]]');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [{ id: 'Target', isPublic: true, markdown: targetMd }],
      }),
    );

    const s = serialized(tree);
    expect(s).toContain('intro-section-body');
    expect(s).not.toContain('before-section-body');
    expect(s).not.toContain('after-section-body');
    expect(s).not.toContain('Before');
    expect(s).not.toContain('After');

    expect(result.transclusions).toEqual([
      { raw: 'Target#Intro', status: 'expanded-public', targetId: 'Target' },
    ]);
  });

  it('inline code `![[X]]` is left untouched (7)', () => {
    const tree = parse('say `![[A]]` literally');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [{ id: 'A', isPublic: true, markdown: 'expanded' }],
      }),
    );

    const paragraph = tree.children[0] as unknown as { children: { type: string; value?: string }[] };
    const code = paragraph.children.find((c) => c.type === 'inlineCode');
    expect(code).toBeDefined();
    expect(code?.value).toBe('![[A]]');
    expect(result.transclusions).toEqual([]);
    expect(serialized(tree)).not.toContain('expanded');
  });

  it('fenced code block ![[X]] is left untouched (8)', () => {
    const tree = parse('```\n![[A]]\n```');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [{ id: 'A', isPublic: true, markdown: 'expanded' }],
      }),
    );

    expect(tree.children[0]).toMatchObject({ type: 'code', value: '![[A]]' });
    expect(result.transclusions).toEqual([]);
    expect(serialized(tree)).not.toContain('expanded');
  });

  it('same target embedded twice → second is removed-cycle with warning (9)', () => {
    const tree = parse('first ![[A]] mid ![[A]] last');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [{ id: 'A', isPublic: true, markdown: 'content-of-A' }],
      }),
    );

    const statuses = result.transclusions.map((t) => t.status);
    expect(statuses).toEqual(['expanded-public', 'removed-cycle']);
    expect(result.transclusions[1]).toMatchObject({
      raw: 'A',
      status: 'removed-cycle',
      targetId: 'A',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = String(warnSpy.mock.calls[0]?.[0] ?? '');
    expect(msg).toContain('![[A]]');
  });

  it('maxDepth: nested embed beyond limit is removed-depth (10)', () => {
    const tree = parse('![[B]]');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [
          { id: 'B', isPublic: true, markdown: 'outer ![[C]] outer' },
          { id: 'C', isPublic: true, markdown: 'content-of-C' },
        ],
        extras: { maxDepth: 1 },
      }),
    );

    const statuses = result.transclusions.map((t) => t.status);
    expect(statuses).toContain('expanded-public');
    expect(statuses).toContain('removed-depth');

    const depthRec = result.transclusions.find((t) => t.status === 'removed-depth');
    expect(depthRec).toMatchObject({ raw: 'C', status: 'removed-depth', targetId: 'C' });
    expect(serialized(tree)).not.toContain('content-of-C');
  });

  it('non-embed wikilinks [[PublicA]] are not processed (11)', () => {
    const tree = parse('see [[PublicA]] here');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [{ id: 'PublicA', isPublic: true, markdown: 'SHOULD NOT APPEAR' }],
      }),
    );

    expect(result.transclusions).toEqual([]);
    const paragraph = tree.children[0] as unknown as { children: { type: string; value?: string }[] };
    const joined = paragraph.children.map((c) => c.value ?? '').join('');
    expect(joined).toBe('see [[PublicA]] here');
    expect(serialized(tree)).not.toContain('SHOULD NOT APPEAR');
  });

  it('private embed leaves no trace: canary and id absent from serialized tree (12)', () => {
    const CANARY = 'DO_NOT_LEAK_BANANA_6f3c1';
    const tree = parse('a ![[private/secret]] b');
    const result = expandTransclusions(
      makeOptions({
        tree,
        notes: [
          {
            id: `private/secret-${CANARY}`,
            isPublic: false,
            markdown: `body with ${CANARY}`,
          },
        ],
        extras: {
          resolve: (raw) => {
            if (raw.trim().toLowerCase() === 'private/secret') {
              return {
                resolved: true,
                targetId: `private/secret-${CANARY}`,
                kind: 'note' as const,
              };
            }
            return { resolved: false, kind: 'note' as const };
          },
        },
      }),
    );

    const s = serialized(tree);
    expect(s).not.toContain(CANARY);
    expect(s).not.toContain('private/secret');
    expect(s).not.toContain('secret');
    expect(result.transclusions[0]?.status).toBe('removed-private');
  });
});
