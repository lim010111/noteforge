export interface ObpubInputErrorOptions {
  readonly filePath?: string;
  readonly line?: number;
  readonly column?: number;
  readonly cause?: unknown;
}

export class ObpubInputError extends Error {
  readonly filePath: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;
  readonly reason: string;

  constructor(reason: string, opts?: ObpubInputErrorOptions) {
    super(
      formatInputErrorMessage(reason, opts),
      opts?.cause !== undefined ? { cause: opts.cause } : undefined,
    );
    this.name = 'ObpubInputError';
    this.filePath = opts?.filePath;
    this.line = opts?.line;
    this.column = opts?.line !== undefined ? opts.column : undefined;
    this.reason = reason;
  }
}

function formatInputErrorMessage(
  reason: string,
  opts: ObpubInputErrorOptions | undefined,
): string {
  const filePath = opts?.filePath;
  if (filePath === undefined || filePath.length === 0) return reason;
  const line = opts?.line;
  if (line === undefined) return `${filePath}: ${reason}`;
  const column = opts?.column;
  if (column === undefined) return `${filePath}:${line}: ${reason}`;
  return `${filePath}:${line}:${column}: ${reason}`;
}
