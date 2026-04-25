#!/usr/bin/env node
import { Command } from 'commander';
import { formatStatusLine, runStatus } from './commands/status.ts';
import { loadConfig } from './lib/loadConfig.ts';

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

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`obpub: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
