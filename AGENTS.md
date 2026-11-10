# Noheir

Personal finance application for cash flow, capital units, products and availability planning.
Profile: ts-worker-web.
Direction: [README.md](README.md), [runbook](docs/04-run.md), [operations/UI constraints](docs/22-agent-operations.md).

## Sources of Truth

This handbook is the project contract; hooks, CI and configuration enforce it.
Raise weaker enforcement to the contract. Maintain project rules only here.

| Fact                           | Where                                                       |
| ------------------------------ | ----------------------------------------------------------- |
| Human docs                     | [README.md](README.md), [docs/README.md](docs/README.md)    |
| Scoped Bearer REST (`/api/v1`) | [docs/api.md](docs/api.md), live `GET /api/v1/openapi.json` |
| Version                        | Root `package.json`, imported by UI and Worker              |
| Enforcement                    | `.husky/`, parallel hook scripts, CI, root/Worker Vitest    |
| Runtime configuration          | `wrangler.jsonc`, `vite.config.ts`, `.env.example`          |
| Migration and cutover evidence | [Migration plan](docs/23-workers-migration.md)              |
| Accidents                      | [Retrospective.md](Retrospective.md)                        |

## Project Invariants

- One native Hono Worker serves Vite assets, human business APIs and scoped Bearer REST at `/api/v1` using the existing D1 binding. No internal model inference, model credentials, MCP/OAuth server, Next.js runtime or SQL-over-HTTP gateway remains.
- Verify Access signature, issuer, audience and expiry. Normalize verified email and resolve exactly one existing `users.id`; never replace financial ownership keys with Access `sub`. Unknown or ambiguous users fail closed.
- Run the Worker before static assets. Disable workers.dev and preview URLs. Demo/E2E use launcher-issued signed fixture identities with controlled JWKS; no environment or loopback host bypasses verification.
- Browser mutations require same origin. Derive ownership on the server, ignoring user-id and internal-action headers and ownership fields in JSON.
- Human-only API key/site administration never accepts Bearer credentials. Machine routes never fall back to Access. Keys are hash-only, expiring, revocable and explicitly scoped; read/write/delete grants are independent. No public interface contains `agent` terminology.
- Any change to `/api/v1` routes, query/body schemas, limits, scopes or stable problem `code` values must update [docs/api.md](docs/api.md) in the same PR; `worker/tests/api-docs.test.ts` fails if a registered machine route is missing from that file.
- Shared financial mutations require snapshot `If-Match`; machine mutations additionally require `Idempotency-Key`. Preserve atomic financial writes, actor audit and financial revisions. Reports have separate revisions, immutable creator/external identity and durable creation receipts after deletion.
- Keep report Markdown inert: no raw HTML or remote images. Evidence references require source read grants and same-owner IDs; author/model labels are unverified text. Only external tools perform inference.
- CSV transaction import replaces the selected user's whole year of income and expense; transfer import is separate. Validate all rows before a single atomic D1 batch. Keep JSON parameters below D1 limits using chunks; never delete before validation or in a separate request.
- JSON export includes more than restore. Restore replaces only transactions/transfers across all years. Never claim a complete disaster-recovery backup; use a private D1 export for that purpose.
- Currency is integer cents. Calendar math uses Asia/Shanghai helpers across writes and fixtures; recurring state end timestamps retain the existing UTC convention. Parameterize SQLite syntax.
- New writes use ISO CNY/USD/HKD. Aggregates never mix currencies or perform implicit FX; legacy browser summaries explicitly use CNY. Missing investment history and balance anchors remain unknown, not zero.
- Availability derives from the latest invest log or explicit override, not `start_date`; missing invest history stays unknown. Established units with a product create the proper invest log; planned units do not.
- Domain labels use shared colored-badge wrappers. Preserve available/soon/locked colors and the full mapping in [operations/UI constraints](docs/22-agent-operations.md).
- Retain the existing D1 database. Retiring old Noheir infrastructure must not disturb shared Caddy/mTLS, the shared `edge` network or other VPS applications.

## Stack / Layout

| Component | Choice                                                                                    |
| --------- | ----------------------------------------------------------------------------------------- |
| Web       | Vite, React, React Router data loaders; `src/app/`, `src/routes.tsx`                      |
| Domain/UI | `src/domain/`, `src/components/`; preserve MVVM and Basalt controls                       |
| API/auth  | Hono, jose/Access, scoped Bearer REST; `worker/src/`, shared `src/domain/api-contract.ts` |
| Data      | Direct request-scoped D1, Drizzle; `worker/db/`, canonical `worker/db/migrations/`        |
| Tooling   | Bun 1.4.2 / Node 26.12.1 in CI, TypeScript 7, Biome, Vitest/Playwright                    |

