/**
 * categoryAccent — deterministic segment→slot mapping.
 *
 * Why these assertions:
 *   - determinism (1) : the SSOT contract; same input → same slot, every time,
 *                        every process. Repeated 100x to catch any accidental
 *                        mutable state in the hash.
 *   - distribution (2): the hash should not collapse 100 distinct inputs into
 *                       one slot. We allow generous tolerance (no slot used
 *                       more than ~60% of inputs) — the test is a sanity
 *                       check, not a statistical guarantee.
 *   - empty (3)       : the empty segment is the documented `null` case.
 *   - slotCount=0 (4) : defensive — callers must not crash if a config zeroes
 *                       the slot ring out.
 *   - slotCount const : `CATEGORY_ACCENT_SLOT_COUNT` matches design/TOKENS.md
 *                        (5 slots in v0.3).
 */

import { describe, expect, it } from 'vitest';
import {
  pickCategoryAccentSlot,
  CATEGORY_ACCENT_SLOT_COUNT,
} from '../src/lib/categoryAccent';

describe('pickCategoryAccentSlot', () => {
  it('(1) is deterministic — same segment → same slot, 100x', () => {
    const segments = ['AI', 'DB', 'writing', 'posts', '한국어'];
    for (const seg of segments) {
      const first = pickCategoryAccentSlot(seg, CATEGORY_ACCENT_SLOT_COUNT);
      for (let i = 0; i < 100; i++) {
        expect(pickCategoryAccentSlot(seg, CATEGORY_ACCENT_SLOT_COUNT)).toBe(first);
      }
    }
  });

  it('(2) distributes 100 distinct segments across all slots without collapsing', () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 100; i++) {
      const slot = pickCategoryAccentSlot(`segment-${i}`, CATEGORY_ACCENT_SLOT_COUNT);
      expect(slot, `slot for segment-${i} must be in [1..${CATEGORY_ACCENT_SLOT_COUNT}]`)
        .toBeTypeOf('number');
      expect(slot).toBeGreaterThanOrEqual(1);
      expect(slot).toBeLessThanOrEqual(CATEGORY_ACCENT_SLOT_COUNT);
      counts.set(slot!, (counts.get(slot!) ?? 0) + 1);
    }
    expect(counts.size, 'every slot 1..N should be hit at least once across 100 inputs').toBe(
      CATEGORY_ACCENT_SLOT_COUNT,
    );
    for (const [slot, count] of counts) {
      expect(
        count,
        `slot ${slot} captured ${count}/100 — distribution skew exceeds tolerance (max 60)`,
      ).toBeLessThan(60);
    }
  });

  it('(3) returns null for the empty segment', () => {
    expect(pickCategoryAccentSlot('', CATEGORY_ACCENT_SLOT_COUNT)).toBeNull();
  });

  it('(4) returns null when slotCount is zero or negative', () => {
    expect(pickCategoryAccentSlot('AI', 0)).toBeNull();
    expect(pickCategoryAccentSlot('AI', -1)).toBeNull();
    expect(pickCategoryAccentSlot('AI', 1.5 as unknown as number)).toBeNull();
  });

  it('(5) CATEGORY_ACCENT_SLOT_COUNT is 5 — matches v0.3 TOKENS.md', () => {
    expect(CATEGORY_ACCENT_SLOT_COUNT).toBe(5);
  });
});
