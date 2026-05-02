# 0004. Build Locally — No CI Auto-Build for apps/blog

## Status
Accepted · 2025-Q4

## Context
정적 사이트 SSG 의 일반적 패턴은 GitHub Actions / Cloudflare Pages 의 *서버* 빌드다. 하지만 이 프로젝트는 vault 가 레포 밖에 있다 — `apps/blog/obsidian-blog.config.ts` 의 `vaults[0].path` 는 사용자의 로컬 절대 경로 (`/Users/.../Obsidian` 같은) 다. 이 경로는 GitHub Actions runner 에 존재하지 않는다.

선택지:

- **Vault 를 레포에 커밋** → privacy 모델 위반. 발행 안 한 노트도 git history 에 남는다.
- **CI 에 vault 를 secret 으로 mount** → 가능은 하지만 vault 누출 risk + 이상한 워크플로우.
- **빌드는 사용자 머신, 결과물(`dist/`)만 호스트로 업로드** → 책임 분리.

## Decision
- `apps/blog` 의 빌드는 **항상 사용자 로컬에서** 실행한다.
- CI (`.github/workflows/ci.yml`) 는 typecheck / lint / test / cli build 만 수행. `pnpm --filter blog build` 는 의도적으로 CI step 에 포함시키지 않는다.
- 호스트 업로드는 `wrangler pages deploy apps/blog/dist` 와 같이 명시적 명령으로. CI 에서의 자동 deploy 도 미지원.

## Consequences
- **+** vault 가 git / CI / 외부 서비스 어디로도 새지 않는다. privacy 모델과 일관.
- **+** 사용자가 빌드 시점에 어떤 노트가 발행되는지 직접 확인 가능 (`pnpm obpub status` / dev 서버).
- **−** "git push 하면 자동 배포" 워크플로우를 기대하는 사용자에게 마찰. README / docs/DEPLOY.md 에서 명확히 알려야 한다.
- **−** CI 에서는 *전체 빌드 검증* 대신 *유닛 테스트 + cli 빌드 + audit 룰* 로만 회귀를 잡는다.

## Related
- [docs/DEPLOY.md](../DEPLOY.md) §9 — 호스트별 업로드 명령.
- CI 구성: [.github/workflows/ci.yml](../../.github/workflows/ci.yml).
- env 검증: `apps/blog/obsidian-blog.config.ts` 가 `OBPUB_VAULT_PATH` 부재 시 빌드 거부.
