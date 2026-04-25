import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defineConfig,
  ObpubConfigError,
  type ObpubConfig,
  type ObpubConfigInput,
} from '@noteforge/core/config';

const CONFIG_BASENAMES = [
  'obsidian-blog.config.ts',
  'obsidian-blog.config.mjs',
  'obsidian-blog.config.js',
];

export interface LoadConfigOptions {
  readonly cwd?: string;
  readonly configPath?: string;
}

export interface LoadedConfig {
  readonly config: ObpubConfig;
  /** Absolute path of the loaded config file, or `null` when fallback defaults were used. */
  readonly configPath: string | null;
}

export async function loadConfig(opts: LoadConfigOptions = {}): Promise<ObpubConfig> {
  const { config } = await loadConfigWithPath(opts);
  return config;
}

export async function loadConfigWithPath(
  opts: LoadConfigOptions = {},
): Promise<LoadedConfig> {
  const cwd = opts.cwd ?? process.cwd();
  const loaded = await resolveLoaded(cwd, opts);
  await assertVaultPathsExist(loaded.config, {
    configPath: loaded.configPath ?? undefined,
  });
  return loaded;
}

async function resolveLoaded(
  cwd: string,
  opts: LoadConfigOptions,
): Promise<LoadedConfig> {
  if (opts.configPath !== undefined) {
    const explicit = path.isAbsolute(opts.configPath)
      ? opts.configPath
      : path.resolve(cwd, opts.configPath);
    return { config: await importConfigFile(explicit), configPath: explicit };
  }

  const found = await findConfigUpwards(cwd);
  if (found !== null) {
    return { config: await importConfigFile(found), configPath: found };
  }

  process.stderr.write(
    `obpub: no config found, falling back to defaults at ${cwd}\n` +
      `       hint: pass --config <path> or create obsidian-blog.config.ts in the project root\n`,
  );
  return {
    config: defineConfig({
      site: {
        title: 'obpub',
        url: 'https://example.com',
        author: 'unknown',
      },
      vaults: [
        {
          id: 'default',
          path: cwd,
        },
      ],
    }),
    configPath: null,
  };
}

export async function assertVaultPathsExist(
  config: ObpubConfig,
  opts: { configPath?: string } = {},
): Promise<void> {
  for (const vault of config.vaults) {
    const abs = path.resolve(vault.path);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(abs);
    } catch (cause) {
      throw new ObpubConfigError(
        `vault path does not exist: ${abs} (vault id: ${vault.id}). ` +
          `Update vaults[].path in your obsidian-blog.config.ts.`,
        { configPath: opts.configPath, cause },
      );
    }
    if (!stat.isDirectory()) {
      throw new ObpubConfigError(
        `vault path is not a directory: ${abs} (vault id: ${vault.id}).`,
        { configPath: opts.configPath },
      );
    }
  }
}

async function findConfigUpwards(start: string): Promise<string | null> {
  let dir = path.resolve(start);
  const root = path.parse(dir).root;
  while (true) {
    for (const name of CONFIG_BASENAMES) {
      const candidate = path.join(dir, name);
      if (await fileExists(candidate)) return candidate;
    }
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function importConfigFile(absPath: string): Promise<ObpubConfig> {
  const url = pathToFileURL(absPath).href;
  let mod: { default?: unknown };
  try {
    mod = (await import(url)) as { default?: unknown };
  } catch (cause) {
    if (cause instanceof ObpubConfigError) throw cause;
    const { line, column } = extractLineColumn(cause, absPath);
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    throw new ObpubConfigError(`failed to load config: ${causeMessage}`, {
      configPath: absPath,
      line,
      column,
      cause,
    });
  }
  const exported = mod.default;
  if (exported === undefined || exported === null) {
    throw new ObpubConfigError(`config file has no default export`, {
      configPath: absPath,
    });
  }
  return defineConfig(exported as ObpubConfigInput, { configPath: absPath });
}

function extractLineColumn(
  err: unknown,
  configPath: string,
): { line: number | undefined; column: number | undefined } {
  if (!(err instanceof Error)) return { line: undefined, column: undefined };
  const haystacks = [err.stack, err.message].filter(
    (s): s is string => typeof s === 'string',
  );
  const fileUrl = pathToFileURL(configPath).href;
  const patterns = [
    new RegExp(`${escapeRegex(fileUrl)}:(\\d+):(\\d+)`),
    new RegExp(`${escapeRegex(configPath)}:(\\d+):(\\d+)`),
  ];
  for (const text of haystacks) {
    for (const re of patterns) {
      const m = re.exec(text);
      if (m !== null) {
        const line = Number(m[1]);
        const column = Number(m[2]);
        if (Number.isFinite(line) && Number.isFinite(column)) {
          return { line, column };
        }
      }
    }
  }
  return { line: undefined, column: undefined };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
