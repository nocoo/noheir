# Noheir

Personal finance application for cash flow, capital units, products and availability planning.
Profile: ts-worker-web.
Direction: [README.md](README.md), [runbook](docs/04-run.md), [operations/UI constraints](docs/22-agent-operations.md).

## Sources of Truth

This handbook is the project contract; hooks, CI and configuration enforce it.
Raise weaker enforcement to the contract. Maintain project rules only here.

| Fact | Where |
| --- | --- |
| Human docs | [README.md](README.md), [docs/README.md](docs/README.md) |
| Version | Root `package.json`, imported by UI and Worker |
| Enforcement | `.husky/`, parallel hook scripts, CI, root/Worker Vitest |
| Runtime configuration | `wrangler.jsonc`, `vite.config.ts`, `.env.example` |
| Migration and cutover evidence | [Migration plan](docs/23-workers-migration.md) |
| Accidents | [Retrospective.md](Retrospective.md) |

## Project Invariants

- One native Hono Worker serves Vite assets, business APIs and OAuth/MCP using the existing D1 binding. No Next.js runtime, Docker deployment, SQL-over-HTTP gateway or shared Worker secret remains in v3.
- Verify Access signature, issuer, audience and expiry. Normalize verified email and resolve exactly one existing `users.id`; never replace Google-era financial/MCP ownership keys with Access `sub`. Unknown or ambiguous users fail closed.
- Run the Worker before static assets. Disable workers.dev and preview URLs. Local identity requires an explicit local/test environment and loopback host; production never bypasses verification.
- Browser mutations require same origin. Derive ownership on the server, ignoring user-id and internal-action headers and ownership fields in JSON.
- Preserve OAuth issuer, client registrations and token hashes. Machine endpoints perform OAuth/MCP validation; authorize/callback require Access and the same original owner. Preserve single-use PKCE codes and refresh rotation. External Access path precedence is documented in the runbook.
- CSV transaction import replaces the selected user's whole year of income and expense; transfer import is separate. Validate all rows before a single atomic D1 batch. Keep JSON parameters below D1 limits using chunks; never delete before validation or in a separate request.
- JSON export includes more than restore. Restore replaces only transactions/transfers across all years. Never claim a complete disaster-recovery backup; use a private D1 export for that purpose.
- Currency is integer cents. Calendar math uses Asia/Shanghai helpers across writes and fixtures; recurring state end timestamps retain the existing UTC convention. Parameterize SQLite syntax.
- Availability derives from the latest invest log or explicit override, not `start_date`; missing invest history stays unknown. Established units with a product create the proper invest log; planned units do not.
- Domain labels use shared colored-badge wrappers. Preserve available/soon/locked colors and the full mapping in [operations/UI constraints](docs/22-agent-operations.md).
- Retain the existing D1 database. Retiring old Noheir infrastructure must not disturb shared Caddy/mTLS, the shared `edge` network or other VPS applications.

## Stack / Layout

| Component | Choice |
| --- | --- |
| Web | Vite, React, React Router data loaders; `src/app/`, `src/routes.tsx` |
| Domain/UI | `src/domain/`, `src/components/`; preserve MVVM and Basalt controls |
| API/auth/MCP | Hono, jose, native MCP Web Standard transport; `worker/src/`, `src/lib/mcp/` |
| Data | Direct request-scoped D1, Drizzle; `worker/db/`, canonical `worker/db/migrations/` |
| Tooling | Bun 1.4.2 / Node 26.8.1 in CI, TypeScript 7, Biome, Vitest/Playwright |

## Commands

Run from root. Root and Worker remain separate dependency packages for tests.

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run prepare
bun run db:migrate
bun run db:seed
bun run dev
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

Development uses local D1 and `developer@example.test` on port 7004. No production
credentials or Google client is needed. Worker unit tests need a working
`better-sqlite3` native module. Root typecheck includes the Worker lane. Keep
Workers global types out of the browser compiler: DOM and Worker element types
conflict; use the scoped D1 aliases in `src/worker-types.d.ts`.

## Verification

6DQ = L1/L2/L3 + G1/G2 + D1. Status describes enforcement, not a claim of complete
coverage. Both L1 suites require statements/branches/functions/lines each >=95%
in their configured scope. Do not lower thresholds, add exclusions to hide new
logic, skip/focus tests or bypass hooks.

| Piece | Requirement and scope | Status | Evidence |
| --- | --- | --- | --- |
| L1 App | Four metrics >=95% in configured TypeScript logic; UI, wiring and listed domain/service exclusions are outside the coverage denominator | enforced | Root Vitest; pre-commit/pre-push/CI |
| L1 Worker | Four metrics >=95% for `worker/lib/**/*.ts` and `db/validation.ts`; HTTP entrypoints/repositories outside this unit denominator | enforced | Worker Vitest; pre-commit/pre-push/CI |
| L2 | Native Worker real HTTP with SQLite, signed JWT failures, ownership, CRUD, OAuth/PKCE/replay/refresh, state races, annual import rollback and backup scope | enforced | `scripts/run-e2e.ts`; pre-push/CI; not a complete endpoint/method coverage claim |
| L3 | Authenticated route rendering and financial/import/backup/error workflows on built assets | enforced | Playwright CI; acceptance evidence in migration plan |
| G1 | Both type lanes; zero-warning/error Biome | enforced | Root typecheck and lint; pre-commit/CI |
| G2 | Required OSV on both locks; redacted gitleaks | enforced | Pre-push and reusable CI security gates |
| D1 | Per-run local state, marker validation before fixture writes/cleanup, reserved ports, controlled JWKS | enforced | `scripts/test-fixture.ts`, HTTP/browser runners |
| Build | Vite client/Worker bundles and deployment dry-run | enforced/manual | Build in CI preparation; dry-run during release validation |
| Docs | Operations, limitations and release evidence aligned | manual | README, handbook and numbered docs |

Current hooks check the working tree, not an isolated index. Pre-push secrets scan
`origin/main..HEAD`, not arbitrary pushed refs from stdin. Index-only L1/G1 under
30 seconds and pushed-ref L2/G2 under three minutes remain workflow targets;
never describe them as implemented. Explicitly stage logical commits only.

## Resources / Isolation

| Purpose | Port / state | Policy |
| --- | --- | --- |
| Dev | 7004 / `.wrangler/state` | Explicit local binding and local user |
| L2 | 17004 / per-run temporary SQLite | Real Worker HTTP; signed synthetic identities |
| L3 | 27004 / independent temporary SQLite | Built client, real Worker and browser fixtures |

Never create remote test resources, seed production, or reuse daily-development
data. A `_test_marker` and matching private directory marker guard fixture writes
and cleanup. HTTP/browser runners refuse occupied ports; Playwright does not reuse
an existing server. Test JWKS is intercepted locally; production Access is not a
test dependency.

## Operations / Release

Use `bun run release -- major` for the v3 migration. Subsequent releases choose
an appropriate semantic bump. The script requires a clean tree, updates the root
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
