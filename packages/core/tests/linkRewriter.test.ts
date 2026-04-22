import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Root } from 'mdast';
import {
  rewriteWikilinks,
  type RewriteWikilinksOptions,
} from '../src/privacy/linkRewriter.ts';

/** The ids registered here are the fake "vault" used by the test resolver. */
interface FakeNote {
  readonly id: string;
  readonly isPublic: boolean;
}

function parse(md: string): Root {
  return fromMarkdown(md) as unknown as Root;
}

function makeOptions(
  tree: Root,
  notes: readonly FakeNote[],
  extras: Partial<RewriteWikilinksOptions> = {},
): RewriteWikilinksOptions {
  const byName = new Map<string, FakeNote>();
  for (const n of notes) byName.set(n.id.toLowerCase(), n);

  return {
    tree,
    sourceFile: extras.sourceFile ?? 'src/foo.md',
    resolve:
      extras.resolve ??
      ((raw: string) => {
        const target = raw.split('|')[0]?.split('#')[0]?.trim().toLowerCase() ?? '';
        const hit = byName.get(target);
        if (!hit) return { resolved: false };
        return { resolved: true, targetId: hit.id };
      }),
    isPublic: extras.isPublic ?? ((id: string) => byName.get(id.toLowerCase())?.isPublic === true),
    hrefFor:
      extras.hrefFor ??
      ((id: string, heading?: string) => {
        const base = `/notes/${id.toLowerCase()}`;
        return heading !== undefined ? `${base}#${heading.toLowerCase()}` : base;
      }),
  };
}

/** Return the first paragraph's children from a root — most tests only need that. */
function paragraphChildren(tree: Root): unknown[] {
  const first = tree.children[0];
  if (!first || first.type !== 'paragraph') {
    throw new Error(`expected first child to be paragraph, got ${first?.type ?? 'nothing'}`);
  }
  return first.children as unknown[];
}

