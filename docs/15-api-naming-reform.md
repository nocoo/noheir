# 15 — Worker API Naming Reform

> Audit and reform Worker API endpoints for consistency, RESTfulness, and semantic clarity.
> Two categories of change: **naming reform** (path/method renames) and **contract fixes** (404 shape normalization, backup truncation fix).

## Motivation

The Gen 2 rewrite shipped a working Worker API, but naming was done ad-hoc during rapid development. Several inconsistencies exist across three layers (route paths, response shapes, client methods) that will compound as the API surface grows.

**Scope classification:**
- **Naming reform** — Route path renames, client method renames. No behavioral change.
- **Contract fixes** — 404 response shape normalization (R1) and backup truncation fix (R2). These are **API behavior changes** that fix incorrect contracts, not cosmetic renames.

## Deployment Model

Next.js and Cloudflare Worker are **two independently deployable components**. Next.js calls the Worker remotely via `WORKER_URL` (see `src/lib/api-helpers.ts`). The auth flow in `src/auth.ts` also calls the Worker directly during sign-in. This means route path changes carry a **deployment ordering risk**: if the Worker deploys new paths before Next.js is updated (or vice versa), runtime errors will occur.

**Mitigation strategy — Dual-path transition:**

Every route rename follows a 3-step process:
1. **Worker: add new path as alias** — old path still works, new path also works
2. **Next.js: switch client to new path** — deploy Next.js; it now uses new paths, Worker still serves both
3. **Worker: remove old path alias** — separate commit/deploy after Next.js is confirmed working

This adds 1 extra commit per renamed route but eliminates any window where front-end and back-end are out of sync.

## Audit Summary

### Layer 1: Route Path Issues

| ID | Issue | Current | Proposed | Severity |
|----|-------|---------|----------|----------|
| P1 | `/api/metadata` is too generic — collides with potential future metadata endpoints | `GET /api/metadata` | `GET /api/reports/metadata` | High |
| P2 | `/by-year` and `/count-by-year` are verb-phrases, not RESTful sub-resources | `DELETE /api/transactions/by-year?year=2025` | `DELETE /api/transactions/years/:year` | Medium |
| P3 | `/count-by-year` same issue | `GET /api/transactions/count-by-year?year=2025` | `GET /api/transactions/years/:year/count` | Medium |
| P4 | `/api/users/upsert` leaks implementation detail ("upsert" is a DB concept) | `POST /api/users/upsert` | `PUT /api/users/me` | High |
| P5 | `/api/backup` and `/api/restore` are verbs at root level, not grouped | `GET /api/backup` / `POST /api/restore` | `GET /api/data/export` / `POST /api/data/import` | Medium |
| P6 | `/api/reports/monthly` lacks `-summary` suffix while all siblings have it | `GET /api/reports/monthly` | `GET /api/reports/monthly-summary` | Medium |
| P7 | `/api/live` is non-standard for health checks | `GET /api/live` | `GET /api/health` | Low |

### Layer 2: Response Shape Issues

| ID | Issue | Current | Proposed | Severity |
|----|-------|---------|----------|----------|
| R1 | **Contract fix (not rename):** 404 format inconsistent — GET-by-id returns `{ entity: null }` at `index.ts:169,236,267,313`, PUT/DELETE returns `{ error: "Not found" }` | Mixed | All 404s return `{ error: "Not found" }` with status 404 | High |
| R2 | `GET /api/backup` uses search repo with `limit: 5000` silently truncating data at `index.ts:468` | `repos.transactions.search(userId, { limit: 5000 })` | Dedicated `findAllByUser()` repo method without arbitrary limit | High |

### Layer 3: Client Method Issues

| ID | Issue | Current | Proposed | Severity |
|----|-------|---------|----------|----------|
| C1 | `upsertUser()` / `upsertSettings()` expose DB semantics | `upsertUser()`, `upsertSettings()` | `syncUser()`, `saveSettings()` | Medium |
| C2 | `DELETE /api/settings` exists on Worker but has no business client method | Route at `index.ts:361` is called by E2E cleanup (`worker/tests/e2e/helpers/cleanup.ts:43`). **Not dead code.** | **Keep the route. Add `deleteSettings()` to `WorkerDbClient`** for completeness and future use. | Low |

## Affected Files

| File | Changes |
|------|---------|
| `worker/src/index.ts` | Route path renames, 404 response normalization, dual-path aliases |
| `src/lib/worker-db-client.ts` | Client method renames, URL path updates |
| `src/auth.ts` | `upsertUser()` → `syncUser()` call at line 123 |
| `worker/db/repositories/transactions.ts` | Add `findAllByUser()` for backup |
| `worker/db/repositories/transfers.ts` | Add `findAllByUser()` for backup |
| `worker/db/repositories/metadata.ts` | No change (just re-mounted under reports) |
| `worker/db/repositories/reports.ts` | Register metadata as sub-route |
| `worker/tests/e2e/**/*.ts` | Update request paths in E2E tests |
| `src/**/*.ts` (Server Components/Actions) | Update client method calls |

## Implementation Plan

Test-driven approach: **write/update tests first**, then make them pass.

