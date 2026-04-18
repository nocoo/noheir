# Deferred optimization ideas for git hooks

Final optimized state: best total ~1.25s (vs 7.55s baseline = -83%). Bottleneck distribution:
- pre-commit (~0.65-0.95s, parallel max of): tests=0.2s, lint=0.6s, tsc --build=0.6-0.85s
- pre-push (~0.6s, parallel max of): tests=0.2s, lint=0.6s

Applied optimizations (already shipped):
1. **eslint --cache** — lint dropped from ~4s to ~0.6s warm.
2. **Parallel pre-commit** — tests+lint+typecheck run concurrently via shell `&` backgrounding (`scripts/precommit-parallel.sh`).
3. **Parallel pre-push** — tests+lint (and optional osv-scanner/gitleaks/e2e) run concurrently (`scripts/prepush-parallel.sh`).
4. **Replaced lint-staged with full cached eslint** in pre-commit — cached full lint is faster and broader than lint-staged invoking eslint without cache.
5. **Direct binary invocation** — `./node_modules/.bin/eslint` and `./node_modules/.bin/tsc` instead of `bun run X` to skip package.json script lookup.
6. **`tsc --build`** instead of `tsc --noEmit` — incremental-aware, lets tsc skip work entirely on no-op rebuilds (~50ms vs 1s).


- **typecheck (~0.85s warm)** — single-threaded `tsc --noEmit`. To speed up:
  - Project references / `tsc --build` could allow incremental + parallel (but project is a single tsconfig today).
  - Move long-running `tsc --noEmit --watch` daemon and have pre-commit just check status (e.g. via `tsc-watch` or VS Code task).
  - Replace with looser `bun run --check` style? Bun doesn't full-typecheck; would lose safety.
- **bun runtime startup (~0.05-0.1s × N processes)** — dominates when work is tiny. A persistent daemon (long-lived bun process listening on a unix socket) could remove startup cost entirely.
- **Coverage instrumentation** — currently runs in both pre-commit and pre-push. ~30ms cost is negligible; not worth changing.
- **Lint-staged removal** — already done. Full cached `eslint .` is faster than lint-staged invoking eslint without cache. If we ever need auto-fix-on-commit, reintroduce lint-staged but pass `--cache --cache-location node_modules/.cache/eslint/`.
- **Parallel orchestrator in single bun process (parallel-runner.ts)** — tried, regressed due to high variance (occasional 4s spikes). Stick with shell `&` backgrounding which is more stable.
- **Test sharding** — bun test is already 0.2s warm; not worth sharding.
- **Skip pre-push tests if pre-commit passed recently** — could write `.git/hooks-state` with last-passed timestamp + commit SHA, skip identical work in pre-push if HEAD unchanged. Risk: stale state. ~0.2s savings only.
- **eslint --concurrency** — tested off/auto/2/4. Concurrency >1 hurts (worker startup ~0.5s overhead vs ~0.6s warm single-thread). Stay with default off.
- **@typescript/native-preview (tsgo)** — TS native compiler is much faster but requires adding a dep + rewiring scripts. Out of scope for hook-only optimization, but would be the biggest single win if adopted project-wide.
- **⚠️ Latent bug in scripts/check-coverage.ts** — it captures bun test's stdout but bun emits the coverage table to stderr; so it always falls into the "No coverage data found. Skipping" branch. Effective coverage threshold = 0%. Fixing this would surface that current line coverage is 85.9% (below the 90% threshold), causing builds to fail. Out of scope for hook-perf optimization but should be addressed separately by either lowering THRESHOLD or adding tests.
