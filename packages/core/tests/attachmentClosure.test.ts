import { describe, expect, it } from 'vitest';
import {
  applyAttachmentClosure,
  buildAttachmentClosure,
  collectAttachmentRefs,
  type AttachmentRef,
} from '../src/privacy/attachmentClosure.ts';
import type { RenderedNote } from '../src/render/renderPublicNote.ts';
import type { ParsedNote } from '../src/types.ts';
import type { VaultIndexSnapshot } from '../src/vaultIndex/types.ts';

const DEFAULT_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf'] as const;

function note(
  slug: string,
  body: string,
  frontmatter: Record<string, unknown> = {},
): ParsedNote {
  return {
    path: `/abs/${slug}.md`,
    vaultId: 'main',
    relativePath: `${slug}.md`,
    frontmatter: Object.freeze({ ...frontmatter }),
    tags: Object.freeze([]),
    body,
  };
}

function vaultIndexLike(
  attachments: readonly string[],
): Pick<VaultIndexSnapshot, 'attachments' | 'attachmentByBasenameLower'> {
  const byBase = new Map<string, string>();
  for (const a of attachments) {
    const base = a.split('/').pop()?.toLowerCase() ?? '';
    byBase.set(base, a);
  }
  return { attachments, attachmentByBasenameLower: byBase };
}

function rendered(overrides: Partial<RenderedNote> = {}): RenderedNote {
  return {
    html: '<p>x</p>',
    headings: [],
    frontmatter: {},
    tags: [],
    attachmentRefs: [],
    firstImage: undefined,
    embeddedImages: [],
    ...overrides,
  };
}

describe('buildAttachmentClosure', () => {
  it('returns empty closure for empty references', () => {
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(),
      allReferences: [],
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual([]);
    expect(result.excluded).toEqual([]);
  });

  it('includes an attachment referenced by one public note (allowed extension)', () => {
    const refs: AttachmentRef[] = [{ id: 'a.png', sourceNoteId: 'n1' }];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(['n1']),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual(['a.png']);
    expect(result.excluded).toEqual([]);
  });

  it('excludes an attachment referenced only by private notes (no-public-referrer)', () => {
    const refs: AttachmentRef[] = [{ id: 'b.png', sourceNoteId: 'secret' }];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(['n1']),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual([]);
    expect(result.excluded).toEqual([{ id: 'b.png', reason: 'no-public-referrer' }]);
  });

  it('includes an attachment referenced by both public and private notes', () => {
    const refs: AttachmentRef[] = [
      { id: 'shared.png', sourceNoteId: 'pub' },
      { id: 'shared.png', sourceNoteId: 'priv' },
    ];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(['pub']),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual(['shared.png']);
    expect(result.excluded).toEqual([]);
  });

  it('excludes disallowed extensions (e.g. .exe) even when public-referred', () => {
    const refs: AttachmentRef[] = [{ id: 'payload.exe', sourceNoteId: 'pub' }];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(['pub']),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual([]);
    expect(result.excluded).toEqual([
      { id: 'payload.exe', reason: 'disallowed-extension' },
    ]);
  });

  it('treats extensionless ids as disallowed-extension', () => {
    const refs: AttachmentRef[] = [{ id: 'notes/readme', sourceNoteId: 'pub' }];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(['pub']),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual([]);
    expect(result.excluded).toEqual([
      { id: 'notes/readme', reason: 'disallowed-extension' },
    ]);
  });

  it('matches extensions case-insensitively (.PNG matches [.png])', () => {
    const refs: AttachmentRef[] = [{ id: 'IMG.PNG', sourceNoteId: 'pub' }];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(['pub']),
      allReferences: refs,
      allowedExtensions: ['.png'],
    });
    expect([...result.included]).toEqual(['IMG.PNG']);
    expect(result.excluded).toEqual([]);
  });

  it('includes an attachment only once even when referenced by many public notes', () => {
    const refs: AttachmentRef[] = [
      { id: 'shared.png', sourceNoteId: 'p1' },
      { id: 'shared.png', sourceNoteId: 'p2' },
      { id: 'shared.png', sourceNoteId: 'p3' },
    ];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(['p1', 'p2', 'p3']),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual(['shared.png']);
    expect(result.excluded).toEqual([]);
  });

  it('prefers disallowed-extension when a private-only reference also has a bad extension', () => {
    const refs: AttachmentRef[] = [{ id: 'hidden.exe', sourceNoteId: 'priv' }];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(['pub']),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual([]);
    expect(result.excluded).toEqual([
      { id: 'hidden.exe', reason: 'disallowed-extension' },
    ]);
  });

  it('excludes everything as no-public-referrer when publicNoteIds is empty (unless extension fails first)', () => {
    const refs: AttachmentRef[] = [
      { id: 'a.png', sourceNoteId: 'priv1' },
      { id: 'b.exe', sourceNoteId: 'priv2' },
    ];
    const result = buildAttachmentClosure({
      publicNoteIds: new Set(),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    });
    expect([...result.included]).toEqual([]);
    expect(result.excluded).toEqual([
      { id: 'a.png', reason: 'no-public-referrer' },
      { id: 'b.exe', reason: 'disallowed-extension' },
    ]);
  });

  it('produces deterministic excluded order (sorted by id) across repeated calls', () => {
    const refs: AttachmentRef[] = [
      { id: 'zeta.png', sourceNoteId: 'priv' },
      { id: 'alpha.png', sourceNoteId: 'priv' },
      { id: 'mango.exe', sourceNoteId: 'pub' },
      { id: 'beta.png', sourceNoteId: 'priv' },
    ];
    const options = {
      publicNoteIds: new Set(['pub']),
      allReferences: refs,
      allowedExtensions: DEFAULT_EXTS,
    };
    const first = buildAttachmentClosure(options);
    const second = buildAttachmentClosure(options);
    expect(first.excluded).toEqual([
      { id: 'alpha.png', reason: 'no-public-referrer' },
      { id: 'beta.png', reason: 'no-public-referrer' },
      { id: 'mango.exe', reason: 'disallowed-extension' },
      { id: 'zeta.png', reason: 'no-public-referrer' },
    ]);
    expect(second.excluded).toEqual(first.excluded);
  });
});

