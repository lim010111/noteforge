import * as path from 'node:path';
import { runAstro } from '../lib/astroRunner.ts';
import {
  formatFailSummary,
  formatPassSummary,
  formatViolationLines,
} from '../lib/audit/report.ts';
import { loadConfigWithPath } from '../lib/loadConfig.ts';
import { resolveAstroCwd } from '../lib/resolveAstroCwd.ts';
import { runAudit, type AuditOutcome } from './audit.ts';

export interface BuildOptions {
  readonly configPath?: string;
  readonly extraArgs: readonly string[];
  /** `--no-audit`이면 false. 기본 true. */
  readonly runAuditAfter: boolean;
  /** audit `--strict`와 동일 효과 */
  readonly strictAudit: boolean;
}

export interface BuildOutcome {
  readonly astroExitCode: number;
  readonly elapsedAstroMs: number;
  readonly audit?: AuditOutcome;
}

/**
 * `obpub build` — astro build → privacy audit (optional).
 *
 * 1. loadConfig.
 * 2. runAstro({ subcommand: 'build' }) — Astro가 0이 아니면 즉시 반환 (audit 생략).
 * 3. astroExit === 0이면 runAudit 호출.
 * 4. 호출자(bin.ts)가 종료 코드를 결정한다.
 */
export async function runBuild(opts: BuildOptions): Promise<BuildOutcome> {
  const { config } = await loadConfigWithPath({ configPath: opts.configPath });

  let cwd: string;
  try {
    cwd = resolveAstroCwd(process.cwd());
  } catch (err) {
    process.stderr.write(
      `obpub build: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return { astroExitCode: 1, elapsedAstroMs: 0 };
  }

  const astroResult = await runAstro({
    cwd,
    subcommand: 'build',
    extraArgs: opts.extraArgs,
  });

  if (astroResult.exitCode !== 0) {
    process.stdout.write(
      `[build] astro build FAILED — exit ${astroResult.exitCode}, ${astroResult.elapsedMs}ms\n`,
    );
    process.stdout.write('[obpub] BUILD FAILED — astro exited non-zero\n');
    return {
      astroExitCode: astroResult.exitCode,
      elapsedAstroMs: astroResult.elapsedMs,
    };
  }

  process.stdout.write(`[build] astro build OK — ${astroResult.elapsedMs}ms\n`);

  if (!opts.runAuditAfter) {
    process.stdout.write('[obpub] BUILD OK\n');
    return { astroExitCode: 0, elapsedAstroMs: astroResult.elapsedMs };
  }

  const distDir = path.join(cwd, 'dist');
  const audit = await runAudit(config, { distDir, strict: opts.strictAudit });

  if (audit.violations.length === 0) {
    process.stdout.write(`${formatPassSummary(audit)}\n`);
    process.stdout.write('[obpub] BUILD OK\n');
  } else {
    for (const line of formatViolationLines(audit.violations)) {
      process.stderr.write(`${line}\n`);
    }
    process.stderr.write(`${formatFailSummary(audit.violations, audit)}\n`);
    process.stderr.write('[obpub] BUILD FAILED — privacy audit failed\n');
  }

  return {
    astroExitCode: 0,
    elapsedAstroMs: astroResult.elapsedMs,
    audit,
  };
}
