# 26 · L1 Gate Contract and Measured Evidence

Detailed coverage scopes, local hook mechanics, rejection-matrix coverage, and the 2026-11-09 measured verification record offloaded from [AGENTS.md](../AGENTS.md). Current CI slot definitions live in [.github/workflows/quality-slots.yml](../.github/workflows/quality-slots.yml).

## Scope and Coverage Denominators

Both L1 suites enforce >=95% across all four metrics (`statements`, `branches`, `functions`, `lines`) within their configured scopes. Do not lower thresholds, add exclusions to hide new logic, skip/focus tests, or bypass hooks.

| Suite                              | Included Scope                                     | Excluded from Unit Denominator                                                                                                      | Enforcement                                           |
| ---------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| App (`vitest.config.ts`)           | Configured `src/**/*.ts` domain and helper logic   | UI (`.tsx`), wiring (`src/app/**`, `src/components/**`, `src/hooks/**`), and listed domain/service exclusions in `vitest.config.ts` | Root Vitest; `pre-commit`, `pre-push`, CI `l1-unit`   |
| Worker (`worker/vitest.config.ts`) | `worker/lib/**/*.ts` and `worker/db/validation.ts` | HTTP entrypoints (`worker/src/**`), repositories, tests, and `lib/version.ts`                                                       | Worker Vitest; `pre-commit`, `pre-push`, CI `l1-unit` |

## Local Hook Mechanics

Hooks are installed via `bun run prepare` (`core.hooksPath=.husky/_`).

- **`pre-commit`** (`.husky/pre-commit` -> `git show :scripts/pre-commit.py`):
  - Exports the staged Git index (`git checkout-index --all --force`) into a temporary snapshot with symlinked `node_modules` and `worker/node_modules`; never stages or rewrites project files.
  - Rejects tracked private environment files (`.env*` other than `.env.example`/`.env.test`, and `worker/.dev.vars`).
  - Runs `scripts/pre-commit.py --self-test`, then executes `lint`, `typecheck`, `app tests and coverage`, and `worker tests and coverage` in parallel with `--allowOnly=false` and zero skipped tests allowed.
  - Coverage outputs, logs, and caches stay in temporary directories and are cleaned up on exit.
  - Historical note: former G1 static lanes (`typecheck` + `lint`) were merged into the unified L1 pre-commit contract on 2026-09-21; CI now models all 12 `system1-quality` slots in `.github/workflows/quality-slots.yml`.
- **`pre-push`** (`.husky/pre-push` -> `scripts/prepush-parallel.sh`):
  - Runs app coverage, worker coverage, Biome lint, `osv-scanner` across both `bun.lock` and `worker/bun.lock`, redacted `gitleaks` on `origin/main..HEAD` (does not scan arbitrary pushed refs from stdin), and `bun run test:e2e` in parallel.
  - Target timing: index-only unified L1 under 30 seconds (verified on the reference cloud-agent image on 2026-11-09 with frozen locks in root and `worker/`); pushed-ref integration and dependency scans under 3 minutes remain workflow targets.

## L1 Measured Evidence (2026-11-09)

Recorded on `main` lineage after `bun install --frozen-lockfile`, `bun install --cwd worker --frozen-lockfile`, and `bun run prepare` (`core.hooksPath=.husky/_`).

| Check               | Command                                        | Exit | Wall time                               |
| ------------------- | ---------------------------------------------- | ---- | --------------------------------------- |
| Healthy hook (cold) | `sh .husky/pre-commit`                         | 0    | 23.59s                                  |
| Healthy hook (warm) | `sh .husky/pre-commit`                         | 0    | 22.77s                                  |
| Helper invariants   | `python3 -B scripts/pre-commit.py --self-test` | 0    | under 1s                                |
| Contract probes     | `bun run test:l1-gate`                         | 0    | under 20s (disposable clone; cleans up) |

Four-metric coverage from a healthy cold run (index snapshot, Vitest `json-summary` parsed by `scripts/pre-commit.py`):

| Suite                                    | statements | branches | functions | lines  |
| ---------------------------------------- | ---------- | -------- | --------- | ------ |
| App (`vitest.config.ts` scope)           | 98.44%     | 96.44%   | 100.00%   | 99.51% |
| Worker (`worker/vitest.config.ts` scope) | 99.00%     | 97.71%   | 100.00%   | 99.77% |

Parallel lanes in the healthy cold run: `lint` 0, `typecheck` 0, `worker tests and coverage` 0, `app tests and coverage` 0; final line `L1 index snapshot passed in 23.22s`.

## Contract Probes (`bun run test:l1-gate` / CI `l1-hook-verify`)

`bun run test:l1-gate` exercises real Husky on an isolated `git clone` with symlinked `node_modules` via fast fail-fast contract probes (full 4-metric coverage floor enforcement is verified by `l1-unit` and `scripts/pre-commit.py --self-test`):

- `scripts/pre-commit.py --self-test` (missing/empty/skipped test reports, missing/malformed/below-floor coverage across all 4 metrics, dependency symlinks, process-group reaper)
- `scripts/pre-commit.py --cleanup-test` (descendant process-group cleanup on leader exit)
- Real Husky `git commit` with staged Biome lint error and clean worktree (verifies fail-fast rejection, worktree preservation, and staged index retention)
- Missing `bun` on `PATH`
- `NOHEIR_L1_TIMEOUT_SEC` budget enforcement
- `SIGINT` interruption and unchanged local `core.hooksPath`
