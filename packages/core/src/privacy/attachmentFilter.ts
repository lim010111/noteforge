/**
 * Compute the public-referenced closure of attachment ids for the build output.
 *
 * privacy-first: an attachment is included only when at least one PUBLIC note references
 * it AND its extension is on the caller-supplied allowlist. Attachments referenced
 * exclusively by private notes never leave this filter — their ids do not reach `dist/`.
 *
 * Pure calculation — no filesystem I/O. Actual copy decisions live in the build stage
 * (astro-integration / CLI), which consumes `included` verbatim.
 *
 * Exclusion policy:
 *   - `disallowed-extension` takes precedence over `no-public-referrer`. The extension
 *     rule is a blanket safety gate (binary executables, script files), so it is the
 *     more conservative reason when both apply.
 *   - `excluded` entries carry the attachment id only. `sourceNoteId` deliberately does
 *     not propagate here so diagnostics cannot leak the existence of private notes.
 *
 * Output order:
 *   - `included` is a Set (unordered).
 *   - `excluded` is sorted lexicographically by id for stable snapshots and audits.
 */

import * as path from 'node:path';

export interface AttachmentRef {
  readonly id: string;
  readonly sourceNoteId: string;
}

export interface BuildAttachmentClosureOptions {
  readonly publicNoteIds: ReadonlySet<string>;
  readonly allReferences: readonly AttachmentRef[];
  readonly allowedExtensions: readonly string[];
}

export interface AttachmentClosure {
  readonly included: ReadonlySet<string>;
  readonly excluded: readonly ExcludedAttachment[];
}

export type ExcludeReason = 'no-public-referrer' | 'disallowed-extension';

export interface ExcludedAttachment {
  readonly id: string;
  readonly reason: ExcludeReason;
}

export function buildAttachmentClosure(
  options: BuildAttachmentClosureOptions,
): AttachmentClosure {
  const { publicNoteIds, allReferences, allowedExtensions } = options;

  const allowed = new Set<string>();
  for (const ext of allowedExtensions) allowed.add(ext.toLowerCase());

  const seen = new Set<string>();
  const hasPublicReferrer = new Map<string, boolean>();

  for (const ref of allReferences) {
    seen.add(ref.id);
    const prev = hasPublicReferrer.get(ref.id) ?? false;
    hasPublicReferrer.set(ref.id, prev || publicNoteIds.has(ref.sourceNoteId));
  }

  const included = new Set<string>();
  const excluded: ExcludedAttachment[] = [];

  for (const id of seen) {
    const ext = path.posix.extname(id).toLowerCase();
    const extensionOk = ext.length > 0 && allowed.has(ext);
    if (!extensionOk) {
      excluded.push({ id, reason: 'disallowed-extension' });
      continue;
    }
    if (!(hasPublicReferrer.get(id) ?? false)) {
      excluded.push({ id, reason: 'no-public-referrer' });
      continue;
    }
    included.add(id);
  }

  excluded.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { included, excluded };
}
