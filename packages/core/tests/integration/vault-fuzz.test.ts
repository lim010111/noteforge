/**
 * Property-based fuzz for the core privacy pipeline.
 *
 * 50 random vault shapes (3..10 notes, random public flag per note, random
 * `[[Note_j]]` links, optional `![[Note_j]]` embed) are assembled on disk and
 * fed through `runCorePipeline`. Five privacy invariants (classify consistency,
 * no private body canary leak, no private title in anchor attributes, public
 * subgraph endpoint closure, and per-note embed boundary) must hold across
 * every run. Seed is fixed for reproducibility.
 *
 * The test treats the pipeline as a black box — it does not re-implement any
 * privacy logic. Canary strings are constructed from the per-index generator
 * output rather than hardcoded into the test file, so the "canary absent from
 * HTML" assertions cannot self-match against the test source.
 */
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { defineConfig } from '../../src/config.ts';
import { runCorePipeline } from '../../src/pipeline.ts';

const FUZZ_SEED = 424242;
const FUZZ_RUNS = 50;

interface GenNote {
  readonly isPublicFlag: boolean;
  readonly linkTargets: readonly number[];
  readonly hasEmbed: boolean;
  readonly embedTarget: number;
}

interface GenVault {
  readonly notes: readonly GenNote[];
}

const canaryFor = (i: number): string => `FUZZ_PRIVATE_CANARY_${i}`;
const titleFor = (i: number): string => `Note_${i}`;
const slugFor = (i: number): string => `note-${i}`;

function buildNoteFile(note: GenNote, index: number): string {
  const fm: string[] = [
    '---',
    `title: ${titleFor(index)}`,
    `slug: ${slugFor(index)}`,
  ];
  if (note.isPublicFlag) fm.push('public: true');
  fm.push('---', '');

  const body: string[] = [canaryFor(index), ''];
  for (const t of note.linkTargets) body.push(`[[${titleFor(t)}]]`);
  if (note.hasEmbed) body.push('', `![[${titleFor(note.embedTarget)}]]`);

  return fm.join('\n') + body.join('\n') + '\n';
}

function arbitraryVault(): fc.Arbitrary<GenVault> {
  return fc.integer({ min: 3, max: 10 }).chain((n) => {
    const nodeIdx = fc.integer({ min: 0, max: n - 1 });
    const noteArb: fc.Arbitrary<GenNote> = fc.record({
      isPublicFlag: fc.boolean(),
      linkTargets: fc.array(nodeIdx, { minLength: 3, maxLength: 3 }),
      hasEmbed: fc.boolean(),
      embedTarget: nodeIdx,
    });
    return fc
      .array(noteArb, { minLength: n, maxLength: n })
      .map((notes) => ({ notes }));
  });
}

async function writeVault(dir: string, vault: GenVault): Promise<void> {
  for (let i = 0; i < vault.notes.length; i++) {
    const note = vault.notes[i];
    if (note === undefined) continue;
    await fsp.writeFile(
      path.join(dir, `${titleFor(i)}.md`),
      buildNoteFile(note, i),
      'utf8',
    );
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('property-based fuzz — privacy invariants across random vaults', () => {
  let baseDir: string;
  const originalWarn = console.warn;

  beforeAll(async () => {
    baseDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'obpub-fuzz-'));
    // Silence unresolved-link / unresolved-embed warnings from the pipeline —
    // this fuzz only generates resolvable targets, but keeping the channel
    // quiet prevents any incidental shrinking output from being drowned.
    console.warn = (): void => {};
  });

  afterAll(async () => {
    console.warn = originalWarn;
    if (baseDir !== undefined) {
      await fsp.rm(baseDir, { recursive: true, force: true });
    }
  });

  it(
    `holds 5 privacy invariants over ${FUZZ_RUNS} random vaults (seed=${FUZZ_SEED})`,
    async () => {
      await fc.assert(
        fc.asyncProperty(arbitraryVault(), async (vault) => {
          const vaultDir = await fsp.mkdtemp(path.join(baseDir, 'run-'));
          try {
            await writeVault(vaultDir, vault);

            const config = defineConfig({
              site: {
                title: 'fuzz',
                url: 'https://example.com',
                author: 'tester',
              },
              vaults: [
                {
                  id: 'fuzz',
                  path: vaultDir,
                  ignore: ['.obsidian/**', '.trash/**'],
                },
              ],
            });

            const result = await runCorePipeline(config);

            const expectedPublic = new Set<string>();
            const privateIndices: number[] = [];
            for (let i = 0; i < vault.notes.length; i++) {
              const n = vault.notes[i];
              if (n === undefined) continue;
              if (n.isPublicFlag) expectedPublic.add(slugFor(i));
              else privateIndices.push(i);
            }

            // [1] classify consistency
            expect([...result.publicSlugs].sort()).toEqual(
              [...expectedPublic].sort(),
            );

            const concatHtml = [...result.renderedHtml.values()].join('\n');

            // [2] private body canaries never leak into any rendered public HTML
            for (const i of privateIndices) {
              expect(concatHtml.includes(canaryFor(i))).toBe(false);
            }

            // [3] private title never appears inside an <a> attribute
            for (const i of privateIndices) {
              const pattern = new RegExp(
                `<a\\s[^>]*(?:href|title|data-[a-z-]+)\\s*=\\s*["'][^"']*${escapeRegex(
                  titleFor(i),
                )}`,
                'i',
              );
              expect(pattern.test(concatHtml)).toBe(false);
            }

            // [4] publicGraph edges both endpoints public
            for (const e of result.publicGraph.edges) {
              expect(result.publicSlugs.has(e.from)).toBe(true);
              expect(result.publicSlugs.has(e.to)).toBe(true);
            }

            // [5] embed boundary — per public note whose embed targets a private
            // note, that note's HTML must not contain the target's canary
            for (let i = 0; i < vault.notes.length; i++) {
              const n = vault.notes[i];
              if (n === undefined || !n.isPublicFlag || !n.hasEmbed) continue;
              const target = vault.notes[n.embedTarget];
              if (target === undefined || target.isPublicFlag) continue;
              const html = result.renderedHtml.get(slugFor(i)) ?? '';
              expect(html.includes(canaryFor(n.embedTarget))).toBe(false);
            }
          } finally {
            await fsp.rm(vaultDir, { recursive: true, force: true });
          }
        }),
        { numRuns: FUZZ_RUNS, seed: FUZZ_SEED, verbose: true },
      );
    },
    30000,
  );
});
