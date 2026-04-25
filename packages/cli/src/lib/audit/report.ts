import type { AuditOutcome, AuditViolation } from './checks.ts';

export interface AuditSummary {
  readonly checkedFiles: number;
  readonly elapsedMs: number;
}

export function formatViolationLines(violations: readonly AuditViolation[]): string[] {
  const out: string[] = [];
  for (const v of violations) {
    out.push(`[audit] ${v.rule}  ${v.location}`);
    out.push(`        ${v.message}`);
  }
  return out;
}

export function formatFailSummary(
  violations: readonly AuditViolation[],
  summary: AuditSummary,
): string {
  const fileCount = countDistinctLocations(violations);
  return (
    `[audit] FAIL — ${violations.length} violation${violations.length === 1 ? '' : 's'}` +
    ` across ${fileCount} file${fileCount === 1 ? '' : 's'}` +
    ` (checked ${summary.checkedFiles} files in ${summary.elapsedMs}ms)`
  );
}

export function formatPassSummary(summary: AuditSummary): string {
  return `[audit] OK — 0 violations (checked ${summary.checkedFiles} files in ${summary.elapsedMs}ms)`;
}

function countDistinctLocations(violations: readonly AuditViolation[]): number {
  const seen = new Set<string>();
  for (const v of violations) seen.add(v.location);
  return seen.size;
}

export interface AuditJsonReport {
  readonly pass: boolean;
  readonly strict: boolean;
  readonly checkedFiles: number;
  readonly elapsedMs: number;
  readonly violations: readonly AuditViolation[];
}

/**
 * JSON 보고서 — CI/automation 용. message는 redact된 그대로 들어가므로
 * 사람-친화 출력과 동일한 privacy 표면을 유지한다.
 */
export function formatAuditJson(
  outcome: AuditOutcome,
  opts: { strict: boolean },
): string {
  const report: AuditJsonReport = {
    pass: outcome.violations.length === 0,
    strict: opts.strict,
    checkedFiles: outcome.checkedFiles,
    elapsedMs: outcome.elapsedMs,
    violations: outcome.violations,
  };
  return JSON.stringify(report);
}
