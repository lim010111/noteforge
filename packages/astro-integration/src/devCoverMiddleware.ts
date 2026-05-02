import * as nodeFs from 'node:fs/promises';
import * as nodePath from 'node:path';

export interface DevCoverPipelineSnapshot {
  readonly publicSlugs: ReadonlySet<string>;
  readonly sourcePathBySlug: ReadonlyMap<string, string>;
  readonly attachmentClosure: ReadonlySet<string>;
}

export interface DevCoverFileSystem {
  readFile(absPath: string): Promise<string>;
  writeFile(absPath: string, content: string): Promise<void>;
}

interface DevCoverMiddlewareDeps {
  readonly vaultPath: string;
  readonly getPipelineResult: () => DevCoverPipelineSnapshot;
  readonly refreshPipelineCache?: () => Promise<void>;
  readonly fs?: DevCoverFileSystem;
}

type DevCoverReq = AsyncIterable<Uint8Array | string> & {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type DevCoverRes = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: unknown) => void;
};

type DevCoverNext = () => void;

const DEFAULT_FS: DevCoverFileSystem = {
  readFile: (absPath) => nodeFs.readFile(absPath, 'utf8'),
  writeFile: (absPath, content) => nodeFs.writeFile(absPath, content, 'utf8'),
};

const MAX_BODY_BYTES = 64 * 1024;

export function createDevCoverMiddleware(deps: DevCoverMiddlewareDeps) {
  const fs = deps.fs ?? DEFAULT_FS;
  const vaultRoot = nodePath.resolve(deps.vaultPath);

  return async (
    req: DevCoverReq,
    res: DevCoverRes,
    next: DevCoverNext,
  ): Promise<void> => {
    if ((req.method ?? 'GET') !== 'POST') {
      next();
      return;
    }

    if (!isSameOrigin(req.headers ?? {})) {
      sendJson(res, 403, { error: 'csrf_origin_mismatch' });
      return;
    }

    let body: DevCoverBody;
    try {
      body = parseBody(await readJsonBody(req));
    } catch (err) {
      sendJson(res, 400, { error: errorMessage(err) });
      return;
    }

    if (!isSafeSlug(body.slug)) {
      sendJson(res, 400, { error: 'invalid_slug' });
      return;
    }

    const snapshot = deps.getPipelineResult();
    if (!snapshot.publicSlugs.has(body.slug)) {
      sendJson(res, 404, { error: 'unknown_slug' });
      return;
    }
    const sourceRel = snapshot.sourcePathBySlug.get(body.slug);
    if (sourceRel === undefined || !isSafeSourcePath(sourceRel)) {
      sendJson(res, 404, { error: 'unknown_source' });
      return;
    }

    const sourceAbs = nodePath.resolve(vaultRoot, sourceRel);
    if (!isInside(vaultRoot, sourceAbs)) {
      sendJson(res, 400, { error: 'invalid_source_path' });
      return;
    }

    let cover: string | null | undefined;
    let thumbnail: string | null | undefined;
    try {
      cover = validateImageValue('cover', body.cover, snapshot.attachmentClosure);
      thumbnail = validateImageValue(
        'thumbnail',
        body.thumbnail,
        snapshot.attachmentClosure,
      );
    } catch (err) {
      sendJson(res, 400, { error: errorMessage(err) });
      return;
    }

    const raw = await fs.readFile(sourceAbs);
    const updated = updateFrontmatterImageFields(raw, { cover, thumbnail });
    await fs.writeFile(sourceAbs, updated);
    try {
      await deps.refreshPipelineCache?.();
    } catch (err) {
      try {
        await fs.writeFile(sourceAbs, raw);
      } catch {
        // Best-effort rollback. The refresh failure is the primary error.
      }
      sendJson(res, 500, {
        error: 'pipeline_refresh_failed',
        detail: errorMessage(err),
      });
      return;
    }
    sendJson(res, 200, { ok: true });
  };
}

interface DevCoverBody {
  slug: string;
  cover?: string | null;
  thumbnail?: string | null;
}

async function readJsonBody(req: AsyncIterable<Uint8Array | string>): Promise<unknown> {
  let bytes = 0;
  let body = '';
  for await (const chunk of req) {
    const text =
      typeof chunk === 'string'
        ? chunk
        : Buffer.from(chunk).toString('utf8');
    bytes += Buffer.byteLength(text);
    if (bytes > MAX_BODY_BYTES) throw new Error('body_too_large');
    body += text;
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('invalid_json');
  }
}

function parseBody(raw: unknown): DevCoverBody {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('invalid_body');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj['slug'] !== 'string') throw new Error('invalid_slug');
  const out: DevCoverBody = { slug: obj['slug'] };
  if ('cover' in obj) out.cover = parseOptionalImageField(obj['cover'], 'cover');
  if ('thumbnail' in obj) {
    out.thumbnail = parseOptionalImageField(obj['thumbnail'], 'thumbnail');
  }
  return out;
}

function parseOptionalImageField(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`invalid_${field}`);
  return value;
}

