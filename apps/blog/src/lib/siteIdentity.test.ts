import { describe, expect, it } from 'vitest';
import {
  githubUsernameFromUrl,
  resolveSiteIdentity,
} from './siteIdentity.ts';

describe('githubUsernameFromUrl', () => {
  it('returns undefined for undefined input', () => {
    expect(githubUsernameFromUrl(undefined)).toBeUndefined();
  });

  it('returns undefined for the empty "needs setup" stub sentinel', () => {
    expect(githubUsernameFromUrl('')).toBeUndefined();
  });

  it('returns undefined for malformed URLs', () => {
    expect(githubUsernameFromUrl('not-a-url')).toBeUndefined();
  });

  it('returns undefined for non-github hosts (e.g. gitlab)', () => {
    expect(githubUsernameFromUrl('https://gitlab.com/example')).toBeUndefined();
  });

  it('extracts the username from a profile URL', () => {
    expect(githubUsernameFromUrl('https://github.com/example')).toBe('example');
  });

  it('extracts the username from a repo URL (first path segment)', () => {
    expect(githubUsernameFromUrl('https://github.com/example/repo')).toBe('example');
  });

  it('tolerates trailing slashes', () => {
    expect(githubUsernameFromUrl('https://github.com/example/')).toBe('example');
  });

  it('accepts the www subdomain', () => {
    expect(githubUsernameFromUrl('https://www.github.com/example')).toBe('example');
  });

  it('accepts http scheme (uncommon but valid)', () => {
    expect(githubUsernameFromUrl('http://github.com/example')).toBe('example');
  });

  it('is case-insensitive on the host', () => {
    expect(githubUsernameFromUrl('https://GITHUB.com/example')).toBe('example');
  });

  it('returns undefined when the URL has no path segment', () => {
    expect(githubUsernameFromUrl('https://github.com/')).toBeUndefined();
    expect(githubUsernameFromUrl('https://github.com')).toBeUndefined();
  });
});

describe('resolveSiteIdentity — explicit fields win over GitHub fallback', () => {
  it('passes the configured avatar through verbatim even when github is set', () => {
    const out = resolveSiteIdentity({
      avatar: '/avatar.png',
      social: { github: 'https://github.com/example' },
    });
    expect(out.avatar).toBe('/avatar.png');
  });

  it('passes the configured nickname through verbatim even when github is set', () => {
    const out = resolveSiteIdentity({
      nickname: 'My Nick',
      social: { github: 'https://github.com/example' },
    });
    expect(out.nickname).toBe('My Nick');
  });
});

describe('resolveSiteIdentity — GitHub fallback when fields are unset', () => {
  it('derives avatar from the github URL when site.avatar is unset', () => {
    const out = resolveSiteIdentity({
      social: { github: 'https://github.com/example' },
    });
    expect(out.avatar).toBe('https://github.com/example.png');
  });

  it('derives nickname from the github username when site.nickname is unset', () => {
    const out = resolveSiteIdentity({
      social: { github: 'https://github.com/example' },
    });
    expect(out.nickname).toBe('example');
  });

  it('derives both when both are unset', () => {
    const out = resolveSiteIdentity({
      social: { github: 'https://github.com/example' },
    });
    expect(out.avatar).toBe('https://github.com/example.png');
    expect(out.nickname).toBe('example');
  });
});

describe('resolveSiteIdentity — nothing to derive', () => {
  it('omits avatar and nickname when neither is configured and no github URL is present', () => {
    const out = resolveSiteIdentity({});
    expect(out.avatar).toBeUndefined();
    expect(out.nickname).toBeUndefined();
    expect('avatar' in out).toBe(false);
    expect('nickname' in out).toBe(false);
  });

  it('omits derived values when github is the empty "needs setup" stub', () => {
    const out = resolveSiteIdentity({ social: { github: '' } });
    expect(out.avatar).toBeUndefined();
    expect(out.nickname).toBeUndefined();
  });

  it('omits derived values when github is set to a non-github host', () => {
    const out = resolveSiteIdentity({
      social: { github: 'https://gitlab.com/example' as string },
    });
    expect(out.avatar).toBeUndefined();
    expect(out.nickname).toBeUndefined();
  });
});

describe('resolveSiteIdentity — github pass-through preserves the stub sentinel', () => {
  it('passes a live URL through verbatim', () => {
    const out = resolveSiteIdentity({
      social: { github: 'https://github.com/example' },
    });
    expect(out.github).toBe('https://github.com/example');
  });

  it("preserves the empty-string '' sentinel verbatim (stub onboarding state)", () => {
    const out = resolveSiteIdentity({ social: { github: '' } });
    expect(out.github).toBe('');
    expect('github' in out).toBe(true);
  });

  it('omits github when social is undefined', () => {
    const out = resolveSiteIdentity({});
    expect(out.github).toBeUndefined();
    expect('github' in out).toBe(false);
  });

  it('omits github when social is set but social.github is undefined', () => {
    const out = resolveSiteIdentity({ social: {} });
    expect(out.github).toBeUndefined();
    expect('github' in out).toBe(false);
  });
});
