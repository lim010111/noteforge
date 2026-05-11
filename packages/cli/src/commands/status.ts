import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  classify,
  getClassifyRule,
  ObpubConfigError,
  parseNote,
  type ObpubConfig,
} from '@noteforge/core';
import { ObpubInputError } from '../lib/errors.ts';

export interface StatusResult {
  readonly relativePath: string;
  readonly verdict: 'PUBLIC' | 'PRIVATE';
  readonly reason: string;
  readonly tripwireFired: boolean;
}

export async function runStatus(filePath: string, config: ObpubConfig): Promise<StatusResult> {
  const vault = config.vaults[0];
  if (vault === undefined) {
    throw new ObpubConfigError('config has no vaults; cannot resolve note path');
  }

  const vaultRoot = path.resolve(vault.path);
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(vaultRoot, filePath);

  const relWithSep = path.relative(vaultRoot, absPath);
  if (relWithSep.startsWith('..') || path.isAbsolute(relWithSep)) {
    throw new ObpubInputError(
      `file is outside vault root ${vaultRoot}`,
      { filePath: absPath, line: 1 },
    );
  }

  if (path.extname(absPath).toLowerCase() !== '.md') {
    throw new ObpubInputError(
      `only .md files can be classified, got extension '${path.extname(absPath)}'`,
      { filePath: absPath, line: 1 },
    );
  }

  const relativePath = relWithSep.split(path.sep).join('/');

  let content: string;
  try {
    content = await fs.readFile(absPath, 'utf8');
  } catch (cause) {
    if (isNodeENOENT(cause)) {
      throw new ObpubInputError('file not found', {
        filePath: absPath,
        line: 1,
        cause,
      });
    }
    throw cause;
  }

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

function isNodeENOENT(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}
