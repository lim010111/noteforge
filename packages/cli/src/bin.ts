#!/usr/bin/env node
import * as path from 'node:path';
import { Command } from 'commander';
import { runAudit } from './commands/audit.ts';
import { runBuild } from './commands/build.ts';
import { runDev } from './commands/dev.ts';
import { formatStatusJson, formatStatusLine, runStatus } from './commands/status.ts';
import {
  formatAuditJson,
  formatFailSummary,
  formatPassSummary,
  formatViolationLines,
} from './lib/audit/report.ts';
import { loadConfig, loadConfigWithPath } from './lib/loadConfig.ts';

const program = new Command();
program.name('obpub').description('Obsidian-Publish-OSS CLI').version('0.0.0');

const WITH_VALUE_OPTS: ReadonlySet<string> = new Set(['-c', '--config']);
const NO_VALUE_OPTS: ReadonlySet<string> = new Set();

/**
 * Pull astro-bound args out of process.argv directly so order is preserved.
 * Commander's `cmd.args` mixes operands and unknown flags non-deterministically
 * when `allowUnknownOption(true)` is set; reading argv ourselves keeps
 * `--port 3000` in the right order.
 */
function forwardedArgsFor(
  subcommand: string,
  withValue: ReadonlySet<string>,
  noValue: ReadonlySet<string>,
): string[] {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf(subcommand);
  if (idx < 0) return [];
  const tokens = argv.slice(idx + 1);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? '';
    if (noValue.has(tok)) continue;
    if (withValue.has(tok)) {
      i++;
      continue;
    }
    const eq = tok.indexOf('=');
    if (eq > 0) {
      const head = tok.slice(0, eq);
      if (withValue.has(head) || noValue.has(head)) continue;
    }
    out.push(tok);
  }
  return out;
}

program
  .command('status <file>')
  .description('Show whether a note is PUBLIC or PRIVATE and why')
  .option('-c, --config <path>', 'path to noteforge.config.ts')
  .option('--json', 'emit machine-readable JSON instead of a human line')
  .action(async (file: string, opts: { config?: string; json?: boolean }) => {
    const config = await loadConfig({ configPath: opts.config });
    const result = await runStatus(file, config);
    const line = opts.json === true ? formatStatusJson(result) : formatStatusLine(result);
    process.stdout.write(`${line}\n`);
  });

program
  .command('audit')
  .description('Scan dist/ for privacy leaks')
  .option('-c, --config <path>', 'path to noteforge.config.ts')
  .option('-d, --dist <path>', 'path to dist directory (default: <config-dir>/dist)')
  .option('--strict', 'fail on weak signals (authored title mentions, etc.)')
  .option('--json', 'emit machine-readable JSON instead of human-formatted lines')
  .action(
    async (opts: { config?: string; dist?: string; strict?: boolean; json?: boolean }) => {
      const { config, configPath } = await loadConfigWithPath({ configPath: opts.config });
      const distDir = resolveDistDir(opts.dist, configPath);
      const strict = opts.strict ?? false;

      const outcome = await runAudit(config, { distDir, strict });

      if (opts.json === true) {
        process.stdout.write(`${formatAuditJson(outcome, { strict })}\n`);
        if (outcome.violations.length > 0) process.exit(1);
        return;
      }

      if (outcome.violations.length === 0) {
        process.stdout.write(`${formatPassSummary(outcome)}\n`);
        return;
      }

      for (const line of formatViolationLines(outcome.violations)) {
        process.stderr.write(`${line}\n`);
      }
      process.stderr.write(`${formatFailSummary(outcome.violations, outcome)}\n`);
      process.exit(1);
    },
  );

program
  .command('dev')
  .description('Run Astro dev server with HMR')
  .option('-c, --config <path>', 'path to noteforge.config.ts')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async (opts: { config?: string }) => {
    const exitCode = await runDev({
      configPath: opts.config,
      extraArgs: forwardedArgsFor('dev', WITH_VALUE_OPTS, NO_VALUE_OPTS),
    });
    process.exit(exitCode);
  });

program
  .command('build')
  .description('Build the static site and run privacy audit')
  .option('-c, --config <path>', 'path to noteforge.config.ts')
  .option('--no-audit', 'skip post-build audit')
  .option('--strict', 'pass --strict to the audit step')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(
    async (opts: { config?: string; audit?: boolean; strict?: boolean }) => {
      const outcome = await runBuild({
        configPath: opts.config,
        extraArgs: forwardedArgsFor(
          'build',
          WITH_VALUE_OPTS,
          new Set([...NO_VALUE_OPTS, '--no-audit', '--strict']),
        ),
        runAuditAfter: opts.audit !== false,
        strictAudit: opts.strict === true,
      });
      if (outcome.astroExitCode !== 0) process.exit(outcome.astroExitCode);
      if (outcome.audit !== undefined && outcome.audit.violations.length > 0) {
        process.exit(1);
      }
      process.exit(0);
    },
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`obpub: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

function resolveDistDir(explicit: string | undefined, configPath: string | null): string {
  if (explicit !== undefined) {
    return path.isAbsolute(explicit) ? explicit : path.resolve(process.cwd(), explicit);
  }
  const baseDir = configPath !== null ? path.dirname(configPath) : process.cwd();
  return path.join(baseDir, 'dist');
}
