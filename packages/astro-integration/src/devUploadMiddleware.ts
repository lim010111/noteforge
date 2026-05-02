import * as nodeFs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { ObpubConfig } from '@noteforge/core/config';
import {
  isInside,
  isSafeSlug,
  isSafeSourcePath,
  isSameOrigin,
  updateFrontmatterImageFields,
  type DevCoverPipelineSnapshot,
} from './devCoverMiddleware.ts';

export interface DevUploadFileSystem {
  readFile(absPath: string): Promise<string>;
  writeFile(absPath: string, content: string | Uint8Array): Promise<void>;
  mkdir(absPath: string): Promise<void>;
  unlink(absPath: string): Promise<void>;
  exists(absPath: string): Promise<boolean>;
}

interface DevUploadMiddlewareDeps {
  readonly vaultPath: string;
  readonly getPipelineResult: () => DevCoverPipelineSnapshot;
  readonly refreshPipelineCache: () => Promise<void>;
  readonly config: ObpubConfig;
  readonly fs?: DevUploadFileSystem;
}

type DevUploadReq = AsyncIterable<Uint8Array | string> & {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type DevUploadRes = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: unknown) => void;
};

type DevUploadNext = () => void;

const DEFAULT_FS: DevUploadFileSystem = {
  readFile: (absPath) => nodeFs.readFile(absPath, 'utf8'),
  writeFile: (absPath, content) => nodeFs.writeFile(absPath, content),
  mkdir: (absPath) => nodeFs.mkdir(absPath, { recursive: true }).then(() => {}),
  unlink: (absPath) => nodeFs.unlink(absPath),
  exists: async (absPath) => {
    try {
      await nodeFs.access(absPath);
      return true;
    } catch {
      return false;
    }
  },
};

const BODY_OVERHEAD_BYTES = 64 * 1024;
const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const MIME_BY_EXT = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
]);

interface ParsedUpload {
  readonly slug: string;
  readonly field: 'cover' | 'thumbnail';
  readonly file: MultipartFile;
}

interface MultipartFile {
  readonly filename: string;
  readonly contentType?: string;
  readonly content: Buffer;
}

interface SniffedImage {
  readonly mime: string;
  readonly preferredExt: string;
}