export function isSameOrigin(
  headers: Record<string, string | string[] | undefined>,
): boolean {
  const originRaw = headerValue(headers, 'origin');
  const hostRaw = headerValue(headers, 'host');
  if (originRaw === undefined || hostRaw === undefined) return false;
  try {
    const origin = new URL(originRaw);
    return origin.host === hostRaw;
  } catch {
    return false;
  }
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

export function isSafeSlug(slug: string): boolean {
  return (
    slug.length > 0 &&
    slug === slug.trim() &&
    !slug.includes('..') &&
    !slug.includes('\\') &&
    !nodePath.isAbsolute(slug)
  );
}

export function isSafeSourcePath(sourceRel: string): boolean {
  return (
    sourceRel.length > 0 &&
    !sourceRel.includes('\\') &&
    !nodePath.isAbsolute(sourceRel) &&
    !sourceRel.split('/').includes('..')
  );
}

export function isInside(root: string, absPath: string): boolean {
  const rel = nodePath.relative(root, absPath);
  return rel === '' || (rel.length > 0 && !rel.startsWith('..') && !nodePath.isAbsolute(rel));
}

function validateImageValue(
  field: 'cover' | 'thumbnail',
  value: string | null | undefined,
  attachmentClosure: ReadonlySet<string>,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const cleaned = value.trim();
  if (cleaned.length === 0) throw new Error(`invalid_${field}`);
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (!cleaned.startsWith('/attachments/')) {
    throw new Error(`invalid_${field}_url`);
  }
  const rel = cleaned.slice('/attachments/'.length);
  if (
    rel.length === 0 ||
    rel.includes('..') ||
    rel.includes('\\') ||
    nodePath.posix.isAbsolute(rel)
  ) {
    throw new Error(`invalid_${field}_attachment`);
  }
  if (!attachmentClosure.has(rel)) {
    throw new Error(`${field}_attachment_not_public`);
  }
  return `/attachments/${rel}`;
}

interface ImageFieldUpdates {
  cover?: string | null;
  thumbnail?: string | null;
}

export function updateFrontmatterImageFields(
  raw: string,
  updates: ImageFieldUpdates,
): string {
  const entries = Object.entries(updates).filter(
    (entry): entry is ['cover' | 'thumbnail', string | null] =>
      entry[1] !== undefined,
  );
  if (entries.length === 0) return raw;

  const split = splitFrontmatter(raw);
  if (split === null) {
    const setEntries = entries.filter(
      (entry): entry is ['cover' | 'thumbnail', string] => entry[1] !== null,
    );
    if (setEntries.length === 0) return raw;
    const yaml = setEntries
      .map(([key, value]) => `${key}: ${formatYamlScalar(value, undefined)}`)
      .join('\n');
    return `---\n${yaml}\n---\n${raw}`;
  }

  let lines = split.yaml.length > 0 ? split.yaml.split(/\r?\n/) : [];
  for (const [key, value] of entries) {
    lines = applyYamlScalarUpdate(lines, key, value);
  }
  return `${split.open}${lines.join(split.eol)}${split.close}${split.body}`;
}

function splitFrontmatter(raw: string):
  | {
      open: string;
      yaml: string;
      close: string;
      body: string;
      eol: '\n' | '\r\n';
    }
  | null {
  const match = /^(---[ \t]*(?:\r?\n))([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(raw);
  if (match === null) return null;
  const open = match[1]!;
  const yaml = match[2]!;
  const close = match[3]!;
  return {
    open,
    yaml,
    close,
    body: raw.slice(match[0].length),
    eol: open.includes('\r\n') || close.includes('\r\n') ? '\r\n' : '\n',
  };
}

function applyYamlScalarUpdate(
  lines: string[],
  key: 'cover' | 'thumbnail',
  value: string | null,
): string[] {
  const re = new RegExp(`^${key}(\\s*:\\s*)(.*)$`);
  let replaced = false;
  const out: string[] = [];
  for (const line of lines) {
    const match = re.exec(line);
    if (match === null) {
      out.push(line);
      continue;
    }
    replaced = true;
    if (value === null) continue;
    const rest = match[2] ?? '';
    const comment = extractInlineComment(rest);
    const quote = quoteStyle(comment.value);
    const suffix = comment.comment.length > 0 ? ` ${comment.comment}` : '';
    out.push(
      `${key}${match[1] ?? ': '}${formatYamlScalar(value, quote)}${suffix}`,
    );
  }
  if (!replaced && value !== null) {
    out.push(`${key}: ${formatYamlScalar(value, undefined)}`);
  }
  return out;
}

function extractInlineComment(rest: string): { value: string; comment: string } {
  let quote: '"' | "'" | undefined;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
      if (ch === '\\' && quote === '"') i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(rest[i - 1]!))) {
      return {
        value: rest.slice(0, i).trimEnd(),
        comment: rest.slice(i).trim(),
      };
    }
  }
  return { value: rest.trimEnd(), comment: '' };
}

function quoteStyle(value: string): '"' | "'" | undefined {
  const trimmed = value.trim();
  if (trimmed.startsWith("'")) return "'";
  if (trimmed.startsWith('"')) return '"';
  return undefined;
}

function formatYamlScalar(value: string, quote: '"' | "'" | undefined): string {
  if (quote === "'") return `'${value.replace(/'/g, "''")}'`;
  if (quote === '"') return JSON.stringify(value);
  if (/^[A-Za-z0-9_./~:?&=%+-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function sendJson(
  res: DevCoverRes,
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
