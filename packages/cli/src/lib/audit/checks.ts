import { createHash } from 'node:crypto';
import { scanDist, type DistGraphJson, type DistView } from './scanDist.ts';

export type AuditRule =
  | 'private-note-title-in-html'
  | 'private-attachment-in-dist'
  | 'graph-edge-leaks-private'
  | 'frontmatter-allowlist-violation'
  | 'obsidian-comment-leak'
  | 'tag-blocklist-leak'
  | 'authored-private-title-mention'
  | 'alias-redirect-broken-target'
  | 'alias-redirect-body-leak';

export interface AuditViolation {
  readonly rule: AuditRule;
  readonly location: string;
  readonly message: string;
  readonly strictOnly: boolean;
}

export interface AuditInput {
  /** `dist/` directory absolute path. */
  readonly distDir: string;
  /** Slugs the build promised would be public. Graph endpoints are checked against this. */
  readonly publicSlugs: ReadonlySet<string>;
  /** Title-shaped strings of every private note (frontmatter title + bare filename). */
  readonly privateTitles: ReadonlySet<string>;
  /** Lower-cased basenames of vault attachments that should never reach dist. */
  readonly privateAttachmentBasenames: ReadonlySet<string>;
  /** Allowed frontmatter keys that may surface in dist (data-fm-*, JSON-LD, etc.). */
  readonly frontmatterAllowlist: ReadonlySet<string>;
  /** Tag glob patterns that must not surface as anchor hrefs or `#tag` text. */
  readonly tagBlocklist: ReadonlySet<string>;
  /**
   * Trimmed `frontmatter.title` of every public note. Used to detect alias
   * redirect pages that accidentally render another note's title in `<main>` —
   * alias pages are pure URL pointers and must not surface note metadata.
   */
  readonly publicTitles: ReadonlySet<string>;
  /** When true, also fire weak-signal rules (authored-private-title-mention, etc.). */
  readonly strict: boolean;
}

export interface AuditOutcome {
  readonly violations: readonly AuditViolation[];
  readonly checkedFiles: number;
  readonly elapsedMs: number;
}

const COMMENT_RE = /%%[\s\S]*?%%/;
const HASHED_TITLE_BYTES = 6;

export async function runAuditChecks(input: AuditInput): Promise<readonly AuditViolation[]> {
  const view = await scanDist(input.distDir);
  return collectViolations(view, input);
}

export async function runAuditWithMetrics(input: AuditInput): Promise<AuditOutcome> {
  const startedAt = Date.now();
  const view = await scanDist(input.distDir);
  const violations = collectViolations(view, input);
  return {
    violations,
    checkedFiles: view.allFiles.length,
    elapsedMs: Date.now() - startedAt,
  };
}

function collectViolations(view: DistView, input: AuditInput): readonly AuditViolation[] {
  const out: AuditViolation[] = [];
  out.push(...checkPrivateTitleInHtml(view, input));
  out.push(...checkPrivateAttachmentInDist(view, input));
  out.push(...checkGraphLeaks(view, input));
  out.push(...checkFrontmatterAllowlist(view, input));
  out.push(...checkObsidianCommentLeak(view));
  out.push(...checkTagBlocklist(view, input));
  out.push(...checkAliasRedirects(view, input));
  return out;
}

function checkPrivateTitleInHtml(view: DistView, input: AuditInput): AuditViolation[] {
  const violations: AuditViolation[] = [];
  for (const title of input.privateTitles) {
    if (title.length === 0) continue;
    // "Short" = unlikely to be a distinctive title; common short English words
    // (note, code, dev, page, file, ...) are weak signals per ADR-004 and are
    // only flagged under --strict as authored-private-title-mention. We treat
    // ASCII-letter-only titles up to length 5 as short for this purpose.
    const isShort =
      title.length < 3 ||
      !/[a-z0-9]/i.test(title) ||
      (title.length < 6 && /^[A-Za-z]+$/.test(title));
    const matches = buildTitleMatcher(title);
    for (const file of view.htmlFiles) {
      if (!matches(file.content)) continue;
      if (isShort) {
        if (input.strict) {
          violations.push({
            rule: 'authored-private-title-mention',
            location: file.relPath,
            message: `dist contains a short authored mention of a private note (${redactTitle(title)})`,
            strictOnly: true,
          });
        }
        // Non-strict: short titles are skipped to avoid false positives.
        continue;
      }
      violations.push({
        rule: 'private-note-title-in-html',
        location: file.relPath,
        message: `private note title ${redactTitle(title)} appears in rendered HTML`,
        strictOnly: false,
      });
    }
  }
  return violations;
}

function checkPrivateAttachmentInDist(
  view: DistView,
  input: AuditInput,
): AuditViolation[] {
  if (input.privateAttachmentBasenames.size === 0) return [];
  const violations: AuditViolation[] = [];
  for (const file of view.allFiles) {
    if (input.privateAttachmentBasenames.has(file.basename.toLowerCase())) {
      violations.push({
        rule: 'private-attachment-in-dist',
        location: file.relPath,
        message: `dist contains a private attachment basename ${redactTitle(file.basename)}`,
        strictOnly: false,
      });
    }
  }
  return violations;
}

