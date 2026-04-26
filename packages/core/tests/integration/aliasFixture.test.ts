/**
 * Integration: pipe the shared `vault-mixed` fixture through `runCorePipeline`
 * and prove that frontmatter `aliases` declared on a public note surface as
 * redirects, while aliases declared on a private note never appear in any
 * publish-surface channel.
 *
 * Why this is a separate file from `vault-mixed.test.ts`:
 *   - That file enumerates the original 11 privacy invariants. Folding alias
 *     assertions into it would conflate two concerns and force every future
 *     alias change to touch the historical invariant counts.
 *   - The canary used here (`DO_NOT_LEAK_BANANA_*`) is shared with
 *     `Private Secret.md` so we can reuse the regex-extracted sentinel
 *     without hardcoding it in the test source.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import { defineConfig } from '../../src/config.ts';
import { runCorePipeline, type PipelineResult } from '../../src/pipeline.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(HERE, '..', 'fixtures', 'vault-mixed');

const CANARY_A_RE = /DO_NOT_LEAK_BANANA_[A-Za-z0-9]+/;

async function readCanaryA(): Promise<string> {
  const body = await fs.readFile(
    path.join(VAULT_ROOT, 'private-with-alias.md'),
    'utf8',
  );
  const m = CANARY_A_RE.exec(body);
  if (m === null) {
    throw new Error('fixture private-with-alias.md does not contain canary A');
  }
  return m[0];
}

describe('vault-mixed alias fixture — alias redirects honour the privacy contract', () => {
  let result: PipelineResult;
  let canaryA: string;

  beforeAll(async () => {
    canaryA = await readCanaryA();
    const config = defineConfig({
      site: {
        title: 'vault-mixed alias fixture',
        url: 'https://example.com',
        author: 'tester',
      },
      vaults: [
        {
          id: 'fixture',
          path: VAULT_ROOT,
          ignore: ['.obsidian/**', '.trash/**'],
        },
      ],
      publishing: {
        tagBlocklist: ['client/**'],
      },
    });
    result = await runCorePipeline(config);
  });

  it('emits a redirect from the public note alias `old-name` to its canonical slug', () => {
    const match = result.aliasRedirects.find((r) => r.from === 'old-name');
    expect(
      match,
      'public note `note-with-alias.md` declares `aliases: [old-name, …]` — that alias must surface as a redirect',
    ).toBeDefined();
    expect(match!.to).toBe('note-with-alias');
  });

  it('never emits a redirect for an alias declared on a private note', () => {
    const fromSet = new Set(result.aliasRedirects.map((r) => r.from));
    expect(
      fromSet.has('secret-old'),
      '`private-with-alias.md` is not public — its `secret-old` alias must never reach result.aliasRedirects',
    ).toBe(false);
  });

  it('does not leak the private alias canary into any serialized publish channel', () => {
    // Each channel is independently serialized so the assertion error tells us
    // *where* a regression introduced the leak, not just that one happened.
    const aliasSerialized = JSON.stringify(result.aliasRedirects);
    expect(
      aliasSerialized.includes(canaryA),
      'canary A must not appear in aliasRedirects — buildAliasRedirects must only see publishable notes',
    ).toBe(false);

    const htmlSerialized = [...result.renderedHtml.values()].join('\n');
    expect(
      htmlSerialized.includes(canaryA),
      'canary A must not appear in any rendered public HTML — private bodies are excluded from rendering',
    ).toBe(false);

    const frontmatterSerialized = JSON.stringify([
      ...result.publicFrontmatter.values(),
    ]);
    expect(
      frontmatterSerialized.includes(canaryA),
      'canary A must not surface via allowlisted public frontmatter — private notes must never contribute frontmatter rows',
    ).toBe(false);

    const warningsSerialized = JSON.stringify(result.warnings);
    expect(
      warningsSerialized.includes(canaryA),
      'canary A must not appear in pipeline warnings — warnings are logged to stdout/CI',
    ).toBe(false);
  });
});