> **Dual-path transition protocol** applies to all route renames (Phase 1, 2).
> Each rename = 3 steps: (a) Worker adds new path as alias, (b) Next.js switches to new path, (c) Worker removes old path.
> Phase 0 (contract fixes) does NOT need dual-path — they are **not** HTTP-level backward-compatible (R1 changes the 404 response body), but impact is controlled because the sole client (`WorkerDbClient`) already throws on non-2xx status codes and never inspects the 404 body. Verify all call sites before commit 1.

### Phase 0 — Contract Fixes (R1, R2) ✅

> **These are behavioral changes**, not renames. Separated from naming reform for honest categorization.

**Atomic commit 1: Normalize 404 responses** ✅ `aa3d04d`

Test first:
- Update Worker E2E tests to assert all GET-by-id 404s return `{ error: "Not found" }` instead of `{ entity: null }`
- Affected routes: `GET /api/transactions/:id` (`index.ts:169`), `GET /api/transfers/:id` (`index.ts:236`), `GET /api/products/:id` (`index.ts:267`), `GET /api/units/:id` (`index.ts:313`)

Then implement:
- `worker/src/index.ts` — Change 4 GET-by-id handlers from `c.json({ transaction: null }, 404)` to `c.json({ error: "Not found" }, 404)`
- `src/lib/worker-db-client.ts` — Update `getTransaction()`, `getTransfer()`, `getProduct()`, `getUnit()` return types (remove `| null` variant, callers now catch 404 via `WorkerDbError`)

**Atomic commit 2: Dedicated backup export methods** ✅ `a5e28df`

Test first (two layers):
- **Repo unit tests**: Add tests for new `findAllByUser()` in transaction and transfer repos — assert no limit is applied, all rows returned
- **Route-level E2E test**: The current bug is `search(userId, { limit: 5000 })` at `index.ts:468` — inserting 101 rows would still pass under the broken implementation. The test must either: (a) insert >5000 rows and assert all are returned (expensive but definitive), or (b) assert structurally that the backup route does **not** call `search()` — e.g., mock `repos.transactions.search` to throw, and confirm backup still succeeds via `findAllByUser()`. Option (b) is preferred for speed; option (a) can be a supplementary integration test if D1 test fixtures are cheap.

Then implement:
- `worker/db/repositories/transactions.ts` — Add `findAllByUser(userId)` that returns all rows without limit
- `worker/db/repositories/transfers.ts` — Add `findAllByUser(userId)` that returns all rows without limit
- `worker/src/index.ts` — Backup route uses `findAllByUser()` instead of `search(userId, { limit: 5000 })`

### Phase 1 — Route Renames with Dual-Path Transition (P1, P4, P5, P6, P7) ✅

Each route rename follows the 3-step protocol from the Deployment Model section above. Steps (a) and (b) are shown as one commit when they can ship in the same PR. The old-path removal (c) is batched into a single cleanup commit at the end (Phase 3).

**Atomic commit 3a: Add `PUT /api/users/me` alias + switch client** ✅ `e6647df`

Test first:
- Add E2E test asserting `PUT /api/users/me` works identically to `POST /api/users/upsert`
- Keep existing tests for old path passing (old path still served)

Then implement:
- `worker/src/index.ts` — Add `app.put("/api/users/me", ...)` alongside existing `app.post("/api/users/upsert", ...)`
- `src/lib/worker-db-client.ts` — `upsertUser()` → `syncUser()`, path → `/api/users/me`, method → `PUT`
- `src/auth.ts` — Update `client.upsertUser(...)` → `client.syncUser(...)` at line 123

**Atomic commit 4a: Add `/api/reports/metadata` alias + switch client** ✅ `c941e67`

- Worker: Add `GET /api/reports/metadata` alongside `GET /api/metadata`
- Client: `getMetadata()` path update to `/api/reports/metadata`

**Atomic commit 5a: Add `/api/data/export` + `/api/data/import` aliases + switch client** ✅ `f242789`

- Worker: Add `GET /api/data/export` alias for `GET /api/backup`, `POST /api/data/import` alias for `POST /api/restore`
- Client: `backup()` → `exportData()`, `restore()` → `importData()`, paths updated

**Atomic commit 6a: Add `/api/reports/monthly-summary` alias + switch client** ✅ `a381d2c`

- Worker: Add `GET /api/reports/monthly-summary` alongside `GET /api/reports/monthly`
- Client: `getMonthlyReport()` path update

**Atomic commit 7a: Add `/api/health` alias + switch client** ✅ `f31e615`

