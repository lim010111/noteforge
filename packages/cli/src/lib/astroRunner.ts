import { spawn as defaultSpawn } from 'node:child_process';
import type { spawn as SpawnFn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Re-exported so callers can type a custom spawn injection precisely. */
export type SpawnFunction = typeof SpawnFn;

export interface AstroRunResult {
  /** Astro 프로세스가 정상 종료된 exit code */
  readonly exitCode: number;
  /** 호출자가 spawn 시점부터 측정한 wall clock */
  readonly elapsedMs: number;
}

export interface AstroRunOptions {
  /** astro CLI를 실행할 cwd. */
  readonly cwd: string;
  /** 'dev' | 'build' | 'preview' 등 — 알려진 서브커맨드 */
  readonly subcommand: 'dev' | 'build' | 'preview';
  /** 사용자가 추가로 전달한 인자 (예: --port, --host) */
  readonly extraArgs: readonly string[];
  /** 테스트용 주입점 — 기본은 child_process.spawn */
  readonly spawn?: SpawnFunction;
  /** stdio. 기본 'inherit' — 사용자 터미널에 그대로 노출 */
  readonly stdio?: 'inherit' | 'pipe';
}

/**
 * Astro CLI를 spawn 한다.
 *
 * - astro 바이너리는 cwd의 node_modules/.bin/astro를 우선 사용.
 *   없으면 'astro' PATH 검색. 없으면 즉시 throw.
 * - 부모 SIGINT는 자식에 forward — 좀비 프로세스를 만들지 않도록.
 * - exit code를 그대로 전달 (Astro가 1을 주면 1).
 */
export function runAstro(opts: AstroRunOptions): Promise<AstroRunResult> {
  const binary = resolveAstroBinary(opts.cwd);
  const args: string[] = [opts.subcommand, ...opts.extraArgs];
  const spawnFn = opts.spawn ?? defaultSpawn;
  const stdio = opts.stdio ?? 'inherit';
  const startedAt = Date.now();

  const child = spawnFn(binary, args, { cwd: opts.cwd, stdio });

  return new Promise<AstroRunResult>((resolve, reject) => {
    let settled = false;

    const onSigint = (): void => {
      try {
        child.kill('SIGINT');
      } catch {
        // child may already be gone — nothing useful to do here.
      }
    };
    process.on('SIGINT', onSigint);

    const cleanup = (): void => {
      process.off('SIGINT', onSigint);
    };

    child.on('error', (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });

    child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      const exitCode =
        code !== null ? code : signal === 'SIGINT' ? 130 : signal !== null ? 1 : 0;
      resolve({ exitCode, elapsedMs: Date.now() - startedAt });
    });
  });
}

function resolveAstroBinary(cwd: string): string {
  const localName = process.platform === 'win32' ? 'astro.cmd' : 'astro';
  const local = path.join(cwd, 'node_modules', '.bin', localName);
  if (fs.existsSync(local)) return local;
  const onPath = findOnPath('astro');
  if (onPath !== null) return onPath;
  throw new Error(
    `astro binary not found. Looked in:\n  ${local}\n  PATH (no entry for astro)`,
  );
}

function findOnPath(name: string): string | null {
  const envPath = process.env['PATH'] ?? '';
  if (envPath.length === 0) return null;
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of envPath.split(sep)) {
    if (dir.length === 0) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}
