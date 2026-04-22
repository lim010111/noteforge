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

export function obpub(_config: ObpubConfig): AstroIntegration {
  const resolveStub: RemarkWikilinkOptions['resolve'] = () => ({
    resolved: false,
  });
  const isPublicStub: RemarkWikilinkOptions['isPublic'] = () => false;
  const hrefForStub: RemarkWikilinkOptions['hrefFor'] = (id) => `/${id}`;

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
      'astro:build:done': ({ logger }) => {
        logger.info(
          'obpub: build done — audit placeholder (audit arrives in @obpub/cli phase)',
        );
      },
    },
  };
}
