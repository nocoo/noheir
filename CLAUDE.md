# Noheir

Personal finance application for cash flow, capital units, products and availability planning.
Profile: ts-worker-web.
Direction: [README.md](README.md), [runbook](docs/04-run.md), [operations/UI constraints](docs/22-agent-operations.md).

## Sources of Truth

This handbook is the contract; hooks, CI and config enforce it. Raise weaker enforcement to the contract. Preserve the framework-generated footer without allowing it to replace this file.

| Fact | Where |
| --- | --- |
| Human docs | [README.md](README.md), [docs/README.md](docs/README.md) |
| Version | Root `package.json`; verify both app and Worker runtime versions when releasing |
| Enforcement | `.husky/`, parallel hook scripts, CI, root/Worker Vitest |
| Environment | Ignored `.env.local` / `worker/.dev.vars`; tracked `.env.example` |
| Accidents | [Retrospective.md](Retrospective.md) |

## Project Invariants

- Next.js owns UI, Google login, OAuth/MCP and app APIs; Worker owns business/SQL APIs and D1. Never move MCP back into the Worker.
- Respect per-user ownership and import scope: CSV replaces the selected year's/type's rows; JSON restore currently replaces only income/expense/transfers, not every exported object. Preserve backup limitations explicitly.
- Keep OAuth endpoints public in `src/proxy.ts` before the protected-page branch. Public `/api/live` performs read-only `SELECT 1`, returns version/database status with no-store and 200/503, and hides private diagnostics.
- Availability derives from the latest invest log or explicit override, not `start_date`; missing invest history stays unknown. New established units with a product create the proper invest log; planned units do not.
- Calendar math uses Asia/Shanghai helpers across write paths and fixtures. SQLite queries retain SQLite syntax; parameterize SQL.
- Domain labels use the shared colored-badge wrappers, never arbitrary Badge colors. Preserve available/soon/locked color rules and full badge mapping in [operations/UI constraints](docs/22-agent-operations.md).
- App deployments roll only its VPS container on shared `edge`; never disturb shared Caddy/mTLS. Worker code/schema ships separately; no runtime credentials enter the image.

## Stack / Layout

| Component | Choice |
| --- | --- |
| Web | Next.js standalone, React, Auth.js, MCP; `src/app/` |
| Domain/UI | `src/domain/`, `src/lib/mcp/`, `src/components/`; keep MVVM |
| Worker/data | Hono/D1, `worker/src/`, `worker/db/schema.ts`, `worker/db/migrations/` |
| Tooling | Bun, Node 22.12+, TypeScript 7, Biome, Vitest/Playwright |

## Commands

Run from root; root and Worker are separate packages. CI currently pins Bun 1.4.2.

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run prepare
bun run --cwd worker dev
bun run dev
bun run typecheck
bun run worker:typecheck
bun run lint
bun run build
bun run test:coverage
bun run --cwd worker test:coverage
bun run test:e2e
bunx playwright install chromium
bun run test:e2e:bdd
```

Configure `WORKER_URL`/`WORKER_TOKEN` with matching Worker token; the example URL targets production, so choose local 37004 before dev writes. Google login needs `AUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`. Worker unit tests require a working `better-sqlite3` native module. Follow README for local migrations; do not run remote schema commands for tests.

## Verification

6DQ = L1/L2/L3 + G1/G2 + D1. Status: `enforced`, `planned`, `manual`, `N/A`. L1 statements/branches/functions/lines each ≥95%, no skipped/focused tests.

| Piece | Requirement and current reality | Status | Evidence |
| --- | --- | --- | --- |
| L1 Web | Four metrics ≥95% in configured logic | enforced | Root Vitest, pre-commit/pre-push/CI |
| L1 Worker | Four metrics ≥95%, relevant Worker logic included | planned | CI enforces all four ≥95% on configured libraries/validation; broader Worker route coverage remains excluded and planned |
| L2 | Real HTTP, every endpoint/method, real SQLite | planned | `run-e2e.ts` is enforced in pre-push/CI; full app/MCP surface proof missing |
| L3 | Authenticated financial/import/backup workflows | planned | Playwright CI currently checks public terms-page smoke only |
| G1 | Both type lanes and zero-warning/error Biome | planned | Root checks enforced; Worker typecheck not included in root/CI typecheck command |
| G2 | Required OSV/gitleaks; both locks and pushed commits | planned | Pre-push allows absent tools/skip variables and scans staged secrets; CI scans root lock |
| D1 | Per-run local state and guard/marker before writes/cleanup | planned | Local HTTP runner rebuilds fixed `worker/.wrangler/state-e2e`; marker/per-run safeguards missing |
| Build | Next standalone output | enforced | CI `build` preparation |
| Docs | Schema/operations and evidence remain aligned | manual | Review numbered docs |

Hooks run working-tree coverage/lint/types (commit), then coverage/lint/security/HTTP in parallel (push). Required target: check-only index L1/G1 <30s and stdin pushed-ref L2/G2 <3min. Do not use hook bypass or the current `SKIP_SECURITY`/`SKIP_E2E` escape hatches.

## Resources / Isolation

| Purpose | Port / state | Policy |
| --- | --- | --- |
| Dev | Next 7004; Worker 37004 | Local configured D1 for development |
| L2 | 17004 (`E2E_PORT` override), `worker/.wrangler/state-e2e` | Local migrations/Worker; refuses an occupied port |
| L3 | 27004 | Public smoke only; no verified financial fixtures |

Required test design uses local Wrangler/Miniflare with per-run SQLite, explicit local context and `_test_marker` checked before seed/reset/cleanup. Never create remote `-test` resources or use production/daily-dev data as fixtures; retired remote test bindings stay retired.

## Operations / Release

Authorized releases use `bun run release` and the [runbook](docs/04-run.md). CI success triggers the Docker release workflow; Worker changes additionally need `bun run --cwd worker deploy` after migrations. Verify both public `/api/live` versions, not only the app container. GitHub credentials and VPS runtime variable names are documented in [operations](docs/22-agent-operations.md).

## Retrospective

Full narratives live in [Retrospective.md](Retrospective.md). Keep recurring rules short; cross-project lessons belong in nmem/global rules and deterministic checks in hooks/tests.

- Do not use sibling `link:` dependencies for container builds; deployed app and Worker versions must both reflect their changed code.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
