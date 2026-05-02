# Pull request

## Summary
<!-- 1-3 bullets — what changed, what user impact (privacy contract / build / docs). -->

## Privacy checklist
<!-- Required for any PR touching packages/core/src/privacy/** or fixtures/vault-mixed/. -->
- [ ] Decision logic remains in `packages/core/src/privacy/classify.ts` only — no re-derivation in adapters / themes / app.
- [ ] frontmatter allowlist (`packages/core/src/privacy/frontmatterFilter.ts`) is unchanged, OR change is justified and accompanied by ADR + canary verification.
- [ ] Build + audit pass: `pnpm --filter blog build && pnpm obpub audit`.
- [ ] Canaries 0회 등장 검증: `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`, `FOLDER_TREE_DO_NOT_LEAK_8a4f2`.

## Verification
- [ ] `pnpm -r typecheck && pnpm lint && pnpm test` 통과.
- [ ] `pnpm validate:context-paths` 통과 (CLAUDE.md / AGENTS.md 짝 + path 무결성).
- [ ] 변경 영향이 한 모듈을 넘으면 docs/ARCHITECTURE.md 또는 관련 모듈 CLAUDE.md 업데이트.

## Notes
<!-- 결정 근거, trade-off, 향후 follow-up. -->
