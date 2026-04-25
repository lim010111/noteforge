import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface ScannedHtmlFile {
  /** POSIX-separated path relative to distDir. */
  readonly relPath: string;
  /** Full file content as UTF-8. */
  readonly content: string;
}

export interface ScannedFile {
  /** POSIX-separated path relative to distDir. */
  readonly relPath: string;
  /** Final path segment (e.g. `cover.png`). */
  readonly basename: string;
}

export interface DistGraphJson {
  readonly nodes?: unknown;
  readonly edges?: unknown;
}

export interface DistView {
  readonly distDir: string;
  readonly htmlFiles: readonly ScannedHtmlFile[];
  readonly allFiles: readonly ScannedFile[];
  /** Parsed `dist/api/graph.json` body, or `null` when the file is absent. */
  readonly graph: DistGraphJson | null;
  /** POSIX-separated path of the graph file (relative to distDir), or `null`. */
  readonly graphLocation: string | null;
}

const HTML_EXT_RE = /\.html?$/i;
const GRAPH_JSON_REL = 'api/graph.json';

export async function scanDist(distDir: string): Promise<DistView> {
  let stat;
  try {
    stat = await fs.stat(distDir);
  } catch (err) {
    throw new Error(
      `audit: dist directory not found at ${distDir} (${(err as NodeJS.ErrnoException).code ?? 'unknown'})`,
    );
  }
  if (!stat.isDirectory()) {
    throw new Error(`audit: dist path is not a directory: ${distDir}`);
  }

  const allFiles: ScannedFile[] = [];
  const htmlFiles: ScannedHtmlFile[] = [];
  for await (const rel of walkFiles(distDir, '')) {
    allFiles.push({ relPath: rel, basename: path.posix.basename(rel) });
    if (HTML_EXT_RE.test(rel)) {
      const content = await fs.readFile(path.join(distDir, rel), 'utf8');
      htmlFiles.push({ relPath: rel, content });
    }
  }

  const graphAbs = path.join(distDir, GRAPH_JSON_REL);
  let graph: DistGraphJson | null = null;
  let graphLocation: string | null = null;
  try {
    const raw = await fs.readFile(graphAbs, 'utf8');
    graph = JSON.parse(raw) as DistGraphJson;
    graphLocation = GRAPH_JSON_REL;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw new Error(`audit: failed to read ${GRAPH_JSON_REL}: ${(err as Error).message}`);
    }
  }

  return { distDir, htmlFiles, allFiles, graph, graphLocation };
}

async function* walkFiles(root: string, prefix: string): AsyncGenerator<string> {
  const dir = prefix.length === 0 ? root : path.join(root, prefix);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const childRel = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      yield* walkFiles(root, childRel);
    } else if (entry.isFile()) {
      yield childRel;
    }
  }
}
