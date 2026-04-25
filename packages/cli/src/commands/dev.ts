import { runAstro } from '../lib/astroRunner.ts';
import { loadConfig } from '../lib/loadConfig.ts';
import { resolveAstroCwd } from '../lib/resolveAstroCwd.ts';

export interface DevOptions {
  readonly configPath?: string;
  readonly extraArgs: readonly string[];
}

/**
 * `obpub dev` — load config, locate the astro project, spawn `astro dev`.
 *
 * The watcher itself lives in `@noteforge/astro` (registered as an Astro
 * integration by apps/blog). The CLI only kicks off Astro; it never builds
 * its own watcher.
 */
export async function runDev(opts: DevOptions): Promise<number> {
  // Validate config + vault paths before spawning astro. The result is
  // discarded — the watcher (registered as an Astro integration in
  // apps/blog) loads the config itself; we only fail-fast here so users
  // get a clear error instead of a broken HMR session.
  await loadConfig({ configPath: opts.configPath });

  let cwd: string;
  try {
    cwd = resolveAstroCwd(process.cwd());
  } catch (err) {
    process.stderr.write(
      `obpub dev: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  const result = await runAstro({
    cwd,
    subcommand: 'dev',
    extraArgs: opts.extraArgs,
  });
  return result.exitCode;
}
