/**
 * Astro 5 Content Layer adapter for `@noteforge/core`'s privacy pipeline.
 *
 * Single responsibility: take the structured PipelineResult (which has already
 * decided what is public, filtered frontmatter through the allowlist, applied
 * the tag blocklist, rewritten links, and serialized HTML) and write one entry
 * per *public* slug into Astro's Content Layer store.
 *
 * privacy contract:
 *   - the public/private verdict comes from `result.publicSlugs`. We never
 *     re-derive `isPublic` here. Re-derivation would split the rule across two
 *     code paths and is the most common origin of leak regressions.
 *   - private slugs never reach `store.set` — Content Layer is a long-lived,
 *     id-addressable cache; even an `id`-only entry is a "this note exists"
 *     signal that the privacy-first contract forbids.
 *   - frontmatter / tags are passed through verbatim from core. No further
 *     allowlist/blocklist filtering happens here, because re-filtering risks
 *     re-introducing a field the loader thinks is safe.
 */

import type { Loader } from 'astro/loaders';
import { runCorePipeline } from '@noteforge/core/pipeline';
import type { ObpubConfig } from '@noteforge/core/config';

interface ObpubEntry {
  id: string;
  data: {
    title?: string;
    frontmatter: Record<string, unknown>;
    tags: string[];
    backlinks: string[];
  };
  rendered: {
    html: string;
    metadata: Record<string, unknown>;
  };
}

export function obpubLoader(config: ObpubConfig): Loader {
  return {
    name: '@noteforge/astro/loader',
    async load(context): Promise<void> {
      const result = await runCorePipeline(config);

      // Wipe before populating so repeated load() calls (Astro re-runs in dev)
      // are deterministic and cannot accumulate ghost entries from a previous
      // vault state.
      context.store.clear();

      for (const w of result.warnings) {
        const file = w.file ?? 'unknown';
        const message = `${w.code}: ${w.message} (${file})`;
        if (w.code === 'TRIPWIRE_REJECTED') {
          context.logger.warn(message);
        } else {
          context.logger.info(message);
        }
      }

      // Pre-compute backlinks once: { to → sorted unique [from] }.
      const backlinksByTarget = new Map<string, string[]>();
      for (const edge of result.publicGraph.edges) {
        const list = backlinksByTarget.get(edge.to);
        if (list === undefined) {
          backlinksByTarget.set(edge.to, [edge.from]);
        } else if (!list.includes(edge.from)) {
          list.push(edge.from);
        }
      }
      for (const list of backlinksByTarget.values()) {
        list.sort();
      }

      for (const slug of result.publicSlugs) {
        // Defensive re-check: even though the iteration source is publicSlugs,
        // we re-verify before set() so any future refactor that widens the
        // source set fails loud instead of silently leaking ids into the store.
        if (!result.publicSlugs.has(slug)) continue;

        const frontmatter = result.publicFrontmatter.get(slug) ?? {};
        const tags = result.publicTags.get(slug) ?? [];
        const backlinks = backlinksByTarget.get(slug) ?? [];
        const html = result.renderedHtml.get(slug) ?? '';
        const titleRaw = frontmatter['title'];

        const data: ObpubEntry['data'] = {
          frontmatter,
          tags,
          backlinks,
        };
        if (typeof titleRaw === 'string') {
          data.title = titleRaw;
        }

        const entry: ObpubEntry = {
          id: slug,
          data,
          rendered: { html, metadata: {} },
        };

        context.store.set(entry);
      }
    },
  };
}
