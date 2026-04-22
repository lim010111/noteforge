/**
 * Expand Obsidian transclusion embeds `![[Target]]` / `![[Target#heading]]` in an mdast
 * tree. Non-embed wikilinks (`[[...]]`) are NOT handled here — see `linkRewriter.ts`.
 *
 * privacy-first contract:
 *   - public note target    → AST replaced with caller-supplied `mdastFor(targetId)` body
 *                             (already privacy-processed by caller). Block-level expansions
 *                             split the enclosing paragraph so the resulting tree stays
 *                             structurally valid.
 *   - private note target   → embed node removed. No warning (expected default).
 *   - unresolved target     → embed node removed. Warning emitted.
 *   - attachment target     → replaced with an inline mdast `image` node whose url comes
 *                             from `attachmentUrlFor`. Attachment public/private filtering
 *                             is the caller's responsibility (see attachmentFilter step).
 *   - block-reference `^id` → out of scope for v0.1; treated as unresolved.
 *
 * Cycle / depth safety:
 *   - `visited` is seeded with `sourceId`. Any subsequent occurrence of a targetId already
 *     in the set is removed as a cycle — self-reference and shared-target repeats both
 *     map to the same behaviour.
 *   - `maxDepth` (default 5) bounds recursive expansion. Each embed crossed enters a
 *     deeper walk on the caller-supplied target body; attempts beyond the limit are
 *     removed, not expanded.
 *
 * The tree is mutated in place — the root reference is preserved so callers can keep
 * threading the same tree through subsequent privacy stages.
 */

import type { Root } from 'mdast';
import { parseWikilinkTarget } from '../resolve/wikilink.ts';

const MAX_DEPTH_DEFAULT = 5;

export type TranscludeStatus =
  | 'expanded-public'
  | 'removed-private'
  | 'removed-unresolved'
  | 'removed-cycle'
  | 'removed-depth'
  | 'attachment';

export interface TransclusionRecord {
  readonly raw: string;
  readonly status: TranscludeStatus;
  readonly targetId?: string;
}

export interface ExpandTransclusionsOptions {
  readonly tree: Root;
  readonly sourceId: string;
  readonly sourceFile?: string;
  readonly resolve: (raw: string) => {
    readonly resolved: boolean;
    readonly targetId?: string;
    readonly kind: 'note' | 'attachment';
  };
  readonly isPublic: (targetId: string) => boolean;
  readonly mdastFor: (targetId: string) => Root;
  readonly attachmentUrlFor: (targetId: string) => string;
  readonly maxDepth?: number;
}

export interface ExpandTransclusionsResult {
  readonly transclusions: readonly TransclusionRecord[];
}

/** Factory — returns a fresh regex per call so recursive processText invocations
 *  don't share a mutating `lastIndex`. */
const embedRegex = (): RegExp => /!\[\[([^[\]]*)\]\]/g;
const SKIP_TYPES: ReadonlySet<string> = new Set(['inlineCode', 'code', 'html', 'yaml']);

interface AnyNode {
  type: string;
  value?: string;
  children?: AnyNode[];
  url?: string;
  alt?: string;
  depth?: number;
  title?: string | null;
  position?: {
    start?: { line?: number; column?: number };
  };
}

type TextPiece =
  | { kind: 'inline'; nodes: AnyNode[] }
  | { kind: 'blocks'; nodes: AnyNode[] };

type EmbedReplacement =
  | { kind: 'inline'; nodes: AnyNode[] }
  | { kind: 'blocks'; nodes: AnyNode[] }
  | { kind: 'drop' };

