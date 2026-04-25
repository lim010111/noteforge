import { describe, expect, it } from 'vitest';
import {
  formatAuditJson,
  formatFailSummary,
  formatPassSummary,
  formatViolationLines,
} from '../../src/lib/audit/report.ts';
import type { AuditOutcome, AuditViolation } from '../../src/lib/audit/checks.ts';

describe('formatAuditJson', () => {
  it('emits pass:true with empty violations on a clean outcome', () => {
    const outcome: AuditOutcome = {
      violations: [],
      checkedFiles: 12,
      elapsedMs: 5,
    };
    const json = formatAuditJson(outcome, { strict: false });
    expect(json).not.toContain('\n');
    const parsed = JSON.parse(json) as {
      pass: boolean;
      strict: boolean;
      checkedFiles: number;
      elapsedMs: number;
      violations: unknown[];
    };
    expect(parsed.pass).toBe(true);
    expect(parsed.strict).toBe(false);
    expect(parsed.checkedFiles).toBe(12);
    expect(parsed.elapsedMs).toBe(5);
    expect(parsed.violations).toEqual([]);
  });

  it('emits pass:false and forwards redacted violation messages verbatim', () => {
    const violations: AuditViolation[] = [
      {
        rule: 'private-note-title-in-html',
        location: 'note-a/index.html',
        message: 'private note title [REDACTED:Aaaa…abcdef] appears in rendered HTML',
        strictOnly: false,
      },
    ];
    const outcome: AuditOutcome = {
      violations,
      checkedFiles: 7,
      elapsedMs: 9,
    };
    const json = formatAuditJson(outcome, { strict: true });
    const parsed = JSON.parse(json) as {
      pass: boolean;
      strict: boolean;
      violations: AuditViolation[];
    };
    expect(parsed.pass).toBe(false);
    expect(parsed.strict).toBe(true);
    expect(parsed.violations).toHaveLength(1);
    expect(parsed.violations[0]?.message).toContain('[REDACTED:');
    expect(parsed.violations[0]?.rule).toBe('private-note-title-in-html');
  });
});

describe('human formatters (sanity)', () => {
  it('formatPassSummary mentions the file count and elapsed', () => {
    const line = formatPassSummary({ checkedFiles: 3, elapsedMs: 11 });
    expect(line).toContain('0 violations');
    expect(line).toContain('checked 3 files');
    expect(line).toContain('11ms');
  });

  it('formatFailSummary pluralizes correctly', () => {
    const violations: AuditViolation[] = [
      {
        rule: 'obsidian-comment-leak',
        location: 'a.html',
        message: 'x',
        strictOnly: false,
      },
      {
        rule: 'obsidian-comment-leak',
        location: 'b.html',
        message: 'x',
        strictOnly: false,
      },
    ];
    const summary = formatFailSummary(violations, { checkedFiles: 5, elapsedMs: 4 });
    expect(summary).toContain('2 violations');
    expect(summary).toContain('across 2 files');
  });

  it('formatViolationLines emits two lines per violation (header + message)', () => {
    const lines = formatViolationLines([
      {
        rule: 'frontmatter-allowlist-violation',
        location: 'idx.html',
        message: 'key "secret" surfaced',
        strictOnly: false,
      },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('frontmatter-allowlist-violation');
    expect(lines[0]).toContain('idx.html');
    expect(lines[1]).toContain('secret');
  });
});