## Commands

Run from root. Root and Worker remain separate dependency packages for tests.

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run prepare
bun run dev
bun run dev --mode e2e
bun run build
bun run dev:built
bun run demo:reset
bun run test:environments
bun run test:environments:browser
bun run demo:capture
bun run typecheck
bun run lint
bun run build
bun run test:coverage
bun run --cwd worker test:coverage
bun run test:e2e
bunx playwright install chromium
bun run test:e2e:bdd
bun run deploy:check
```

Development uses native local D1 and signed synthetic identities. Open
`https://noheir.dev.hexly.ai` in Chrome after `bun run dev`. The local-only
`Demo | E2E | Prod` control uses app-specific preferences; manual E2E remains
switchable, while dedicated automated entrypoints enforce a separate server lock.
Demo persists in `.wrangler/environments/demo`; E2E uses owned temporary state.
The old `.wrangler/state` remains untouched and is not an active entrypoint.
Stop port 7004 before `bun run demo:reset`; reset validates ownership and never
imports or deletes old development data. Build before standalone HTTP/browser tests.
Browser checks and captures share reserved port 27004 and run sequentially.

See [environment architecture and feature matrix](docs/24-local-environments.md)
for exact startup, reset, capture, authentication and verification details.
`bun run prod:login` and `bun run dev --mode prod` are explicit real operations;
automated tests never load production credentials. Local proxy targets are fixed,
all business requests are instance-bound, and stale instances return 410.
Do not replace signed auth with local email, mode or client-header bypasses.

Worker unit tests need a working
`better-sqlite3` native module. Root typecheck includes the Worker lane. Keep
Workers global types out of the browser compiler: DOM and Worker element types
conflict; use the scoped D1 aliases in `src/worker-types.d.ts`.

## Verification

6DQ = unified L1 (absorbing former G1) + L2/L3 + G2 + D1. Status describes enforcement, not a claim of complete
coverage. Both L1 suites require statements/branches/functions/lines each >=95%
in their configured scope. Do not lower thresholds, add exclusions to hide new
logic, skip/focus tests or bypass hooks.

Flaky automated tests are worse than no test: stabilize them when found, or delete
them if they cannot be made deterministic (for example, prove stability with
`bunx playwright test <spec> --repeat-each=30` locally with zero failures). Never
add retries, skips, or looser assertions solely to mask timing or layout races.

| Piece                                  | Requirement and scope                                                                                                                                          | Status          | Evidence                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| L1 — complete unified contract         | All four coverage metrics >=95% plus strict static lanes on an installed index-snapshot hook with proven rejection, under 30s                                  | enforced        | See **L1 measured evidence** below; automated rejection matrix in `bun run test:l1-gate` (CI job `l1-hook-verify`) |
| L1 subcheck — App coverage             | Four metrics >=95% in configured TypeScript logic; UI, wiring and listed domain/service exclusions are outside the coverage denominator                        | enforced        | Root Vitest; pre-commit/pre-push/CI                                                                                |
| L1 subcheck — Worker coverage          | Four metrics >=95% for `worker/lib/**/*.ts` and `db/validation.ts`; HTTP entrypoints/repositories outside this unit denominator                                | enforced        | Worker Vitest; pre-commit/pre-push/CI                                                                              |
| L2                                     | Native Worker real HTTP with SQLite, signed JWT failures, scoped Bearer isolation, CRUD, idempotency/CAS, state races, annual import rollback and backup scope | enforced        | `scripts/run-e2e.ts`; pre-push/CI; not a complete endpoint/method coverage claim                                   |
| L3                                     | Authenticated route rendering and financial/import/backup/error workflows on built assets                                                                      | enforced        | Playwright CI; acceptance evidence in migration plan                                                               |
| L1 subcheck — static lanes (former G1) | Both type lanes; zero-warning/error Biome                                                                                                                      | enforced        | Root typecheck and lint; pre-commit/CI; pre-commit runs these lanes from the index snapshot                        |
| G2                                     | Required OSV on both locks; redacted gitleaks                                                                                                                  | enforced        | Pre-push and reusable CI security gates                                                                            |
| D1                                     | Per-run local state, marker validation before fixture writes/cleanup, reserved ports, controlled JWKS                                                          | enforced        | `scripts/test-fixture.ts`, HTTP/browser runners                                                                    |
| Build                                  | Vite client/Worker bundles and deployment dry-run                                                                                                              | enforced/manual | Build in CI preparation; dry-run during release validation                                                         |
| Docs                                   | Operations, limitations and release evidence aligned                                                                                                           | manual          | README, handbook and numbered docs                                                                                 |

