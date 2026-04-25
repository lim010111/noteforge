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
  runAstro: vi.fn(async () => ({ exitCode: 0, elapsedMs: 50 })),
}));

vi.mock('../src/commands/audit.ts', () => ({
  runAudit: vi.fn(async () => ({ violations: [], checkedFiles: 5, elapsedMs: 7 })),
}));

import { runBuild } from '../src/commands/build.ts';
import { runAudit } from '../src/commands/audit.ts';
import { runAstro } from '../src/lib/astroRunner.ts';

let sandbox: string;
let originalCwd: string;

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), `obpub-build-${randomUUID()}-`));
  // pretend sandbox is an astro project root
  await fs.writeFile(path.join(sandbox, 'astro.config.mjs'), '', 'utf8');
  originalCwd = process.cwd();
  process.chdir(sandbox);
  vi.mocked(runAstro).mockReset();
  vi.mocked(runAudit).mockReset();
  vi.mocked(runAstro).mockResolvedValue({ exitCode: 0, elapsedMs: 50 });
  vi.mocked(runAudit).mockResolvedValue({
    violations: [],
    checkedFiles: 5,
    elapsedMs: 7,
  });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(sandbox, { recursive: true, force: true });
});

describe('runBuild', () => {
  it('runs audit and reports zero violations on a clean build', async () => {
    const outcome = await runBuild({
      extraArgs: [],
      runAuditAfter: true,
      strictAudit: false,
    });

    expect(outcome.astroExitCode).toBe(0);
    expect(outcome.audit).toBeDefined();
    expect(outcome.audit?.violations).toHaveLength(0);
    expect(vi.mocked(runAudit)).toHaveBeenCalledTimes(1);
  });

  it('skips audit when astro build fails', async () => {
    vi.mocked(runAstro).mockResolvedValueOnce({ exitCode: 1, elapsedMs: 30 });

    const outcome = await runBuild({
      extraArgs: [],
      runAuditAfter: true,
      strictAudit: false,
    });

    expect(outcome.astroExitCode).toBe(1);
    expect(outcome.audit).toBeUndefined();
    expect(vi.mocked(runAudit)).not.toHaveBeenCalled();
  });

  it('returns audit violations when present after a green astro build', async () => {
    vi.mocked(runAudit).mockResolvedValueOnce({
      violations: [
        {
          rule: 'private-note-title-in-html',
          location: 'index.html',
          message: 'leak',
          strictOnly: false,
        },
      ],
      checkedFiles: 5,
      elapsedMs: 8,
    });

    const outcome = await runBuild({
      extraArgs: [],
      runAuditAfter: true,
      strictAudit: false,
    });

    expect(outcome.astroExitCode).toBe(0);
    expect(outcome.audit?.violations.length).toBeGreaterThan(0);
  });

  it('does not run audit when runAuditAfter is false', async () => {
    const outcome = await runBuild({
      extraArgs: [],
      runAuditAfter: false,
      strictAudit: false,
    });

    expect(outcome.astroExitCode).toBe(0);
    expect(outcome.audit).toBeUndefined();
    expect(vi.mocked(runAudit)).not.toHaveBeenCalled();
  });

  it('forwards extraArgs to runAstro', async () => {
    await runBuild({
      extraArgs: ['--verbose'],
      runAuditAfter: false,
      strictAudit: false,
    });

    const mocked = runAstro as MockedFunction<typeof runAstro>;
    const call = mocked.mock.calls[0]?.[0];
    expect(call?.subcommand).toBe('build');
    expect(call?.extraArgs).toEqual(['--verbose']);
  });

  it('passes strict flag through to runAudit', async () => {
    await runBuild({
      extraArgs: [],
      runAuditAfter: true,
      strictAudit: true,
    });

    const mocked = runAudit as MockedFunction<typeof runAudit>;
    const call = mocked.mock.calls[0];
    expect(call?.[1]?.strict).toBe(true);
  });
});
