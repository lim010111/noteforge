/**
 * Integration: confirm `runCorePipeline` exposes `aliasRedirects` derived only
 * from publishable notes. Step 2 will exercise the same path against the
 * shared `vault-mixed` fixture; here we use a small per-test scratch vault so
 * the assertions stay focused on the alias funnel itself.
 *
 * Privacy invariant under test:
 *   - aliases declared by a public note appear in `result.aliasRedirects`.
 *   - aliases declared by a private note never appear anywhere in the result
 *     (not in `aliasRedirects`, not in serialized HTML, not in warnings) —
 *     even though `private/**` lives outside the tripwire path here, the
 *     `public: false` (default) verdict alone must be enough to keep the
 *     alias string out of the publish surface.
 */

import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { defineConfig } from '../../src/config.ts';
import { runCorePipeline, type PipelineResult } from '../../src/pipeline.ts';

const PRIVATE_ALIAS_CANARY = 'PRIVATE_ALIAS_DO_NOT_LEAK_4f7a';

let vaultRoot: string;
let result: PipelineResult;

beforeAll(async () => {
  vaultRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'obpub-alias-pipeline-'));

  // Public note with two declared aliases — one ASCII, one Hangul.
  await fsp.writeFile(
    path.join(vaultRoot, 'public-with-alias.md'),
    [
      '---',
      'title: Public With Alias',
      'public: true',
      'aliases: [old-name, 옛이름]',
      '---',
      '',
      '본문은 평범한 산문이면 된다.',
      '',
    ].join('\n'),
    'utf8',
  );

  // Private note (no public marker) whose alias contains a canary string.
  // The whole point: this string must not appear anywhere in result.
  await fsp.writeFile(
    path.join(vaultRoot, 'hidden-secret.md'),
    [
      '---',
      'title: Hidden Secret',
      `aliases: [${PRIVATE_ALIAS_CANARY}]`,
      '---',
      '',
      '비공개 노트.',
      '',
    ].join('\n'),
    'utf8',
  );

  // A second public note with no aliases — keeps the publishable set > 1 so
  // the test cannot accidentally succeed from a degenerate single-note vault.
  await fsp.writeFile(
    path.join(vaultRoot, 'sibling-public.md'),
    ['---', 'title: Sibling', 'public: true', '---', '', '시블링.', ''].join(
      '\n',
    ),
    'utf8',
  );

  const config = defineConfig({
    site: {
      title: 'alias pipeline integration',
      url: 'https://example.com',
      author: 'tester',
    },
    vaults: [
      {
        id: 'fixture',
        path: vaultRoot,
        ignore: ['.obsidian/**', '.trash/**'],
      },
    ],
  });

  result = await runCorePipeline(config);
});

afterAll(async () => {
  await fsp.rm(vaultRoot, { recursive: true, force: true });
});

describe('aliasPipeline (core integration)', () => {
  it('emits redirects for every alias declared on a public note', () => {
    const fromSet = new Set(result.aliasRedirects.map((r) => r.from));
    expect(
      fromSet.has('old-name'),
      'frontmatter alias `old-name` must surface as an aliasRedirect.from',
    ).toBe(true);
    expect(
      fromSet.has('옛이름'),
      'Hangul alias must be preserved verbatim through slugifySegment',
    ).toBe(true);

    for (const r of result.aliasRedirects) {
      if (r.from === 'old-name' || r.from === '옛이름') {
        expect(
          r.to,
          'alias redirect target must be the canonical slug of public-with-alias',
        ).toBe('public-with-alias');
      }
    }
  });

  it('redirects reference only public canonical slugs', () => {
    for (const r of result.aliasRedirects) {
      expect(
        result.publicSlugs.has(r.to),
        `aliasRedirect.to '${r.to}' must be a public slug — private targets break the privacy contract`,
      ).toBe(true);
    }
  });

  it('never leaks a private note alias string into the pipeline result', () => {
    // Cover every channel a private alias could have leaked into:
    //  - aliasRedirects entries (from / to / noteId)
    //  - rendered HTML for any public note
    //  - structured warnings
    // We serialize each surface and assert the canary is absent from all.
    const aliasSerialized = JSON.stringify(result.aliasRedirects);
    expect(
      aliasSerialized.includes(PRIVATE_ALIAS_CANARY),
      'private-note alias must not appear in aliasRedirects — buildAliasRedirects must only see the publishable subset',
    ).toBe(false);

    const htmlSerialized = [...result.renderedHtml.values()].join('\n');
    expect(
      htmlSerialized.includes(PRIVATE_ALIAS_CANARY),
      'private alias must not leak into rendered HTML of any public note',
    ).toBe(false);

    const warningsSerialized = JSON.stringify(result.warnings);
    expect(
      warningsSerialized.includes(PRIVATE_ALIAS_CANARY),
      'private alias must not leak into pipeline warnings — warnings get logged to stdout',
    ).toBe(false);
  });
});
