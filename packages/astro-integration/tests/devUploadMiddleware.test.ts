import { Readable } from 'node:stream';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { defineConfig, type ObpubConfig } from '@noteforge/core/config';
import {
  createDevUploadMiddleware,
  type DevUploadFileSystem,
} from '../src/devUploadMiddleware.ts';

const VAULT_ROOT = '/vault';
const POST_ABS = path.resolve(VAULT_ROOT, 'post.md');
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function makeConfig(overrides: Partial<ObpubConfig> = {}): ObpubConfig {
  const cfg = defineConfig({
    site: { title: 'Example', url: 'https://example.com', author: 'Tester' },
    vaults: [{ id: 'fixture', path: VAULT_ROOT }],
    ...overrides,
  });
  return cfg;
}

function makeSnapshot(
  publicSlugs: readonly string[] = ['post'],
  sourceRel = 'post.md',
) {
  return {
    publicSlugs: new Set(publicSlugs),
    sourcePathBySlug: new Map([['post', sourceRel]]),
    attachmentClosure: new Set<string>(),
  };
}

class MemoryFs implements DevUploadFileSystem {
  readonly files = new Map<string, Buffer>();
  readonly dirs = new Set<string>();
  readonly log: string[] = [];
  failSourceWrite = false;

  constructor(
    initialSource = '---\ntitle: Hello\npublic: true\n---\nBody\n',
    sourceAbs = POST_ABS,
  ) {
    this.files.set(sourceAbs, Buffer.from(initialSource));
  }

  async readFile(absPath: string): Promise<string> {
    this.log.push(`read:${absPath}`);
    const value = this.files.get(absPath);
    if (value === undefined) throw new Error(`ENOENT: ${absPath}`);
    return value.toString('utf8');
  }

  async writeFile(absPath: string, content: string | Uint8Array): Promise<void> {
    this.log.push(`write:${absPath}`);
    if (this.failSourceWrite && absPath === POST_ABS) {
      throw new Error('source write failed');
    }
    this.files.set(absPath, Buffer.from(content));
  }

  async mkdir(absPath: string): Promise<void> {
    this.log.push(`mkdir:${absPath}`);
    this.dirs.add(absPath);
  }

  async unlink(absPath: string): Promise<void> {
    this.log.push(`unlink:${absPath}`);
    this.files.delete(absPath);
  }

  async exists(absPath: string): Promise<boolean> {
    this.log.push(`exists:${absPath}`);
    return this.files.has(absPath) || this.dirs.has(absPath);
  }
}

