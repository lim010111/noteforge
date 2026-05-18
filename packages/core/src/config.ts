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
  'thumbnail',
  'author',
  'draft',
  'public',
  'slug',
  'permalink',
  'lang',
  'featured',
  'category',
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

const socialSchema = z
  .object({
    // Three-state contract consumed by `<SocialLinks />`:
    //   - field omitted     → channel hidden (no DOM remnant; full opt-out)
    //   - empty string ''   → "needs setup" stub icon with onboarding hint
    //   - valid URL         → live anchor
    // The empty-string sentinel powers the first-run UX in the default
    // `apps/blog/noteforge.config.ts`, so fork users see the icon and learn
    // *which* config field to edit instead of silently rendering nothing.
    github: z
      .union([z.string().url('유효한 URL이어야 합니다'), z.literal('')])
      .optional(),
    email: z.string().email('유효한 이메일 주소여야 합니다').optional(),
  })
  .optional();

const aboutSchema = z
  .object({
    headline: z.string().min(1, '빈 문자열은 허용되지 않습니다').optional(),
    bio: z
      .array(z.string().min(1, '빈 문자열은 허용되지 않습니다'))
      .default([]),
    highlights: z
      .array(z.string().min(1, '빈 문자열은 허용되지 않습니다'))
      .default([]),
  })
  .optional();

const siteSchema = z.object({
  title: z.string().min(1, '빈 문자열은 허용되지 않습니다'),
  url: z.string().url('유효한 URL이어야 합니다'),
  author: z.string().min(1, '빈 문자열은 허용되지 않습니다'),
  avatar: z
    .string()
    .min(1, '빈 문자열은 허용되지 않습니다')
    .refine(
      (v) => !/^(https?:\/\/|\/\/|data:)/i.test(v),
      'avatar는 외부 호스트(http/https/scheme-less //, data:)를 허용하지 않습니다 — apps/blog/public/ 아래 상대 경로로 두세요',
    )
    .optional(),
  nickname: z.string().min(1, '빈 문자열은 허용되지 않습니다').optional(),
  social: socialSchema,
  about: aboutSchema,
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
    uploadDir: z
      .string()
      .min(1, '빈 문자열은 허용되지 않습니다')
      .refine((value) => !isAbsoluteLikePath(value), '상대 POSIX 경로여야 합니다')
      .refine((value) => !value.includes('\\'), 'POSIX 경로 구분자(/)만 허용됩니다')
      .refine((value) => !value.includes('..'), '상위 경로(..)는 허용되지 않습니다')
      .default('attachments'),
    uploadMaxBytes: z
      .number()
      .int('정수여야 합니다')
      .positive('양수여야 합니다')
      .default(10_485_760),
  })
  .default({});

const graphSchema = z
  .object({
    enabled: z.boolean().default(true),
    includePrivateAsAnonymousNodes: z.boolean().default(false),
  })
  .default({});

const navSchema = z
  .object({
    mode: z.enum(['folder', 'category']).default('folder'),
    // Whether leaf notes appear in the sidebar folder tree. Default 'hide':
    // the sidebar stays a category navigator and notes are reached via the
    // folder/category index page. See ADR-0015.
    sidebarNotes: z.enum(['show', 'hide']).default('hide'),
  })
  .default({});

const rawConfigSchema = z
  .object({
    site: siteSchema,
    vaults: z
      .array(vaultSchema)
      .min(1, 'vaults는 비어있지 않은 배열이어야 합니다')
      .max(1, 'MVP v0.1은 단일 vault만 지원합니다'),
    publishing: publishingSchema,
    privateLinkBehavior: z.literal('strip-to-text').default('strip-to-text'),
    attachments: attachmentsSchema,
    graph: graphSchema,
    nav: navSchema,
    unsafeAllowPrivateFolder: z.boolean().default(false),
  })
  .superRefine((cfg, ctx) => {
    const uploadDir = cfg.attachments.uploadDir;
    if (
      !cfg.unsafeAllowPrivateFolder &&
      (uploadDir === 'private' || uploadDir.startsWith('private/'))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachments', 'uploadDir'],
        message:
          'private/ 하위 업로드는 tripwire 보호를 위해 허용되지 않습니다',
      });
    }
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

function isAbsoluteLikePath(value: string): boolean {
  return path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value);
}
