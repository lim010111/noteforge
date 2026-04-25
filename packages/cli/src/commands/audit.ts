import * as path from 'node:path';
import { runCorePipeline, type PipelineResult } from '@noteforge/core/pipeline';
import type { ObpubConfig } from '@noteforge/core/config';
import {
  runAuditWithMetrics,
  type AuditInput,
  type AuditOutcome,
} from '../lib/audit/checks.ts';

export type { AuditViolation, AuditOutcome } from '../lib/audit/checks.ts';

export interface AuditOptions {
  /** Absolute path of the dist directory. Defaults to `<cwd>/dist`. */
  readonly distDir?: string;
  /** When true, also fire weak-signal rules. */
  readonly strict?: boolean;
}

/**
 * Independent post-build privacy audit.
 *
 * 1. Runs the core pipeline once to derive what the build *should* expose
 *    (publicSlugs, privateNoteTitles, attachment closure). Audit never re-runs
 *    classification — it is a verifier, not a classifier.
 * 2. Walks the on-disk dist directory and applies six (+ one strict-only) rules.
 * 3. Returns the structured outcome. The CLI binary is responsible for printing
 *    the report and translating violations.length > 0 into a non-zero exit code.
 */
export async function runAudit(
  config: ObpubConfig,
  opts: AuditOptions = {},
): Promise<AuditOutcome> {
  const distDir = path.resolve(opts.distDir ?? path.join(process.cwd(), 'dist'));
  const pipeline = await runCorePipeline(config);

  const input: AuditInput = {
    distDir,
    publicSlugs: pipeline.publicSlugs,
    privateTitles: pipeline.privateNoteTitles,
    privateAttachmentBasenames: collectPrivateAttachmentBasenames(pipeline),
    frontmatterAllowlist: new Set(config.publishing.frontmatterAllowlist),
    tagBlocklist: new Set(config.publishing.tagBlocklist),
    strict: opts.strict ?? false,
  };

  return runAuditWithMetrics(input);
}

function collectPrivateAttachmentBasenames(result: PipelineResult): ReadonlySet<string> {
  const out = new Set<string>();
  for (const rel of result.allAttachments) {
    if (result.attachmentClosure.has(rel)) continue;
    out.add(path.posix.basename(rel).toLowerCase());
  }
  return out;
}
