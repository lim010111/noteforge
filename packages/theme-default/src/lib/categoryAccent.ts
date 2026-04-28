/**
 * Category accent slot — deterministic mapping from a slug segment
 * to one of the `--color-accent-cat-1..N` token slots.
 *
 * The mapping is computed via FNV-1a 32-bit hash of the segment string,
 * modulo `slotCount`. The result is 1-indexed so callers can interpolate
 * the slot directly into a CSS variable name (`var(--color-accent-cat-${n})`).
 *
 * SSOT for the slot count: `phases/step10-v03-sidebar-redesign/design/TOKENS.md`
 * (5 slots in v0.3). `tokens.css` defines `--color-accent-cat-1..5`. The
 * exported `CATEGORY_ACCENT_SLOT_COUNT` constant is the single source of truth
 * in code — `apps/blog`'s sidebar payload imports it instead of hard-coding 5.
 *
 * `null` is returned for empty input segments and non-positive `slotCount`,
 * so callers can fall back to the primary accent without a separate guard.
 *
 * Why FNV-1a: small, dependency-free, well-distributed for short ASCII/UTF-16
 * inputs (Math.imul keeps it 32-bit even on V8). Determinism is the primary
 * contract; cryptographic strength is irrelevant.
 */

const FNV_OFFSET_BASIS_32 = 2166136261;
const FNV_PRIME_32 = 16777619;

function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME_32);
  }
  return hash >>> 0;
}

export function pickCategoryAccentSlot(
  segment: string,
  slotCount: number,
): number | null {
  if (segment.length === 0) return null;
  if (!Number.isInteger(slotCount) || slotCount <= 0) return null;
  return (fnv1a32(segment) % slotCount) + 1;
}

export const CATEGORY_ACCENT_SLOT_COUNT = 5;