Pre-commit exports the index into a temporary source snapshot; it does not stage or
rewrite project files. Coverage outputs, logs and caches are temporary. Pre-push secrets
scan `origin/main..HEAD`, not arbitrary pushed refs from stdin. Index-only unified L1
under 30 seconds is verified on the reference cloud-agent image (2026-11-09, frozen
locks after `bun install --frozen-lockfile` in root and `worker/`). Pushed-ref L2/G2
under three minutes remain workflow targets. Explicitly stage logical commits only. The
owner merged former G1 into L1 on 2026-09-21; the framework keeps the 6DQ name.

### L1 measured evidence (2026-11-09)

Recorded on `main` lineage after `bun install --frozen-lockfile`, `bun install --cwd
worker --frozen-lockfile`, and `bun run prepare` (`core.hooksPath=.husky/_`).

| Check               | Command                                        | Exit | Wall time                              |
| ------------------- | ---------------------------------------------- | ---- | -------------------------------------- |
| Healthy hook (cold) | `sh .husky/pre-commit`                         | 0    | 23.59s                                 |
| Healthy hook (warm) | `sh .husky/pre-commit`                         | 0    | 22.77s                                 |
| Helper invariants   | `python3 -B scripts/pre-commit.py --self-test` | 0    | under 1s                               |
| Rejection matrix    | `bun run test:l1-gate`                         | 0    | about 8m (disposable clone; cleans up) |

Four-metric coverage from a healthy cold run (index snapshot, Vitest `json-summary` parsed
by `scripts/pre-commit.py`):

| Suite                                    | statements | branches | functions | lines  |
| ---------------------------------------- | ---------- | -------- | --------- | ------ |
| App (`vitest.config.ts` scope)           | 98.44%     | 96.44%   | 100.00%   | 99.51% |
| Worker (`worker/vitest.config.ts` scope) | 99.00%     | 97.71%   | 100.00%   | 99.77% |

Parallel lanes in the healthy hook (same cold run): `lint` 0, `typecheck` 0, `worker tests
and coverage` 0, `app tests and coverage` 0; final line `L1 index snapshot passed in
23.22s`.

`bun run test:l1-gate` exercises real Husky on an isolated `git clone` with symlinked
`node_modules`: healthy index and commit; rejects failing UT; each coverage metric floor
(8 vitest threshold probes); Biome error and warning; `tsc` error; `.only` and `skip`;
staged-bad/unstaged-good index mismatch; parallel multi-lane failure; empty suite; missing
`coverage-summary.json`; missing `bun`; `NOHEIR_L1_TIMEOUT_SEC` budget; SIGINT
interruption. Malformed or below-floor reports are additionally covered by
`pre-commit.py --self-test`.

## Resources / Isolation

| Purpose           | Port / state                                 | Policy                                           |
| ----------------- | -------------------------------------------- | ------------------------------------------------ |
| Demo / manual E2E | 7004 / persistent Demo or owned temporary D1 | Caddy HTTPS; signed fixture identity; switchable |
| L2                | 17004 / per-run temporary SQLite             | Real Worker HTTP; signed synthetic identities    |
| L3                | 27004 / independent temporary SQLite         | Built client, real Worker and browser fixtures   |

Never create remote test resources, seed production, or reuse daily-development
data. A `_test_marker` and matching private directory marker guard fixture writes
and cleanup. HTTP/browser runners refuse occupied ports; Playwright does not reuse
an existing server. Test JWKS is intercepted locally; production Access is not a
test dependency.

## Operations / Release

The v3.0.0 migration is released. Use `bun run release -- patch`, `-- minor` or
`-- major` according to the change. The script requires a clean tree, updates the root
version/changelog, commits and pushes, waits for successful CI and native Worker
deployment of that revision, verifies live version/build SHA and boundaries, then
publishes the exact tag and GitHub release. Never publish a tag after a failed gate.

Public `/api/live` performs read-only `SELECT 1`, returns version/build SHA and
database status with no-store and 200/503, and hides private diagnostics. There is
no meaningful process uptime contract in the Worker runtime. Follow the runbook
for Access path policy precedence, DNS cutover, backup, rollback and owner cleanup.

## Retrospective

Full narratives live in [Retrospective.md](Retrospective.md). Cross-project lessons
belong in global rules/nmem; deterministic protections belong in hooks/tests.
