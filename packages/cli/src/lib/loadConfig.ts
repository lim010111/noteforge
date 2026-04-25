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

export async function loadConfig(opts: LoadConfigOptions = {}): Promise<ObpubConfig> {
  const cwd = opts.cwd ?? process.cwd();

  if (opts.configPath !== undefined) {
    const explicit = path.isAbsolute(opts.configPath)
      ? opts.configPath
      : path.resolve(cwd, opts.configPath);
    return importConfigFile(explicit);
  }

  const found = await findConfigUpwards(cwd);
  if (found !== null) {
    return importConfigFile(found);
  }

  process.stderr.write(`obpub: no config found, falling back to defaults at ${cwd}\n`);
  return defineConfig({
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
  });
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
