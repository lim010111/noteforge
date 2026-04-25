import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseNote } from '@obpub/core/discover/parseNote';
import { classify } from '@obpub/core/privacy/classify';
import { getClassifyRule, type ObpubConfig } from '@obpub/core/config';

export interface StatusResult {
  readonly relativePath: string;
  readonly verdict: 'PUBLIC' | 'PRIVATE';
  readonly reason: string;
  readonly tripwireFired: boolean;
}

export async function runStatus(filePath: string, config: ObpubConfig): Promise<StatusResult> {
  const vault = config.vaults[0];
  if (vault === undefined) {
    throw new Error('config has no vaults; cannot resolve note path');
  }

  const vaultRoot = path.resolve(vault.path);
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(vaultRoot, filePath);

  const relWithSep = path.relative(vaultRoot, absPath);
  if (relWithSep.startsWith('..') || path.isAbsolute(relWithSep)) {
    throw new Error(
      `file is outside vault root: ${absPath} is not under ${vaultRoot}`,
    );
  }

  if (path.extname(absPath).toLowerCase() !== '.md') {
    throw new Error(`only .md files can be classified, got: ${absPath}`);
  }

  const relativePath = relWithSep.split(path.sep).join('/');

  const content = await fs.readFile(absPath, 'utf8');

  const note = parseNote({
    path: absPath,
    vaultId: vault.id,
    relativePath,
    content,
  });

  const rule = getClassifyRule(config, vault.id);
  const classification = classify(note, rule);

  return {
    relativePath,
    verdict: classification.isPublic ? 'PUBLIC' : 'PRIVATE',
    reason: classification.reason,
    tripwireFired: classification.tripwireFired,
  };
}

export function formatStatusLine(result: StatusResult): string {
  const tripwire = result.tripwireFired ? ' [TRIPWIRE]' : '';
  return `${result.relativePath} → ${result.verdict}${tripwire} (reason: ${result.reason})`;
}

export function formatStatusJson(result: StatusResult): string {
  return JSON.stringify(result);
}