describe('collectAttachmentRefs', () => {
  it('returns no refs when body and frontmatter have no attachment references', () => {
    const refs = collectAttachmentRefs(
      note('foo', 'plain body, no embeds.'),
      vaultIndexLike(['img.png']),
    );
    expect(refs).toEqual([]);
  });

  it('collects refs from `![[name.png]]` embeds in body, resolved against attachmentByBasenameLower', () => {
    const refs = collectAttachmentRefs(
      note('foo', '![[img-a.png]] some text ![[img-b.png|alt]]'),
      vaultIndexLike(['img-a.png', 'img-b.png']),
    );
    expect(refs).toEqual([
      { id: 'img-a.png', sourceNoteId: 'foo' },
      { id: 'img-b.png', sourceNoteId: 'foo' },
    ]);
  });

  it('ignores `![[...]]` whose target is not a known attachment basename', () => {
    const refs = collectAttachmentRefs(
      note('foo', '![[some-note]]'),
      vaultIndexLike(['only.png']),
    );
    expect(refs).toEqual([]);
  });

  it('collects refs from frontmatter cover + thumbnail when /attachments/<id> matches a known id', () => {
    const refs = collectAttachmentRefs(
      note('foo', '', {
        cover: '/attachments/hero.png',
        thumbnail: '/attachments/thumb.png',
      }),
      vaultIndexLike(['hero.png', 'thumb.png']),
    );
    expect(refs).toEqual([
      { id: 'hero.png', sourceNoteId: 'foo' },
      { id: 'thumb.png', sourceNoteId: 'foo' },
    ]);
  });

  it('ignores frontmatter cover/thumbnail that does not point at /attachments/', () => {
    const refs = collectAttachmentRefs(
      note('foo', '', {
        cover: 'https://cdn.example/hero.png',
        thumbnail: '/static/theme.png',
      }),
      vaultIndexLike(['hero.png']),
    );
    expect(refs).toEqual([]);
  });

  it('skips frontmatter image fields whose id is not in vaultIndex.attachments', () => {
    const refs = collectAttachmentRefs(
      note('foo', '', { cover: '/attachments/unknown.png' }),
      vaultIndexLike(['known.png']),
    );
    expect(refs).toEqual([]);
  });

  it('returns body refs followed by frontmatter refs (deterministic order)', () => {
    const refs = collectAttachmentRefs(
      note('foo', '![[body.png]]', { cover: '/attachments/cover.png' }),
      vaultIndexLike(['body.png', 'cover.png']),
    );
    expect(refs).toEqual([
      { id: 'body.png', sourceNoteId: 'foo' },
      { id: 'cover.png', sourceNoteId: 'foo' },
    ]);
  });
});

