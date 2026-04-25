import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Root } from 'mdast';
import {
  remarkWikilink,
  type RemarkWikilinkOptions,
} from '../src/remarkWikilink.ts';

function parse(md: string): Root {
  return fromMarkdown(md) as unknown as Root;
}

function makeOptions(
  overrides: Partial<RemarkWikilinkOptions> = {},
): RemarkWikilinkOptions {
  return {
    resolve: overrides.resolve ?? (() => ({ resolved: false })),
    isPublic: overrides.isPublic ?? (() => false),
    hrefFor:
      overrides.hrefFor ??
      ((id: string, heading?: string) =>
        heading !== undefined ? `/${id}#${heading}` : `/${id}`),
    sourceFile: overrides.sourceFile,
    onWarning: overrides.onWarning,
  };
}

function applyPlugin(tree: Root, options: RemarkWikilinkOptions): void {
  remarkWikilink(options)(tree);
}

function paragraphChildren(tree: Root, index = 0): unknown[] {
  const node = tree.children[index];
  if (!node || node.type !== 'paragraph') {
    throw new Error(
      `expected child ${index} to be paragraph, got ${node?.type ?? 'nothing'}`,
    );
  }
  return node.children as unknown[];
}

describe('remarkWikilink (thin bridge over core rewriteWikilinks)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('(1) public target → link node built from hrefFor(targetId)', () => {
    const tree = parse('see [[AnotherPublic]] here');
    applyPlugin(
      tree,
      makeOptions({
        resolve: (raw) =>
          raw === 'AnotherPublic'
            ? { resolved: true, targetId: 'another-public' }
            : { resolved: false },
        isPublic: () => true,
      }),
    );

    const children = paragraphChildren(tree);
    expect(
      children[1],
      'public wikilinks must become link nodes with url from hrefFor',
    ).toMatchObject({
      type: 'link',
      url: '/another-public',
      children: [{ type: 'text', value: 'AnotherPublic' }],
    });
  });

  it('(2) private target → plain text only; targetId never surfaces in the tree', () => {
    const tree = parse('x [[AnotherPublic]] y');
    applyPlugin(
      tree,
      makeOptions({
        resolve: () => ({ resolved: true, targetId: 'another-public' }),
        isPublic: () => false,
      }),
    );

    const children = paragraphChildren(tree);
    expect(
      children[1],
      'private target must be a bare text node — no link, no href, no title',
    ).toMatchObject({ type: 'text', value: 'AnotherPublic' });
    expect(children[1]).not.toHaveProperty('url');

    const serialized = JSON.stringify(tree);
    expect(
      serialized,
      'private targetId must not appear anywhere in the rewritten tree',
    ).not.toContain('another-public');
  });

  it('(3) unresolved target → onWarning called exactly once with { sourceFile, raw, message }', () => {
    const tree = parse('open [[DoesNotExist]] link');
    const onWarning = vi.fn();

    applyPlugin(
      tree,
      makeOptions({
        resolve: () => ({ resolved: false }),
        sourceFile: 'notes/a.md',
        onWarning,
      }),
    );

    const children = paragraphChildren(tree);
    expect(
      children[1],
      'unresolved wikilinks must degrade to plain text (no link node)',
    ).toMatchObject({ type: 'text', value: 'DoesNotExist' });

    expect(
      onWarning,
      'onWarning must be invoked exactly once for a single unresolved link',
    ).toHaveBeenCalledTimes(1);
    const warning = onWarning.mock.calls[0]?.[0] as
      | { sourceFile?: string; raw: string; message: string }
      | undefined;
    expect(warning).toMatchObject({
      sourceFile: 'notes/a.md',
      raw: 'DoesNotExist',
    });
    expect(
      warning?.message,
      'warning message must reference the raw target text',
    ).toContain('DoesNotExist');
  });

  it('(4) alias `[[Target|사용자표시]]` → display text is the alias for both public and private targets', () => {
    const pubTree = parse('see [[Target|사용자표시]] now');
    applyPlugin(
      pubTree,
      makeOptions({
        resolve: () => ({ resolved: true, targetId: 'target' }),
        isPublic: () => true,
      }),
    );
    expect(
      paragraphChildren(pubTree)[1],
      'public + alias must render a link whose children text is the alias',
    ).toMatchObject({
      type: 'link',
      children: [{ type: 'text', value: '사용자표시' }],
    });

    const privTree = parse('see [[Target|사용자표시]] now');
    applyPlugin(
      privTree,
      makeOptions({
        resolve: () => ({ resolved: true, targetId: 'target' }),
        isPublic: () => false,
      }),
    );
    expect(
      paragraphChildren(privTree)[1],
      'private + alias must surface alias as plain text (and nothing else)',
    ).toMatchObject({ type: 'text', value: '사용자표시' });
  });

  it('(5) heading `[[Target#Some Heading]]` → hrefFor receives (targetId, heading) verbatim', () => {
    const tree = parse('jump [[Target#Some Heading]] here');
    const hrefFor = vi.fn(
      (id: string, heading?: string) =>
        `/h/${id}${heading !== undefined ? `#${heading}` : ''}`,
    );

    applyPlugin(
      tree,
      makeOptions({
        resolve: () => ({ resolved: true, targetId: 'target' }),
        isPublic: () => true,
        hrefFor,
      }),
    );

    expect(
      hrefFor,
      'hrefFor must be invoked with the exact heading string as the second argument',
    ).toHaveBeenCalledWith('target', 'Some Heading');
    expect(paragraphChildren(tree)[1]).toMatchObject({
      type: 'link',
      url: '/h/target#Some Heading',
    });
  });

  it('(6) wikilinks inside inlineCode / code / html / yaml nodes are left untouched', () => {
    const resolve = vi.fn(() => ({ resolved: true, targetId: 'x' }));
    const tree: Root = {
      type: 'root',
      children: [
        { type: 'yaml', value: 'title: [[YAMLLink]]' },
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'inline: ' },
            { type: 'inlineCode', value: '[[InlineCode]]' },
            { type: 'text', value: ' here' },
          ],
        },
        { type: 'code', lang: null, meta: null, value: '[[FencedCode]]' },
        { type: 'html', value: '<div>[[HtmlNode]]</div>' },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'rewrite me [[Real]] please' }],
        },
      ],
    } as unknown as Root;

    applyPlugin(
      tree,
      makeOptions({
        resolve: (raw) =>
          raw === 'Real' ? { resolved: true, targetId: 'real' } : resolve(),
        isPublic: () => true,
      }),
    );

    const yamlNode = tree.children[0] as { value: string };
    const paraKids = (tree.children[1] as { children: unknown[] }).children;
    const inlineCode = paraKids[1] as { value: string };
    const code = tree.children[2] as { value: string };
    const html = tree.children[3] as { value: string };

    expect(
      yamlNode.value,
      'yaml frontmatter wikilink string must remain literal',
    ).toBe('title: [[YAMLLink]]');
    expect(
      inlineCode.value,
      'inlineCode wikilink string must remain literal',
    ).toBe('[[InlineCode]]');
    expect(
      code.value,
      'fenced code block wikilink string must remain literal',
    ).toBe('[[FencedCode]]');
    expect(
      html.value,
      'raw html wikilink string must remain literal',
    ).toBe('<div>[[HtmlNode]]</div>');

    const realPara = tree.children[4] as { children: unknown[] };
    expect(
      realPara.children[1],
      'paragraph-level wikilinks must still be rewritten to links',
    ).toMatchObject({ type: 'link', url: '/real' });
  });

  it('(7) embed `![[...]]` sequences are not rewritten by this plugin', () => {
    const tree = parse('before ![[Target]] after');
    const snapshotBefore = JSON.parse(JSON.stringify(tree)) as unknown;
    const resolve = vi.fn(() => ({ resolved: true, targetId: 'target' }));
    const onWarning = vi.fn();

    applyPlugin(
      tree,
      makeOptions({
        resolve,
        isPublic: () => true,
        onWarning,
      }),
    );

    expect(
      resolve,
      'embeds must never hit resolve — they are the transclude plugin’s job',
    ).not.toHaveBeenCalled();
    expect(
      onWarning,
      'embeds must never produce a warning from this plugin',
    ).not.toHaveBeenCalled();
    expect(
      JSON.parse(JSON.stringify(tree)),
      'embed input tree must be byte-for-byte equal to the output tree',
    ).toEqual(snapshotBefore);
  });
});