function checkGraphLeaks(view: DistView, input: AuditInput): AuditViolation[] {
  if (view.graph === null || view.graphLocation === null) return [];
  const violations: AuditViolation[] = [];
  const loc = view.graphLocation;

  for (const id of extractGraphNodeIds(view.graph)) {
    if (!input.publicSlugs.has(id)) {
      violations.push({
        rule: 'graph-edge-leaks-private',
        location: loc,
        message: `graph node ${redactTitle(id)} is not in publicSlugs`,
        strictOnly: false,
      });
    }
  }

  for (const edge of extractGraphEdges(view.graph)) {
    const fromOk = input.publicSlugs.has(edge.from);
    const toOk = input.publicSlugs.has(edge.to);
    if (!fromOk || !toOk) {
      violations.push({
        rule: 'graph-edge-leaks-private',
        location: loc,
        message: `graph edge ${redactTitle(edge.from)} → ${redactTitle(edge.to)} references a non-public slug`,
        strictOnly: false,
      });
    }
  }
  return violations;
}

function checkFrontmatterAllowlist(view: DistView, input: AuditInput): AuditViolation[] {
  const violations: AuditViolation[] = [];
  const allowedLower = new Set<string>();
  for (const k of input.frontmatterAllowlist) allowedLower.add(k.toLowerCase());

  for (const file of view.htmlFiles) {
    const re = /\bdata-fm-([a-z0-9_-]+)\s*=/gi;
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = re.exec(file.content)) !== null) {
      const key = (match[1] ?? '').toLowerCase();
      if (key.length === 0) continue;
      if (allowedLower.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({
        rule: 'frontmatter-allowlist-violation',
        location: file.relPath,
        message: `frontmatter key "${key}" surfaced via data-fm-${key} but is not in the allowlist`,
        strictOnly: false,
      });
    }
  }
  return violations;
}

function checkObsidianCommentLeak(view: DistView): AuditViolation[] {
  const violations: AuditViolation[] = [];
  for (const file of view.htmlFiles) {
    if (COMMENT_RE.test(file.content)) {
      violations.push({
        rule: 'obsidian-comment-leak',
        location: file.relPath,
        message: 'obsidian-style %%...%% comment delimiters survived to rendered HTML',
        strictOnly: false,
      });
    }
  }
  return violations;
}

