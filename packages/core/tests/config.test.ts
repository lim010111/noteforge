import { describe, expect, it } from 'vitest';
import {
  defineConfig,
  getClassifyRule,
  ObpubConfigError,
  type ObpubConfigInput,
} from '../src/config.ts';

const DEFAULT_ALLOWLIST = [
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
];

function baseInput(overrides: Partial<ObpubConfigInput> = {}): ObpubConfigInput {
  return {
    site: {
      title: 'Example',
      url: 'https://example.com',
      author: 'Tester',
    },
    vaults: [
      {
        id: 'personal',
        path: '/home/tester/vault',
      },
    ],
    ...overrides,
  };
}

describe('defineConfig', () => {
  it('accepts a minimal valid input and fills all defaults', () => {
    const cfg = defineConfig(baseInput());

    expect(cfg.site.title).toBe('Example');
    expect(cfg.site.url).toBe('https://example.com');
    expect(cfg.site.author).toBe('Tester');
    expect(cfg.vaults).toHaveLength(1);
    expect(cfg.vaults[0]?.id).toBe('personal');
    expect(cfg.vaults[0]?.urlPrefix).toBe('/');
    expect(cfg.vaults[0]?.theme).toBe('@noteforge/theme-default');
    expect(cfg.publishing.frontmatterKey).toBe('public');
    expect(cfg.publishing.publicTag).toBe('public');
    expect(cfg.publishing.requireExplicitOptIn).toBe(true);
    expect(cfg.publishing.tagBlocklist).toEqual([]);
    expect(cfg.privateLinkBehavior).toBe('strip-to-text');
    expect(cfg.attachments.followReferencesOnly).toBe(true);
    expect(cfg.attachments.allowedExtensions).toEqual([
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.svg',
      '.pdf',
    ]);
    expect(cfg.graph.enabled).toBe(true);
    expect(cfg.graph.includePrivateAsAnonymousNodes).toBe(false);
    expect(cfg.unsafeAllowPrivateFolder).toBe(false);
  });

  it('rejects an empty vaults array', () => {
    expect(() => defineConfig(baseInput({ vaults: [] }))).toThrow(ObpubConfigError);
  });

  it('rejects more than one vault (MVP single-vault guard)', () => {
    expect(() =>
      defineConfig(
        baseInput({
          vaults: [
            { id: 'a', path: '/home/x/a' },
            { id: 'b', path: '/home/x/b' },
          ],
        }),
      ),
    ).toThrow(/MVP|단일/);
  });

  it('rejects a blank vault id', () => {
    expect(() =>
      defineConfig(baseInput({ vaults: [{ id: '', path: '/home/tester/vault' }] })),
    ).toThrow(ObpubConfigError);
  });

  it('rejects a non-URL site.url', () => {
    expect(() =>
      defineConfig(
        baseInput({
          site: { title: 'X', url: 'not-a-url', author: 'Y' },
        }),
      ),
    ).toThrow(ObpubConfigError);
  });

  it('defaults frontmatterAllowlist to the canonical 14 fields', () => {
    const cfg = defineConfig(baseInput());
    expect(cfg.publishing.frontmatterAllowlist).toEqual(DEFAULT_ALLOWLIST);
  });

  it('unions a user-provided frontmatterAllowlist with the defaults (additive)', () => {
    const cfg = defineConfig(
      baseInput({
        publishing: { frontmatterAllowlist: ['custom'] },
      }),
    );

    expect(cfg.publishing.frontmatterAllowlist).toHaveLength(DEFAULT_ALLOWLIST.length + 1);
    expect(cfg.publishing.frontmatterAllowlist).toContain('custom');
    for (const key of DEFAULT_ALLOWLIST) {
      expect(cfg.publishing.frontmatterAllowlist).toContain(key);
    }
  });

  it('does not duplicate allowlist entries the user repeats', () => {
    const cfg = defineConfig(
      baseInput({
        publishing: { frontmatterAllowlist: ['title'] },
      }),
    );

    expect(cfg.publishing.frontmatterAllowlist).toHaveLength(DEFAULT_ALLOWLIST.length);
    expect(
      cfg.publishing.frontmatterAllowlist.filter((k: string) => k === 'title'),
    ).toHaveLength(1);
  });

  it('auto-adds private/**, .obsidian/**, .trash/** to vault.ignore when ignore is omitted', () => {
    const cfg = defineConfig(baseInput());
    const ignore = cfg.vaults[0]?.ignore ?? [];
    expect(ignore).toEqual(
      expect.arrayContaining(['private/**', '.obsidian/**', '.trash/**']),
    );
    expect(ignore).toHaveLength(3);
  });

  it('unions user-provided ignore globs with the three forced entries', () => {
    const cfg = defineConfig(
      baseInput({
        vaults: [{ id: 'personal', path: '/home/tester/vault', ignore: ['custom/**'] }],
      }),
    );
    const ignore = cfg.vaults[0]?.ignore ?? [];
    expect(ignore).toEqual(
      expect.arrayContaining(['custom/**', 'private/**', '.obsidian/**', '.trash/**']),
    );
    expect(ignore).toHaveLength(4);
  });

  it('drops the private/** auto-ignore when unsafeAllowPrivateFolder is true', () => {
    const cfg = defineConfig(baseInput({ unsafeAllowPrivateFolder: true }));
    const ignore = cfg.vaults[0]?.ignore ?? [];
    expect(ignore).not.toContain('private/**');
    expect(ignore).toEqual(expect.arrayContaining(['.obsidian/**', '.trash/**']));
    expect(ignore).toHaveLength(2);
  });
});

