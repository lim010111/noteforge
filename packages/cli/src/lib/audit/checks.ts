import { createHash } from 'node:crypto';
import { scanDist, type DistGraphJson, type DistView } from './scanDist.ts';

export type AuditRule =
  | 'private-note-title-in-html'
  | 'private-attachment-in-dist'
  | 'graph-edge-leaks-private'
  | 'frontmatter-allowlist-violation'
  | 'obsidian-comment-leak'
  | 'tag-blocklist-leak'
  | 'authored-private-title-mention';

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
  return out;
}

function checkPrivateTitleInHtml(view: DistView, input: AuditInput): AuditViolation[] {
  const violations: AuditViolation[] = [];
  for (const title of input.privateTitles) {
    if (title.length === 0) continue;
    const isShort = title.length < 3 || !/[a-z0-9]/i.test(title);
    for (const file of view.htmlFiles) {
      if (!file.content.includes(title)) continue;
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