function checkTagBlocklist(view: DistView, input: AuditInput): AuditViolation[] {
  if (input.tagBlocklist.size === 0) return [];
  const literalPrefixes: string[] = [];
  for (const pattern of input.tagBlocklist) {
    const prefix = literalGlobPrefix(pattern);
    if (prefix.length > 0) literalPrefixes.push(prefix);
  }
  if (literalPrefixes.length === 0) return [];

  const violations: AuditViolation[] = [];
  for (const file of view.htmlFiles) {
    for (const prefix of literalPrefixes) {
      const needles = [`#${prefix}`, `/tags/${prefix}`];
      const hit = needles.some((n) => file.content.includes(n));
      if (hit) {
        violations.push({
          rule: 'tag-blocklist-leak',
          location: file.relPath,
          message: `dist HTML mentions tag blocklist prefix "${prefix}"`,
          strictOnly: false,
        });
      }
    }
  }
  return violations;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Word-boundary-aware substring matcher for private note titles. Plain
// `String.includes` produced false positives on short ASCII titles (e.g. a
// note titled "dev" matching `device-width` in viewport meta). For titles
// whose outer characters are ASCII alphanumerics we anchor the boundary
// with a negative look-around; non-ASCII edges (e.g. Korean) fall back to
// substring because `\b` is undefined for them in JS regex.
function buildTitleMatcher(title: string): (text: string) => boolean {
  const startsAlnum = /^[A-Za-z0-9]/.test(title);
  const endsAlnum = /[A-Za-z0-9]$/.test(title);
  if (!startsAlnum && !endsAlnum) {
    return (text) => text.includes(title);
  }
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const left = startsAlnum ? '(?<![A-Za-z0-9])' : '';
  const right = endsAlnum ? '(?![A-Za-z0-9])' : '';
  const re = new RegExp(`${left}${escaped}${right}`);
  return (text) => re.test(text);
}

function redactTitle(title: string): string {
  if (title.length === 0) return '[REDACTED:empty]';
  const head = title.slice(0, 4);
  const hash = createHash('sha256').update(title).digest('hex').slice(0, HASHED_TITLE_BYTES);
  return `[REDACTED:${head.replace(/[^A-Za-z0-9]/g, '_')}…${hash}]`;
}

function literalGlobPrefix(pattern: string): string {
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' || ch === '?' || ch === '[' || ch === '{' || ch === '(') break;
    i++;
  }
  return pattern.slice(0, i);
}

function extractGraphNodeIds(graph: DistGraphJson): string[] {
  const out: string[] = [];
  const nodes = graph.nodes;
  if (!Array.isArray(nodes)) return out;
  for (const n of nodes) {
    if (typeof n === 'string') {
      out.push(n);
    } else if (n !== null && typeof n === 'object' && 'id' in n) {
      const id = (n as { id?: unknown }).id;
      if (typeof id === 'string') out.push(id);
    }
  }
  return out;
}

interface FlatEdge {
  readonly from: string;
  readonly to: string;
}

function extractGraphEdges(graph: DistGraphJson): FlatEdge[] {
  const out: FlatEdge[] = [];
  const edges = graph.edges;
  if (!Array.isArray(edges)) return out;
  for (const e of edges) {
    if (e === null || typeof e !== 'object') continue;
    const obj = e as { from?: unknown; to?: unknown; source?: unknown; target?: unknown };
    const from = typeof obj.from === 'string' ? obj.from : typeof obj.source === 'string' ? obj.source : null;
    const to = typeof obj.to === 'string' ? obj.to : typeof obj.target === 'string' ? obj.target : null;
    if (from !== null && to !== null) out.push({ from, to });
  }
  return out;
}

// ── Alias redirect checks ─────────────────────────────────────────────────────

/**
 * Captures `<meta http-equiv="refresh" content="0; url=...">`. The regex tolerates
 * arbitrary whitespace and either quote style on the attributes; the captured
 * group is the bare URL with surrounding whitespace trimmed by the caller.
 */
const META_REFRESH_RE =
  /<meta\b[^>]*\bhttp-equiv\s*=\s*["']refresh["'][^>]*\bcontent\s*=\s*["']\s*\d+\s*;\s*url\s*=\s*([^"']+?)\s*["'][^>]*>/i;

const MAIN_BLOCK_RE = /<main\b[^>]*>([\s\S]*?)<\/main>/i;

function checkAliasRedirects(view: DistView, input: AuditInput): AuditViolation[] {
  const violations: AuditViolation[] = [];
  // Build the set of dist-relative paths once so each redirect target can be
  // resolved in O(1). Using POSIX separators matches `scanDist`'s output.
  const existing = new Set<string>(view.allFiles.map((f) => f.relPath));

  for (const file of view.htmlFiles) {
    const refresh = META_REFRESH_RE.exec(file.content);
    if (refresh === null) continue;
    const target = (refresh[1] ?? '').trim();
    if (target.length === 0) continue;

    if (!targetExistsInDist(target, existing)) {
      violations.push({
        rule: 'alias-redirect-broken-target',
        location: file.relPath,
        message: `alias redirect points to '${target}' but no matching page exists in dist`,
        strictOnly: false,
      });
    }

    const mainText = extractMainText(file.content);
    if (mainText.length === 0) continue;
    for (const title of input.publicTitles) {
      if (title.length === 0) continue;
      const matches = buildTitleMatcher(title);
      if (matches(mainText)) {
        violations.push({
          rule: 'alias-redirect-body-leak',
          location: file.relPath,
          message: `alias redirect <main> contains a public note title ${redactTitle(title)} — alias pages must be content-free`,
          strictOnly: false,
        });
        // One leak per file is enough to flag the page; further matches would
        // just repeat the same finding.
        break;
      }
    }
  }
  return violations;
}

/**
 * Maps a redirect target URL onto the dist file that should serve it. We accept
 * three shapes the project actually emits:
 *   - `/foo`       → `foo.html` or `foo/index.html`
 *   - `/foo/`      → `foo/index.html`
 *   - `/`          → `index.html`
 * External absolute URLs (http/https) are out of scope — the audit cannot reach
 * the network — so they are treated as existent to avoid false positives. The
 * project pipeline never emits external alias targets, so this branch is
 * defensive rather than load-bearing.
 */
function targetExistsInDist(target: string, existing: ReadonlySet<string>): boolean {
  if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('//')) {
    return true;
  }
  const stripped = target.replace(/[?#].*$/, '');
  const clean = stripped.startsWith('/') ? stripped.slice(1) : stripped;
  if (clean.length === 0) return existing.has('index.html');
  if (clean.endsWith('/')) return existing.has(`${clean}index.html`);
  return existing.has(`${clean}.html`) || existing.has(`${clean}/index.html`);
}

/**
 * Strip tags from `<main>...</main>` so the body-leak check looks at rendered
 * text only. Attribute values (href, alt, …) are excluded; without this step a
 * legitimate `<a href="/foo">` whose slug overlaps a public title would
 * false-positive.
 */
function extractMainText(html: string): string {
  const m = MAIN_BLOCK_RE.exec(html);
  if (m === null) return '';
  return (m[1] ?? '').replace(/<[^>]*>/g, ' ');
}
