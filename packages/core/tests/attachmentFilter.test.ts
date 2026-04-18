import { describe, expect, it } from 'vitest';
import {
  buildAttachmentClosure,
  type AttachmentRef,
} from '../src/privacy/attachmentFilter.ts';

const DEFAULT_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf'] as const;

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
