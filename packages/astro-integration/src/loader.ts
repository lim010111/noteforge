/**
 * Astro 5 Content Layer adapter for `@noteforge/core`'s privacy pipeline.
 *
 * Single responsibility: take the structured PipelineResult (which has already
 * decided what is public, filtered frontmatter through the allowlist, applied
 * the tag blocklist, rewritten links, and serialized HTML) and write entries
 * into Astro's Content Layer store. Two kinds share the same collection:
 *   - `kind: 'note'`         — one per public slug, carries rendered HTML.
 *   - `kind: 'alias-redirect'` — one per frontmatter alias, points to canonical.
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
 *   - alias entries carry no body/title/tags — only `to` (canonical slug).
 *     `result.aliasRedirects` is built upstream from publishable notes only,
 *     so a private alias cannot reach this loop.
 */

import type { Loader } from 'astro/loaders';
import { runCorePipeline } from '@noteforge/core/pipeline';
import type { ObpubConfig } from '@noteforge/core/config';

interface NoteEntryData extends Record<string, unknown> {
  kind: 'note';
  title?: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  backlinks: string[];
  /**
   * First image URL for the public note, suitable for a hero background.
   * Sourced from `result.firstImage`, which the pipeline already filtered
   * through `attachmentClosure`. The theme renders verbatim.
   */
  heroImage?: string;
  thumbnailImage?: string;
  embeddedImages?: readonly string[];
  sourcePath?: string;
}

interface AliasRedirectEntryData extends Record<string, unknown> {
  kind: 'alias-redirect';
  to: string;
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

      const usedIds = new Set<string>();

      for (const slug of result.publicSlugs) {
        // Defensive re-check: even though the iteration source is publicSlugs,
        // we re-verify before set() so any future refactor that widens the
        // source set fails loud instead of silently leaking ids into the store.
        if (!result.publicSlugs.has(slug)) continue;

        const frontmatter = { ...(result.publicFrontmatter.get(slug) ?? {}) };
        const tags = result.publicTags.get(slug) ?? [];
        const backlinks = backlinksByTarget.get(slug) ?? [];
        const html = result.renderedHtml.get(slug) ?? '';
        const coverRaw = frontmatter['cover'];
        const thumbnailRaw = frontmatter['thumbnail'];
        const cover = resolvePublicImageFrontmatter(
          coverRaw,
          result.attachmentClosure,
        );
        const thumbnail = resolvePublicImageFrontmatter(
          thumbnailRaw,
          result.attachmentClosure,
        );
        if (coverRaw !== undefined && cover === undefined) delete frontmatter['cover'];
        if (thumbnailRaw !== undefined && thumbnail === undefined) {
          delete frontmatter['thumbnail'];
        }
        const titleRaw = frontmatter['title'];

        const data: NoteEntryData = {
          kind: 'note',
          frontmatter,
          tags,
          backlinks,
        };
        if (typeof titleRaw === 'string') {
          data.title = titleRaw;
        }

        // heroImage resolution — frontmatter `cover` wins (author-curated),
        // otherwise the pipeline's first-image fallback. `/attachments/<id>`
        // values are gated against the public attachment closure here because
        // frontmatter is an author-controlled side channel separate from the
        // mdast image pass.
        const hero = cover ?? result.firstImage.get(slug);
        if (hero !== undefined) data.heroImage = hero;
        const resolvedThumbnail = thumbnail ?? hero;
        if (
          resolvedThumbnail !== undefined &&
          resolvedThumbnail !== hero
        ) {
          data.thumbnailImage = resolvedThumbnail;
        }
        const embeddedImages = result.embeddedImages.get(slug);
        if (embeddedImages !== undefined) {
          data.embeddedImages = embeddedImages;
        }
        const sourcePath = result.sourcePathBySlug.get(slug);
        if (sourcePath !== undefined) data.sourcePath = sourcePath;

        usedIds.add(slug);
        context.store.set({
          id: slug,
          data,
          rendered: { html, metadata: {} },
        });
      }

      // Alias redirect entries share the `notes` collection so Content Layer
      // can recompute them through the same HMR/dependency channel as notes.
      for (const redirect of result.aliasRedirects) {
        if (usedIds.has(redirect.from)) {
          // Should already be caught by buildAliasRedirects' slug-collision
          // pass, but a second guard here turns silent overwrites into loud
          // failures. The id collision is the loader's invariant: each
          // `store.set(id)` must claim a unique URL slot.
          throw new Error(
            `alias '${redirect.from}' (→ '${redirect.to}') collides with an existing note id; ` +
              `pipeline should have warned upstream`,
          );
        }

        const data: AliasRedirectEntryData = {
          kind: 'alias-redirect',
          to: redirect.to,
        };
        usedIds.add(redirect.from);
        context.store.set({ id: redirect.from, data });
      }
    },
  };
}

function resolvePublicImageFrontmatter(
  value: unknown,
  attachmentClosure: ReadonlySet<string>,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (!cleaned.startsWith('/')) return undefined;
  if (!cleaned.startsWith('/attachments/')) return cleaned;
  const id = cleaned.slice('/attachments/'.length);
  if (attachmentClosure.has(id)) return cleaned;
  return undefined;
}
