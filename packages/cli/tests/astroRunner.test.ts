import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAstro, type SpawnFunction } from '../src/lib/astroRunner.ts';

class FakeChild extends EventEmitter {
  killed = false;
  killSignal: NodeJS.Signals | number | null = null;
  override on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
  kill(signal?: NodeJS.Signals | number): boolean {
    this.killed = true;
    this.killSignal = signal ?? 'SIGTERM';
    return true;
  }
}

interface SpawnCall {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: { cwd?: string; stdio?: string };
}

interface FakeSpawn {
  readonly fn: SpawnFunction;
  readonly calls: SpawnCall[];
  readonly child: FakeChild;
}

function makeFakeSpawn(): FakeSpawn {
  const child = new FakeChild();
  const calls: SpawnCall[] = [];
  const fn = ((binary: string, args: readonly string[], options: object) => {
    calls.push({ binary, args, options: options as { cwd?: string; stdio?: string } });
    return child;
  }) as unknown as SpawnFunction;
  return { fn, calls, child };
}

let sandbox: string;
let originalPath: string | undefined;

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), `astro-runner-${randomUUID()}-`));
  originalPath = process.env['PATH'];
});

afterEach(async () => {
  if (originalPath === undefined) delete process.env['PATH'];
  else process.env['PATH'] = originalPath;
  await fs.rm(sandbox, { recursive: true, force: true });
});

describe('runAstro — binary resolution', () => {
  it('uses node_modules/.bin/astro in cwd when present', async () => {
    const binDir = path.join(sandbox, 'node_modules', '.bin');
    await fs.mkdir(binDir, { recursive: true });
    const localBin = path.join(binDir, 'astro');
    await fs.writeFile(localBin, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const { fn, calls, child } = makeFakeSpawn();
    const promise = runAstro({
      cwd: sandbox,
      subcommand: 'build',
      extraArgs: [],
      spawn: fn,
    });
    await new Promise((r) => setImmediate(r));
    child.emit('exit', 0, null);
    await promise;

    expect(calls).toHaveLength(1);
    expect(calls[0]?.binary).toBe(localBin);
  });

  it('falls back to astro on PATH when no local bin exists', async () => {
    const pathDir = path.join(sandbox, 'fakepath');
    await fs.mkdir(pathDir, { recursive: true });
    const pathBin = path.join(pathDir, 'astro');
    await fs.writeFile(pathBin, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    process.env['PATH'] = pathDir;

    const { fn, calls, child } = makeFakeSpawn();
    const promise = runAstro({
      cwd: sandbox,
      subcommand: 'dev',
      extraArgs: [],
      spawn: fn,
    });
    await new Promise((r) => setImmediate(r));
    child.emit('exit', 0, null);
    await promise;

    expect(calls).toHaveLength(1);
    expect(calls[0]?.binary).toBe(pathBin);
  });

  it('throws when astro is neither local nor on PATH', async () => {
    process.env['PATH'] = '';
    const { fn } = makeFakeSpawn();
    expect(() =>
      runAstro({ cwd: sandbox, subcommand: 'build', extraArgs: [], spawn: fn }),
    ).toThrow(/astro binary not found/);
  });
});

describe('runAstro — argument forwarding and exit codes', () => {
  async function setupLocalAstro(): Promise<string> {
    const binDir = path.join(sandbox, 'node_modules', '.bin');
    await fs.mkdir(binDir, { recursive: true });
    const localBin = path.join(binDir, 'astro');
    await fs.writeFile(localBin, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    return localBin;
  }

  it('forwards extraArgs to the spawned process verbatim', async () => {
    await setupLocalAstro();
    const { fn, calls, child } = makeFakeSpawn();
    const promise = runAstro({
      cwd: sandbox,
      subcommand: 'dev',
      extraArgs: ['--port', '3000', '--host'],
      spawn: fn,
    });
    await new Promise((r) => setImmediate(r));
    child.emit('exit', 0, null);
    await promise;

    expect(calls[0]?.args).toEqual(['dev', '--port', '3000', '--host']);
  });

  it('returns exitCode 0 when child exits 0', async () => {
    await setupLocalAstro();
    const { fn, child } = makeFakeSpawn();
    const promise = runAstro({
      cwd: sandbox,
      subcommand: 'build',
      extraArgs: [],
      spawn: fn,
    });
    await new Promise((r) => setImmediate(r));
    child.emit('exit', 0, null);
    const result = await promise;
    expect(result.exitCode).toBe(0);
  });

  it('returns the same non-zero exitCode the child exits with', async () => {
    await setupLocalAstro();
    const { fn, child } = makeFakeSpawn();
    const promise = runAstro({
      cwd: sandbox,
      subcommand: 'build',
      extraArgs: [],
      spawn: fn,
    });
    await new Promise((r) => setImmediate(r));
    child.emit('exit', 7, null);
    const result = await promise;
    expect(result.exitCode).toBe(7);
  });
});

describe('runAstro — SIGINT forwarding', () => {
  async function setupLocalAstro(): Promise<void> {
    const binDir = path.join(sandbox, 'node_modules', '.bin');
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(path.join(binDir, 'astro'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  }

  it('forwards SIGINT received on the parent to the spawned child', async () => {
    await setupLocalAstro();
    const before = process.listeners('SIGINT').slice();

    const { fn, child } = makeFakeSpawn();
    const promise = runAstro({
      cwd: sandbox,
      subcommand: 'dev',
      extraArgs: [],
      spawn: fn,
    });
    await new Promise((r) => setImmediate(r));

    const after = process.listeners('SIGINT');
    const added = after.filter((l) => !before.includes(l));
    expect(added).toHaveLength(1);

    // Invoke our own listener directly instead of process.emit('SIGINT'),
    // which would also fire any other test runner SIGINT handlers.
    (added[0] as () => void)();

    expect(child.killed).toBe(true);
    expect(child.killSignal).toBe('SIGINT');

    child.emit('exit', 130, 'SIGINT');
    const result = await promise;
    expect(result.exitCode).toBe(130);

    // Ensure cleanup removed our listener.
    const final = process.listeners('SIGINT');
    expect(final.filter((l) => !before.includes(l))).toHaveLength(0);
  });
});
