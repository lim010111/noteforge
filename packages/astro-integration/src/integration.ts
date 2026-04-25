/**
 * AstroIntegration factory for Obsidian-Publish-OSS.
 *
 * Two responsibilities, deliberately small:
 *   1. astro:config:setup — append `remarkWikilink` to `markdown.remarkPlugins`
 *      via `updateConfig`. We rely on Astro's deep-merge to *append* (never
 *      replace) the user's plugin array, so we pass our plugin only — passing
 *      existing plugins back would duplicate them after the merge.
 *   2. astro:build:done — placeholder hook that records intent. The real audit
 *      lives in `@obpub/cli` + Phase D; doing it here would couple the integration
 *      to filesystem layout it has no business owning.
 *
 * Things this file deliberately does NOT do:
 *   - Walk the vault or call `runCorePipeline` at config:setup. Doing so would
 *     turn `astro dev` startup into an O(vault) operation. Vault I/O is the
 *     loader's job (lazy, on-demand).
 *   - Re-implement loader / plugin logic. Those modules are the source of truth.
 *   - Read `dist/` in build:done. Audit gating is its own phase; we only reserve
 *     the hook position here.
 *
 * MVP stub resolver (config:setup path only):
 *   The remark plugin we register here is invoked by Astro on author-written
 *   `.astro` / `.mdx` pages — NOT on vault notes (those flow through the loader
 *   which already provides pre-rendered HTML). For author-written pages, we
 *   don't have a vault index in scope at integration time, so the resolver is
 *   a conservative noop: every wikilink gets `resolved: false`, which the plugin
 *   safely degrades to strip-to-text. This preserves the privacy contract by
 *   default. A shared-state registry (or pipeline preload) can replace this stub
 *   in a later step (step3b watcher / future phase).
 */

import type { AstroIntegration } from 'astro';
import type { ObpubConfig } from '@obpub/core/config';
import { remarkWikilink, type RemarkWikilinkOptions } from './remarkWikilink.ts';
import { createWatcher, type Watcher, type WatcherEvent } from './watcher.ts';

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

export function obpub(
  config: ObpubConfig,
  opts: ObpubIntegrationOptions = {},
): AstroIntegration {
  const resolveStub: RemarkWikilinkOptions['resolve'] = () => ({
    resolved: false,
  });
  const isPublicStub: RemarkWikilinkOptions['isPublic'] = () => false;
  const hrefForStub: RemarkWikilinkOptions['hrefFor'] = (id) => `/${id}`;

  let watcher: Watcher | undefined;

  return {
    name: '@obpub/astro',
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
      'astro:server:setup': async ({ server, logger }) => {
        if (watcher !== undefined) return;

        const factory = opts.createWatcherImpl ?? createWatcher;
        const vault = config.vaults[0];
        if (vault === undefined) {
          logger.warn('obpub: watcher not started — config has no vault');
          return;
        }

        watcher = factory({
          vaultPath: vault.path,
          vaultId: vault.id,
          ignore: vault.ignore,
          config,
          ...(opts.watcher !== undefined ? { chokidarOptions: opts.watcher } : {}),
          onInvalidate: (events: readonly WatcherEvent[]): void => {
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
          },
          onWarning: (msg: string): void => {
            logger.warn(`obpub watcher: ${msg}`);
          },
        });
        await watcher.start();
        logger.info(`obpub: watching vault at ${vault.path}`);
      },
      'astro:server:done': async () => {
        if (watcher === undefined) return;
        const w = watcher;
        watcher = undefined;
        await w.stop();
      },
      'astro:build:done': ({ logger }) => {
        logger.info(
          'obpub: build done — audit placeholder (audit arrives in @obpub/cli phase)',
        );
      },
    },
  };
}
