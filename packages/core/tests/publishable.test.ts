import { describe, expect, it } from 'vitest';
import { isPublishable } from '../src/privacy/publishable.ts';

describe('isPublishable', () => {
  it('returns true when draft is absent', () => {
    expect(isPublishable({})).toBe(true);
    expect(isPublishable({ title: 'X', date: '2026-04-26' })).toBe(true);
  });

  it('returns true when draft is explicitly false', () => {
    expect(isPublishable({ draft: false })).toBe(true);
  });

  it('returns false when draft is exactly true', () => {
    expect(isPublishable({ draft: true })).toBe(false);
  });

  it('treats only the boolean true as a draft signal — string "true" is not draft', () => {
    // Vault frontmatter is YAML-typed by gray-matter. The pipeline normalizes
    // booleans before this gate, so strings/numbers should pass through. This
    // matches `classify.ts` which also requires `=== true` for the public flag.
    expect(isPublishable({ draft: 'true' })).toBe(true);
    expect(isPublishable({ draft: 1 })).toBe(true);
    expect(isPublishable({ draft: null })).toBe(true);
  });

  it('does not look at any other field', () => {
    expect(isPublishable({ public: false, draft: true })).toBe(false);
    expect(isPublishable({ public: true, draft: true })).toBe(false);
    expect(isPublishable({ tags: ['draft'], draft: false })).toBe(true);
  });

  it('is pure — does not mutate input', () => {
    const fm = Object.freeze({ draft: true, title: 'X' });
    expect(() => isPublishable(fm)).not.toThrow();
    expect(isPublishable(fm)).toBe(false);
  });
});