export function createDevUploadMiddleware(deps: DevUploadMiddlewareDeps) {
  const fs = deps.fs ?? DEFAULT_FS;
  const vaultRoot = nodePath.resolve(deps.vaultPath);
  const uploadMaxBytes = deps.config.attachments.uploadMaxBytes;
  const allowedExtensions = new Set(
    deps.config.attachments.allowedExtensions.map((ext) => ext.toLowerCase()),
  );
  const uploadDir = deps.config.attachments.uploadDir;
  const uploadDirAbs = nodePath.resolve(vaultRoot, ...uploadDir.split('/'));

  return async (
    req: DevUploadReq,
    res: DevUploadRes,
    next: DevUploadNext,
  ): Promise<void> => {
    if ((req.method ?? 'GET') !== 'POST') {
      next();
      return;
    }

    if (!isSameOrigin(req.headers ?? {})) {
      sendJson(res, 403, { error: 'csrf_origin_mismatch' });
      return;
    }

    if (!isInside(vaultRoot, uploadDirAbs)) {
      sendJson(res, 400, { error: 'invalid_upload_dir' });
      return;
    }

    let upload: ParsedUpload;
    try {
      upload = await parseUploadRequest(req, uploadMaxBytes);
      validateUpload(upload, uploadMaxBytes);
    } catch (err) {
      sendJson(res, 400, { error: errorMessage(err) });
      return;
    }

    if (!isSafeSlug(upload.slug)) {
      sendJson(res, 400, { error: 'invalid_slug' });
      return;
    }

    const snapshot = deps.getPipelineResult();
    if (!snapshot.publicSlugs.has(upload.slug)) {
      sendJson(res, 404, { error: 'unknown_slug' });
      return;
    }
    const sourceRel = snapshot.sourcePathBySlug.get(upload.slug);
    if (sourceRel === undefined || !isSafeSourcePath(sourceRel)) {
      sendJson(res, 404, { error: 'unknown_source' });
      return;
    }
    const sourceAbs = nodePath.resolve(vaultRoot, sourceRel);
    if (!isInside(vaultRoot, sourceAbs)) {
      sendJson(res, 400, { error: 'invalid_source_path' });
      return;
    }

    let target: AllocatedTarget;
    try {
      target = await allocateUploadTarget({
        uploadDir,
        uploadDirAbs,
        filename: upload.file.filename,
        content: upload.file.content,
        contentType: upload.file.contentType,
        allowedExtensions,
        fs,
      });
    } catch (err) {
      sendJson(res, 400, { error: errorMessage(err) });
      return;
    }

    await fs.mkdir(uploadDirAbs);

    let sourceRaw: string;
    try {
      await fs.writeFile(target.absPath, upload.file.content);
      sourceRaw = await fs.readFile(sourceAbs);
    } catch (err) {
      await safeUnlink(fs, target.absPath);
      sendJson(res, 500, { error: 'upload_write_failed', detail: errorMessage(err) });
      return;
    }

    const updates =
      upload.field === 'cover'
        ? { cover: target.url }
        : { thumbnail: target.url };
    const updated = updateFrontmatterImageFields(sourceRaw, updates);
    try {
      await fs.writeFile(sourceAbs, updated);
    } catch (err) {
      await safeUnlink(fs, target.absPath);
      sendJson(res, 500, {
        error: 'frontmatter_write_failed',
        detail: errorMessage(err),
      });
      return;
    }

    try {
      await deps.refreshPipelineCache();
    } catch (err) {
      await safeUnlink(fs, target.absPath);
      try {
        await fs.writeFile(sourceAbs, sourceRaw);
      } catch {
        // Best-effort rollback. The refresh error is the primary failure.
      }
      sendJson(res, 500, {
        error: 'pipeline_refresh_failed',
        detail: errorMessage(err),
      });
      return;
    }

    sendJson(res, 200, { ok: true, url: target.url });
  };
}

async function parseUploadRequest(
  req: DevUploadReq,
  uploadMaxBytes: number,
): Promise<ParsedUpload> {
  const contentType = headerValue(req.headers ?? {}, 'content-type');
  const boundary = parseBoundary(contentType);
  if (boundary === undefined) throw new Error('missing_boundary');

  const body = await readBody(req, uploadMaxBytes + BODY_OVERHEAD_BYTES);
  const parts = parseMultipart(body, boundary);
  const fields = new Map<string, string>();
  let file: MultipartFile | undefined;

  for (const part of parts) {
    const disposition = parseContentDisposition(part.headers.get('content-disposition'));
    if (disposition?.name === undefined) continue;
    if (disposition.filename !== undefined) {
      if (disposition.name !== 'file') continue;
      if (file !== undefined) throw new Error('multiple_files');
      file = {
        filename: disposition.filename,
        contentType: part.headers.get('content-type'),
        content: part.content,
      };
      continue;
    }
    fields.set(disposition.name, part.content.toString('utf8'));
  }

  const slug = fields.get('slug');
  if (slug === undefined) throw new Error('missing_slug');
  const rawField = fields.get('field');
  if (rawField !== 'cover' && rawField !== 'thumbnail') {
    throw new Error('invalid_field');
  }
  if (file === undefined) throw new Error('missing_file');

  return { slug, field: rawField, file };
}

function validateUpload(upload: ParsedUpload, uploadMaxBytes: number): void {
  if (upload.file.content.length === 0) throw new Error('empty_file');
  if (upload.file.content.length > uploadMaxBytes) throw new Error('file_too_large');
}

