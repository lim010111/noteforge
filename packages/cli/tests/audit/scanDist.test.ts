import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanDist } from '../../src/lib/audit/scanDist.ts';

let tmpDir: string;

async function writeFile(rel: string, content: string): Promise<void> {
  const abs = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `obpub-audit-scan-${randomUUID()}-`));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('scanDist', () => {
  it('collects every .html file with content', async () => {
    await writeFile('index.html', '<p>hi</p>');
    await writeFile('posts/foo.html', '<p>foo</p>');
    await writeFile('readme.txt', 'plain');

    const result = await scanDist(tmpDir);

    const htmlPaths = result.htmlFiles.map((f) => f.relPath).sort();
    expect(htmlPaths).toEqual(['index.html', 'posts/foo.html']);

    const indexFile = result.htmlFiles.find((f) => f.relPath === 'index.html');
    expect(indexFile?.content).toBe('<p>hi</p>');
  });

  it('lists every file basename including non-HTML and nested dirs', async () => {
    await writeFile('index.html', '<p>x</p>');
    await writeFile('attachments/cover.png', 'png');
    await writeFile('api/graph.json', '{"nodes":[],"edges":[]}');

    const result = await scanDist(tmpDir);

    const basenames = result.allFiles.map((f) => f.basename).sort();
    expect(basenames).toEqual(['cover.png', 'graph.json', 'index.html']);
  });

  it('parses dist/api/graph.json when present', async () => {
    await writeFile(
      'api/graph.json',
      JSON.stringify({
        nodes: ['a', 'b'],
        edges: [{ from: 'a', to: 'b' }],
      }),
    );

    const result = await scanDist(tmpDir);

    expect(result.graph).not.toBeNull();
    expect(result.graphLocation).toBe('api/graph.json');
  });

  it('returns null graph when dist/api/graph.json is missing', async () => {
    await writeFile('index.html', '<p>x</p>');

    const result = await scanDist(tmpDir);

    expect(result.graph).toBeNull();
    expect(result.graphLocation).toBeNull();
  });

  it('throws a clear error when distDir does not exist', async () => {
    const missing = path.join(tmpDir, 'does-not-exist');
    await expect(scanDist(missing)).rejects.toThrow(/dist/);
  });
});
