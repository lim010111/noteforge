import type { TagPageEntry, TagSummary } from '@noteforge/theme-default';
import {
  coerceDate,
  descriptionForEntry,
  displayTitleForEntry,
  tagsForEntry,
  thumbnailForEntry,
  type NoteEntry,
} from './viewModels.ts';

export function summarizeTags(entries: readonly NoteEntry[]): TagSummary[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const raw of e.data.tags) {
      const tag = raw.trim();
      if (tag.length === 0) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const out: TagSummary[] = [];
  for (const [tag, count] of counts) {
    out.push({ tag, count });
  }
  out.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
  });
  return out;
}

export function entriesForTag(
  tag: string,
  entries: readonly NoteEntry[],
): TagPageEntry[] {
  const matched: TagPageEntry[] = [];
  for (const e of entries) {
    if (e.data.tags.includes(tag) === false) continue;
    if (e.id.length === 0) continue;
    const title = displayTitleForEntry(e);
    const description = descriptionForEntry(e);
    const tags = tagsForEntry(e);
    const date = coerceDate(e.data.frontmatter['date']);
    const thumbnail = thumbnailForEntry(e);
    const item: TagPageEntry = { slug: e.id, title };
    if (description !== undefined) item.description = description;
    if (tags.length > 0) item.tags = tags;
    if (date !== undefined) item.date = date;
    if (thumbnail !== undefined) item.thumbnail = thumbnail;
    matched.push(item);
  }
  matched.sort((a, b) => {
    const ad = a.date;
    const bd = b.date;
    if (ad === undefined && bd === undefined) {
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    }
    if (ad === undefined) return 1;
    if (bd === undefined) return -1;
    if (ad !== bd) return bd.localeCompare(ad);
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
  return matched;
}