describe('rewriteWikilinks', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('public target → link node with hrefFor(url) and display text (1)', () => {
    const tree = parse('see [[PublicA]] here');
    const notes = [{ id: 'PublicA', isPublic: true }];
    const result = rewriteWikilinks(makeOptions(tree, notes));

    const children = paragraphChildren(tree);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: 'text', value: 'see ' });
    expect(children[1]).toMatchObject({
      type: 'link',
      url: '/notes/publica',
      title: null,
      children: [{ type: 'text', value: 'PublicA' }],
    });
    expect(children[2]).toMatchObject({ type: 'text', value: ' here' });

    expect(result.outgoing).toEqual([
      { raw: 'PublicA', status: 'resolved-public', targetId: 'PublicA' },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('private target → text node; id/relativePath never appear in tree (2)', () => {
    const tree = parse('x [[PrivateA]] y');
    const notes = [{ id: 'private/secret-PrivateA', isPublic: false }];
    const opts = makeOptions(tree, notes, {
      // bespoke resolver: match "PrivateA" → id with revealing relativePath
      resolve: (raw) => {
        if (raw.toLowerCase() === 'privatea') {
          return { resolved: true, targetId: 'private/secret-PrivateA' };
        }
        return { resolved: false };
      },
    });
    const result = rewriteWikilinks(opts);

    const children = paragraphChildren(tree);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: 'text', value: 'x ' });
    expect(children[1]).toMatchObject({ type: 'text', value: 'PrivateA' });
    expect(children[1]).not.toHaveProperty('url');
    expect(children[1]).not.toHaveProperty('title');
    expect(children[2]).toMatchObject({ type: 'text', value: ' y' });

    const serialized = JSON.stringify(tree);
    expect(serialized).not.toContain('private/secret-PrivateA');
    expect(serialized).not.toContain('secret-PrivateA');

    expect(result.outgoing).toEqual([
      { raw: 'PrivateA', status: 'resolved-private', targetId: 'private/secret-PrivateA' },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('unresolved → text node and warns with source location (3)', () => {
    const tree = parse('open [[DoesNotExist]] link');
    const result = rewriteWikilinks(makeOptions(tree, [], { sourceFile: 'notes/a.md' }));

    const children = paragraphChildren(tree);
    expect(children).toHaveLength(3);
    expect(children[1]).toMatchObject({ type: 'text', value: 'DoesNotExist' });

    expect(result.outgoing).toEqual([{ raw: 'DoesNotExist', status: 'unresolved' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('notes/a.md');
    expect(message).toContain('DoesNotExist');
  });

  it('public + alias → link text uses alias, url from target (4)', () => {
    const tree = parse('see [[PublicA|다른 이름]] now');
    const notes = [{ id: 'PublicA', isPublic: true }];
    rewriteWikilinks(makeOptions(tree, notes));

    const children = paragraphChildren(tree);
    expect(children[1]).toMatchObject({
      type: 'link',
      url: '/notes/publica',
      children: [{ type: 'text', value: '다른 이름' }],
    });
  });

  it('private + alias → text shows alias, raw target name absent (5)', () => {
    const tree = parse('see [[PrivateA|다른 이름]] now');
    const notes = [{ id: 'PrivateA', isPublic: false }];
    rewriteWikilinks(makeOptions(tree, notes));

    const children = paragraphChildren(tree);
    expect(children[1]).toMatchObject({ type: 'text', value: '다른 이름' });
    const serialized = JSON.stringify(tree);
    expect(serialized).not.toContain('PrivateA');
  });

  it('public + heading → url has fragment, display is target (6)', () => {
    const tree = parse('jump [[PublicA#Intro]] here');
    const notes = [{ id: 'PublicA', isPublic: true }];
    rewriteWikilinks(makeOptions(tree, notes));

    const children = paragraphChildren(tree);
    expect(children[1]).toMatchObject({
      type: 'link',
      url: '/notes/publica#intro',
      children: [{ type: 'text', value: 'PublicA' }],
    });
  });

  it('mixed public + private in one text node keeps order (7)', () => {
    const tree = parse('앞 [[PublicA]] 중간 [[PrivateA]] 뒤');
    const notes = [
      { id: 'PublicA', isPublic: true },
      { id: 'PrivateA', isPublic: false },
    ];
    const result = rewriteWikilinks(makeOptions(tree, notes));

    const children = paragraphChildren(tree);
    expect(children).toHaveLength(5);
    expect(children[0]).toMatchObject({ type: 'text', value: '앞 ' });
    expect(children[1]).toMatchObject({ type: 'link', url: '/notes/publica' });
    expect(children[2]).toMatchObject({ type: 'text', value: ' 중간 ' });
    expect(children[3]).toMatchObject({ type: 'text', value: 'PrivateA' });
    expect(children[4]).toMatchObject({ type: 'text', value: ' 뒤' });

    expect(result.outgoing.map((o) => o.status)).toEqual([
      'resolved-public',
      'resolved-private',
    ]);
  });

  it('embed ![[PublicA]] is left untouched and not reported (8)', () => {
    const tree = parse('before ![[PublicA]] after');
    const notes = [{ id: 'PublicA', isPublic: true }];
    const result = rewriteWikilinks(makeOptions(tree, notes));

    const children = paragraphChildren(tree);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: 'text', value: 'before ![[PublicA]] after' });
    expect(result.outgoing).toEqual([]);
  });

  it('inline code `[[X]]` is left untouched (9)', () => {
    const tree = parse('say `[[PublicA]]` to the parser');
    const notes = [{ id: 'PublicA', isPublic: true }];
    const result = rewriteWikilinks(makeOptions(tree, notes));

    const children = paragraphChildren(tree);
    const codeNode = children.find(
      (c): c is { type: 'inlineCode'; value: string } =>
        typeof c === 'object' && c !== null && (c as { type?: string }).type === 'inlineCode',
    );
    expect(codeNode).toBeDefined();
    expect(codeNode?.value).toBe('[[PublicA]]');
    expect(result.outgoing).toEqual([]);
  });

  it('fenced code block [[X]] is left untouched (10)', () => {
    const tree = parse('```\n[[PublicA]]\n```');
    const notes = [{ id: 'PublicA', isPublic: true }];
    const result = rewriteWikilinks(makeOptions(tree, notes));

    const first = tree.children[0];
    expect(first).toMatchObject({ type: 'code', value: '[[PublicA]]' });
    expect(result.outgoing).toEqual([]);
  });

  it('empty target [[]] → unresolved, text value is "" (11)', () => {
    const tree = parse('empty [[]] here');
    const result = rewriteWikilinks(makeOptions(tree, []));

    const children = paragraphChildren(tree);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: 'text', value: 'empty ' });
    expect(children[1]).toMatchObject({ type: 'text', value: '' });
    expect(children[2]).toMatchObject({ type: 'text', value: ' here' });
    expect(result.outgoing).toEqual([{ raw: '', status: 'unresolved' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('same target linked twice → outgoing has two entries (no dedupe) (12)', () => {
    const tree = parse('once [[PublicA]] then [[PublicA]] again');
    const notes = [{ id: 'PublicA', isPublic: true }];
    const result = rewriteWikilinks(makeOptions(tree, notes));

    expect(result.outgoing).toEqual([
      { raw: 'PublicA', status: 'resolved-public', targetId: 'PublicA' },
      { raw: 'PublicA', status: 'resolved-public', targetId: 'PublicA' },
    ]);
  });

  it('heading + alias [[A#H|별칭]] → url with fragment, text is alias (13)', () => {
    const tree = parse('ref [[PublicA#Intro|별칭]] here');
    const notes = [{ id: 'PublicA', isPublic: true }];
    rewriteWikilinks(makeOptions(tree, notes));

    const children = paragraphChildren(tree);
    expect(children[1]).toMatchObject({
      type: 'link',
      url: '/notes/publica#intro',
      children: [{ type: 'text', value: '별칭' }],
    });
  });

  it('mutates tree in place — same Root reference returned children mutated (14)', () => {
    const tree = parse('see [[PublicA]] now');
    const originalRoot = tree;
    const originalParagraph = tree.children[0];
    const originalChildrenArray = (tree.children[0] as { children: unknown[] }).children;

    const notes = [{ id: 'PublicA', isPublic: true }];
    rewriteWikilinks(makeOptions(tree, notes));

    expect(tree).toBe(originalRoot);
    expect(tree.children[0]).toBe(originalParagraph);
    expect((tree.children[0] as { children: unknown[] }).children).toBe(originalChildrenArray);
    expect(originalChildrenArray).toHaveLength(3);
  });
});
