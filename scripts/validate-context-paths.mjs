#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, resolve as resolvePath } from "node:path";

const REPO_ROOT = process.cwd();

// Same shape as score.py:RE_PATH_REF (ai-readiness-cartography v2), but the
// extension alternation is sorted longest-first so `.json` is not chopped to
// `.js`, `.tsx` is not chopped to `.ts`, and `.jsx` is not chopped to `.js`.
// score.py preserves the original (buggy) order; the bug there is benign
// because E1 still rounds to full points, but CI must not block on false
// positives, so we diverge here.
const RE_PATH_REF =
  /(?<![A-Za-z0-9_/])((?:\.\/|[A-Za-z0-9_]+\/)[A-Za-z0-9_./-]+\.(?:json|jsx|tsx|yaml|toml|html|java|js|ts|md|sql|yml|css|sh|go|rs|kt|rb|php|py))/g;

// Markdown links `[text](url)` get resolved with proper relative-path semantics
// (path.resolve handles `..` correctly). Text inside `[...]` is treated as
// display copy and not validated, which avoids false positives like
// `[adr/0001-...md](../../docs/adr/0001-...md)`.
const RE_MD_LINK = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;
const TRACKED_EXTS = new Set([
  "json", "jsx", "tsx", "yaml", "toml", "html", "java",
  "js", "ts", "md", "sql", "yml", "css", "sh", "go",
  "rs", "kt", "rb", "php", "py",
]);
const RE_ABS_OR_ANCHOR = /^(https?:|mailto:|tel:|ftp:|#|\/)/;

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".astro",
  ".git",
  ".next",
  ".turbo",
  "coverage",
  ".pnpm-store",
]);

// References whose first concrete segment is a build / runtime artifact dir
// (gitignored, recreated by the build) are documentation pointers to outputs
// that intentionally don't exist in the source tree. Treat as valid without
// touching the filesystem so CI doesn't depend on prior build steps.
function refTouchesSkipDir(ref) {
  const segments = ref.split("/").filter((s) => s !== "" && s !== ".");
  for (const seg of segments) {
    if (seg === "..") continue;
    return SKIP_DIRS.has(seg);
  }
  return false;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// Scope mirrors score.py CONTEXT_FILES: CLAUDE.md / AGENTS.md / README.md only.
// We deliberately do not scan docs/**/*.md so the validator's verdict matches
// the rubric scorer's E1 verdict.
function isContextDoc(absPath) {
  const rel = relative(REPO_ROOT, absPath);
  if (rel === "CLAUDE.md" || rel === "AGENTS.md" || rel === "README.md")
    return true;
  if (
    rel.endsWith("/CLAUDE.md") ||
    rel.endsWith("/AGENTS.md") ||
    rel.endsWith("/README.md")
  )
    return true;
  return false;
}

const allFiles = walk(REPO_ROOT);
const contextFiles = allFiles.filter(isContextDoc).sort();

const violations = [];
let totalRefs = 0;

function refExists(ref, fileDir) {
  // 1) Try as written, repo-relative and file-relative (matches score.py).
  if (existsSync(join(REPO_ROOT, ref))) return true;
  if (existsSync(join(fileDir, ref))) return true;
  // 2) The lookbehind in RE_PATH_REF chops a leading `..` or `.` from the
  //    captured ref (e.g. `../../X` → `./../X`, `.github/...` → `github/...`).
  //    Try resolving against the file dir's parent and grand-parent so we
  //    recover the chopped traversal segment without false-flagging.
  if (existsSync(resolvePath(fileDir, "..", ref))) return true;
  if (existsSync(resolvePath(fileDir, "../..", ref))) return true;
  return false;
}

for (const file of contextFiles) {
  const text = readFileSync(file, "utf8");
  const fileDir = dirname(file);
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pass 1 — markdown links: `[text](url)` with proper relative resolution.
    // This is the authoritative pass for clickable links; it uses path.resolve
    // so `..` traversal works correctly and link *text* is ignored entirely.
    const linkRanges = [];
    RE_MD_LINK.lastIndex = 0;
    let mdMatch;
    while ((mdMatch = RE_MD_LINK.exec(line)) !== null) {
      linkRanges.push([mdMatch.index, mdMatch.index + mdMatch[0].length]);
      const url = mdMatch[2].trim();
      if (RE_ABS_OR_ANCHOR.test(url)) continue;
      const cleanUrl = url.replace(/[#?].*$/, "");
      if (!cleanUrl) continue;
      if (refTouchesSkipDir(cleanUrl)) continue;
      const ext = cleanUrl.includes(".") ? cleanUrl.split(".").pop() : "";
      if (!TRACKED_EXTS.has(ext)) continue;
      totalRefs++;
      const target = resolvePath(fileDir, cleanUrl);
      if (!existsSync(target)) {
        violations.push({
          file: relative(REPO_ROOT, file),
          line: i + 1,
          reason: `markdown link target does not exist: ${url}`,
        });
      }
    }

    // Pass 2 — bare path references outside markdown links. This catches
    // inline mentions like `src/foo.ts` in prose. Matches inside link ranges
    // are skipped because pass 1 already handled them precisely.
    RE_PATH_REF.lastIndex = 0;
    let m;
    while ((m = RE_PATH_REF.exec(line)) !== null) {
      const matchStart = m.index;
      const inLink = linkRanges.some(
        ([s, e]) => matchStart >= s && matchStart < e,
      );
      if (inLink) continue;
      const ref = m[1];
      if (refTouchesSkipDir(ref)) continue;
      totalRefs++;
      if (!refExists(ref, fileDir)) {
        violations.push({
          file: relative(REPO_ROOT, file),
          line: i + 1,
          reason: `path reference does not exist: ${ref}`,
        });
      }
    }
  }
}

const claudeDirs = new Set();
const agentsDirs = new Set();
for (const f of contextFiles) {
  if (f.endsWith("/CLAUDE.md") || f === join(REPO_ROOT, "CLAUDE.md"))
    claudeDirs.add(dirname(f));
  if (f.endsWith("/AGENTS.md") || f === join(REPO_ROOT, "AGENTS.md"))
    agentsDirs.add(dirname(f));
}

for (const dir of claudeDirs) {
  const claudePath = join(dir, "CLAUDE.md");
  const agentsPath = join(dir, "AGENTS.md");
  if (!agentsDirs.has(dir)) {
    violations.push({
      file: relative(REPO_ROOT, claudePath),
      line: 0,
      reason: "missing AGENTS.md sibling (Codex CLI mirror required)",
    });
    continue;
  }
  const a = readFileSync(claudePath);
  const b = readFileSync(agentsPath);
  if (!a.equals(b)) {
    violations.push({
      file: relative(REPO_ROOT, claudePath),
      line: 0,
      reason:
        "AGENTS.md content diverges from CLAUDE.md (must be byte-identical)",
    });
  }
}

for (const dir of agentsDirs) {
  if (!claudeDirs.has(dir)) {
    violations.push({
      file: relative(REPO_ROOT, join(dir, "AGENTS.md")),
      line: 0,
      reason:
        "missing CLAUDE.md sibling (CLAUDE.md / AGENTS.md must come as a pair)",
    });
  }
}

if (violations.length === 0) {
  console.log(
    `✓ ${contextFiles.length} context files / ${totalRefs} path references verified`,
  );
  process.exit(0);
}

console.error(`✗ ${violations.length} violation(s) in context documents:\n`);
for (const v of violations) {
  const where = v.line ? `${v.file}:${v.line}` : v.file;
  console.error(`  ${where} — ${v.reason}`);
}
process.exit(1);
