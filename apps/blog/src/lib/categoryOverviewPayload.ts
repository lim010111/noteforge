import type {
  CategoryOverviewNote,
  CategoryOverviewSection,
  FolderNode,
} from '@noteforge/theme-default';

interface FolderNote {
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
  date?: string;
  thumbnail?: string;
}

function collectDescendantNotes(node: FolderNode): readonly FolderNote[] {
  const out: FolderNote[] = [...node.notes];
  for (const child of node.children) out.push(...collectDescendantNotes(child));
  return out;
}

function compareNotes(
  a: CategoryOverviewNote,
  b: CategoryOverviewNote,
): number {
  const ad = a.date;
  const bd = b.date;
  if (ad === undefined && bd === undefined) {
    return a.href < b.href ? -1 : a.href > b.href ? 1 : 0;
  }
  if (ad === undefined) return 1;
  if (bd === undefined) return -1;
  if (ad !== bd) return bd.localeCompare(ad);
  return a.href < b.href ? -1 : a.href > b.href ? 1 : 0;
}

function compareSections(
  a: CategoryOverviewSection,
  b: CategoryOverviewSection,
): number {
  const al = a.name.toLowerCase();
  const bl = b.name.toLowerCase();
  if (al !== bl) return al < bl ? -1 : 1;
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return 0;
}

function toCategoryNote(
  note: FolderNote,
  dateBySlug: ReadonlyMap<string, string>,
): CategoryOverviewNote {
  const date = note.date ?? dateBySlug.get(note.slug);
  const item: CategoryOverviewNote = {
    href: `/${note.slug}/`,
    title: note.title,
  };
  if (note.description !== undefined) item.description = note.description;
  if (note.tags !== undefined) item.tags = note.tags;
  if (date !== undefined) item.date = date;
  if (note.thumbnail !== undefined) item.thumbnail = note.thumbnail;
  return item;
}

/**
 * Flatten a folder tree into a Categories-overview view-model.
 *
 * Each top-level child folder becomes one section whose `notes` are *all*
 * descendants of that folder, flattened. Notes sitting directly at the vault
 * root (`root.notes`) become a trailing `Uncategorized` section.
 *
 * Sorting:
 *   - sections: alphabetical (case-insensitive). `Uncategorized` is always
 *     pinned to the end regardless of letter.
 *   - notes inside a section: date desc → href asc, mirroring the same rule
 *     `entriesForTag` uses so the two listing pages feel coherent.
 *
 * Dates are looked up via `dateBySlug` (typically built from `entry.data
 * .frontmatter.date` filtered to strings) so this helper stays a pure
 * transform — it does not crawl Astro entries itself.
 */
export function buildCategoryOverviewSections(
  root: FolderNode,
  dateBySlug: ReadonlyMap<string, string>,
): CategoryOverviewSection[] {
  const sections: CategoryOverviewSection[] = root.children.map((child) => {
    const flattened = collectDescendantNotes(child);
    const notes = flattened
      .map((n) => toCategoryNote(n, dateBySlug))
      .sort(compareNotes);
    return {
      name: child.name,
      href: `/${child.path}/`,
      notes,
    };
  });

  sections.sort(compareSections);

  if (root.notes.length > 0) {
    const uncategorized: CategoryOverviewSection = {
      name: 'Uncategorized',
      notes: root.notes
        .map((n) => toCategoryNote(n, dateBySlug))
        .sort(compareNotes),
    };
    sections.push(uncategorized);
  }

  return sections;
}
