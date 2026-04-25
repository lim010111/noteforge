import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defineConfig,
  type ObpubConfig,
  type ObpubConfigInput,
} from '@obpub/core/config';

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
  await assertVaultPathsExist(loaded.config);
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

export async function assertVaultPathsExist(config: ObpubConfig): Promise<void> {
  for (const vault of config.vaults) {
    const abs = path.resolve(vault.path);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(abs);
    } catch {
      throw new Error(
        `vault path does not exist: ${abs} (vault id: ${vault.id}). ` +
          `Update vaults[].path in your obsidian-blog.config.ts.`,
      );
    }
    if (!stat.isDirectory()) {
      throw new Error(
        `vault path is not a directory: ${abs} (vault id: ${vault.id}).`,
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
  const mod = (await import(url)) as { default?: unknown };
  const exported = mod.default;
  if (exported === undefined || exported === null) {
    throw new Error(`config file ${absPath} has no default export`);
  }
  return defineConfig(exported as ObpubConfigInput);
}
