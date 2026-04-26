/**
 * Container-API tests for `<FolderTreeSidebar />`.
 *
 * Pin the privacy + a11y + auto-expand contracts so the sidebar cannot drift
 * silently. Mirrors the assertion style of NoteList.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import FolderTreeSidebar from '../src/components/FolderTreeSidebar.astro';
import type {
  FolderTreeSidebarProps,
  SidebarFolder,
  SidebarLeaf,
} from '../src/components/FolderTreeSidebar.types';

async function render(props: FolderTreeSidebarProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(FolderTreeSidebar as never, {
    props: props as unknown as Record<string, unknown>,
  });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

const leaf = (slug: string, label = slug): SidebarLeaf => ({
  kind: 'leaf',
  slug,
  label,
});

const folder = (
  path: string,
  label: string,
  children: readonly (SidebarFolder | SidebarLeaf)[],
): SidebarFolder => ({
  kind: 'folder',
  path,
  label,
  noteCount: children.reduce(
    (n, c) => n + (c.kind === 'leaf' ? 1 : c.noteCount),
    0,
  ),
  children,
});

describe('FolderTreeSidebar', () => {
  it('renders nothing when roots is empty (no shell, no aria leak)', async () => {
    const html = await render({ roots: [] });
    expect(countMatches(html, /<aside\b/g)).toBe(0);
    expect(countMatches(html, /<nav\b/g)).toBe(0);
  });

  it('renders <aside> with a labelled nav and a top-level <ul>', async () => {
    const html = await render({
      roots: [leaf('a', 'A')],
    });
    expect(html).toMatch(/<aside\s[^>]*\bclass="folder-tree"/);
    expect(html).toMatch(/<aside\s[^>]*\baria-label="[^"]+"/);
    expect(html).toMatch(/<nav\b/);
    expect(html).toMatch(/<ul\s[^>]*\bclass="folder-tree__list"/);
  });

  it('uses caller-provided ariaLabel when given', async () => {
    const html = await render({
      roots: [leaf('a')],
      ariaLabel: 'Custom Label',
    });
    expect(html).toContain('aria-label="Custom Label"');
  });

  it('renders one folder as <details> with a summary, label, and count', async () => {
    const html = await render({
      roots: [folder('daily', 'Daily', [leaf('daily/x'), leaf('daily/y')])],
    });
    expect(countMatches(html, /<details\b/g)).toBe(1);
    expect(countMatches(html, /<summary\b/g)).toBe(1);
    expect(html).toContain('>Daily<');
    // count badge present and matches transitive count
    expect(html).toMatch(/folder-tree__count[^>]*>2</);
  });

  it('opens ancestor folders of currentSlug and only those', async () => {
    const html = await render({
      roots: [
        folder('a', 'A', [
          folder('a/b', 'B', [leaf('a/b/note')]),
          leaf('a/peer'),
        ]),
        folder('z', 'Z', [leaf('z/other')]),
      ],
      currentSlug: 'a/b/note',
    });
    // Three <details> total. 'a' and 'a/b' are open; 'z' is closed.
    expect(countMatches(html, /<details\b[^>]*\bopen\b/g)).toBe(2);
    expect(countMatches(html, /<details\b/g)).toBe(3);
  });

  it('does not auto-open any folder when currentSlug is omitted', async () => {
    const html = await render({
      roots: [
        folder('a', 'A', [folder('a/b', 'B', [leaf('a/b/note')])]),
      ],
    });
    expect(countMatches(html, /<details\b[^>]*\bopen\b/g)).toBe(0);
  });

  it('marks the active leaf with aria-current="page" + .is-active', async () => {
    const html = await render({
      roots: [folder('a', 'A', [leaf('a/x'), leaf('a/y')])],
      currentSlug: 'a/x',
    });
    // active leaf has the marker
    expect(html).toMatch(
      /<a\s[^>]*\bhref="\/a\/x"[^>]*\bclass="[^"]*\bis-active\b[^"]*"[^>]*\baria-current="page"/,
    );
    // sibling leaf does NOT have aria-current
    expect(html).toMatch(
      /<a\s[^>]*\bhref="\/a\/y"(?![^>]*aria-current)/,
    );
  });

  it('does not mark anything as aria-current when currentSlug is omitted', async () => {
    const html = await render({
      roots: [folder('a', 'A', [leaf('a/x')])],
    });
    expect(countMatches(html, /\baria-current=/g)).toBe(0);
  });

  it('builds leaf hrefs as `/{slug}` verbatim', async () => {
    const html = await render({
      roots: [
        leaf('top'),
        folder('deep', 'Deep', [leaf('deep/one'), leaf('deep/two')]),
      ],
    });
    expect(html).toMatch(/<a\s[^>]*\bhref="\/top"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/deep\/one"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/deep\/two"/);
  });

  it('HTML-escapes labels (no set:html) — XSS guard', async () => {
    const html = await render({
      roots: [
        folder('f', '<b>Folder</b>', [
          leaf('f/x', '<script>alert(1)</script>'),
        ]),
      ],
    });
    expect(countMatches(html, /<script\b/g)).toBe(0);
    // The literal "<b>" text must not be a real <b> tag
    expect(countMatches(html, /<b>Folder/g)).toBe(0);
    expect(html).toMatch(/&lt;b&gt;Folder/);
  });

  it('uses folder-tree__* classes (no leakage of sibling component scopes)', async () => {
    const html = await render({
      roots: [folder('f', 'F', [leaf('f/x')])],
      currentSlug: 'f/x',
    });
    expect(html).toContain('folder-tree__folder');
    expect(html).toContain('folder-tree__leaf');
    expect(html).toContain('folder-tree__link');
    expect(html).toContain('folder-tree__label');
    expect(html).toContain('folder-tree__count');
    // anti-regression: must not cross-pollinate with note-list/tag-page styling
    expect(html).not.toContain('note-list__');
    expect(html).not.toContain('tag-page__');
  });

  it('exposes nesting depth via inline --folder-tree-depth so CSS can ladder indents', async () => {
    const html = await render({
      roots: [folder('a', 'A', [folder('a/b', 'B', [leaf('a/b/note')])])],
    });
    expect(html).toMatch(/style="--folder-tree-depth: 0;?"/);
    expect(html).toMatch(/style="--folder-tree-depth: 1;?"/);
    expect(html).toMatch(/style="--folder-tree-depth: 2;?"/);
  });

  it('does not emit any <script> tags or set:html — JS-less by construction', async () => {
    const html = await render({
      roots: [folder('a', 'A', [leaf('a/x', 'X')])],
      currentSlug: 'a/x',
    });
    expect(countMatches(html, /<script\b/g)).toBe(0);
  });
});
