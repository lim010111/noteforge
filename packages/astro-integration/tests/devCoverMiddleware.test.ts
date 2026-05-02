import { Readable } from 'node:stream';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createDevCoverMiddleware,
  isSafeSourcePath,
  updateFrontmatterImageFields,
  type DevCoverFileSystem,
} from '../src/devCoverMiddleware.ts';

const VAULT_ROOT = '/vault';
const POST_ABS = path.resolve(VAULT_ROOT, 'post.md');

function makeSnapshot() {
  return {
    publicSlugs: new Set(['post']),
    sourcePathBySlug: new Map([['post', 'post.md']]),
    attachmentClosure: new Set(['images/a.png', 'images/thumb.png']),
  };
}

function makeFs(
  initial: string,
): DevCoverFileSystem & { written?: string; writes: string[] } {
  const fs: DevCoverFileSystem & { written?: string; writes: string[] } = {
    writes: [],
    async readFile(absPath: string) {
      expect(absPath).toBe(POST_ABS);
      return initial;
    },
    async writeFile(absPath: string, content: string) {
      expect(absPath).toBe(POST_ABS);
      fs.writes.push(content);
      fs.written = content;
    },
  };
  return fs;
}

function makeReq(body: unknown, overrides: Record<string, string> = {}) {
  const req = Readable.from([JSON.stringify(body)]) as Readable & {
    method?: string;
    headers: Record<string, string>;
  };
  req.method = 'POST';
  req.headers = {
    origin: 'http://localhost:4321',
    host: 'localhost:4321',
    ...overrides,
  };
  return req;
}

function makeRes() {
  return {
    statusCode: 200,
    headers: new Map<string, string>(),
    body: '',
    setHeader(name: string, value: string) {
      this.headers.set(name.toLowerCase(), value);
    },
    end(chunk?: unknown) {
      if (chunk !== undefined) this.body += String(chunk);
    },
  };
}

async function invoke(
  body: unknown,
  options: {
    fs?: DevCoverFileSystem & { written?: string; writes?: string[] };
    headers?: Record<string, string>;
    method?: string;
    refreshPipelineCache?: () => Promise<void>;
  } = {},
) {
  const fs = options.fs ?? makeFs('---\ntitle: Hello\npublic: true\n---\nBody\n');
  const handler = createDevCoverMiddleware({
    vaultPath: VAULT_ROOT,
    getPipelineResult: makeSnapshot,
    refreshPipelineCache: options.refreshPipelineCache,
    fs,
  });
  const req = makeReq(body, options.headers);
  if (options.method !== undefined) req.method = options.method;
  const res = makeRes();
  const next = vi.fn();
  await handler(req, res, next);
  return { res, next, fs };
}

describe('updateFrontmatterImageFields', () => {
  it('preserves existing comments, field order, quote style, and inline comment while updating image fields', () => {
    const raw = [
      '---',
      'title: Hello',
      '# keep this comment',
      'public: true',
      "cover: '/attachments/old.png' # keep inline",
      '---',
      'Body',
      '',
    ].join('\n');
    const updated = updateFrontmatterImageFields(raw, {
      cover: '/attachments/images/a.png',
      thumbnail: 'https://example.com/thumb.png',
    });
    expect(updated).toContain('# keep this comment');
    expect(updated).toContain(
      "cover: '/attachments/images/a.png' # keep inline",
    );
    expect(updated).toContain('thumbnail: https://example.com/thumb.png');
    expect(updated.indexOf('title: Hello')).toBeLessThan(
      updated.indexOf('# keep this comment'),
    );
    expect(updated.indexOf('# keep this comment')).toBeLessThan(
      updated.indexOf('public: true'),
    );
    expect(updated.endsWith('Body\n')).toBe(true);
  });

  it('updates only top-level cover/thumbnail keys, leaving nested YAML mappings intact', () => {
    const raw = [
      '---',
      'title: Hello',
      'seo:',
      '  cover: /attachments/nested-old.png',
      '  thumbnail: /attachments/nested-thumb.png',
      'public: true',
      '---',
      'Body',
      '',
    ].join('\n');
    const updated = updateFrontmatterImageFields(raw, {
      cover: '/attachments/images/a.png',
      thumbnail: null,
    });
    expect(updated).toContain('seo:\n  cover: /attachments/nested-old.png');
    expect(updated).toContain('  thumbnail: /attachments/nested-thumb.png');
    expect(updated).toContain('cover: /attachments/images/a.png');
    expect(updated.match(/^thumbnail:/gm)).toBeNull();
  });
});

