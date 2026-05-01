import { describe, expect, it } from 'vitest';
import { coerceDate, slugBasename } from './viewModels.ts';

describe('coerceDate', () => {
  it('passes a string through unchanged', () => {
    expect(coerceDate('2026-05-01')).toBe('2026-05-01');
  });

  it('formats a Date object as YYYY-MM-DD', () => {
    // gray-matter (js-yaml default schema) parses unquoted YAML date scalars
    // like `Date: 2026-05-01` as JS Date objects rather than strings. Without
    // this coercion the home/category/tag rails see a non-string and fall
    // back to the `——` placeholder even though the note has a date.
    const d = new Date(Date.UTC(2026, 4, 1));
    expect(coerceDate(d)).toBe('2026-05-01');
  });

  it('returns undefined for invalid Date instances', () => {
    expect(coerceDate(new Date('not-a-date'))).toBeUndefined();
  });

  it('returns undefined for non-string, non-Date values', () => {
    expect(coerceDate(undefined)).toBeUndefined();
    expect(coerceDate(null)).toBeUndefined();
    expect(coerceDate(20260501)).toBeUndefined();
    expect(coerceDate({ year: 2026 })).toBeUndefined();
  });
});

describe('slugBasename', () => {
  it('returns the trailing segment of a multi-level slug', () => {
    // The whole point of the helper: a deep slug renders as just its last
    // segment when the note's frontmatter `title` is missing. Without this,
    // the home/listing fallback used `entry.id` and surfaced the full path
    // ("ai/gen-ai/공부-일지/lora") to readers — the v0.5 "/" rail bug.
    expect(slugBasename('ai/gen-ai/공부-일지/lora')).toBe('lora');
  });

  it('returns the input verbatim when there is no slash', () => {
    expect(slugBasename('lora')).toBe('lora');
  });

  it('handles the trailing-slash edge case as the empty segment', () => {
    // A slug ending in `/` is malformed for our routing, but the helper
    // must not crash or invent a name. Returning '' makes the misuse
    // visible in test output rather than masking it with a guess.
    expect(slugBasename('foo/bar/')).toBe('');
  });
});