export function expandTransclusions(
  options: ExpandTransclusionsOptions,
): ExpandTransclusionsResult {
  const maxDepth = options.maxDepth ?? MAX_DEPTH_DEFAULT;
  const transclusions: TransclusionRecord[] = [];
  const visited = new Set<string>([options.sourceId]);

  walkContainer(options.tree as unknown as AnyNode, 0);
  return { transclusions };

  function walkContainer(container: AnyNode, depth: number): void {
    const children = container.children;
    if (!Array.isArray(children)) return;
    for (let i = 0; i < children.length; ) {
      const child = children[i];
      if (!child) {
        i++;
        continue;
      }
      if (SKIP_TYPES.has(child.type)) {
        i++;
        continue;
      }
      if (child.type === 'paragraph') {
        const replacement = transformParagraph(child, depth);
        if (replacement === null) {
          i++;
        } else {
          children.splice(i, 1, ...replacement);
          i += replacement.length;
        }
      } else {
        walkContainer(child, depth);
        i++;
      }
    }
  }

  function transformParagraph(paragraph: AnyNode, depth: number): AnyNode[] | null {
    const inline = paragraph.children;
    if (!Array.isArray(inline)) return null;

    type Segment =
      | { kind: 'inline'; nodes: AnyNode[] }
      | { kind: 'blocks'; nodes: AnyNode[] };

    const segments: Segment[] = [];
    let changed = false;

    const addInline = (node: AnyNode): void => {
      const last = segments[segments.length - 1];
      if (last && last.kind === 'inline') last.nodes.push(node);
      else segments.push({ kind: 'inline', nodes: [node] });
    };

    const addBlocks = (nodes: readonly AnyNode[]): void => {
      segments.push({ kind: 'blocks', nodes: [...nodes] });
    };

    for (const node of inline) {
      if (node.type === 'text') {
        const pieces = processText(node, depth);
        if (pieces === null) {
          addInline(node);
        } else {
          changed = true;
          for (const piece of pieces) {
            if (piece.kind === 'inline') {
              for (const n of piece.nodes) addInline(n);
            } else {
              addBlocks(piece.nodes);
            }
          }
        }
      } else if (SKIP_TYPES.has(node.type)) {
        addInline(node);
      } else if (Array.isArray(node.children)) {
        processInlineContainer(node, depth);
        addInline(node);
      } else {
        addInline(node);
      }
    }

    if (!changed) return null;

    const output: AnyNode[] = [];
    let pendingInline: AnyNode[] = [];
    for (const seg of segments) {
      if (seg.kind === 'inline') {
        pendingInline.push(...seg.nodes);
      } else {
        if (pendingInline.length > 0) {
          output.push({ type: 'paragraph', children: pendingInline });
          pendingInline = [];
        }
        for (const b of seg.nodes) output.push(b);
      }
    }
    if (pendingInline.length > 0) {
      output.push({ type: 'paragraph', children: pendingInline });
    }
    return output;
  }

  function processInlineContainer(container: AnyNode, depth: number): void {
    const children = container.children;
    if (!Array.isArray(children)) return;
    for (let i = 0; i < children.length; ) {
      const child = children[i];
      if (!child) {
        i++;
        continue;
      }
      if (SKIP_TYPES.has(child.type)) {
        i++;
        continue;
      }
      if (child.type === 'text') {
        const pieces = processText(child, depth);
        if (pieces === null) {
          i++;
        } else {
          const flat: AnyNode[] = [];
          for (const p of pieces) {
            if (p.kind === 'inline') flat.push(...p.nodes);
          }
          children.splice(i, 1, ...flat);
          i += flat.length;
        }
      } else if (Array.isArray(child.children)) {
        processInlineContainer(child, depth);
        i++;
      } else {
        i++;
      }
    }
  }

  function processText(node: AnyNode, depth: number): TextPiece[] | null {
    const value = node.value ?? '';
    const re = embedRegex();
    let match: RegExpExecArray | null;
    let last = 0;
    const pieces: TextPiece[] = [];
    let found = false;

    const pushInline = (n: AnyNode): void => {
      const lastPiece = pieces[pieces.length - 1];
      if (lastPiece && lastPiece.kind === 'inline') lastPiece.nodes.push(n);
      else pieces.push({ kind: 'inline', nodes: [n] });
    };

    const pushBlocks = (nodes: readonly AnyNode[]): void => {
      pieces.push({ kind: 'blocks', nodes: [...nodes] });
    };

    while ((match = re.exec(value)) !== null) {
      found = true;
      const start = match.index;
      const end = start + match[0].length;
      if (start > last) {
        pushInline({ type: 'text', value: value.slice(last, start) });
      }
      const raw = match[1] ?? '';
      const replacement = buildEmbedReplacement(raw, node, depth);
      if (replacement.kind === 'inline') {
        for (const n of replacement.nodes) pushInline(n);
      } else if (replacement.kind === 'blocks') {
        pushBlocks(replacement.nodes);
      }
      last = end;
    }
    if (!found) return null;
    if (last < value.length) {
      pushInline({ type: 'text', value: value.slice(last) });
    }
    return pieces;
  }

  function buildEmbedReplacement(
    raw: string,
    source: AnyNode,
    depth: number,
  ): EmbedReplacement {
    const parsed = parseWikilinkTarget(raw);

    if (parsed.blockId !== undefined) {
      transclusions.push({ raw, status: 'removed-unresolved' });
      warn(raw, source, 'unsupported block-reference embed');
      return { kind: 'drop' };
    }

    const resolution = options.resolve(raw);
    if (!resolution.resolved || resolution.targetId === undefined) {
      transclusions.push({ raw, status: 'removed-unresolved' });
      warn(raw, source, 'unresolved embed');
      return { kind: 'drop' };
    }

    const targetId = resolution.targetId;

    if (resolution.kind === 'attachment') {
      const alt = parsed.alias ?? parsed.target;
      transclusions.push({ raw, status: 'attachment', targetId });
      return {
        kind: 'inline',
        nodes: [
          {
            type: 'image',
            url: options.attachmentUrlFor(targetId),
            alt,
            title: null,
          },
        ],
      };
    }

    if (!options.isPublic(targetId)) {
      transclusions.push({ raw, status: 'removed-private', targetId });
      return { kind: 'drop' };
    }

    if (visited.has(targetId)) {
      transclusions.push({ raw, status: 'removed-cycle', targetId });
      warn(raw, source, 'cyclic embed');
      return { kind: 'drop' };
    }

    if (depth + 1 > maxDepth) {
      transclusions.push({ raw, status: 'removed-depth', targetId });
      warn(raw, source, 'maxDepth exceeded for embed');
      return { kind: 'drop' };
    }

    visited.add(targetId);
    const targetTree = options.mdastFor(targetId) as unknown as AnyNode;
    const targetChildren = Array.isArray(targetTree.children) ? targetTree.children : [];
    const expandedChildren =
      parsed.heading !== undefined
        ? sliceByHeading(targetChildren, parsed.heading)
        : [...targetChildren];

    const synthetic: AnyNode = { type: 'root', children: expandedChildren };
    walkContainer(synthetic, depth + 1);

    transclusions.push({ raw, status: 'expanded-public', targetId });
    return { kind: 'blocks', nodes: synthetic.children ?? [] };
  }

  function sliceByHeading(nodes: readonly AnyNode[], heading: string): AnyNode[] {
    const needle = heading.trim().toLowerCase();
    let startIdx = -1;
    let startLevel = 0;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n) continue;
      if (n.type === 'heading' && typeof n.depth === 'number') {
        if (headingText(n).trim().toLowerCase() === needle) {
          startIdx = i;
          startLevel = n.depth;
          break;
        }
      }
    }
    if (startIdx === -1) return [];

    const result: AnyNode[] = [];
    const startNode = nodes[startIdx];
    if (startNode) result.push(startNode);
    for (let i = startIdx + 1; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n) continue;
      if (n.type === 'heading' && typeof n.depth === 'number' && n.depth <= startLevel) {
        break;
      }
      result.push(n);
    }
    return result;
  }

  function headingText(node: AnyNode): string {
    let acc = '';
    const stack: AnyNode[] = [node];
    while (stack.length > 0) {
      const n = stack.pop();
      if (!n) continue;
      if (typeof n.value === 'string') acc += n.value;
      if (Array.isArray(n.children)) {
        for (let i = n.children.length - 1; i >= 0; i--) {
          const c = n.children[i];
          if (c) stack.push(c);
        }
      }
    }
    return acc;
  }

  function warn(raw: string, source: AnyNode, message: string): void {
    const line = source.position?.start?.line;
    const file = options.sourceFile ?? '<unknown>';
    const locus = line !== undefined ? `${file}:${line}` : file;
    console.warn(`[obpub/transclude] ${locus}: ${message} ![[${raw}]]`);
  }
}
