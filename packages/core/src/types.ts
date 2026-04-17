export type Tag = string;

export interface ParsedNote {
  /** Absolute filesystem path. */
  readonly path: string;
  /** Config vault id this note belongs to. */
  readonly vaultId: string;
  /** Path inside the vault, POSIX-separated, no leading slash. E.g. "projects/foo.md". */
  readonly relativePath: string;
  /** Parsed YAML frontmatter object. */
  readonly frontmatter: Readonly<Record<string, unknown>>;
  /** Normalized tags (no leading `#`, lowercased, nested as "a/b"). */
  readonly tags: readonly Tag[];
  /** Note body markdown AFTER Obsidian `%%...%%` comments have been stripped. */
  readonly body: string;
}

export interface ClassifyRule {
  /** Frontmatter key that signals public. Default `"public"`. */
  readonly frontmatterKey: string;
  /** Tag name (no `#`) that signals public. Default `"public"`. */
  readonly publicTag: string;
  /** Glob patterns where any match forces the note private regardless of markers. */
  readonly tripwirePaths: readonly string[];
  /** Escape hatch: bypass tripwire. Use only when you know what you're doing. */
  readonly unsafeAllowPrivateFolder: boolean;
}

export interface Classification {
  /** Final publishability verdict. */
  readonly isPublic: boolean;
  /** Human-readable reason, suitable for `obpub status` output. */
  readonly reason: string;
  /** True when a tripwire rule rejected a note that would otherwise be public. */
  readonly tripwireFired: boolean;
}