describe('applyAttachmentClosure', () => {
  it('filters embeddedImages to those whose /attachments/<id> survives the closure', () => {
    const result = applyAttachmentClosure(
      rendered({
        firstImage: '/attachments/pub.png',
        embeddedImages: ['/attachments/pub.png', '/attachments/priv.png'],
      }),
      new Set(['pub.png']),
    );
    expect(result.embeddedImages).toEqual(['/attachments/pub.png']);
    expect(result.firstImage).toBe('/attachments/pub.png');
  });

  it('passes absolute http(s) image URLs through regardless of closure contents', () => {
    const result = applyAttachmentClosure(
      rendered({
        firstImage: 'https://cdn.example/x.png',
        embeddedImages: ['https://cdn.example/x.png'],
      }),
      new Set(),
    );
    expect(result.firstImage).toBe('https://cdn.example/x.png');
    expect(result.embeddedImages).toEqual(['https://cdn.example/x.png']);
  });

  it('clears firstImage when every raw embedded image fails the closure', () => {
    const result = applyAttachmentClosure(
      rendered({
        firstImage: '/attachments/priv-a.png',
        embeddedImages: ['/attachments/priv-a.png', '/attachments/priv-b.png'],
      }),
      new Set(),
    );
    expect(result.firstImage).toBeUndefined();
    expect(result.embeddedImages).toEqual([]);
  });

  it('drops frontmatter.cover when it points at a private-only attachment', () => {
    const result = applyAttachmentClosure(
      rendered({
        frontmatter: {
          title: 'Foo',
          cover: '/attachments/secret.png',
          thumbnail: '/attachments/pub.png',
        },
      }),
      new Set(['pub.png']),
    );
    expect(result.frontmatter).not.toHaveProperty('cover');
    expect(result.frontmatter).toHaveProperty('thumbnail', '/attachments/pub.png');
    expect(result.frontmatter).toHaveProperty('title', 'Foo');
  });

  it('does not mutate the input RenderedNote (immutable application)', () => {
    const raw = rendered({
      frontmatter: { cover: '/attachments/secret.png' },
      firstImage: '/attachments/secret.png',
      embeddedImages: ['/attachments/secret.png'],
    });
    const frozenFrontmatterRef = raw.frontmatter;
    const result = applyAttachmentClosure(raw, new Set());
    // Input untouched.
    expect(raw.frontmatter).toBe(frozenFrontmatterRef);
    expect(raw.frontmatter).toHaveProperty('cover', '/attachments/secret.png');
    expect(raw.firstImage).toBe('/attachments/secret.png');
    expect(raw.embeddedImages).toEqual(['/attachments/secret.png']);
    // Result reflects the gating.
    expect(result.frontmatter).not.toHaveProperty('cover');
    expect(result.firstImage).toBeUndefined();
    expect(result.embeddedImages).toEqual([]);
  });

  it('leaves html, headings, tags, and attachmentRefs untouched (closure only gates image surfaces)', () => {
    const refs: readonly AttachmentRef[] = [{ id: 'pub.png', sourceNoteId: 'foo' }];
    const result = applyAttachmentClosure(
      rendered({
        html: '<p>body</p>',
        headings: [{ depth: 2, text: 'S', id: 's' }],
        tags: ['public', 'essay'],
        attachmentRefs: refs,
      }),
      new Set(['pub.png']),
    );
    expect(result.html).toBe('<p>body</p>');
    expect(result.headings).toEqual([{ depth: 2, text: 'S', id: 's' }]);
    expect(result.tags).toEqual(['public', 'essay']);
    expect(result.attachmentRefs).toBe(refs);
  });
});
