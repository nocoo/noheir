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
| `test:e2e` | `bun test tests/e2e/` |
| `test:all` | `bun test` |

## API Coverage Matrix

### Auth (4 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 1 | `auth.signUp` (email/password) | auth.e2e.test.ts | pending |
| 2 | `auth.signInWithPassword` | auth.e2e.test.ts | pending |
| 3 | `auth.getSession` | auth.e2e.test.ts | pending |
| 4 | `auth.signOut` | auth.e2e.test.ts | pending |

### Settings (5 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 5 | `settings.select` (fetch by owner_id) | settings.e2e.test.ts | pending |
| 6 | `settings.insert` (create) | settings.e2e.test.ts | pending |
| 7 | `settings.update` site_name | settings.e2e.test.ts | pending |
| 8 | `settings.update` settings JSONB | settings.e2e.test.ts | pending |
| 9 | `settings.select` returns null for new user | settings.e2e.test.ts | pending |

### Transactions (9 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 10 | `transactions.select` years | transactions.e2e.test.ts | pending |
| 11 | `transactions.select` all ordered | transactions.e2e.test.ts | pending |
| 12 | `transactions.select` by year | transactions.e2e.test.ts | pending |
| 13 | `transactions.select` count by year | transactions.e2e.test.ts | pending |
| 14 | `transactions.insert` batch | transactions.e2e.test.ts | pending |
| 15 | `transactions.delete` by year | transactions.e2e.test.ts | pending |
| 16 | `transactions.delete` all | transactions.e2e.test.ts | pending |
| 17 | `transactions.select` latest year | transactions.e2e.test.ts | pending |
| 18 | `transactions.select` years excluding one | transactions.e2e.test.ts | pending |

### Transfers (5 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 19 | `transfers.select` all ordered | transfers.e2e.test.ts | pending |
| 20 | `transfers.insert` batch | transfers.e2e.test.ts | pending |
| 21 | `transfers.delete` by year | transfers.e2e.test.ts | pending |
| 22 | `transfers.delete` all | transfers.e2e.test.ts | pending |
| 23 | `transfers.delete` + re-insert (replace) | transfers.e2e.test.ts | pending |

### Financial Products (5 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 24 | `financial_products.select` all | products.e2e.test.ts | pending |
| 25 | `financial_products.select` by id | products.e2e.test.ts | pending |
| 26 | `financial_products.insert` | products.e2e.test.ts | pending |
| 27 | `financial_products.update` | products.e2e.test.ts | pending |
| 28 | `financial_products.delete` | products.e2e.test.ts | pending |

### Capital Units (13 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 29 | `capital_units.select` all (no product) | units.e2e.test.ts | pending |
| 30 | `capital_units.select` filtered + sorted | units.e2e.test.ts | pending |
| 31 | `capital_units.select` by id | units.e2e.test.ts | pending |
| 32 | `capital_units.insert` single | units.e2e.test.ts | pending |
| 33 | `capital_units.update` single | units.e2e.test.ts | pending |
| 34 | `capital_units.delete` single | units.e2e.test.ts | pending |
| 35 | deploy: verify status + update product/dates | units.e2e.test.ts | pending |
| 36 | recall: clear product + reset status | units.e2e.test.ts | pending |
| 37 | archive: set status '已归档' | units.e2e.test.ts | pending |
| 38 | `capital_units.insert` batch | units.e2e.test.ts | pending |
| 39 | `capital_units.update` batch statuses | units.e2e.test.ts | pending |
| 40 | `capital_units.select` + join product by id | units.e2e.test.ts | pending |
| 41 | `financial_products.select` by ids (for manual join) | units.e2e.test.ts | pending |

### RPC Functions (2 APIs)

| # | Operation | File | Status |
|---|---|---|---|
| 42 | `rpc('get_units_with_products')` | rpc.e2e.test.ts | pending |
| 43 | `rpc('search_transactions_fuzzy')` all params | rpc.e2e.test.ts | pending |

### RLS Security (5 scenarios)

| # | Scenario | File | Status |
|---|---|---|---|
| 44 | anon cannot read any table | rls.e2e.test.ts | pending |
| 45 | user A cannot read user B's transactions | rls.e2e.test.ts | pending |
| 46 | user A cannot read user B's settings | rls.e2e.test.ts | pending |
| 47 | user A cannot read user B's products/units | rls.e2e.test.ts | pending |
| 48 | anon cannot call RPC functions | rls.e2e.test.ts | pending |

**Total: 48 test scenarios across 8 files**

## Test Design Principles

1. **Real database** -- no mocks; tests hit local Supabase Postgres via Docker
2. **Isolated users** -- each test file creates its own user via `auth.signUp`
3. **Clean state** -- `afterAll` deletes all test data using service_role client
4. **Deterministic** -- no dependency on execution order between files
5. **BDD style** -- `describe` blocks map to features, `it` blocks describe behavior

## Git Hooks Integration

- **pre-commit**: `bun run test` (UT only, fast)
- **pre-push**: `bun run test && bun run lint && bun run test:e2e` (UT + Lint + E2E)

> E2E requires Docker + local Supabase running. If `supabase` is not available,
> E2E tests skip gracefully.
