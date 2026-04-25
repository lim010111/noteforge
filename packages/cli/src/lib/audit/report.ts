import type { AuditViolation } from './checks.ts';

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
