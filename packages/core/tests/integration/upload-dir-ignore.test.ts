import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/config.ts';
import { runCorePipeline } from '../../src/pipeline.ts';

describe('runCorePipeline — uploaded attachment directory discovery', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'obpub-upload-dir-'));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('discovers attachments.uploadDir files even when vault.ignore contains attachments/**', async () => {
    await fs.mkdir(path.join(tmpRoot, 'attachments'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'attachments', 'hero.png'), 'png');
    await fs.writeFile(
      path.join(tmpRoot, 'post.md'),
      [
        '---',
        'title: Post',
        'public: true',
        'cover: /attachments/attachments/hero.png',
        '---',
        '',
        'No body embed.',
        '',
      ].join('\n'),
    );

    const result = await runCorePipeline(
      defineConfig({
        site: { title: 'Example', url: 'https://example.com', author: 'Tester' },
        vaults: [
          {
            id: 'fixture',
            path: tmpRoot,
            ignore: ['attachments/**'],
          },
        ],
      }),
    );

    expect(result.attachmentClosure.has('attachments/hero.png')).toBe(true);
    expect(result.publicFrontmatter.get('post')).toMatchObject({
      cover: '/attachments/attachments/hero.png',
    });
  });
});
