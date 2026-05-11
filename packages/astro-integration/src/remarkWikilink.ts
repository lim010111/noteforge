/**
 * Thin bridge between unified's remark pipeline and `@noteforge/core`'s privacy-aware
 * wikilink rewriter. All AST decisions live in core; this module only:
 *   1. forwards the call with caller-injected resolve / isPublic / hrefFor, and
 *   2. surfaces unresolved-link observations to an Astro-side logger via onWarning.
 *
 * Why this shape: the "what is public?" verdict must stay centralized in
 * `packages/core/src/privacy/`. Re-deriving public/private here would split the
 * contract and open a leak vector (plugin says "ok", core says "private", or
 * vice versa). So this file never re-implements AST rewriting — it delegates.
 */

import type { Root } from 'mdast';
import { rewriteWikilinks } from '@noteforge/core';

export interface RemarkWikilinkOptions {
  /** core의 resolveWikilink 래퍼. integration/loader가 vault 인덱스를 클로저로 주입. */
  resolve: (raw: string) => { resolved: boolean; targetId?: string };
  /** 결정은 `privacy/classify`에서 내린 값을 그대로 통과. plugin 내부 재계산 금지. */
  isPublic: (targetId: string) => boolean;
  /** `hrefFor(targetId)` → `/slug`, `hrefFor(targetId, heading)` → `/slug#anchor`. */
  hrefFor: (targetId: string, heading?: string) => string;
  /** 처리 중인 파일 식별자 (warning 메시지에 포함). */
  sourceFile?: string;
  /** unresolved-link warning을 Astro logger로 브리지하기 위한 콜백. */
  onWarning?: (warning: {
    sourceFile?: string;
    raw: string;
    message: string;
  }) => void;
}

export function remarkWikilink(
  options: RemarkWikilinkOptions,
): (tree: Root) => void {
  return (tree: Root): void => {
    const { outgoing } = rewriteWikilinks({
      tree,
      sourceFile: options.sourceFile,
      resolve: options.resolve,
      isPublic: options.isPublic,
      hrefFor: options.hrefFor,
    });

    const onWarning = options.onWarning;
    if (onWarning === undefined) return;

    for (const link of outgoing) {
      if (link.status === 'unresolved') {
        onWarning({
          sourceFile: options.sourceFile,
          raw: link.raw,
          message: `unresolved wikilink [[${link.raw}]]`,
        });
      }
    }
  };
}
