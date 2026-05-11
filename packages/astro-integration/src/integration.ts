/**
 * AstroIntegration factory for Obsidian-Publish-OSS.
 *
 * Three responsibilities, kept deliberately small:
 *   1. astro:config:setup — append `remarkWikilink` to `markdown.remarkPlugins`
 *      via `updateConfig`. We rely on Astro's deep-merge to *append* (never
 *      replace) the user's plugin array, so we pass our plugin only — passing
 *      existing plugins back would duplicate them after the merge.
 *   2. astro:server:setup — start the dev watcher AND register an
 *      `/attachments/*` Vite middleware that streams files from the vault for
 *      slugs in the public attachment closure. Without the middleware, every
 *      `<img src="/attachments/…">` in dev would 404 because the static dir
 *      lives outside Astro's `public/`.
 *   3. astro:build:done — copy each attachment in the public closure from the
 *      vault into `<dist>/attachments/<vault-rel-path>`. Build-time `<img>`
 *      tags reference `/attachments/…` and the static-export pipeline does
 *      not know the vault exists, so this hook is the only thing that gets
 *      attachment files into dist.
 *
 * privacy contract:
 *   - Both copy paths consult ONLY `result.attachmentClosure`. Attachments
 *     referenced exclusively from private notes never enter the closure
 *     upstream (`packages/core/src/privacy/attachmentClosure.ts`), so neither
 *     the dev middleware nor the build copier can ever surface them.
 *   - The dev middleware re-checks closure membership for every request and
 *     refuses anything not in the set, so a user typing a known private
 *     attachment URL into the address bar gets a 404, not a 200 leak.
 *   - Path traversal is blocked at the middleware boundary (no `..`, no
 *     absolute paths, post-resolve must stay under `vault.path`).
 *
 * Why re-run `runCorePipeline` here:
 *   The pipeline is pure and idempotent. Calling it again at `server:setup`
 *   and `build:done` costs an extra vault scan but keeps the integration's
 *   privacy decisions in lockstep with the loader's — there is no shared
 *   module-scope state for tests / parallel builds to corrupt.
 *
 * MVP stub resolver (config:setup path only):
 *   The remark plugin we register here is invoked by Astro on author-written
 *   `.astro` / `.mdx` pages — NOT on vault notes (those flow through the loader
 *   which already provides pre-rendered HTML). For author-written pages, we
 *   don't have a vault index in scope at integration time, so the resolver is
 *   a conservative noop: every wikilink gets `resolved: false`, which the plugin
 *   safely degrades to strip-to-text. This preserves the privacy contract by
 *   default.
 */

import * as nodeFs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import * as nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { runCorePipeline, type ObpubConfig } from '@noteforge/core';
import { remarkWikilink, type RemarkWikilinkOptions } from './remarkWikilink.ts';
import { createWatcher, type Watcher, type WatcherEvent } from './watcher.ts';
import {
  createDevCoverMiddleware,
  type DevCoverPipelineSnapshot,
} from './devCoverMiddleware.ts';
import { createDevUploadMiddleware } from './devUploadMiddleware.ts';

export interface ObpubIntegrationOptions {
  /**
   * Test seam: override the default Vite full-reload dispatch. When provided,
   * the integration forwards coalesced events here instead of poking
   * `server.ws.send` / `server.hot.send`. Events are re-shaped to drop the
   * `affectedSlugs` Set — the MVP reload path is coarse (full page), so
   * per-slug invalidation data would be misleading if it leaked out.
   */
  onDevInvalidate?: (events: { kind: string; slug: string }[]) => void;
  /** Test seam: replace the watcher factory so tests can inject fakes. */
  createWatcherImpl?: typeof createWatcher;
  /**
   * Test seam: override the pipeline runner used by `astro:server:setup` /
   * `astro:build:done` to compute the attachment closure. Real callers use
   * `runCorePipeline`; tests inject a stub so they can assert copy/serve
   * behaviour without booting the full vault scan.
   */
  runPipelineImpl?: typeof runCorePipeline;
  /**
   * Test seam: override the filesystem layer used by `astro:build:done` to
   * copy attachments and by the dev `/attachments/*` middleware to stream
   * them. Real builds use `node:fs/promises`; tests inject in-memory shims so
   * the integration suite never touches real disk.
   */
  fs?: AttachmentFs;
  /**
   * Thin pass-through for the dev watcher's chokidar polling knobs.
   * `usePolling` is required on WSL `/mnt/c` mounts where inotify is
   * unreliable. Production builds never boot the watcher, so this option
   * has no effect outside `astro dev`.
   */
  watcher?: {
    usePolling?: boolean;
    pollInterval?: number;
  };
}