async function readBody(
  req: AsyncIterable<Uint8Array | string>,
  maxBytes: number,
): Promise<Buffer> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    bytes += buf.length;
    if (bytes > maxBytes) throw new Error('body_too_large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

interface MultipartPart {
  readonly headers: ReadonlyMap<string, string>;
  readonly content: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const raw = body.toString('latin1');
  const marker = `--${boundary}`;
  const chunks = raw.split(marker);
  if (chunks.length < 3) throw new Error('invalid_multipart');

  const parts: MultipartPart[] = [];
  for (const chunk of chunks.slice(1)) {
    if (chunk.startsWith('--')) break;
    let part = chunk;
    if (part.startsWith('\r\n')) part = part.slice(2);
    else if (part.startsWith('\n')) part = part.slice(1);
    if (part.endsWith('\r\n')) part = part.slice(0, -2);
    else if (part.endsWith('\n')) part = part.slice(0, -1);
    if (part.length === 0) continue;

    let headerEnd = part.indexOf('\r\n\r\n');
    let separatorLength = 4;
    if (headerEnd === -1) {
      headerEnd = part.indexOf('\n\n');
      separatorLength = 2;
    }
    if (headerEnd === -1) throw new Error('invalid_part_headers');

    const headerText = part.slice(0, headerEnd);
    const content = part.slice(headerEnd + separatorLength);
    parts.push({
      headers: parsePartHeaders(Buffer.from(headerText, 'latin1').toString('utf8')),
      content: Buffer.from(content, 'latin1'),
    });
  }
  return parts;
}

function parsePartHeaders(raw: string): ReadonlyMap<string, string> {
  const headers = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) throw new Error('invalid_part_headers');
    const name = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (name.length === 0) throw new Error('invalid_part_headers');
    headers.set(name, value);
  }
  return headers;
}

function parseBoundary(contentType: string | undefined): string | undefined {
  if (contentType === undefined || !/^multipart\/form-data\b/i.test(contentType)) {
    return undefined;
  }
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const value = match?.[1] ?? match?.[2];
  const cleaned = value?.trim();
  return cleaned !== undefined && cleaned.length > 0 ? cleaned : undefined;
}

function parseContentDisposition(
  value: string | undefined,
): { name?: string; filename?: string } | undefined {
  if (value === undefined) return undefined;
  const [kind, ...params] = value.split(';');
  if (kind?.trim().toLowerCase() !== 'form-data') return undefined;
  const out: { name?: string; filename?: string } = {};
  for (const rawParam of params) {
    const idx = rawParam.indexOf('=');
    if (idx === -1) continue;
    const key = rawParam.slice(0, idx).trim().toLowerCase();
    const rawValue = rawParam.slice(idx + 1).trim();
    const decoded =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        : rawValue;
    if (key === 'name') out.name = decoded;
    if (key === 'filename') out.filename = decoded;
  }
  return out;
}

interface AllocateTargetOptions {
  readonly uploadDir: string;
  readonly uploadDirAbs: string;
  readonly filename: string;
  readonly content: Buffer;
  readonly contentType?: string;
  readonly allowedExtensions: ReadonlySet<string>;
  readonly fs: DevUploadFileSystem;
}

interface AllocatedTarget {
  readonly absPath: string;
  readonly url: string;
}