- Worker: Add `GET /api/health` alias, update auth middleware to skip both `/api/live` and `/api/health`
- Client: `health()` path update
- Note: Next.js also has `/api/live` — that is a separate route (kept as-is, it's a Next.js route not Worker)

### Phase 2 — Sub-Resource Path Reform (P2, P3) ✅

Same dual-path protocol. Old paths kept until Phase 3 cleanup.

**Atomic commit 8a: Add resourceful year-scoped paths for transactions + switch client** ✅ `15f5de9`

Test first:
- Add E2E tests for `GET /api/transactions/years/:year/count` and `DELETE /api/transactions/years/:year`

Then implement:
- Worker: Add new routes alongside old `/count-by-year` and `/by-year`
- Client: `countTransactionsByYear()` and `deleteTransactionsByYear()` path updates

**Atomic commit 9a: Same for transfers** ✅ `f3c2bfe`

- Mirror commit 8a for `/api/transfers/years/:year/count` and `/api/transfers/years/:year`

### Phase 3 — Client Method Semantics + Cleanup (C1, C2) ✅

**Atomic commit 10: Rename client methods for semantic clarity** ✅ `31ddb7c`

- `upsertSettings()` → `saveSettings()` in `worker-db-client.ts`
- Update all call sites in `src/`

**Atomic commit 11: Add `deleteSettings()` to `WorkerDbClient`** ✅ `00cb51a`

- Add `deleteSettings(userId)` to `WorkerDbClient` — route already exists at `worker/src/index.ts:361`
- Route is actively used by E2E cleanup (`worker/tests/e2e/helpers/cleanup.ts:43`) — **must not be removed**
- Adding the client method provides hard-delete capability for future business use

**Atomic commit 12: Remove all old-path aliases from Worker** ✅ `d8d191b`

After confirming Next.js is deployed and stable on new paths:
- Remove all old route handlers that were kept as aliases in Phase 1–2:
  - `POST /api/users/upsert`
  - `GET /api/metadata`
  - `GET /api/backup`, `POST /api/restore`
  - `GET /api/reports/monthly`
  - `GET /api/live` (Worker only; Next.js `/api/live` is unrelated)
  - `GET /api/transactions/count-by-year`, `DELETE /api/transactions/by-year`
  - `GET /api/transfers/count-by-year`, `DELETE /api/transfers/by-year`
- Update all E2E tests to only reference new paths
- This is the final cut-over commit

## Route Migration Table (Before → After)

| # | Method | Before | After |
|---|--------|--------|-------|
| 1 | `GET` | `/api/live` | `/api/health` |
| 2 | `POST` | `/api/users/upsert` | `PUT /api/users/me` |
| 3 | `GET` | `/api/transactions/count-by-year?year=Y` | `/api/transactions/years/:year/count` |
| 4 | `DELETE` | `/api/transactions/by-year?year=Y` | `/api/transactions/years/:year` |
| 5 | `GET` | `/api/transfers/count-by-year?year=Y` | `/api/transfers/years/:year/count` |
| 6 | `DELETE` | `/api/transfers/by-year?year=Y` | `/api/transfers/years/:year` |
| 7 | `GET` | `/api/metadata` | `/api/reports/metadata` |
| 8 | `GET` | `/api/reports/monthly` | `/api/reports/monthly-summary` |
| 9 | `GET` | `/api/backup` | `/api/data/export` |
| 10 | `POST` | `/api/restore` | `/api/data/import` |

## Client Method Rename Table

| Before | After | Notes |
|--------|-------|-------|
| `upsertUser(userId, data)` | `syncUser(userId, data)` | Path + method + name change |
| `upsertSettings(userId, data)` | `saveSettings(userId, data)` | Name change only |
| `backup(userId)` | `exportData(userId)` | Path + name change |
| `restore(userId, data)` | `importData(userId, data)` | Path + name change |
| *(missing)* | `deleteSettings(userId)` | New method for existing route |
| `countTransactionsByYear(userId, year)` | *(same)* | Path change only |
| `deleteTransactionsByYear(userId, year)` | *(same)* | Path change only |
| `countTransfersByYear(userId, year)` | *(same)* | Path change only |
| `deleteTransfersByYear(userId, year)` | *(same)* | Path change only |
| `getMonthlyReport(...)` | *(same)* | Path change only |
| `getMetadata(userId)` | *(same)* | Path change only |
| `health()` | *(same)* | Path change only |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Worker/Next.js deploy ordering mismatch** | Dual-path transition: old paths kept as aliases until Next.js is confirmed on new paths, then removed in commit 12 |
| MCP server uses old API paths | MCP server uses Supabase directly (archived), not the Worker API — no impact |
| Next.js `/api/live` conflicts with Worker `/api/health` rename | They are separate services (Next.js vs Worker) — no conflict |
| 404 contract change (R1) breaks callers expecting `{ entity: null }` | `WorkerDbClient` already throws `WorkerDbError` on non-2xx — callers use try/catch, not null-checking. Verify all call sites before commit 1. |
| Backup truncation fix (R2) changes response size characteristics | `findAllByUser()` returns all rows — monitor response size in production. D1 has a 10MB response limit per query; if data exceeds this, pagination will be needed (out of scope for this reform). |
| E2E cleanup depends on `DELETE /api/settings` | Route is **kept** (commit 11 adds client method, does not remove route) |

## Out of Scope

- **API versioning** (`/api/v1/`) — not needed for single-user app
- **Route file splitting** (`routes/*.ts`) — cosmetic refactor, separate PR
- **Products/Units search endpoint** — functional addition, not naming reform
- **Response envelope standardization** (`{ data, total }`) — larger refactor, separate PR