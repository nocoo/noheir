# Deferred optimization ideas for git hooks

Currently at ~1.6s total (pre-commit ~1.0s + pre-push ~0.6s warm). Bottlenecks:

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
