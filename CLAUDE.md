README.md

## Deployment

- **Architecture**: Next.js (standalone, port 7004) handles UI + NextAuth + MCP OAuth + API routes; Cloudflare Worker provides SQL API to D1.
- **Image**: `Dockerfile` (multi-stage, `oven/bun:1`) → published to GHCR as `ghcr.io/<owner>/noheir:latest` and `:<sha>`.
- **Edge**: Cloudflare in front of an origin VPS (jp2.nocoo.cloud, Azure 日本). A shared `proxy-caddy` at `/opt/proxy/` terminates TLS with a Cloudflare Origin Certificate (`*.hexly.ai`) and enforces **Authenticated Origin Pulls (mTLS)**, so direct-to-IP traffic is rejected. App containers (`noheir-app`, `neo-app`, …) join the shared docker network `edge`; Caddy reverse-proxies to them by container name.
- **CI/CD**: `.github/workflows/ci.yml` runs lint + unit tests on every push/PR. `.github/workflows/release.yml` is chained via `workflow_run` — on green CI for `main` it builds & pushes the image, then SSHes into the VPS to `docker compose pull && up -d --no-deps app`, runs an in-container health check, and finally smoke-tests via the public URL. Only the app container rolls; `proxy-caddy` is never touched by app deploys.
- **Runtime env vars** (injected by the host's `.env`, never baked into the image): `WORKER_URL`, `WORKER_TOKEN`, `AUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`.
- **GitHub Actions secrets** required by `release.yml`: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_PULL_USER`, `GHCR_PULL_TOKEN` (PAT with `read:packages`). Host-side compose file references the same image tag.
- See [docs/04-run.md](./docs/04-run.md) for the full deploy guide.

## Backend (Cloudflare Worker + D1)

- **Worker**: `worker/` directory, deployed to `noheir.worker.hexly.ai`
- **Database**: Cloudflare D1 (SQLite), database ID in `worker/wrangler.toml`
- **Schema**: Drizzle ORM, schema in `worker/db/schema.ts`
- **Migrations**: `worker/db/migrations/`

### Common Commands

```bash
# Query D1 (remote)
npx wrangler d1 execute noheir-db --remote --command "SELECT COUNT(*) FROM transactions"

# Run migrations
npx wrangler d1 migrations apply noheir-db --remote

# Local dev
cd worker && bun run dev
```

## Test Architecture

### Test Strategy

| Layer | Files | Runner |
|-------|-------|--------|
| Unit | `src/__tests__/` | `bun run test` |
| Worker Unit | `worker/tests/` (excl. e2e/) | `bun run test:worker` |
| Worker E2E | `worker/tests/e2e/` | `bun run test:e2e` (boots `wrangler dev --local`) |

> E2E runs entirely against a local D1 emulator (`worker/.wrangler/state-e2e/`) — no remote test database. Migrations are applied to that local D1 before each run. The previous `noheir-db-test` database has been retired.

### Port allocation

Per the personal port plan (`dev → dev + 10000 → dev + 20000` for dev/L2/BDD):

| Purpose | Port | Notes |
|---------|------|-------|
| Next.js dev server | `7004` | `bun run dev` |
| L2 / E2E wrangler | `17004` | Owned by `scripts/run-e2e.ts`; override with `E2E_PORT` |
| BDD | `27004` | (not in use) |
| Worker dev (manual) | `37004` | `cd worker && bun run dev`; pinned via `[dev] port` in `worker/wrangler.toml` |

The runner refuses to start if `17004` is busy and tells you to free it or set `E2E_PORT`.

### Git Hooks

| Hook | Runs | Config |
|------|------|--------|
| pre-commit | Unit tests only | `.husky/pre-commit` |
| pre-push | Unit + Lint | `.husky/pre-push` |

## Visual Design Principles

### Unified Badge System

All domain labels (unitCode, strategy, tactics, status, currency, product) MUST use the unified Badge components from `src/components/ui/colored-badge.tsx`:

| Data Type | Component | Color Source |
|-----------|-----------|--------------|
| Unit Code (e.g., C10, A01) | `<UnitCodeBadge unitCode={...} />` | Hash by prefix |
| Strategy (e.g., 远期理财) | `<StrategyBadge strategy={...} />` | `STRATEGY_TOKEN_MAP` |
| Tactics (e.g., 定期存款) | `<TacticsBadge tactics={...} />` | `TACTICS_TOKEN_MAP` |
| Status (e.g., 已成立) | `<StatusBadge status={...} />` | `STATUS_TOKEN_MAP` |
| Currency (e.g., CNY, USD) | `<CurrencyBadge currency={...} />` | `CURRENCY_TOKEN_MAP` |
| Product Name | `<ProductBadge productName={...} />` | Hash by name |

**Key principle**: The same label (e.g., `C10` or `远期理财`) must display with identical color and style across ALL pages. Never use raw `<Badge>` for domain-specific data.

### Availability Status Colors

| State | Color | Label |
|-------|-------|-------|
| Available (≤0 days) | Green | "已可用" / "可用" |
| Soon (1-30 days) | Amber | "N天" |
| Locked (>30 days) | Red/Destructive | "锁定中" |

## Retrospective

- D1 uses SQLite syntax — use `strftime('%Y', date)` instead of `EXTRACT(YEAR FROM date)`.
- Wrangler D1 queries require `--remote` flag for production database.
- MCP server moved from Worker to Next.js API routes (`src/app/api/mcp/`). Worker now only provides SQL API.
- **Local npm links don't work in Docker builds**: `"@nocoo/base-mcp": "link:../base-mcp"` causes `FileNotFound` during Docker builds because the linked package doesn't exist in the build container. Solution: inline needed functions directly into the project (e.g., `src/lib/mcp/pkce.ts`) or publish to npm registry.
- **Middleware whitelist must include `/api/auth/`**: `src/proxy.ts` redirects unauthenticated requests to `/login`. NextAuth's own endpoints (`/api/auth/session`, `/providers`, `/csrf`, `/callback/*`, …) must be in `PUBLIC_PREFIXES`, otherwise the client receives an HTML login page instead of JSON and breaks with `Unexpected token '<'`. Marking them only as "not protected" inside `isProtectedApiRoute` is **not** enough — they fall through to the protected-page branch.
- **E2E uses `wrangler dev --local`, not a remote D1**: the previous `X-Target-DB` header + `DB_TEST` binding + `noheir-db-test` remote database is gone. `scripts/run-e2e.ts` boots wrangler locally, applies migrations into `worker/.wrangler/state-e2e/`, and runs the suite over loopback. CI does the same — no remote D1 is required.
- **Availability is derived from the latest invest log, never from `start_date`**: `computeAvailability` (`worker/lib/availability.ts`) short-circuits to all-null when a unit has no `contribution_logs` invest row, which the tooltip renders as "状态未知". `POST /api/units` originally wrote no log, so any unit created with a product already attached was born broken (R29–R32 hit this). Creation now writes an `invest` log when `status = 已成立` and a product is attached; `计划中` deliberately writes none, since the money is not out yet.
- **Date math must be anchored to Asia/Shanghai, not the runtime's local time**: the Workers runtime is UTC, but `getLocalDateString()` (`worker/src/index.ts:49`) stamps `operation_date` in Shanghai. `computeAvailability` used `new Date()` + `setHours(0,0,0,0)`, so between 00:00 and 08:00 CST it read "today" as the previous day and inflated every `daysUntilAvailable` by 1. Fixed by parsing all calendar days as UTC-midnight and deriving today via `toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })`. Two lessons: (1) any new date arithmetic must use the same helpers, and (2) the bug hid for months because the e2e tests built their fixtures with `toISOString().slice(0,10)` (UTC) — two mistakes cancelling out. Tests must use the *same* timezone convention as the write path, or they validate nothing.
- **Releasing does NOT deploy the Worker**: `release.yml` only rolls the `noheir-app` container. No workflow touches the Worker — it ships solely via a manual `cd worker && bun run deploy`. At v2.6.1 the site reported `2.6.1` while `noheir.worker.hexly.ai/api/live` still reported `2.6.0`, so both Worker-side fixes in that release were live nowhere. "No migration needed" is **not** a reason to skip the Worker deploy — schema and code ship independently. After any release touching `worker/`, curl **both** `/api/live` endpoints and confirm the versions match before calling it done.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
