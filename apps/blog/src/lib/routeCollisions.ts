/**
 * Route-collision guards for `apps/blog/src/pages/[...slug].astro`.
 *
 * The catch-all slug page hosts three route kinds (note, alias-redirect,
 * folder-index). Astro requires unique `params.slug` across all three; a
 * silent override would make a note disappear without a build error. These
 * guards turn a collision into a build-time throw with a precise message
 * that names the offending route AND the file path (so PR reviewers can
 * jump straight to the routing layer).
 */

export interface RouteId {
  readonly slug: string;
}

export interface AliasRouteId extends RouteId {
  readonly to: string;
}

export type FolderRouteId = RouteId;

export type CategoryRouteId = RouteId;

const FILE_TRAILER = '(apps/blog/src/pages/[...slug].astro)';

/**
 * Throw if any alias `id` collides with an existing note slug. Mirrors the
 * loader-level guard but keeps the routing-layer fail-fast message specific
 * to alias-vs-note overrides.
 */
export function assertNoAliasCollisions(
  noteSlugs: ReadonlySet<string>,
  aliases: readonly AliasRouteId[],
): void {
  for (const alias of aliases) {
    if (noteSlugs.has(alias.slug)) {
      throw new Error(
        `[...slug] route collision: alias '${alias.slug}' (→ '${alias.to}') ` +
          `would overwrite a note slug. Resolve in vault frontmatter before building. ` +
          FILE_TRAILER,
      );
    }
  }
}

/**
 * Throw if any folder-index slug collides with a note or alias slug already
 * claimed by `claimed`. The throw message shows the folder slug with a
 * trailing slash so reviewers can disambiguate visually from the colliding
 * note/alias slug (which appears unsuffixed).
 */
export function assertNoFolderCollisions(
  claimed: ReadonlySet<string>,
  folders: readonly FolderRouteId[],
): void {
  for (const folder of folders) {
    if (claimed.has(folder.slug)) {
      throw new Error(
        `[...slug] route collision: folder '${folder.slug}/' shares its slug with an existing note or alias. ` +
          `Resolve by renaming the folder or the colliding note. ` +
          FILE_TRAILER,
      );
    }
  }
}

/**
 * Throw if any category-index slug collides with a note or alias slug already
 * claimed by `claimed`. Mirrors `assertNoFolderCollisions` but its message
 * names the offender as a category so reviewers can distinguish the two
 * routing kinds (`nav.mode === 'category'` vs `'folder'`) when triaging.
 */
export function assertNoCategoryCollisions(
  claimed: ReadonlySet<string>,
  categories: readonly CategoryRouteId[],
): void {
  for (const cat of categories) {
    if (claimed.has(cat.slug)) {
      throw new Error(
        `[...slug] route collision: category '${cat.slug}/' shares its slug with an existing note or alias. ` +
          `Resolve by renaming the category or the colliding note. ` +
          FILE_TRAILER,
      );
    }
  }
}
