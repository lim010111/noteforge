#!/usr/bin/env node
import * as path from 'node:path';
import { Command } from 'commander';
import { runAudit } from './commands/audit.ts';
import { formatStatusLine, runStatus } from './commands/status.ts';
import {
  formatFailSummary,
  formatPassSummary,
  formatViolationLines,
} from './lib/audit/report.ts';
import { loadConfig, loadConfigWithPath } from './lib/loadConfig.ts';

const program = new Command();
program.name('obpub').description('Obsidian-Publish-OSS CLI').version('0.0.0');

program
  .command('status <file>')
  .description('Show whether a note is PUBLIC or PRIVATE and why')
  .option('-c, --config <path>', 'path to obsidian-blog.config.ts')
  .action(async (file: string, opts: { config?: string }) => {
    const config = await loadConfig({ configPath: opts.config });
    const result = await runStatus(file, config);
    process.stdout.write(`${formatStatusLine(result)}\n`);
  });

program
  .command('audit')
  .description('Scan dist/ for privacy leaks')
  .option('-c, --config <path>', 'path to obsidian-blog.config.ts')
  .option('-d, --dist <path>', 'path to dist directory (default: <config-dir>/dist)')
  .option('--strict', 'fail on weak signals (authored title mentions, etc.)')
  .action(async (opts: { config?: string; dist?: string; strict?: boolean }) => {
    const { config, configPath } = await loadConfigWithPath({ configPath: opts.config });
    const distDir = resolveDistDir(opts.dist, configPath);

    const outcome = await runAudit(config, { distDir, strict: opts.strict ?? false });

    if (outcome.violations.length === 0) {
      process.stdout.write(`${formatPassSummary(outcome)}\n`);
      return;
    }

    for (const line of formatViolationLines(outcome.violations)) {
      process.stderr.write(`${line}\n`);
    }
    process.stderr.write(`${formatFailSummary(outcome.violations, outcome)}\n`);
    process.exit(1);
  });

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