function multipart(parts: {
  boundary?: string;
  fields?: Record<string, string>;
  files?: {
    name?: string;
    filename: string;
    contentType: string;
    content: Buffer;
  }[];
}): { contentType: string; body: Buffer } {
  const boundary = parts.boundary ?? '----obpub-test-boundary';
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(parts.fields ?? {})) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`),
    );
    chunks.push(Buffer.from(value));
    chunks.push(Buffer.from('\r\n'));
  }
  for (const file of parts.files ?? []) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${file.name ?? 'file'}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      ),
    );
    chunks.push(file.content);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(chunks),
  };
}

function makeReq(
  payload: { contentType: string; body: Buffer },
  headers: Record<string, string> = {},
) {
  const req = Readable.from([payload.body]) as Readable & {
    method?: string;
    headers: Record<string, string>;
  };
  req.method = 'POST';
  req.headers = {
    origin: 'http://localhost:4321',
    host: 'localhost:4321',
    'content-type': payload.contentType,
    ...headers,
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

async function invoke(options: {
  fs?: MemoryFs;
  config?: ObpubConfig;
  payload?: { contentType: string; body: Buffer };
  publicSlugs?: readonly string[];
  refreshPipelineCache?: () => Promise<void>;
  headers?: Record<string, string>;
  method?: string;
  sourceRel?: string;
}) {
  const fs = options.fs ?? new MemoryFs();
  const refreshPipelineCache =
    options.refreshPipelineCache ??
    vi.fn(async () => {
      fs.log.push('refresh');
    });
  const handler = createDevUploadMiddleware({
    vaultPath: VAULT_ROOT,
    getPipelineResult: () => makeSnapshot(options.publicSlugs, options.sourceRel),
    refreshPipelineCache,
    config: options.config ?? makeConfig(),
    fs,
  });
  const payload =
    options.payload ??
    multipart({
      fields: { slug: 'post', field: 'cover' },
      files: [
        {
          filename: '스크린샷.png',
          contentType: 'image/png',
          content: PNG_BYTES,
        },
      ],
    });
  const req = makeReq(payload, options.headers);
  if (options.method !== undefined) req.method = options.method;
  const res = makeRes();
  const next = vi.fn();
  await handler(req, res, next);
  return { fs, refreshPipelineCache, res, next };
}

function jsonBody(res: ReturnType<typeof makeRes>): Record<string, unknown> {
  return JSON.parse(res.body) as Record<string, unknown>;
}

describe('createDevUploadMiddleware', () => {
  it('uploads an image, updates cover frontmatter, awaits cache refresh, and returns the attachment URL', async () => {
    const { fs, res, refreshPipelineCache } = await invoke({});

    const savedAbs = path.resolve(VAULT_ROOT, 'attachments', '스크린샷.png');
    expect(res.statusCode).toBe(200);
    expect(jsonBody(res)).toEqual({
      ok: true,
      url: '/attachments/attachments/스크린샷.png',
    });
    expect(fs.files.get(savedAbs)).toEqual(PNG_BYTES);
    expect(fs.files.get(POST_ABS)?.toString('utf8')).toContain(
      'cover: "/attachments/attachments/스크린샷.png"',
    );
    expect(refreshPipelineCache).toHaveBeenCalledTimes(1);
    expect(fs.log.indexOf('refresh')).toBeGreaterThan(
      fs.log.indexOf(`write:${POST_ABS}`),
    );
  });

  it('uses suffixes for filename collisions and can update thumbnail', async () => {
    const fs = new MemoryFs();
    fs.files.set(
      path.resolve(VAULT_ROOT, 'attachments', 'image.png'),
      Buffer.from('existing'),
    );

    const { res } = await invoke({
      fs,
      payload: multipart({
        fields: { slug: 'post', field: 'thumbnail' },
        files: [
          {
            filename: 'image.png',
            contentType: 'image/png',
            content: PNG_BYTES,
          },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(jsonBody(res)['url']).toBe('/attachments/attachments/image-1.png');
    expect(
      fs.files.get(path.resolve(VAULT_ROOT, 'attachments', 'image-1.png')),
    ).toEqual(PNG_BYTES);
    expect(fs.files.get(POST_ABS)?.toString('utf8')).toContain(
      'thumbnail: /attachments/attachments/image-1.png',
    );
  });

  it('accepts source markdown filenames that contain literal dot-dot text', async () => {
    const sourceRel = 'AI news/트랜스포머 아키텍쳐 퇴보화..md';
    const sourceAbs = path.resolve(VAULT_ROOT, sourceRel);
    const fs = new MemoryFs(
      '---\ntitle: Dotted\npublic: true\n---\nBody\n',
      sourceAbs,
    );

    const { res } = await invoke({ fs, sourceRel });

    expect(res.statusCode).toBe(200);
    expect(fs.files.get(sourceAbs)?.toString('utf8')).toContain(
      'cover: "/attachments/attachments/스크린샷.png"',
    );
  });

  it('lets magic-byte sniffing win over a mismatched filename extension', async () => {
    const { fs, res } = await invoke({
      payload: multipart({
        fields: { slug: 'post', field: 'cover' },
        files: [
          {
            filename: 'photo.jpg',
            contentType: 'image/jpeg',
            content: PNG_BYTES,
          },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(jsonBody(res)['url']).toBe('/attachments/attachments/photo.png');
    expect(
      fs.files.get(path.resolve(VAULT_ROOT, 'attachments', 'photo.png')),
    ).toEqual(PNG_BYTES);
  });

  it('sanitizes traversal and injection-shaped filename characters', async () => {
    const { res } = await invoke({
      payload: multipart({
        fields: { slug: 'post', field: 'cover' },
        files: [
          {
            filename: '../bad <script>`".png',
            contentType: 'image/png',
            content: PNG_BYTES,
          },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    const url = String(jsonBody(res)['url']);
    expect(url).toMatch(/^\/attachments\/attachments\/.+\.png$/);
    for (const probe of ['..', '<', '>', '`', '"', "'", '\\']) {
      expect(url).not.toContain(probe);
    }
  });

  it('rejects missing multipart boundary, empty files, multiple files, oversized files, and non-image bytes', async () => {
    const cases = [
      {
        payload: { contentType: 'multipart/form-data', body: Buffer.from('x') },
        error: 'missing_boundary',
      },
      {
        payload: multipart({
          fields: { slug: 'post', field: 'cover' },
          files: [{ filename: 'empty.png', contentType: 'image/png', content: Buffer.alloc(0) }],
        }),
        error: 'empty_file',
      },
      {
        payload: multipart({
          fields: { slug: 'post', field: 'cover' },
          files: [
            { filename: 'a.png', contentType: 'image/png', content: PNG_BYTES },
            { filename: 'b.jpg', contentType: 'image/jpeg', content: JPEG_BYTES },
          ],
        }),
        error: 'multiple_files',
      },
      {
        config: makeConfig({
          attachments: {
            uploadMaxBytes: 4,
          },
        } as Partial<ObpubConfig>),
        payload: multipart({
          fields: { slug: 'post', field: 'cover' },
          files: [{ filename: 'big.png', contentType: 'image/png', content: PNG_BYTES }],
        }),
        error: 'file_too_large',
      },
      {
        payload: multipart({
          fields: { slug: 'post', field: 'cover' },
          files: [
            {
              filename: 'text.png',
              contentType: 'image/png',
              content: Buffer.from('not an image'),
            },
          ],
        }),
        error: 'unsupported_image_type',
      },
    ];

    for (const c of cases) {
      const { fs, res } = await invoke({
        payload: c.payload,
        ...(c.config !== undefined ? { config: c.config } : {}),
      });
      expect(res.statusCode).toBe(400);
      expect(jsonBody(res)['error']).toBe(c.error);
      expect([...fs.files.keys()]).toEqual([POST_ABS]);
    }
  });

  it('rejects bad origin, invalid slug, unknown slug, and invalid target field before writing files', async () => {
    const cases = [
      {
        headers: { origin: 'http://evil.example', host: 'localhost:4321' },
        expectedStatus: 403,
        error: 'csrf_origin_mismatch',
      },
      {
        payload: multipart({
          fields: { slug: '../post', field: 'cover' },
          files: [{ filename: 'a.png', contentType: 'image/png', content: PNG_BYTES }],
        }),
        expectedStatus: 400,
        error: 'invalid_slug',
      },
      {
        publicSlugs: [],
        expectedStatus: 404,
        error: 'unknown_slug',
      },
      {
        payload: multipart({
          fields: { slug: 'post', field: 'hero' },
          files: [{ filename: 'a.png', contentType: 'image/png', content: PNG_BYTES }],
        }),
        expectedStatus: 400,
        error: 'invalid_field',
      },
    ];

    for (const c of cases) {
      const { fs, res } = await invoke({
        ...(c.payload !== undefined ? { payload: c.payload } : {}),
        ...(c.publicSlugs !== undefined ? { publicSlugs: c.publicSlugs } : {}),
        ...(c.headers !== undefined ? { headers: c.headers } : {}),
      });
      expect(res.statusCode).toBe(c.expectedStatus);
      expect(jsonBody(res)['error']).toBe(c.error);
      expect([...fs.files.keys()]).toEqual([POST_ABS]);
    }
  });

  it('rolls back the uploaded file when frontmatter write fails', async () => {
    const fs = new MemoryFs();
    fs.failSourceWrite = true;

    const { res } = await invoke({ fs });

    expect(res.statusCode).toBe(500);
    expect(jsonBody(res)['error']).toBe('frontmatter_write_failed');
    expect(
      fs.files.has(path.resolve(VAULT_ROOT, 'attachments', '스크린샷.png')),
    ).toBe(false);
    expect(fs.log).toContain(
      `unlink:${path.resolve(VAULT_ROOT, 'attachments', '스크린샷.png')}`,
    );
  });

  it('passes non-POST requests through to next()', async () => {
    const { res, next, fs } = await invoke({ method: 'GET' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect([...fs.files.keys()]).toEqual([POST_ABS]);
  });
});
