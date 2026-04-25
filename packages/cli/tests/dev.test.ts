import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest';

vi.mock('../src/lib/loadConfig.ts', () => ({
  loadConfig: vi.fn(async () => ({})),
  loadConfigWithPath: vi.fn(async () => ({ config: {}, configPath: null })),
}));

vi.mock('../src/lib/astroRunner.ts', () => ({
  runAstro: vi.fn(async () => ({ exitCode: 0, elapsedMs: 12 })),
}));

import { runDev } from '../src/commands/dev.ts';
import { runAstro } from '../src/lib/astroRunner.ts';
import { loadConfig } from '../src/lib/loadConfig.ts';

let sandbox: string;
let originalCwd: string;

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), `obpub-dev-${randomUUID()}-`));
  // Make sandbox a valid astro project so resolveAstroCwd doesn't throw.
  await fs.writeFile(path.join(sandbox, 'astro.config.mjs'), '', 'utf8');
  originalCwd = process.cwd();
  process.chdir(sandbox);
  vi.mocked(runAstro).mockClear();
  vi.mocked(loadConfig).mockClear();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(sandbox, { recursive: true, force: true });
});

describe('runDev', () => {
  it('forwards extraArgs to runAstro verbatim', async () => {
    const exit = await runDev({ extraArgs: ['--port', '3000'] });

    expect(exit).toBe(0);
    const mocked = runAstro as MockedFunction<typeof runAstro>;
    expect(mocked).toHaveBeenCalledTimes(1);
    const call = mocked.mock.calls[0]?.[0];
    expect(call?.subcommand).toBe('dev');
    expect(call?.extraArgs).toEqual(['--port', '3000']);
  });

  it('passes configPath through to loadConfig', async () => {
    await runDev({
      configPath: '/abs/path/to/obsidian-blog.config.ts',
      extraArgs: [],
    });

    const mocked = loadConfig as MockedFunction<typeof loadConfig>;
    expect(mocked).toHaveBeenCalledWith({
      configPath: '/abs/path/to/obsidian-blog.config.ts',
    });
  });

  it('returns the exit code that runAstro produced', async () => {
    vi.mocked(runAstro).mockResolvedValueOnce({ exitCode: 130, elapsedMs: 5 });
    const exit = await runDev({ extraArgs: [] });
    expect(exit).toBe(130);
  });
});
