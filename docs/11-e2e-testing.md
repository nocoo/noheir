# E2E Testing Plan

## Overview

E2E tests run against a **real local Supabase instance** (via Docker), exercising the full
PostgreSQL schema including RLS policies, stored functions, indexes, and constraints.

Each test file acts as an independent subprocess that talks directly to Supabase via
`@supabase/supabase-js`, mirroring how the production app calls the API.

## Architecture

```
tests/e2e/
  helpers/
    supabase-client.ts   -- creates authenticated + anon Supabase clients
    seed.ts              -- reusable seed-data factories
    cleanup.ts           -- teardown helpers per table
  auth.e2e.test.ts       -- sign-up / sign-in / sign-out / session
  settings.e2e.test.ts   -- CRUD for settings table
  transactions.e2e.test.ts -- CRUD + year queries for transactions table
  transfers.e2e.test.ts  -- CRUD for transfers table
  products.e2e.test.ts   -- CRUD for financial_products table
  units.e2e.test.ts      -- CRUD + deploy / recall / archive for capital_units
  rpc.e2e.test.ts        -- get_units_with_products, search_transactions_fuzzy
  rls.e2e.test.ts        -- cross-user isolation & anon rejection
```

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Docker | 29+ | Runs local Supabase (Postgres, Auth, Storage, etc.) |
| Supabase CLI | 2.75+ | `supabase start` / `supabase stop` / migrations |
| Bun | 1.3+ | Test runner (`bun test`) |

## Local Supabase Setup

```bash
# One-time init (generates supabase/config.toml)
supabase init

# Start local stack (Postgres + Auth + APIs)
supabase start

# Migrations are auto-applied from supabase/migrations/
```

`supabase start` prints local credentials:

| Key | Example |
|---|---|
| API URL | `http://127.0.0.1:54321` |
| anon key | `eyJhbG...` |
| service_role key | `eyJhbG...` (bypasses RLS) |

## Test Execution

```bash
# Start local Supabase (if not running)
supabase start

# Run E2E tests only
bun test tests/e2e/

# Run all tests (UT + E2E)
bun test
```

## npm Scripts

| Script | Command |
|---|---|
| `test:unit` | `bun run test:unit` — UT only (no E2E) |
| `test:e2e` | `bun run test:e2e` — E2E only (requires local Supabase) |
| `test` | `bun test` — runs all tests (UT + E2E) |

## API Coverage Matrix

### Auth (4 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 1 | `auth.signUp` (email/password) | auth.e2e.test.ts | ✅ pass |
| 2 | `auth.signInWithPassword` | auth.e2e.test.ts | ✅ pass |
| 3 | `auth.getSession` | auth.e2e.test.ts | ✅ pass |
| 4 | `auth.signOut` | auth.e2e.test.ts | ✅ pass |

### Settings (5 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 5 | `settings.select` (fetch by owner_id) | settings.e2e.test.ts | ✅ pass |
| 6 | `settings.insert` (create) | settings.e2e.test.ts | ✅ pass |
| 7 | `settings.update` site_name | settings.e2e.test.ts | ✅ pass |
| 8 | `settings.update` settings JSONB | settings.e2e.test.ts | ✅ pass |
| 9 | `settings.select` returns null for new user | settings.e2e.test.ts | ✅ pass |

### Transactions (9 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 10 | `transactions.select` years | transactions.e2e.test.ts | ✅ pass |
| 11 | `transactions.select` all ordered | transactions.e2e.test.ts | ✅ pass |
| 12 | `transactions.select` by year | transactions.e2e.test.ts | ✅ pass |
| 13 | `transactions.select` count by year | transactions.e2e.test.ts | ✅ pass |
| 14 | `transactions.insert` batch | transactions.e2e.test.ts | ✅ pass |
| 15 | `transactions.delete` by year | transactions.e2e.test.ts | ✅ pass |
| 16 | `transactions.delete` all | transactions.e2e.test.ts | ✅ pass |
| 17 | `transactions.select` latest year | transactions.e2e.test.ts | ✅ pass |
| 18 | `transactions.select` years excluding one | transactions.e2e.test.ts | ✅ pass |

### Transfers (5 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 19 | `transfers.select` all ordered | transfers.e2e.test.ts | ✅ pass |
| 20 | `transfers.insert` batch | transfers.e2e.test.ts | ✅ pass |
| 21 | `transfers.delete` by year | transfers.e2e.test.ts | ✅ pass |
| 22 | `transfers.delete` all | transfers.e2e.test.ts | ✅ pass |
| 23 | `transfers.delete` + re-insert (replace) | transfers.e2e.test.ts | ✅ pass |

