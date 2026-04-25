import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineConfig, type ObpubConfig } from '@noteforge/core/config';
import { runCorePipeline, type PipelineResult } from '@noteforge/core/pipeline';
import { runAudit } from '../../src/commands/audit.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(
  HERE,
  '..',
  '..',
  '..',
  'core',
  'tests',
  'fixtures',
  'vault-mixed',
);

const CANARY_A_RE = /DO_NOT_LEAK_BANANA_[A-Za-z0-9]+/;
const CANARY_B_RE = /CLAUDE_COMMENT_LEAK_[A-Za-z0-9]+/;

interface Sandbox {
  readonly distDir: string;
}

let sandbox: Sandbox;

function buildConfig(): ObpubConfig {
  return defineConfig({
    site: { title: 'audit-it', url: 'https://example.com', author: 'tester' },
    vaults: [
      {
        id: 'fixture',
        path: VAULT_ROOT,
        ignore: ['.obsidian/**', '.trash/**'],
      },
    ],
    publishing: { tagBlocklist: ['client/**'] },
  });
}

async function readCanary(rel: string, re: RegExp): Promise<string> {
  const body = await fs.readFile(path.join(VAULT_ROOT, rel), 'utf8');
  const m = re.exec(body);
  if (m === null) throw new Error(`fixture ${rel} missing canary`);
  return m[0];
}

/**
 * Hand-crafted clean dist used for the green scenario. It mirrors what a
 * privacy-respecting theme would produce: one safe HTML page per public slug
 * (no link to private notes, no `%%...%%` markers, no canary strings), the
 * pipeline's own publicGraph at `api/graph.json`, and pass-through copies of
 * every public attachment. We deliberately avoid running the renderedHtml
 * through the dist because vault-mixed's `public-note.md` references
 * `[[Private Secret]]` — strip-to-text leaves the typed words in plain text,
 * and ADR-004 acknowledges the audit is meant to flag that.
 */
async function writeCleanDist(distDir: string, result: PipelineResult): Promise<void> {
  await fs.mkdir(distDir, { recursive: true });
  for (const slug of result.publicSlugs) {
    const target = path.join(distDir, slug, 'index.html');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(
      target,
      `<!doctype html><html><body data-fm-slug="${slug}" data-fm-title="ok"><p>clean</p></body></html>`,
      'utf8',
    );
  }
  const apiDir = path.join(distDir, 'api');
  await fs.mkdir(apiDir, { recursive: true });
  await fs.writeFile(
    path.join(apiDir, 'graph.json'),
    JSON.stringify(result.publicGraph),
    'utf8',
  );
  const attachmentsDir = path.join(distDir, 'attachments');
  await fs.mkdir(attachmentsDir, { recursive: true });
  for (const rel of result.attachmentClosure) {
    const src = path.join(VAULT_ROOT, rel);
    const dst = path.join(attachmentsDir, path.basename(rel));
    await fs.copyFile(src, dst);
  }
}

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `obpub-audit-int-${randomUUID()}-`));
  sandbox = { distDir: dir };
});

afterEach(async () => {
  await fs.rm(sandbox.distDir, { recursive: true, force: true });
});

describe('runAudit — vault-mixed integration', () => {
  it('green: clean synthesized dist + pipeline-derived inputs reports zero violations', async () => {
    const config = buildConfig();
    const result = await runCorePipeline(config);
    await writeCleanDist(sandbox.distDir, result);

    const outcome = await runAudit(config, { distDir: sandbox.distDir, strict: false });

    expect(outcome.violations).toEqual([]);
    expect(outcome.checkedFiles).toBeGreaterThan(0);
  });

  it('red: private title injected into a public page is flagged as private-note-title-in-html', async () => {
    const config = buildConfig();
    const result = await runCorePipeline(config);
    await writeCleanDist(sandbox.distDir, result);

    const canaryA = await readCanary('Private Secret.md', CANARY_A_RE);
    const target = path.join(sandbox.distDir, 'public-note', 'index.html');
    const before = await fs.readFile(target, 'utf8');
    await fs.writeFile(
      target,
      before.replace(
        '</body>',
        `<p>see Private Secret here ${canaryA}</p></body>`,
      ),
      'utf8',
    );

    const outcome = await runAudit(config, { distDir: sandbox.distDir, strict: false });

    const titleHits = outcome.violations.filter(
      (v) => v.rule === 'private-note-title-in-html',
    );
    expect(titleHits.length).toBeGreaterThanOrEqual(1);
  });

  it('red: %%canary B%% injected into a public page is flagged as obsidian-comment-leak', async () => {
    const config = buildConfig();
    const result = await runCorePipeline(config);
    await writeCleanDist(sandbox.distDir, result);

    const canaryB = await readCanary('public-with-comment.md', CANARY_B_RE);
    const target = path.join(sandbox.distDir, 'public-with-comment', 'index.html');
    const before = await fs.readFile(target, 'utf8');
    await fs.writeFile(
      target,
      before.replace('</body>', `<p>%%${canaryB}%%</p></body>`),
      'utf8',
    );

    const outcome = await runAudit(config, { distDir: sandbox.distDir, strict: false });

    const commentHits = outcome.violations.filter((v) => v.rule === 'obsidian-comment-leak');
    expect(commentHits.length).toBeGreaterThanOrEqual(1);
  });
});
