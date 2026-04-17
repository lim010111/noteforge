import { describe, expect, it } from 'vitest';
import { stripObsidianComments } from '../src/privacy/commentStrip.ts';

describe('stripObsidianComments', () => {
  it('removes inline %%comment%%', () => {
    expect(stripObsidianComments('hello %%secret%% world')).toBe('hello  world');
  });

  it('removes block comments spanning lines', () => {
    const input = 'before\n%%\nsecret line 1\nsecret line 2\n%%\nafter';
    expect(stripObsidianComments(input)).toBe('before\n\nafter');
  });

  it('removes multiple inline comments on one line', () => {
    expect(stripObsidianComments('%%a%% middle %%b%%')).toBe(' middle ');
  });

  it('removes comments with Korean / special characters', () => {
    expect(stripObsidianComments('ok %%비밀 메모 with $#@!%% continue')).toBe('ok  continue');
  });

  it('leaves text without %% unchanged', () => {
    expect(stripObsidianComments('plain text with % single percent')).toBe(
      'plain text with % single percent',
    );
  });

  it('removes comments greedily within bounds (non-greedy across blocks)', () => {
    // Two separate comments must both be removed; middle text preserved.
    expect(stripObsidianComments('a %%one%% b %%two%% c')).toBe('a  b  c');
  });

  it('removes empty comment', () => {
    expect(stripObsidianComments('a %%%% b')).toBe('a  b');
  });

  it('handles comments inside markdown paragraphs', () => {
    const input = 'This is a sentence %%with a hidden note%% that continues.';
    expect(stripObsidianComments(input)).toBe('This is a sentence  that continues.');
  });

  it('removes canary comment (fixture vault safety)', () => {
    const input = 'visible %%CLAUDE_COMMENT_LEAK_77b%% still visible';
    expect(stripObsidianComments(input)).not.toContain('CLAUDE_COMMENT_LEAK_77b');
  });

  it('removes comments in code-fence context too (comments are always private)', () => {
    // Obsidian comments are not Markdown comments — they're private even in code.
    // We strip them everywhere because they're author notes, not syntactic code.
    expect(stripObsidianComments('```\nconst x = 1; %%TODO%%\n```')).toBe(
      '```\nconst x = 1; \n```',
    );
  });
});