/**
 * Minimal filesystem surface the integration needs for attachment copy/serve.
 * Kept narrower than `node:fs/promises` so test seams stay tight.
 */
export interface AttachmentFs {
  mkdir(dir: string, opts: { recursive: true }): Promise<unknown>;
  copyFile(src: string, dest: string): Promise<unknown>;
  readFile(absPath: string): Promise<Uint8Array>;
}

const DEFAULT_ATTACHMENT_FS: AttachmentFs = {
  mkdir: (dir, opts) => nodeFs.mkdir(dir, opts),
  copyFile: (src, dest) => nodeFs.copyFile(src, dest),
  readFile: (absPath) => nodeFs.readFile(absPath),
};

const CONTENT_LOADER_NAME = '@noteforge/astro/loader';

/**
 * Conservative MIME map for attachment streaming. The closure already gates
 * `attachments.allowedExtensions`, so only types the user explicitly opted
 * in to ever reach this map. Anything we have no mapping for falls back to
 * `application/octet-stream` (browsers will not auto-execute that).
 */
const ATTACHMENT_MIME: ReadonlyMap<string, string> = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.svg', 'image/svg+xml'],
  ['.bmp', 'image/bmp'],
  ['.ico', 'image/x-icon'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.pdf', 'application/pdf'],
]);

function mimeFor(id: string): string {
  const ext = nodePath.posix.extname(id).toLowerCase();
  return ATTACHMENT_MIME.get(ext) ?? 'application/octet-stream';
}