async function allocateUploadTarget(
  options: AllocateTargetOptions,
): Promise<AllocatedTarget> {
  const sniffed = sniffImage(options.content);
  if (sniffed === undefined) throw new Error('unsupported_image_type');

  const contentType = normalizeMime(options.contentType);
  if (contentType !== undefined && !IMAGE_MIMES.has(contentType)) {
    throw new Error('unsupported_image_type');
  }

  const originalExt = nodePath.posix.extname(options.filename).toLowerCase();
  if (originalExt.length === 0 || !MIME_BY_EXT.has(originalExt)) {
    throw new Error('invalid_file_extension');
  }
  const finalExt =
    MIME_BY_EXT.get(originalExt) === sniffed.mime ? originalExt : sniffed.preferredExt;
  if (!options.allowedExtensions.has(finalExt)) {
    throw new Error('extension_not_allowed');
  }

  const sanitized = sanitizeFilename(options.filename, finalExt);
  const ext = nodePath.posix.extname(sanitized);
  const base = sanitized.slice(0, -ext.length);
  const maxAttempts = 1_000;
  for (let i = 0; i < maxAttempts; i++) {
    const name = i === 0 ? sanitized : `${base}-${i}${ext}`;
    const absPath = nodePath.resolve(options.uploadDirAbs, name);
    const url = `/attachments/${nodePath.posix.join(options.uploadDir, name)}`;
    if (!(await options.fs.exists(absPath))) {
      return { absPath, url };
    }
  }

  const fallback = `${base}-${Date.now()}${ext}`;
  return {
    absPath: nodePath.resolve(options.uploadDirAbs, fallback),
    url: `/attachments/${nodePath.posix.join(options.uploadDir, fallback)}`,
  };
}

function sniffImage(content: Buffer): SniffedImage | undefined {
  if (
    content.length >= 8 &&
    content[0] === 0x89 &&
    content[1] === 0x50 &&
    content[2] === 0x4e &&
    content[3] === 0x47 &&
    content[4] === 0x0d &&
    content[5] === 0x0a &&
    content[6] === 0x1a &&
    content[7] === 0x0a
  ) {
    return { mime: 'image/png', preferredExt: '.png' };
  }
  if (
    content.length >= 3 &&
    content[0] === 0xff &&
    content[1] === 0xd8 &&
    content[2] === 0xff
  ) {
    return { mime: 'image/jpeg', preferredExt: '.jpg' };
  }
  const prefix = content.subarray(0, 12).toString('ascii');
  if (prefix.startsWith('GIF87a') || prefix.startsWith('GIF89a')) {
    return { mime: 'image/gif', preferredExt: '.gif' };
  }
  if (prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP') {
    return { mime: 'image/webp', preferredExt: '.webp' };
  }
  const textPrefix = content.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (textPrefix.startsWith('<svg') || /^<\?xml\b[\s\S]*<svg\b/.test(textPrefix)) {
    return { mime: 'image/svg+xml', preferredExt: '.svg' };
  }
  return undefined;
}

function sanitizeFilename(filename: string, finalExt: string): string {
  const replaced = filename
    .split('')
    .map((ch) => (isUnsafeFilenameChar(ch) ? '_' : ch))
    .join('')
    .replace(/\.\.+/g, '_')
    .replace(/[\s_]+/g, '_')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '');
  const ext = nodePath.posix.extname(replaced);
  const baseRaw = ext.length > 0 ? replaced.slice(0, -ext.length) : replaced;
  const base = baseRaw.replace(/^[. ]+|[. ]+$/g, '');
  const safeBase =
    base.length === 0 || base === '.' || base === '..'
      ? `image-${Date.now()}`
      : base;
  return `${safeBase}${finalExt}`;
}

function isUnsafeFilenameChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (
    code <= 0x1f ||
    code === 0x7f ||
    ch === '/' ||
    ch === '\\' ||
    ch === "'" ||
    ch === '"' ||
    ch === '<' ||
    ch === '>' ||
    ch === '`'
  );
}

function normalizeMime(value: string | undefined): string | undefined {
  const cleaned = value?.split(';')[0]?.trim().toLowerCase();
  return cleaned !== undefined && cleaned.length > 0 ? cleaned : undefined;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const direct = headers[name];
  const value =
    direct ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function safeUnlink(fs: DevUploadFileSystem, absPath: string): Promise<void> {
  try {
    await fs.unlink(absPath);
  } catch {
    // Best-effort rollback.
  }
}

function sendJson(
  res: DevUploadRes,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
