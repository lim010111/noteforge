import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import picomatch from 'picomatch';

export interface WalkOptions {
  /** Absolute vault path. */
  readonly root: string;
  /** Glob patterns (POSIX), root-relative. Matching subtrees are not entered. */
  readonly ignore: readonly string[];
  /** Enter symlinked directories/files. Default `false` to prevent escaping the vault. */
  readonly followSymlinks?: boolean;
  /** File extensions to yield, dot-prefixed. Matched case-insensitively. Default `['.md']`. */
  readonly extensions?: readonly string[];
}

export interface WalkEntry {
  /** OS-native absolute path, suitable for `fs.readFile`. */
  readonly path: string;
  /** Vault-relative POSIX path, no leading slash. */
  readonly relativePath: string;
}

const DEFAULT_EXTENSIONS: readonly string[] = ['.md'];

/**
 * Recursively walks a vault root, yielding `.md` files (by default).
 *
 * - Does NOT read file content — discovery only. Consumers call `parseNote()`.
 * - Ignored subtrees are skipped at `readdir` boundary; no stat into them.
 * - Symlinks are skipped unless `followSymlinks` is explicitly `true`.
 * - Hidden entries (`.` prefix) are skipped by default.
 * - Transient IO errors (`ENOENT`, `EACCES`, …) warn and continue.
 */
export async function* walkVault(options: WalkOptions): AsyncIterable<WalkEntry> {
  const followSymlinks = options.followSymlinks === true;
  const extensions = (options.extensions ?? DEFAULT_EXTENSIONS).map((e) => e.toLowerCase());
  const isIgnored = options.ignore.length > 0
    ? picomatch(options.ignore as string[], { dot: true })
    : () => false;

  yield* walk(options.root, '', { followSymlinks, extensions, isIgnored });
}

interface WalkContext {
  readonly followSymlinks: boolean;
  readonly extensions: readonly string[];
  readonly isIgnored: (relativePath: string) => boolean;
}

async function* walk(
  absDir: string,
  relDir: string,
  ctx: WalkContext,
): AsyncIterable<WalkEntry> {
  let dirents: Dirent[];
  try {
    dirents = await fs.readdir(absDir, { withFileTypes: true });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[obpub] walk: cannot read ${absDir}: ${reason}`);
    return;
  }

  for (const dirent of dirents) {
    const name = dirent.name;
    if (name.startsWith('.')) continue;

    const childRel = relDir.length === 0 ? name : `${relDir}/${name}`;
    const childAbs = path.join(absDir, name);

    if (ctx.isIgnored(childRel)) continue;

    if (dirent.isSymbolicLink() && !ctx.followSymlinks) continue;

    let isDirectory: boolean;
    let isFile: boolean;
    if (dirent.isSymbolicLink()) {
      try {
        const stat = await fs.stat(childAbs);
        isDirectory = stat.isDirectory();
        isFile = stat.isFile();
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[obpub] walk: cannot stat ${childAbs}: ${reason}`);
        continue;
      }
    } else {
      isDirectory = dirent.isDirectory();
      isFile = dirent.isFile();
    }

    if (isDirectory) {
      yield* walk(childAbs, childRel, ctx);
      continue;
    }

    if (!isFile) continue;

    const ext = path.posix.extname(name).toLowerCase();
    if (!ctx.extensions.includes(ext)) continue;

    yield { path: childAbs, relativePath: childRel };
  }
}
