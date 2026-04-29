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

describe('site.avatar / site.nickname (v0.3)', () => {
  function withSite(overrides: Record<string, unknown>): ObpubConfigInput {
    return baseInput({
      site: { title: 'Example', url: 'https://example.com', author: 'Tester', ...overrides },
    } as Partial<ObpubConfigInput>);
  }

  it('rejects avatar pointing to an https external host', () => {
    expect(() =>
      defineConfig(withSite({ avatar: 'https://cdn.example.com/me.png' })),
    ).toThrow(/외부 호스트/);
  });

  it('rejects avatar pointing to an http external host', () => {
    expect(() => defineConfig(withSite({ avatar: 'http://example.com/me.png' }))).toThrow(
      /외부 호스트/,
    );
  });

  it('rejects scheme-relative avatar URLs (//host/...)', () => {
    expect(() => defineConfig(withSite({ avatar: '//cdn.example.com/me.png' }))).toThrow(
      /외부 호스트/,
    );
  });

  it('rejects data: URIs in avatar', () => {
    expect(() =>
      defineConfig(withSite({ avatar: 'data:image/png;base64,iVBOR...' })),
    ).toThrow(/외부 호스트/);
  });

  it('rejects an empty avatar string', () => {
    expect(() => defineConfig(withSite({ avatar: '' }))).toThrow(ObpubConfigError);
  });

  it('rejects an empty nickname string', () => {
    expect(() => defineConfig(withSite({ nickname: '' }))).toThrow(ObpubConfigError);
  });

  it('accepts a relative avatar path (avatar.png)', () => {
    const cfg = defineConfig(withSite({ avatar: 'avatar.png' }));
    expect(cfg.site.avatar).toBe('avatar.png');
  });

  it('accepts a nested relative avatar path (assets/me.webp)', () => {
    const cfg = defineConfig(withSite({ avatar: 'assets/me.webp' }));
    expect(cfg.site.avatar).toBe('assets/me.webp');
  });

  it('accepts site without avatar/nickname (both optional)', () => {
    const cfg = defineConfig(baseInput());
    expect(cfg.site.avatar).toBeUndefined();
    expect(cfg.site.nickname).toBeUndefined();
  });
});

describe('site.social (v0.3 polish)', () => {
  function withSite(overrides: Record<string, unknown>): ObpubConfigInput {
    return baseInput({
      site: { title: 'Example', url: 'https://example.com', author: 'Tester', ...overrides },
    } as Partial<ObpubConfigInput>);
  }

  it('accepts site without a social block (entirely optional)', () => {
    const cfg = defineConfig(baseInput());
    expect(cfg.site.social).toBeUndefined();
  });

  it('accepts a social block with only github', () => {
    const cfg = defineConfig(
      withSite({ social: { github: 'https://github.com/lim010111' } }),
    );
    expect(cfg.site.social?.github).toBe('https://github.com/lim010111');
    expect(cfg.site.social?.email).toBeUndefined();
  });

  it('accepts a social block with only email', () => {
    const cfg = defineConfig(withSite({ social: { email: 'me@example.com' } }));
    expect(cfg.site.social?.email).toBe('me@example.com');
    expect(cfg.site.social?.github).toBeUndefined();
  });

  it('rejects a non-URL github value', () => {
    expect(() =>
      defineConfig(withSite({ social: { github: 'lim010111' } })),
    ).toThrow(ObpubConfigError);
  });

  it('rejects a malformed email value', () => {
    expect(() =>
      defineConfig(withSite({ social: { email: 'not-an-email' } })),
    ).toThrow(ObpubConfigError);
  });
});

describe('site.about (v0.4)', () => {
  function withSite(overrides: Record<string, unknown>): ObpubConfigInput {
    return baseInput({
      site: { title: 'Example', url: 'https://example.com', author: 'Tester', ...overrides },
    } as Partial<ObpubConfigInput>);
  }

  it('accepts site without about (entirely optional)', () => {
    const cfg = defineConfig(baseInput());
    expect(cfg.site.about).toBeUndefined();
  });

  it('accepts about with all fields populated', () => {
    const cfg = defineConfig(
      withSite({
        about: {
          headline: 'Frontend engineer',
          bio: ['line one', 'line two'],
          highlights: ['TypeScript', 'Astro', 'Obsidian'],
        },
      }),
    );
    expect(cfg.site.about?.headline).toBe('Frontend engineer');
    expect(cfg.site.about?.bio).toEqual(['line one', 'line two']);
    expect(cfg.site.about?.highlights).toEqual(['TypeScript', 'Astro', 'Obsidian']);
  });

  it('defaults bio and highlights to empty arrays when about is partial', () => {
    const cfg = defineConfig(withSite({ about: { headline: 'x' } }));
    expect(cfg.site.about?.headline).toBe('x');
    expect(cfg.site.about?.bio).toEqual([]);
    expect(cfg.site.about?.highlights).toEqual([]);
  });

  it('rejects empty headline string', () => {
    expect(() => defineConfig(withSite({ about: { headline: '' } }))).toThrow(
      ObpubConfigError,
    );
  });

  it('rejects empty string in bio array', () => {
    expect(() => defineConfig(withSite({ about: { bio: ['ok', ''] } }))).toThrow(
      ObpubConfigError,
    );
  });

  it('rejects empty string in highlights array', () => {
    expect(() =>
      defineConfig(withSite({ about: { highlights: ['ok', ''] } })),
    ).toThrow(ObpubConfigError);
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