### Financial Products (5 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 24 | `financial_products.select` all | products.e2e.test.ts | ✅ pass |
| 25 | `financial_products.select` by id | products.e2e.test.ts | ✅ pass |
| 26 | `financial_products.insert` | products.e2e.test.ts | ✅ pass |
| 27 | `financial_products.update` | products.e2e.test.ts | ✅ pass |
| 28 | `financial_products.delete` | products.e2e.test.ts | ✅ pass |

### Capital Units (13 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 29 | `capital_units.select` all (no product) | units.e2e.test.ts | ✅ pass |
| 30 | `capital_units.select` filtered + sorted | units.e2e.test.ts | ✅ pass |
| 31 | `capital_units.select` by id | units.e2e.test.ts | ✅ pass |
| 32 | `capital_units.insert` single | units.e2e.test.ts | ✅ pass |
| 33 | `capital_units.update` single | units.e2e.test.ts | ✅ pass |
| 34 | `capital_units.delete` single | units.e2e.test.ts | ✅ pass |
| 35 | deploy: verify status + update product/dates | units.e2e.test.ts | ✅ pass |
| 36 | recall: clear product + reset status | units.e2e.test.ts | ✅ pass |
| 37 | archive: set status '已归档' | units.e2e.test.ts | ✅ pass |
| 38 | `capital_units.insert` batch | units.e2e.test.ts | ✅ pass |
| 39 | `capital_units.update` batch statuses | units.e2e.test.ts | ✅ pass |
| 40 | `capital_units.select` + join product by id | units.e2e.test.ts | ✅ pass |
| 41 | `financial_products.select` by ids (for manual join) | units.e2e.test.ts | ✅ pass |

### RPC Functions (5 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 42 | `rpc('get_units_with_products')` | rpc.e2e.test.ts | ✅ pass |
| 43 | `rpc('search_transactions_fuzzy')` keyword + filters | rpc.e2e.test.ts | ✅ pass |
| 44 | `rpc('search_transactions_fuzzy')` year/month/currency | rpc.e2e.test.ts | ✅ pass |
| 45 | `rpc('search_transfers_fuzzy')` keyword + filters + pagination | rpc.e2e.test.ts | ✅ pass |
| 46 | `rpc('search_transfers_fuzzy')` year/month/currency/tags | rpc.e2e.test.ts | ✅ pass |

### RLS Security (13 scenarios)

| # | Scenario | File | Status |
|---|---|---|---|
| 47 | anon cannot read any table | rls.e2e.test.ts | ✅ pass |
| 48 | anon cannot call any RPC function | rls.e2e.test.ts | ✅ pass |
| 49 | user B cannot read user A's transactions | rls.e2e.test.ts | ✅ pass |
| 50 | user B cannot read user A's transfers | rls.e2e.test.ts | ✅ pass |
| 51 | user B cannot read user A's settings | rls.e2e.test.ts | ✅ pass |
| 52 | user B cannot read user A's products/units | rls.e2e.test.ts | ✅ pass |
| 53 | user B cannot UPDATE user A's transaction | rls.e2e.test.ts | ✅ pass |
| 54 | user B cannot DELETE user A's transaction | rls.e2e.test.ts | ✅ pass |
| 55 | user B cannot UPDATE user A's transfer | rls.e2e.test.ts | ✅ pass |
| 56 | user B cannot DELETE user A's transfer | rls.e2e.test.ts | ✅ pass |
| 57 | user B gets empty from search_transactions_fuzzy on user A's data | rls.e2e.test.ts | ✅ pass |
| 58 | user B gets empty from search_transfers_fuzzy on user A's data | rls.e2e.test.ts | ✅ pass |
| 59 | user B gets zero counts from get_financial_metadata and get_monthly_report | rls.e2e.test.ts | ✅ pass |

**Total: 59 test scenarios across 8 files**

## Test Design Principles

1. **Real database** -- no mocks; tests hit local Supabase Postgres via Docker
2. **Isolated users** -- each test file creates its own user via `auth.signUp`
3. **Clean state** -- `afterAll` deletes all test data using service_role client
4. **Deterministic** -- no dependency on execution order between files
5. **BDD style** -- `describe` blocks map to features, `it` blocks describe behavior

## Git Hooks Integration

- **pre-commit**: `bun run test:unit` (UT only, fast)
- **pre-push**: `bun run test:unit && bun run lint && bun run test:e2e && bun run test:mcp` (UT + Lint + E2E + MCP, if Supabase running)

> E2E and MCP integration tests require Docker + local Supabase running. If `supabase` CLI
> is not available or local Supabase is not running, E2E/MCP tests skip gracefully with a
> visible warning box.