describe('ObpubConfigError', () => {
  it('formats message with configPath + line + column', () => {
    const err = new ObpubConfigError('boom', {
      configPath: '/abs/cfg.ts',
      line: 5,
      column: 7,
    });
    expect(err.message).toBe('/abs/cfg.ts:5:7: boom');
    expect(err.configPath).toBe('/abs/cfg.ts');
    expect(err.line).toBe(5);
    expect(err.column).toBe(7);
    expect(err.reason).toBe('boom');
  });

  it('formats message with configPath + line (no column)', () => {
    const err = new ObpubConfigError('boom', {
      configPath: '/abs/cfg.ts',
      line: 5,
    });
    expect(err.message).toBe('/abs/cfg.ts:5: boom');
    expect(err.column).toBeUndefined();
  });

  it('ignores column when line is missing', () => {
    const err = new ObpubConfigError('boom', {
      configPath: '/abs/cfg.ts',
      column: 7,
    });
    expect(err.message).toBe('/abs/cfg.ts: boom');
    expect(err.line).toBeUndefined();
  });

  it('falls back to bare reason when no options', () => {
    const err = new ObpubConfigError('boom');
    expect(err.message).toBe('boom');
    expect(err.configPath).toBeUndefined();
    expect(err.line).toBeUndefined();
    expect(err.column).toBeUndefined();
  });

  it('preserves original cause', () => {
    const original = new Error('original');
    const err = new ObpubConfigError('wrapped', { cause: original });
    expect(err.cause).toBe(original);
  });
});

describe('defineConfig with configPath', () => {
  it('prefixes the error message with configPath', () => {
    let caught: ObpubConfigError | undefined;
    try {
      defineConfig(baseInput({ vaults: [{ id: 'a', path: 'rel/path' }] }), {
        configPath: '/abs/cfg.ts',
      });
    } catch (e) {
      caught = e as ObpubConfigError;
    }
    expect(caught).toBeInstanceOf(ObpubConfigError);
    expect(caught?.message).toBe(
      '/abs/cfg.ts: vaults[0].path: 절대 경로여야 합니다',
    );
    expect(caught?.configPath).toBe('/abs/cfg.ts');
    expect(caught?.reason).toBe('vaults[0].path: 절대 경로여야 합니다');
  });

  it('matches the original message when configPath is omitted', () => {
    let caught: ObpubConfigError | undefined;
    try {
      defineConfig(baseInput({ vaults: [{ id: 'a', path: 'rel/path' }] }));
    } catch (e) {
      caught = e as ObpubConfigError;
    }
    expect(caught?.message).toBe('vaults[0].path: 절대 경로여야 합니다');
    expect(caught?.configPath).toBeUndefined();
  });
});

describe('getClassifyRule', () => {
  it('derives a ClassifyRule with the default tripwire path', () => {
    const cfg = defineConfig(baseInput());
    const rule = getClassifyRule(cfg, 'personal');

    expect(rule.frontmatterKey).toBe('public');
    expect(rule.publicTag).toBe('public');
    expect(rule.tripwirePaths).toEqual(['private/**']);
    expect(rule.unsafeAllowPrivateFolder).toBe(false);
  });

  it('returns an empty tripwirePaths when unsafeAllowPrivateFolder is true', () => {
    const cfg = defineConfig(baseInput({ unsafeAllowPrivateFolder: true }));
    const rule = getClassifyRule(cfg, 'personal');

    expect(rule.tripwirePaths).toEqual([]);
    expect(rule.unsafeAllowPrivateFolder).toBe(true);
  });

  it('throws when the vault id cannot be found', () => {
    const cfg = defineConfig(baseInput());
    expect(() => getClassifyRule(cfg, 'does-not-exist')).toThrow(/does-not-exist/);
  });
});
