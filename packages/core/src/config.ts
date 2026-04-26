import * as path from 'node:path';
import { z, type ZodError } from 'zod';
import type { ClassifyRule } from './types.ts';

const DEFAULT_FRONTMATTER_ALLOWLIST = [
  'title',
  'description',
  'date',
  'updated',
  'tags',
  'aliases',
  'cover',
  'author',
  'draft',
  'public',
  'slug',
  'permalink',
  'lang',
  'featured',
] as const;

const DEFAULT_ALLOWED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.pdf',
] as const;

const FORCED_VAULT_IGNORE = ['.obsidian/**', '.trash/**'] as const;
const PRIVATE_FOLDER_GLOB = 'private/**';

const vaultSchema = z.object({
  id: z.string().min(1, '빈 문자열은 허용되지 않습니다'),
  path: z
    .string()
    .min(1, '빈 문자열은 허용되지 않습니다')
    .refine((p) => path.isAbsolute(p), '절대 경로여야 합니다'),
  urlPrefix: z.string().default('/'),
  theme: z.string().default('@noteforge/theme-default'),
  ignore: z.array(z.string()).default([]),
});

const siteSchema = z.object({
  title: z.string().min(1, '빈 문자열은 허용되지 않습니다'),
  url: z.string().url('유효한 URL이어야 합니다'),
  author: z.string().min(1, '빈 문자열은 허용되지 않습니다'),
  /**
   * Optional one-line tagline rendered in the homepage hero. Empty string is
   * rejected so callers can branch on `tagline === undefined` without also
   * having to check for whitespace-only values.
   */
  tagline: z.string().min(1, '빈 문자열은 허용되지 않습니다').optional(),
});

const publishingSchema = z
  .object({
    frontmatterKey: z.string().min(1).default('public'),
    publicTag: z.string().min(1).default('public'),
    requireExplicitOptIn: z.boolean().default(true),
    frontmatterAllowlist: z.array(z.string()).default([]),
    tagBlocklist: z.array(z.string()).default([]),
  })
  .default({});

const attachmentsSchema = z
  .object({
    followReferencesOnly: z.boolean().default(true),
    allowedExtensions: z
      .array(z.string())
      .default([...DEFAULT_ALLOWED_EXTENSIONS]),
  })
  .default({});

const graphSchema = z
  .object({
    enabled: z.boolean().default(true),
    includePrivateAsAnonymousNodes: z.boolean().default(false),
  })
  .default({});

const rawConfigSchema = z.object({
  site: siteSchema,
  vaults: z
    .array(vaultSchema)
    .min(1, 'vaults는 비어있지 않은 배열이어야 합니다')
    .max(1, 'MVP v0.1은 단일 vault만 지원합니다'),
  publishing: publishingSchema,
  privateLinkBehavior: z.literal('strip-to-text').default('strip-to-text'),
  attachments: attachmentsSchema,
  graph: graphSchema,
  unsafeAllowPrivateFolder: z.boolean().default(false),
});

export const obpubConfigSchema = rawConfigSchema.transform((cfg) => {
  const forcedIgnore = cfg.unsafeAllowPrivateFolder
    ? [...FORCED_VAULT_IGNORE]
    : [PRIVATE_FOLDER_GLOB, ...FORCED_VAULT_IGNORE];

  const vaults = cfg.vaults.map((vault) => ({
    ...vault,
    ignore: dedupe([...vault.ignore, ...forcedIgnore]),
  }));

  const frontmatterAllowlist = dedupe([
    ...DEFAULT_FRONTMATTER_ALLOWLIST,
    ...cfg.publishing.frontmatterAllowlist,
  ]);

  return {
    ...cfg,
    vaults,
    publishing: {
      ...cfg.publishing,
      frontmatterAllowlist,
    },
  };
});

export type ObpubConfig = z.infer<typeof obpubConfigSchema>;
export type ObpubConfigInput = z.input<typeof obpubConfigSchema>;

export interface ObpubConfigErrorOptions {
  readonly configPath?: string;
  readonly line?: number;
  readonly column?: number;
  readonly cause?: unknown;
}

export class ObpubConfigError extends Error {
  readonly configPath: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;
  readonly reason: string;

  constructor(reason: string, opts?: ObpubConfigErrorOptions) {
    super(formatConfigErrorMessage(reason, opts), opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'ObpubConfigError';
    this.configPath = opts?.configPath;
    this.line = opts?.line;
    this.column = opts?.line !== undefined ? opts.column : undefined;
    this.reason = reason;
  }
}

function formatConfigErrorMessage(
  reason: string,
  opts: ObpubConfigErrorOptions | undefined,
): string {
  const configPath = opts?.configPath;
  if (configPath === undefined || configPath.length === 0) return reason;
  const line = opts?.line;
  if (line === undefined) return `${configPath}: ${reason}`;
  const column = opts?.column;
  if (column === undefined) return `${configPath}:${line}: ${reason}`;
  return `${configPath}:${line}:${column}: ${reason}`;
}

export function defineConfig(
  input: ObpubConfigInput,
  opts?: { configPath?: string },
): ObpubConfig {
  const result = obpubConfigSchema.safeParse(input);
  if (!result.success) {
    throw wrapZodError(result.error, opts?.configPath);
  }
  return result.data;
}

export function getClassifyRule(config: ObpubConfig, vaultId: string): ClassifyRule {
  const vault = config.vaults.find((v) => v.id === vaultId);
  if (vault === undefined) {
    throw new ObpubConfigError(`vault id '${vaultId}'를 찾을 수 없습니다`);
  }

  return {
    frontmatterKey: config.publishing.frontmatterKey,
    publicTag: config.publishing.publicTag,
    tripwirePaths: config.unsafeAllowPrivateFolder ? [] : [PRIVATE_FOLDER_GLOB],
    unsafeAllowPrivateFolder: config.unsafeAllowPrivateFolder,
  };
}

function wrapZodError(error: ZodError, configPath?: string): ObpubConfigError {
  const issue = error.issues[0];
  if (issue === undefined) {
    return new ObpubConfigError('알 수 없는 설정 오류', { configPath });
  }
  const fieldPath = formatPath(issue.path);
  const reason = fieldPath.length > 0 ? `${fieldPath}: ${issue.message}` : issue.message;
  return new ObpubConfigError(reason, { configPath });
}

function formatPath(segments: readonly (string | number)[]): string {
  let out = '';
  for (const seg of segments) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (out.length === 0) {
      out = seg;
    } else {
      out += `.${seg}`;
    }
  }
  return out;
}

function dedupe<T>(items: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