export function obpub(
  config: ObpubConfig,
  opts: ObpubIntegrationOptions = {},
): AstroIntegration {
  const resolveStub: RemarkWikilinkOptions['resolve'] = () => ({
    resolved: false,
  });
  const isPublicStub: RemarkWikilinkOptions['isPublic'] = () => false;
  const hrefForStub: RemarkWikilinkOptions['hrefFor'] = (id) => `/${id}`;

  const fs = opts.fs ?? DEFAULT_ATTACHMENT_FS;
  const runPipeline = opts.runPipelineImpl ?? runCorePipeline;

  let watcher: Watcher | undefined;
  // Dev pipeline cache. The pipeline is the SSOT — this cache is just a
  // memoised view, refreshed at server:setup and on every coalesced watcher
  // invalidation. Lookups must always go through these getters so the latest
  // snapshot is honoured by both /attachments and /__obpub/cover.
  let pipelineCache: DevCoverPipelineSnapshot = {
    attachmentClosure: new Set(),
    publicSlugs: new Set(),
    sourcePathBySlug: new Map(),
  };
  const getAttachmentClosure = (): ReadonlySet<string> =>
    pipelineCache.attachmentClosure;
  const getPipelineSnapshot = (): DevCoverPipelineSnapshot => pipelineCache;

  return {
    name: '@noteforge/astro',
    hooks: {
      'astro:config:setup': ({ updateConfig, logger }) => {
        const wikilinkOptions: RemarkWikilinkOptions = {
          resolve: resolveStub,
          isPublic: isPublicStub,
          hrefFor: hrefForStub,
          onWarning: (w) => {
            const suffix = w.message.length > 0 ? ` — ${w.message}` : '';
            logger.warn(`wikilink: ${w.raw}${suffix}`);
          },
        };
        updateConfig({
          markdown: {
            remarkPlugins: [[remarkWikilink, wikilinkOptions]],
          },
        });
      },
      'astro:server:setup': async ({ server, logger, refreshContent }) => {
        if (watcher !== undefined) return;

        const factory = opts.createWatcherImpl ?? createWatcher;
        const vault = config.vaults[0];
        if (vault === undefined) {
          logger.warn('obpub: watcher not started — config has no vault');
          return;
        }

        const refreshPipelineCache = async (): Promise<void> => {
          try {
            const result = await runPipeline(config);
            pipelineCache = {
              attachmentClosure: new Set(result.attachmentClosure ?? []),
              publicSlugs: new Set(result.publicSlugs ?? []),
              sourcePathBySlug: new Map(result.sourcePathBySlug ?? []),
            };
            await refreshContent?.({ loaders: [CONTENT_LOADER_NAME] });
          } catch (err) {
            logger.warn(
              `obpub: dev content refresh failed — ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
            throw err;
          }
        };

        watcher = factory({
          vaultPath: vault.path,
          vaultId: vault.id,
          ignore: vault.ignore,
          config,
          ...(opts.watcher !== undefined ? { chokidarOptions: opts.watcher } : {}),
          onInvalidate: (events: readonly WatcherEvent[]): void => {
            void (async () => {
              try {
                await refreshPipelineCache();
              } catch {
                return;
              }
              if (opts.onDevInvalidate !== undefined) {
                opts.onDevInvalidate(
                  events.map((e) => ({ kind: e.kind, slug: e.slug })),
                );
                return;
              }
              logger.info(
                `obpub: vault changed (${events.length} event${events.length === 1 ? '' : 's'}) — full reload`,
              );
              // Vite v5 uses `server.ws.send`; some environments expose only
              // `server.hot.send`. Duck-type against both to survive either
              // without importing Vite internals (whose API surface is not
              // contractual across minor versions).
              const viteHot = server as unknown as {
                ws?: { send: (payload: unknown) => void };
                hot?: { send: (payload: unknown) => void };
              };
              const sender =
                viteHot.ws?.send?.bind(viteHot.ws) ??
                viteHot.hot?.send?.bind(viteHot.hot);
              sender?.({ type: 'full-reload' });
            })();
          },
          onWarning: (msg: string): void => {
            logger.warn(`obpub watcher: ${msg}`);
          },
        });
        await watcher.start();
        logger.info(`obpub: watching vault at ${vault.path}`);

        // Closure must be primed before the first request reaches the
        // middleware; otherwise the dev server would 404 every attachment
        // until the user happened to save a file.
        await refreshPipelineCache();
        registerAttachmentMiddleware({
          server,
          vaultPath: vault.path,
          getClosure: getAttachmentClosure,
          fs,
          logger,
        });
        registerDevCoverMiddleware({
          server,
          vaultPath: vault.path,
          getPipelineResult: getPipelineSnapshot,
          refreshPipelineCache,
        });
        registerDevUploadMiddleware({
          server,
          vaultPath: vault.path,
          getPipelineResult: getPipelineSnapshot,
          refreshPipelineCache,
          config,
        });
      },
      'astro:server:done': async () => {
        if (watcher === undefined) return;
        const w = watcher;
        watcher = undefined;
        await w.stop();
      },
      'astro:build:done': async ({ dir, logger }) => {
        const vault = config.vaults[0];
        if (vault === undefined) {
          logger.warn(
            'obpub: build:done — no vault configured; skipping attachment copy',
          );
          return;
        }

        let result;
        try {
          result = await runPipeline(config);
        } catch (err) {
          logger.error(
            `obpub: build:done — pipeline failed, attachments NOT copied: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          throw err;
        }

        const distDir = fileURLToPath(dir);
        const distAttachments = nodePath.resolve(distDir, 'attachments');
        let copied = 0;
        const failures: { id: string; reason: string }[] = [];
        for (const id of result.attachmentClosure) {
          const srcAbs = nodePath.resolve(vault.path, id);
          const destAbs = nodePath.resolve(distAttachments, id);
          // Defense-in-depth: closure ids are derived from `walkVault` so they
          // are already relative + posix, but a future regression that admits
          // an absolute or `..`-laden id should not let us copy out of the
          // dist tree. Re-anchoring under `distAttachments` and re-checking
          // makes that class of bug a noisy failure rather than a silent
          // arbitrary-write.
          if (!destAbs.startsWith(distAttachments + nodePath.sep)) {
            failures.push({ id, reason: 'destination outside dist/attachments' });
            continue;
          }
          try {
            await fs.mkdir(nodePath.dirname(destAbs), { recursive: true });
            await fs.copyFile(srcAbs, destAbs);
            copied++;
          } catch (err) {
            failures.push({
              id,
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }
        logger.info(
          `obpub: copied ${copied}/${result.attachmentClosure.size} attachment(s) → ${distAttachments}`,
        );
        for (const f of failures) {
          logger.warn(`obpub: attachment copy failed for ${f.id} — ${f.reason}`);
        }
        if (failures.length > 0) {
          throw new Error(
            `obpub: ${failures.length} attachment(s) failed to copy — see warnings above`,
          );
        }
      },
    },
  };
}

interface AttachmentMiddlewareDeps {
  server: unknown;
  vaultPath: string;
  getClosure: () => ReadonlySet<string>;
  fs: AttachmentFs;
  logger: { warn: (message: string) => void };
}

/**
 * Wire `/attachments/*` into the dev server's Vite middleware stack. Every
 * request is closure-checked, path-traversal-guarded, and streamed from the
 * vault. Closure misses + traversal attempts both return 404 (avoiding any
 * existence oracle that distinguishes "private" from "absent"). Outside dev
 * (no `server.middlewares`), this is a noop.
 */
function registerAttachmentMiddleware(deps: AttachmentMiddlewareDeps): void {
  const { server, vaultPath, getClosure, fs, logger } = deps;
  const middlewares = (
    server as { middlewares?: { use?: (path: string, handler: unknown) => unknown } }
  ).middlewares;
  if (typeof middlewares?.use !== 'function') return;

  const vaultRoot = nodePath.resolve(vaultPath);

  middlewares.use(
    '/attachments',
    (
      req: { url?: string; method?: string },
      res: {
        statusCode: number;
        headersSent?: boolean;
        setHeader: (name: string, value: string) => void;
        end: (chunk?: unknown) => void;
        write?: (chunk: unknown) => void;
      },
      next: () => void,
    ) => {
      const method = req.method ?? 'GET';
      if (method !== 'GET' && method !== 'HEAD') {
        next();
        return;
      }

      const url = req.url ?? '/';
      const queryIdx = url.indexOf('?');
      const pathOnly = queryIdx === -1 ? url : url.slice(0, queryIdx);
      let id: string;
      try {
        id = decodeURIComponent(pathOnly).replace(/^\/+/, '');
      } catch {
        res.statusCode = 400;
        res.end();
        return;
      }
      if (id.length === 0 || id.includes('..') || nodePath.isAbsolute(id)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      if (!getClosure().has(id)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const abs = nodePath.resolve(vaultRoot, id);
      if (abs !== vaultRoot && !abs.startsWith(vaultRoot + nodePath.sep)) {
        res.statusCode = 404;
        res.end();
        return;
      }

      res.setHeader('Content-Type', mimeFor(id));
      // Dev server only — no caching so changes to the underlying file show
      // up immediately on reload. Production assets are served as static
      // files by the host (Cloudflare Pages, etc.) and get their own headers.
      res.setHeader('Cache-Control', 'no-store');

      if (method === 'HEAD') {
        res.end();
        return;
      }

      // Try the streaming path first (real fs); fall back to the injected
      // readFile so test seams that lack a real disk backing still work.
      if (fs === DEFAULT_ATTACHMENT_FS) {
        const stream = createReadStream(abs);
        stream.on('error', () => {
          if (res.headersSent !== true) res.statusCode = 404;
          res.end();
        });
        (stream as unknown as { pipe: (dest: unknown) => void }).pipe(res);
        return;
      }
      void fs
        .readFile(abs)
        .then((buf) => {
          res.write?.(buf);
          res.end();
        })
        .catch((err) => {
          logger.warn(
            `obpub: attachment stream failed for ${id} — ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          if (res.headersSent !== true) res.statusCode = 404;
          res.end();
        });
    },
  );
}

interface DevCoverRegistrationDeps {
  server: unknown;
  vaultPath: string;
  getPipelineResult: () => DevCoverPipelineSnapshot;
  refreshPipelineCache: () => Promise<void>;
}

function registerDevCoverMiddleware(deps: DevCoverRegistrationDeps): void {
  const middlewares = (
    deps.server as {
      middlewares?: { use?: (path: string, handler: unknown) => unknown };
    }
  ).middlewares;
  if (typeof middlewares?.use !== 'function') return;

  middlewares.use(
    '/__obpub/cover',
    createDevCoverMiddleware({
      vaultPath: deps.vaultPath,
      getPipelineResult: deps.getPipelineResult,
      refreshPipelineCache: deps.refreshPipelineCache,
    }),
  );
}

interface DevUploadRegistrationDeps {
  server: unknown;
  vaultPath: string;
  getPipelineResult: () => DevCoverPipelineSnapshot;
  refreshPipelineCache: () => Promise<void>;
  config: ObpubConfig;
}

function registerDevUploadMiddleware(deps: DevUploadRegistrationDeps): void {
  const middlewares = (
    deps.server as {
      middlewares?: { use?: (path: string, handler: unknown) => unknown };
    }
  ).middlewares;
  if (typeof middlewares?.use !== 'function') return;

  middlewares.use(
    '/__obpub/upload-attachment',
    createDevUploadMiddleware({
      vaultPath: deps.vaultPath,
      getPipelineResult: deps.getPipelineResult,
      refreshPipelineCache: deps.refreshPipelineCache,
      config: deps.config,
    }),
  );
}