describe('createDevCoverMiddleware', () => {
  it('allows dots inside source filenames while still rejecting traversal segments', () => {
    expect(isSafeSourcePath('AI news/트랜스포머 아키텍쳐 퇴보화..md')).toBe(true);
    expect(isSafeSourcePath('../post.md')).toBe(false);
    expect(isSafeSourcePath('notes/../post.md')).toBe(false);
    expect(isSafeSourcePath('/vault/post.md')).toBe(false);
    expect(isSafeSourcePath('notes\\post.md')).toBe(false);
  });

  it('writes validated cover/thumbnail values and returns 200 JSON', async () => {
    const fs = makeFs('---\ntitle: Hello\npublic: true\n---\nBody\n');
    const refreshPipelineCache = vi.fn(async () => {});
    const { res } = await invoke(
      {
        slug: 'post',
        cover: '/attachments/images/a.png',
        thumbnail: 'https://example.com/thumb.png',
      },
      { fs, refreshPipelineCache },
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    expect(fs.written).toContain('cover: /attachments/images/a.png');
    expect(fs.written).toContain('thumbnail: https://example.com/thumb.png');
    expect(refreshPipelineCache).toHaveBeenCalledTimes(1);
  });

  it('rolls frontmatter back when the dev refresh fails', async () => {
    const raw = '---\ntitle: Hello\npublic: true\n---\nBody\n';
    const fs = makeFs(raw);
    const refreshPipelineCache = vi.fn(async () => {
      throw new Error('refresh failed');
    });
    const { res } = await invoke(
      {
        slug: 'post',
        cover: '/attachments/images/a.png',
      },
      { fs, refreshPipelineCache },
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toMatchObject({
      error: 'pipeline_refresh_failed',
      detail: 'refresh failed',
    });
    expect(fs.writes).toHaveLength(2);
    expect(fs.writes[0]).toContain('cover: /attachments/images/a.png');
    expect(fs.written).toBe(raw);
  });

  it('passes non-POST requests through to next()', async () => {
    const { res, next, fs } = await invoke({ slug: 'post' }, { method: 'GET' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(fs.written).toBeUndefined();
  });

  it('rejects cross-origin POSTs with 403', async () => {
    const { res, fs } = await invoke(
      { slug: 'post', cover: '/attachments/images/a.png' },
      { headers: { origin: 'http://evil.example', host: 'localhost:4321' } },
    );
    expect(res.statusCode).toBe(403);
    expect(fs.written).toBeUndefined();
  });

  it('rejects slug traversal before touching disk', async () => {
    const { res, fs } = await invoke({
      slug: '../post',
      cover: '/attachments/images/a.png',
    });
    expect(res.statusCode).toBe(400);
    expect(fs.written).toBeUndefined();
  });

  it('rejects /attachments values outside the public closure', async () => {
    const { res, fs } = await invoke({
      slug: 'post',
      cover: '/attachments/private.png',
    });
    expect(res.statusCode).toBe(400);
    expect(fs.written).toBeUndefined();
  });

  it('rejects unsupported URL shapes', async () => {
    const { res, fs } = await invoke({
      slug: 'post',
      cover: 'file:///tmp/secret.png',
    });
    expect(res.statusCode).toBe(400);
    expect(fs.written).toBeUndefined();
  });

  it('deletes keys when cover/thumbnail are null', async () => {
    const fs = makeFs(
      '---\ntitle: Hello\ncover: /attachments/images/a.png\nthumbnail: https://example.com/thumb.png\npublic: true\n---\nBody\n',
    );
    const { res } = await invoke(
      { slug: 'post', cover: null, thumbnail: null },
      { fs },
    );
    expect(res.statusCode).toBe(200);
    expect(fs.written).not.toContain('cover:');
    expect(fs.written).not.toContain('thumbnail:');
    expect(fs.written).toContain('title: Hello');
    expect(fs.written).toContain('public: true');
  });
});
