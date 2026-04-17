import { describe, expect, it } from 'vitest';
import { classify } from '../src/privacy/classify.ts';
import type { ClassifyRule, ParsedNote } from '../src/types.ts';

const DEFAULT_RULE: ClassifyRule = {
  frontmatterKey: 'public',
  publicTag: 'public',
  tripwirePaths: ['private/**'],
  unsafeAllowPrivateFolder: false,
};

function note(overrides: Partial<ParsedNote>): ParsedNote {
  return {
    path: '/vault/foo.md',
    vaultId: 'personal',
    relativePath: 'foo.md',
    frontmatter: {},
    tags: [],
    body: '',
    ...overrides,
  };
}

describe('classify', () => {
  describe('frontmatter rule', () => {
    it('is public when frontmatter.public === true', () => {
      const result = classify(note({ frontmatter: { public: true } }), DEFAULT_RULE);
      expect(result.isPublic).toBe(true);
      expect(result.reason).toMatch(/frontmatter/);
    });

    it('is private when frontmatter.public === false', () => {
      const result = classify(note({ frontmatter: { public: false } }), DEFAULT_RULE);
      expect(result.isPublic).toBe(false);
    });

    it('is private when frontmatter.public is missing', () => {
      const result = classify(note({}), DEFAULT_RULE);
      expect(result.isPublic).toBe(false);
      expect(result.reason).toMatch(/no public marker/i);
    });

    it('treats truthy non-true values as not public (strict equality)', () => {
      // "true" string must not accidentally publish; only boolean `true` counts.
      const result = classify(
        note({ frontmatter: { public: 'true' } }),
        DEFAULT_RULE,
      );
      expect(result.isPublic).toBe(false);
    });
  });

  describe('tag rule', () => {
    it('is public when tags include the public tag', () => {
      const result = classify(note({ tags: ['public'] }), DEFAULT_RULE);
      expect(result.isPublic).toBe(true);
      expect(result.reason).toMatch(/tag/);
    });

    it('is public when tags include a nested public/* tag', () => {
      const result = classify(note({ tags: ['public/essays'] }), DEFAULT_RULE);
      expect(result.isPublic).toBe(true);
    });

    it('is not public when tag only has the public tag as a prefix but not as a hierarchy segment', () => {
      // "publisher" shares the "public" prefix textually but is not a nested `public/...` tag.
      const result = classify(note({ tags: ['publisher'] }), DEFAULT_RULE);
      expect(result.isPublic).toBe(false);
    });

    it('honours a custom publicTag', () => {
      const rule: ClassifyRule = { ...DEFAULT_RULE, publicTag: 'shareable' };
      expect(classify(note({ tags: ['shareable'] }), rule).isPublic).toBe(true);
      expect(classify(note({ tags: ['public'] }), rule).isPublic).toBe(false);
    });
  });

  describe('tripwire', () => {
    it('forces private when the note is under a tripwire path, even with public: true frontmatter', () => {
      const result = classify(
        note({
          relativePath: 'private/family-photos.md',
          frontmatter: { public: true },
        }),
        DEFAULT_RULE,
      );
      expect(result.isPublic).toBe(false);
      expect(result.tripwireFired).toBe(true);
      expect(result.reason).toMatch(/tripwire/i);
    });

    it('forces private when the note is under a tripwire path with a public tag', () => {
      const result = classify(
        note({ relativePath: 'private/nested/secret.md', tags: ['public'] }),
        DEFAULT_RULE,
      );
      expect(result.isPublic).toBe(false);
      expect(result.tripwireFired).toBe(true);
    });

    it('does not fire tripwire for notes outside private/', () => {
      const result = classify(
        note({ relativePath: 'projects/foo.md', frontmatter: { public: true } }),
        DEFAULT_RULE,
      );
      expect(result.tripwireFired).toBe(false);
    });

    it('bypasses tripwire when unsafeAllowPrivateFolder is true', () => {
      const rule: ClassifyRule = { ...DEFAULT_RULE, unsafeAllowPrivateFolder: true };
      const result = classify(
        note({
          relativePath: 'private/family-photos.md',
          frontmatter: { public: true },
        }),
        rule,
      );
      expect(result.isPublic).toBe(true);
      expect(result.tripwireFired).toBe(false);
    });
  });

  describe('reason string', () => {
    it('mentions the exact rule that made the decision', () => {
      const fmResult = classify(note({ frontmatter: { public: true } }), DEFAULT_RULE);
      expect(fmResult.reason).toMatch(/public: true/);

      const tagResult = classify(note({ tags: ['public'] }), DEFAULT_RULE);
      expect(tagResult.reason).toMatch(/#public/);
    });
  });
});
