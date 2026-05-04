import { describe, expect, it } from 'vitest';
import { heroBackgroundCss } from '../src/lib/heroBackground';

describe('heroBackgroundCss', () => {
  it('returns undefined for non-string / empty / blank input', () => {
    expect(heroBackgroundCss(undefined)).toBeUndefined();
    // @ts-expect-error — runtime guard, not a typed call site
    expect(heroBackgroundCss(null)).toBeUndefined();
    expect(heroBackgroundCss('')).toBeUndefined();
    expect(heroBackgroundCss('   ')).toBeUndefined();
  });

  it('wraps absolute /attachments paths and root-rooted paths', () => {
    expect(heroBackgroundCss('/attachments/hero.png')).toBe("url('/attachments/hero.png')");
    expect(heroBackgroundCss('/static/x.jpg')).toBe("url('/static/x.jpg')");
  });

  it('wraps http(s) URLs and trims surrounding whitespace', () => {
    expect(heroBackgroundCss('https://cdn.example.com/x.png')).toBe(
      "url('https://cdn.example.com/x.png')",
    );
    expect(heroBackgroundCss('  http://example.com/x.png  ')).toBe(
      "url('http://example.com/x.png')",
    );
  });

  it('rejects schemes that the privacy pipeline never emits', () => {
    expect(heroBackgroundCss('javascript:alert(1)')).toBeUndefined();
    expect(heroBackgroundCss('data:image/png;base64,iVBORw0KGgo=')).toBeUndefined();
    expect(heroBackgroundCss('file:///etc/passwd')).toBeUndefined();
    expect(heroBackgroundCss('relative/path.png')).toBeUndefined();
    expect(heroBackgroundCss('./hero.png')).toBeUndefined();
  });

  it('rejects values that contain quote/backslash/newline/parenthesis breakout chars', () => {
    expect(
      heroBackgroundCss("/attachments/hero.png'); background:url('http://evil/"),
      "single-quote breakout payload must not produce any url() — defense-in-depth on top of HTML attribute escaping",
    ).toBeUndefined();
    expect(heroBackgroundCss('/attachments/he"ro.png')).toBeUndefined();
    expect(heroBackgroundCss('/attachments/he\\ro.png')).toBeUndefined();
    expect(heroBackgroundCss('/attachments/he\nro.png')).toBeUndefined();
    expect(heroBackgroundCss('/attachments/he\rro.png')).toBeUndefined();
    expect(heroBackgroundCss('/attachments/he(ro.png')).toBeUndefined();
    expect(heroBackgroundCss('/attachments/he)ro.png')).toBeUndefined();
    expect(heroBackgroundCss('/attachments/he<ro.png')).toBeUndefined();
    expect(heroBackgroundCss('/attachments/he>ro.png')).toBeUndefined();
  });

  it('case-insensitive scheme match', () => {
    expect(heroBackgroundCss('HTTPS://Cdn.Example.com/x.png')).toBe(
      "url('HTTPS://Cdn.Example.com/x.png')",
    );
  });
});
