# 14 — Gen 2 Architecture Rewrite Plan

> Rewrite noheir from Vite SPA + Supabase (Gen 1) to Next.js 16 + D1/Drizzle (Gen 2).
> Target: basalt Gen 2 standard form, React 19, 6-dim quality S-tier.

## Current State

| Dimension | Now | Target |
|-----------|-----|--------|
| Framework | Vite 7 SPA (pure client-side) | Next.js 16 (SSR + server actions) |
| React | 18 | 19 |
| Routing | react-router-dom 6 (flat tab-based) | Next.js App Router (file-based) |
| Layout | Gen 1 DashboardLayout (props) | Gen 2 AppShell + Sidebar + SidebarContext |
| Auth | Supabase Auth (Google OAuth) | NextAuth v5 (Google OAuth + ALLOWED_EMAILS) |
| Database | Supabase Postgres (5 tables + 5 RPC) | Cloudflare D1 (`noheir-db`) + Drizzle ORM |
| Backend | No backend (client-side SDK) | CF Worker (`noheir`) + proxy.ts + repository pattern |
| Charts | ECharts | Recharts |
| MCP Server | Supabase-backed (email/password auth) | D1-backed via same Worker |
| Deployment | Railway (Railpack, Caddy SPA) | Railway (Dockerfile, Next.js standalone) + CF Worker |
| TypeScript | strict: false, strictNullChecks: false | strict: true + noUncheckedIndexedAccess |
| Testing | 327 unit + 59 E2E + 168 MCP (C-tier) | S-tier (L1/L2/L3 + G1/G2 + D1) |
| Quality | C (G1 strictNull=false) | S |

## Architecture Decisions

### AD-1: Identity Model — Canonical Principal

**Decision:** `users` table with auto-generated UUID primary key. Multi-user future-proof.

NextAuth v5 manages authentication (Google OAuth). On first login, a row is upserted into the `users` table keyed by the provider's `accountId` (Google sub). The `users.id` (UUID) becomes the **sole foreign key** referenced by all other tables' `userId` columns.

```
Google OAuth → NextAuth session (JWT) → session.user.id = users.id (UUID)
                                      ↘ proxy.ts extracts userId from session
                                      ↘ API routes pass userId to repos
                                      ↘ repos filter by userId on every query
```

**Why not email as userId:** Email can change (Google allows it). Provider `accountId` is immutable but opaque. A self-owned `users.id` UUID decouples identity from any provider.

**Auth enforcement boundary (3 layers):**
1. **`proxy.ts` (Next.js)** — rejects unauthenticated browser requests before they reach any page/action
2. **Server actions / Server Components** — extract `session.user.id` via `auth()`, set `X-User-Id` header on Worker requests
3. **Worker `WORKER_TOKEN` check** — rejects requests without valid token. Trusts `X-User-Id` from authenticated callers. Passes userId to repository layer for row-level filtering.
4. **No RLS** — D1/SQLite has no row-level security. Isolation is purely application-level via repository `WHERE user_id = ?`.

**ALLOWED_EMAILS:** Env var restricts who can create accounts (whitelist in `auth.ts` `signIn` callback). But once signed in, all data is keyed by `users.id`, not email.

### AD-2: Database Runtime — Execution Boundary

**Decision:** Drizzle runs **inside the Cloudflare Worker**, not in Next.js.

The full data access stack:

```
┌─────────────────────────────────────┐
│  Next.js (Railway)                  │
│                                     │
│  Server Action / Server Component   │
│    → auth() extracts session.user.id│
│    → WorkerDbClient.call(           │
│        endpoint: "/transactions",   │
│        method: "GET",               │
│        headers: {                   │
│          Authorization: Bearer TOKEN│
│          X-User-Id: <users.id>     │
│        },                           │
│        params: { filters }          │
│      )                              │
│    → HTTP request over network      │
└──────────────┬──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│  Cloudflare Worker                  │
│                                     │
│  1. Verify Bearer token = secret    │
│     (rejects if mismatch)           │
│  2. Read X-User-Id header           │
│     (trusted — only holders of the  │
│      secret token can set this)     │
│  3. Pass userId to repository layer │
│    → Drizzle ORM                    │
│    → D1 binding                     │
│    → JSON response                  │
└─────────────────────────────────────┘
```

**Worker auth model: Trusted Upstream.**

The Worker uses a single shared `WORKER_TOKEN` (env secret). It does **not** contain or derive userId from the token. Instead:

1. **WORKER_TOKEN** proves the caller is a trusted upstream (Next.js server or MCP server) — not a browser, not an arbitrary client.
2. **X-User-Id header** carries the userId. The Worker trusts this value **because only trusted upstreams possess the token**. No token = request rejected before userId is ever read.
3. **The Worker itself has no user/session concept.** It is a pure data access proxy. User authentication lives in Next.js (NextAuth) and MCP (API key). The Worker only enforces "is the caller authorized to talk to me at all" (token check), then passes userId to repositories for row-level filtering.

**Why this is safe:**
- `WORKER_TOKEN` is a server-side secret. The browser never has it (see AD-8).
- Next.js extracts userId from NextAuth session (`auth()`) — unforgeable by the browser.
- MCP extracts userId from its own auth mechanism — also server-side.
- The Worker's trust boundary is: "if you have the token, I trust your userId claim." This is the same model as surety and other family projects.

**Why NOT per-user JWTs:** This is a personal-use app with a whitelist. Adding JWT signing/verification between Next.js and Worker adds complexity with no practical security gain — the only callers are server processes we control. If the project ever becomes multi-tenant with untrusted intermediaries, upgrade to signed JWTs.

**Key implications:**
- `db/schema.ts` and `db/repositories/` live in a **shared package** (or `worker/` directory) used by both the Worker and `:memory:` SQLite tests
- Next.js never imports Drizzle at runtime — it only uses `WorkerDbClient` (typed HTTP client)
- `WorkerDbClient` exposes **high-level typed methods** (`searchTransactions(filters)`, `getMonthlyReport(year, month)`), not raw SQL
- Drizzle `query()` / `select()` calls only happen inside the Worker
- Unit tests import the repository layer directly with `bun:sqlite` `:memory:` — no Worker, no HTTP

**Worker API surface** (REST-like, JSON in/out):

| Method | Endpoint | Maps to |
|--------|----------|---------|
| GET | `/transactions?keyword=...&year=...` | `repos.transactions.search(filters)` |
| POST | `/transactions` | `repos.transactions.create(data)` |
| GET | `/transfers?keyword=...` | `repos.transfers.search(filters)` |
| POST | `/transfers` | `repos.transfers.create(data)` |
| GET | `/products` | `repos.products.findAll(filters)` |
| GET | `/products/:id` | `repos.products.findById(id)` |
| POST | `/products` | `repos.products.create(data)` |
| PUT | `/products/:id` | `repos.products.update(id, data)` |
| DELETE | `/products/:id` | `repos.products.delete(id)` |
| GET | `/units?with_products=true` | `repos.units.findAllWithProducts()` |
| GET | `/units/:id` | `repos.units.findById(id)` |
| POST | `/units` | `repos.units.create(data)` |
| PUT | `/units/:id` | `repos.units.update(id, data)` |
| DELETE | `/units/:id` | `repos.units.delete(id)` |
| GET | `/settings` | `repos.settings.getByUserId(userId)` |
| PUT | `/settings` | `repos.settings.upsert(userId, data)` |
| GET | `/metadata` | `repos.metadata.getAll(userId)` |
| GET | `/reports/monthly?year=...&month=...` | `repos.reports.monthly(userId, year, month, currency?)` |
| POST | `/import/transactions` | Bulk insert (user-scoped) |
| POST | `/import/transfers` | Bulk insert (user-scoped) |
| GET | `/backup` | Export all data **for the requesting userId only** |
| POST | `/restore` | Delete + re-import all data **for the requesting userId only** |

**All endpoints require `userId` via `X-User-Id` header** (set by Next.js server from NextAuth session, or by MCP server from its auth). The Worker trusts this header because only holders of `WORKER_TOKEN` can reach the Worker at all. See AD-2 for the full trust model.

**backup/restore scope:** These are **user-level** operations, not admin-level. `/backup` exports only rows where `userId = X-User-Id`. `/restore` deletes only that user's rows, then inserts the provided data. Other users' data is untouched. This is consistent with the multi-user identity model (AD-1).

### AD-3: Database Schema — Supabase Postgres to D1/Drizzle

**Postgres features used that need D1 alternatives:**

| Postgres Feature | D1/SQLite Alternative |
|------------------|-----------------------|
| `uuid_generate_v4()` | Application-level `crypto.randomUUID()` |
| `auth.uid()` RLS | Application-level user filtering in repository layer |
| Array columns (`text[]` for tags) | JSON text column (`JSON.stringify(tags)`) |
| GIN index on arrays | No equivalent; filter in application |
| `pg_trgm` trigram search | SQLite `LIKE '%keyword%'` (or FTS5 if needed later) |
| `NUMERIC(12,2)` | `INTEGER` (store cents) |
| `JSONB` (settings) | `TEXT` with `JSON.parse()` |
| RPC functions (5) | Repository methods in Worker |
| RLS policies | proxy.ts + repository userId filtering |
| `CHECK` constraints (enums) | Zod validation at API boundary |

**Decision: Store monetary amounts as INTEGER cents** (multiply by 100). Avoids floating-point precision issues entirely. Display layer divides by 100.

**Decision: Tags stored as JSON text** (`'["tag1","tag2"]'`). Parsed in application layer. Search via `LIKE '%"tagname"%'` or dedicated tag junction table if performance requires.

### AD-4: Settings — User-scoped with Unique Constraint

**Decision:** `ownerId` is `NOT NULL` + `UNIQUE`. One settings row per user, enforced at schema level.

Current Supabase `settings` table has nullable `owner_id` and relies on RLS for isolation. This is underspecified. Gen 2 makes it explicit:

```typescript
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull().unique()
    .references(() => users.id, { onDelete: "cascade" }),
  siteName: text("site_name").default(""),
  settings: text("settings").default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

Repository API:
- `settings.getByUserId(userId)` — returns the single row or null
- `settings.upsert(userId, data)` — INSERT OR REPLACE keyed by ownerId

### AD-5: Auth — Supabase Auth to NextAuth v5

Current flow: `supabase.auth.signInWithOAuth({ provider: 'google' })` → Supabase session → RLS.

Target flow: NextAuth v5 `signIn('google')` → JWT session → proxy.ts enforcement → API routes extract `session.user.id`.

- ALLOWED_EMAILS env var for access control (whitelist in `signIn` callback)
- `trustHost: true` for Railway reverse proxy
- Login page follows basalt Badge Card pattern
- `auth.ts` callbacks: `signIn` (whitelist check + upsert users row) → `jwt` (embed `users.id`) → `session` (expose `user.id`)

### AD-6: Routing — Tab-based SPA to File-based App Router

Current: 23 tabs in a single `Index.tsx` page, URL pattern `/:tab`.

Target: Next.js file-based routing with dashboard group.

```
app/
├── layout.tsx              # Root layout (AuthProvider, ThemeProvider)
├── page.tsx                # Redirect to /overview or dashboard
├── login/page.tsx          # Badge login card
├── (dashboard)/
│   ├── layout.tsx          # AppShell wrapper
│   ├── overview/page.tsx
│   ├── financial-health/page.tsx
│   ├── ai-insight/page.tsx
│   ├── savings/page.tsx
│   ├── freedom/page.tsx
│   ├── income/page.tsx
│   ├── expense/page.tsx
│   ├── flow/page.tsx
│   ├── compare/page.tsx
│   ├── account/page.tsx
│   ├── account-detail/page.tsx
│   ├── capital-dashboard/page.tsx
│   ├── capital-decisions/page.tsx
│   ├── warehouse/page.tsx
│   ├── strategy-sunburst/page.tsx
│   ├── liquidity-ladder/page.tsx
│   ├── products/page.tsx
│   ├── funds/page.tsx
│   ├── settings/page.tsx
│   ├── ai-settings/page.tsx
│   ├── account-types/page.tsx
│   ├── manage/page.tsx
│   ├── import/page.tsx
│   └── quality/page.tsx
├── api/
│   ├── auth/[...nextauth]/route.ts
│   └── live/route.ts       # Health check (only local API route)
├── terms/page.tsx
└── privacy/page.tsx
```

**Note:** No data CRUD routes in Next.js *directly*. All data mutations go through Next.js **server actions** which internally call `WorkerDbClient` → Cloudflare Worker. The browser never talks to the Worker. See AD-8 for the trust boundary.

### AD-7: Charts — ECharts to Recharts

All charts need rewriting. Mapping:

| Current (ECharts) | Target (Recharts) |
|-------------------|-------------------|
| ScissorsTrendChart (line) | LineChart + Area |
| FinancialHealthRadar (radar) | RadarChart |
| DistributionPieChart (pie) | PieChart |
| StrategySunburst (sunburst) | Custom TreeMap or nested PieChart |
| LiquidityLadder (bar) | BarChart |
| BalanceWaterfall (custom bar) | BarChart with custom shapes |
| MonthlyChart (bar+line combo) | ComposedChart |
| SavingsRateChart (area) | AreaChart |
| YearComparisonChart (multi-line) | LineChart multi-series |
| IncomeExpenseComparison (grouped bar) | BarChart grouped |
| FlowAnalysis (Sankey-like) | Custom or Sankey from recharts |

**Note:** Sunburst is ECharts-specific. Recharts has no native sunburst. Options: (a) TreeMap, (b) nested donut, (c) keep echarts for this one chart only. **Decision: TreeMap** — simpler, readable, no extra dependency.

### AD-8: Data Architecture — Trust Boundary & Write Path

Current: All data fetched client-side via Supabase SDK → hooks → viewmodels → components.

**Decision: Browser NEVER directly contacts the Cloudflare Worker.**

The `WORKER_URL` and `WORKER_TOKEN` are **server-side only** env vars (`next.config.ts` does NOT expose them via `publicRuntimeConfig` or `NEXT_PUBLIC_*`). The `userId` is **always extracted server-side** from the NextAuth session — never sent by the client.

```
Trust boundary
═══════════════════════════════════════════════════════════════
  Browser (untrusted)          │  Next.js Server (trusted)
                               │
  Server Component renders     │  page.tsx (SSR)
  with data already fetched    │    → auth() extracts userId
                               │    → workerDb.search(userId, ...)
                               │    → props to Client Component
                               │
  Client Component calls       │  Server Action (mutation)
  server action (RPC)          │    → auth() extracts userId
    → "use server" function ──→│    → workerDb.create(userId, ...)
    ← returns result ─────────←│    → returns result
                               │
  NEVER:                       │  Next.js → Worker (HTTPS)
  - fetch(WORKER_URL)          │    → Bearer WORKER_TOKEN header
  - knows WORKER_TOKEN         │    → X-User-Id header (from session)
  - sends userId               │    → JSON response
═══════════════════════════════════════════════════════════════
```

**Read path (SSR):**
1. Server Component `page.tsx` calls `auth()` to get `session.user.id`
2. Calls `workerDb.searchTransactions(userId, filters)` server-side
3. Passes result as props to Client Component
4. Client Component renders with data — no fetch needed

**Write path (Server Actions):**
1. Client Component calls a `"use server"` function (e.g., `createTransaction(formData)`)
2. Server action calls `auth()` to get `session.user.id` — client cannot forge this
3. Server action calls `workerDb.createTransaction(userId, data)`
4. Returns result to client for optimistic UI update

**Refetch path (TanStack Query):**
1. Client Component uses `useQuery()` with a server action as `queryFn`
2. Server action extracts userId server-side, calls Worker, returns data
3. TanStack Query manages cache/revalidation

This means `WorkerDbClient` is **only ever imported in server-side code** (`page.tsx`, `"use server"` files, `route.ts`). It is never bundled into the client bundle.

### AD-9: MCP Server — Supabase to D1 Worker

Current MCP authenticates via Supabase email/password, queries via RPC.

Target MCP connects to the **same Cloudflare Worker** as the Next.js app:
- Reuses `WorkerDbClient` with same `WORKER_TOKEN` + `X-User-Id` header
- MCP's own auth (API key or env-based) determines which userId to set in `X-User-Id`
- MCP tools call typed client methods, not raw SQL
- Same repository layer, same data contract, same trust model

### AD-10: No Data Migration — Fresh Start with Import

**Decision:** No Supabase-to-D1 migration script. Data starts fresh.

The existing import feature (CSV/JSON for transactions and transfers) will be used to restore data after the rewrite. Products and units can be re-imported or re-created. This eliminates:
- UUID mapping complexity
- Amount float→cents conversion edge cases
- User ID remapping risk

---

## RPC → Repository Behavioral Contract

The 5 Supabase RPC functions contain non-obvious behavioral contracts that must be preserved exactly in the repository layer. This section is the **acceptance specification** for Phase 1.

### `search_transactions_fuzzy` → `repos.transactions.search()`

**Input:** 16 optional parameters (keyword, categories[], secondary_categories[], tertiary_categories[], type, accounts[], tags[], start_date, end_date, min_amount, max_amount, limit, offset, year, month, currency).

**Behavioral contract:**

| Behavior | Current SQL | Repository must do |
|----------|-------------|--------------------|
| Keyword matches across 5 fields | `note ILIKE`, `primary_category ILIKE`, `secondary_category ILIKE`, `tertiary_category ILIKE`, `account ILIKE` | SQLite `LIKE '%' \|\| keyword \|\| '%'` on same 5 fields (case-insensitive via `COLLATE NOCASE` or `lower()`) |
| `matched_field` return value | CASE expression returns which field matched ('note', 'category', 'secondary_category', 'tertiary_category', 'account', null) | Must return identical field name strings in response |
| Limit clamping | `LEAST(GREATEST(p_limit, 1), 500)` | Clamp to `[1, 500]` in repository |
| Offset pagination | `LIMIT v_limit OFFSET p_offset` | Same |
| Tags overlap | `t.tags && p_tags` (Postgres array overlap) | Parse JSON tags, check `tags.some(t => filterTags.includes(t))`, or `LIKE` per tag with OR |
| All filters AND logic | Every non-null param adds a WHERE clause | Same — all filters combine with AND |
| Sort order | `ORDER BY t.date DESC, t.created_at DESC` | Same |
| Amount is cents in D1 | `t.amount >= p_min_amount` (float in Postgres) | Compare cents: `amountCents >= minAmountCents` (caller converts) |
| User isolation | `t.user_id = auth.uid()` | `WHERE user_id = ?` (userId param) |

**Response shape:** `{ transactions: Transaction[], total_returned: number }`

### `search_transfers_fuzzy` → `repos.transfers.search()`

**Input:** 13 optional parameters (keyword, accounts[], transaction_type, tags[], start_date, end_date, min_amount, max_amount, limit, offset, year, month, currency).

**Behavioral contract (differences from transactions):**

| Behavior | Current SQL | Repository must do |
|----------|-------------|--------------------|
| Keyword matches across 4 fields | `note ILIKE`, `primary_category ILIKE`, `secondary_category ILIKE`, `account ILIKE` | Same 4 fields with LIKE |
| `matched_field` values | 'note', 'category', 'account' (only 3 distinct values despite 4 fields searched) | Preserve: secondary_category match returns 'category' (current behavior) |
| Amount filter uses GREATEST | `GREATEST(t.inflow_amount, t.outflow_amount) >= p_min_amount` | `MAX(inflowAmountCents, outflowAmountCents) >= minAmountCents` |
| Limit clamping | `LEAST(GREATEST(p_limit, 1), 500)` | Same `[1, 500]` |

**Response shape:** `{ transfers: Transfer[], total_returned: number }`

### `get_units_with_products` → `repos.units.findAllWithProducts()`

**Behavioral contract:**

| Behavior | Current SQL | Repository must do |
|----------|-------------|--------------------|
| LEFT JOIN | `capital_units LEFT JOIN financial_products ON product_id = id` | Drizzle `leftJoin` |
| Product as nested JSON | `to_jsonb(p) AS product` — null when no product | Return `{ ...unit, product: Product \| null }` |
| Sort order | `ORDER BY u.created_at DESC` | Same |
| User isolation | `WHERE u.user_id = auth.uid()` | `WHERE user_id = ?` |

**Response shape:** `{ units: UnitWithProduct[], total_returned: number }`

### `get_financial_metadata` → `repos.metadata.getAll()`

**Behavioral contract:**

| Field | Current SQL | Repository must do |
|-------|-------------|--------------------|
| `years` | `SELECT DISTINCT year FROM transactions UNION transfers`, sorted DESC | Same union + sort |
| `accounts` | `SELECT DISTINCT account FROM transactions UNION transfers`, sorted ASC | Same |
| `categories` | `SELECT DISTINCT primary_category FROM transactions`, sorted ASC | Same |
| `secondary_categories` | `SELECT DISTINCT secondary_category FROM transactions WHERE NOT NULL AND != ''`, sorted ASC | Same null/empty filter |
| `tertiary_categories` | Same pattern as secondary | Same |
| `currencies` | `SELECT DISTINCT currency FROM transactions UNION transfers`, sorted ASC | Same |
| `tags` | `SELECT DISTINCT unnest(tags) FROM transactions UNION transfers`, sorted ASC | Parse JSON tags, collect unique, sort |
| `transaction_count` | `SELECT count(*) FROM transactions` | Same |
| `transfer_count` | `SELECT count(*) FROM transfers` | Same |

**Response shape:** Exact JSON structure preserved — MCP tools depend on these field names.

### `get_monthly_report` → `repos.reports.monthly()`

**Input:** year (required), month (required), currency (optional filter).

**Behavioral contract:**

| Field | Current SQL | Repository must do |
|-------|-------------|--------------------|
| `total_income` | `SUM(amount) WHERE type='income'` | `SUM(amountCents)` → return as cents |
| `total_expense` | `SUM(amount) WHERE type='expense'` | Same |
| `net_amount` | `SUM(CASE income THEN amount, expense THEN -amount)` | Same sign logic with cents |
| `transaction_count` | `count(*)` filtered | Same |
| `transfer_count` | `count(*)` filtered | Same |
| `total_transfer_in` | `SUM(inflow_amount)` | `SUM(inflowAmountCents)` |
| `total_transfer_out` | `SUM(outflow_amount)` | `SUM(outflowAmountCents)` |
| `expense_by_category` | `GROUP BY primary_category, ORDER BY total DESC` | Same grouping + sort |
| `income_by_category` | Same pattern | Same |
| `currencies` | DISTINCT currencies from both tables for that month | Same |
| Optional currency filter | `AND (p_currency IS NULL OR currency = p_currency)` on every sub-query | Same |

**Response shape:** Exact JSON structure preserved — MCP and UI both consume this.

---

## Migration Phases

### Phase 0: Scaffold & Infrastructure (no feature work)

**Goal:** Next.js 16 project skeleton with Gen 2 layout, auth, D1, and quality gates.

| # | Commit | Description | Files | Status |
|---|--------|-------------|-------|--------|
| 0.1a | `chore: archive Gen 1 codebase to _archive/` | Move (not delete) all Gen 1 source into `_archive/` for reference during rewrite. Old code stays accessible for copy-paste and comparison. `_archive/` is gitignored after Phase 5 cutover and deleted once rewrite is verified. | See "Phase 0.1a: Archive Scope" below | **DONE** |
| 0.1b | `feat: scaffold Next.js 16 project` | `create-next-app` with App Router, React 19, Tailwind v4, TypeScript strict. Copy design tokens from `_archive/src/index.css` to `app/globals.css`. Configure `next.config.ts` (standalone output). | `package.json`, `next.config.ts`, `tsconfig.json`, `app/globals.css`, `app/layout.tsx` | **DONE** |
| 0.2 | `feat: add Gen 2 layout system` | Port `_archive/src/components/layout/DashboardLayout.tsx` (539 lines) → `app-shell.tsx` + `sidebar.tsx` + `sidebar-context.tsx`. Extract nav config to `lib/navigation.ts`. | `components/layout/{app-shell,sidebar,sidebar-context,index}.tsx`, `lib/navigation.ts` | **DONE** |
| 0.3 | `feat: add NextAuth v5 Google OAuth with users table` | `auth.ts` with Google provider + ALLOWED_EMAILS + signIn callback that upserts `users` row. `proxy.ts` for auth enforcement. `lib/proxy-logic.ts` (pure, testable). Badge login page. | `auth.ts`, `proxy.ts`, `lib/proxy-logic.ts`, `app/login/page.tsx` |
| 0.4 | `feat: add D1 database schema with Drizzle` | 6 tables: `users` + 5 data tables. See Drizzle Schema section. Lives in shared `worker/db/` directory. | `worker/db/schema.ts`, `worker/db/types.ts`, `drizzle.config.ts` |
| 0.5 | `feat: add repository layer` | Repository factory per table inside `worker/db/repositories/`. Each method takes `userId` as explicit parameter. `createAllRepos(db)` compositor. | `worker/db/repositories/{transactions,transfers,products,units,settings,metadata,reports,index}.ts` |
| 0.6 | `feat: add Cloudflare Worker with Hono router` | Worker entry point (`noheir` worker, domain `noheir.worker.hexly.ai`). Bearer token auth + `X-User-Id` header. `X-Target-DB` header routes to `DB` or `DB_TEST` binding. Routes map to repository methods. Drizzle runs inside Worker. | `worker/src/index.ts`, `worker/wrangler.toml` |
| 0.7 | `feat: add WorkerDbClient` | Typed HTTP client used by Next.js. Methods mirror Worker endpoints. No Drizzle import. | `src/lib/worker-db-client.ts`, `src/lib/api-helpers.ts` |
| 0.8 | `feat: add quality infrastructure (husky + lint + typecheck)` | husky v9 pre-commit (test:coverage + lint-staged + typecheck), pre-push (osv-scanner + gitleaks + E2E). ESLint strict + max-warnings=0. tsconfig strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes. | `.husky/{pre-commit,pre-push}`, `eslint.config.js`, `tsconfig.json`, `scripts/check-coverage.ts` |
| 0.9 | `feat: add health check and version` | `/api/live` health endpoint. `lib/version.ts` from package.json. | `app/api/live/route.ts`, `lib/version.ts` |

#### Phase 0.1a: Archive Scope

**Strategy:** `git mv` all Gen 1 files into `_archive/`, preserving directory structure. Old code stays in repo history and is directly browsable during rewrite for copy-paste and comparison. Deleted after Phase 5 cutover is verified.

```bash
# Move to archive (one commit)
mkdir _archive
git mv src/ _archive/src/
git mv tests/ _archive/tests/
git mv supabase/ _archive/supabase/
git mv mcp/ _archive/mcp/
git mv index.html _archive/
git mv vite.config.ts _archive/
git mv tsconfig.app.json _archive/
git mv tsconfig.node.json _archive/
git mv bunfig.toml _archive/
git mv components.json _archive/
git mv .env.test _archive/
```

**Stays in place (not archived):**

| File/Dir | Reason |
|----------|--------|
| `docs/` | Documentation (including this rewrite plan) |
| `public/` | Static assets (logos, favicons, manifest) — reused as-is |
| `logo.png` | Source logo for `scripts/resize-logos.py` |
| `scripts/` | Utility scripts (resize-logos, hex_to_hsl) — reused |
| `.husky/` | Skeleton stays, hook content rewritten in Phase 0.8 |
| `.env.example` | Updated with new env vars |
| `.env.local` | Local dev config (not in git) |
| `CLAUDE.md` | Project instructions — updated after rewrite |
| `README.md` | Updated after rewrite |
| `CHANGELOG.md` | Continued |
| `package.json` | Replaced by `create-next-app` output in 0.1b |
| `tsconfig.json` | Replaced by Next.js config in 0.1b |
| `eslint.config.js` | Replaced in 0.8 |

**Cleanup (Phase 5.6):**
```bash
rm -rf _archive/
# Commit: chore: remove Gen 1 archive after rewrite verification
```

### Phase 1: Worker API (backend-first, no UI)

**Goal:** All Worker endpoints working and tested. Behavioral contracts from RPC section verified.

| # | Commit | Description |
|---|--------|-------------|
| 1.1 | `feat: add transactions search + CRUD` | `repos.transactions.search()` with full 16-param filter, `matched_field`, limit clamping `[1,500]`, offset pagination, tags JSON overlap, AND logic, `ORDER BY date DESC, created_at DESC`. CRUD: create, update, delete. |
| 1.2 | `feat: add transfers search + CRUD` | `repos.transfers.search()` with 13-param filter, `GREATEST(inflow, outflow)` for amount filter, `matched_field` values preserved. CRUD. |
| 1.3 | `feat: add products CRUD` | list (with channel/category/currency filters), get by id, create, update, delete. Zod validation for enum fields. |
| 1.4 | `feat: add units CRUD + findAllWithProducts` | LEFT JOIN via Drizzle, `product` as nested object or null. All CRUD ops. |
| 1.5 | `feat: add settings upsert` | GET returns single row by userId (or null). PUT does INSERT OR REPLACE keyed by `ownerId` UNIQUE constraint. |
| 1.6 | `feat: add metadata aggregation` | `repos.metadata.getAll()` — 9 fields, UNION queries for years/accounts/currencies/tags, DISTINCT with null/empty filtering for categories. Exact JSON field names preserved. |
| 1.7 | `feat: add monthly report aggregation` | `repos.reports.monthly()` — income/expense/net/transfer totals, category breakdowns sorted by total DESC, optional currency filter applied to every sub-query. |
| 1.8 | `feat: add bulk import endpoints` | `/import/transactions`, `/import/transfers` — CSV/JSON bulk insert. |
| 1.9 | `feat: add backup/restore endpoints` | `/backup` exports all tables for requesting userId as JSON. `/restore` deletes requesting user's data then bulk inserts. Never touches other users' rows. |
| 1.10 | `test: add L1 unit tests for repositories` | Test all repository methods with `:memory:` SQLite. Verify every behavioral contract from RPC section. 90% coverage. |
| 1.11 | `test: add L2 E2E tests for Worker API` | Start Worker locally, test all endpoints. Verify response shapes match MCP/UI expectations. |

### Phase 2: Domain Logic Port (pure functions, no UI)

**Goal:** Port all 24 domain modules and 31 viewmodels. Maximum test coverage.

| # | Commit | Description |
|---|--------|-------------|
| 2.1 | `feat: port domain/dashboard logic` | Port 11 dashboard domain modules. Pure functions, no React. Adapt to INTEGER cents (divide by 100 for display). |
| 2.2 | `feat: port domain/assets logic` | Port 4 asset domain modules. |
| 2.3 | `feat: port domain/settings logic` | Port 9 settings domain modules. |
| 2.4 | `feat: port viewmodels to server-compatible form` | Port 31 viewmodels. Separate server-fetchable data from client-interactive state. VMs that only compute derived data become plain functions called in Server Components. VMs that manage interactive state remain as hooks in Client Components. |
| 2.5 | `test: add L1 tests for domain + viewmodels` | Port and adapt existing 327 unit tests. Target 90% coverage. |

### Phase 3: UI Migration (page by page)

**Goal:** Port all 23 pages from tab-based to file-based routing. Replace ECharts with Recharts.

**Strategy:** Port pages in dependency order — shared components first, then pages that depend on them.

| # | Commit | Description |
|---|--------|-------------|
| 3.0 | `feat: port shared UI components` | Port shadcn/ui components, ChartCard, StatCard, shared chart components. Replace ECharts imports with Recharts. |
| 3.1 | `feat: port overview page` | `(dashboard)/overview/page.tsx` — Server Component fetches summary via WorkerDbClient, passes to Client Components with Recharts charts. |
| 3.2 | `feat: port financial-health page` | Radar chart → Recharts RadarChart. |
| 3.3 | `feat: port ai-insight page` | AI insight display + settings. |
| 3.4 | `feat: port cash flow pages (6)` | savings, freedom, income, expense, flow, compare. All chart replacements. |
| 3.5 | `feat: port account pages (2)` | account, account-detail. |
| 3.6 | `feat: port capital pages (7)` | capital-dashboard, capital-decisions, warehouse, strategy-sunburst (→TreeMap), liquidity-ladder, products, funds. |
| 3.7 | `feat: port system pages (6)` | settings, ai-settings, account-types, manage, import, quality. |
| 3.8 | `feat: port terms and privacy pages` | Static pages, straightforward. |
| 3.9 | `feat: port command palette (cmdk)` | ⌘K search across all pages. |
| 3.10 | `test: add L3 Playwright tests` | Core user flows: login → overview → navigate → settings. |

### Phase 4: MCP Server Rewrite

**Goal:** MCP server queries D1 via the same Cloudflare Worker.

| # | Commit | Description |
|---|--------|-------------|
| 4.1 | `feat: rewrite MCP server for D1 backend` | Replace Supabase client with `WorkerDbClient`. Same 14 tools, same response shapes. |
| 4.2 | `feat: update MCP auth to API key` | Replace Supabase email/password auth with Worker Bearer token. |
| 4.3 | `test: update MCP tests` | Adapt 168 tests to new backend. Mock WorkerDbClient for unit tests. |

### Phase 5: Infrastructure & Deployment

**Goal:** Deploy new stack in parallel with old. Verify. Cut over DNS. Tear down old.

**Strategy: Blue-Green with DNS cutover.** The old Railway service (Vite SPA + Caddy) keeps running on `noheir.hexly.ai` throughout development. The new Next.js service deploys to a separate Railway service with a temporary URL. Only after full verification does `noheir.hexly.ai` point to the new service.

#### Infrastructure Topology

```
┌─ Cloudflare ──────────────────────────────────────────────┐
│                                                           │
│  D1 Databases                                             │
│  ┌─────────────────┐  ┌─────────────────────┐            │
│  │ noheir-db       │  │ noheir-db-test      │            │
│  │ (production)    │  │ (E2E tests only)    │            │
│  └────────┬────────┘  └────────┬────────────┘            │
│           │                    │                          │
│  Worker: noheir                                           │
│  ┌─────────────────────────────────────────┐             │
│  │ noheir.worker.hexly.ai                  │             │
│  │                                         │             │
│  │ Hono router + Drizzle ORM               │             │
│  │ Bearer WORKER_TOKEN auth                │             │
│  │ X-User-Id → repository userId           │             │
│  │                                         │             │
│  │ D1 binding: DB → noheir-db (prod)       │             │
│  │ D1 binding: DB_TEST → noheir-db-test    │             │
│  │ Header X-Target-DB: test → use DB_TEST  │             │
│  └─────────────────────────────────────────┘             │
│                                                           │
└───────────────────────────────────────────────────────────┘
         ▲                          ▲
         │ HTTPS                    │ HTTPS
         │                          │
┌────────┴──────────┐    ┌─────────┴──────────┐
│ Railway            │    │ MCP Server (local)  │
│ Next.js 16         │    │ stdio transport     │
│ noheir.hexly.ai    │    │ WorkerDbClient      │
│                    │    │ + WORKER_TOKEN      │
│ Server Components  │    │ + X-User-Id         │
│ Server Actions     │    └────────────────────┘
│ WorkerDbClient     │
│ + WORKER_TOKEN     │
│ + X-User-Id        │
└────────────────────┘
```

**Naming conventions:**

| Resource | Name | Domain | Purpose |
|----------|------|--------|---------|
| CF D1 database (prod) | `noheir-db` | — | Production data |
| CF D1 database (test) | `noheir-db-test` | — | E2E test isolation (D1 quality dimension) |
| CF Worker | `noheir` | `noheir.worker.hexly.ai` | Data access proxy (Drizzle + Hono) |
| Railway service (new) | `noheir` | `noheir.hexly.ai` (after cutover) | Next.js 16 frontend |
| Railway service (old) | `noheir-legacy` | (renamed, then deleted) | Gen 1 Vite SPA (keep alive during transition) |

**D1 test isolation (6-dim D1 quality dimension):**
- `noheir-db-test` is a **separate D1 database**, not a table prefix or flag
- Worker exposes both via bindings: `DB` (prod) and `DB_TEST` (test)
- E2E test harness sends `X-Target-DB: test` header alongside `WORKER_TOKEN`
- Worker routes to `DB_TEST` binding when this header is present
- **Unit tests don't use D1 at all** — they import repositories directly with `:memory:` SQLite
- Production requests never include `X-Target-DB` header → always hits `DB` (prod)

**No direct D1 access:** Neither Next.js nor MCP ever imports `@cloudflare/d1` or uses D1 HTTP API directly. All D1 access goes through the Worker. This is enforced by: (a) no D1 credentials in Next.js/MCP env, (b) `WorkerDbClient` is the sole data access interface.

#### Phase 5 Commits

| # | Commit | Description |
|---|--------|-------------|
| 5.1 | `feat: add Cloudflare Worker wrangler config` | `worker/wrangler.toml` with D1 bindings (`noheir-db` as DB, `noheir-db-test` as DB_TEST). Custom domain `noheir.worker.hexly.ai`. `X-Target-DB` header routing logic. |
| 5.2 | `chore: create D1 databases and deploy Worker` | `wrangler d1 create noheir-db` + `wrangler d1 create noheir-db-test`. `wrangler deploy`. Apply Drizzle migrations to both databases. Set `WORKER_TOKEN` secret. Verify Worker health at `noheir.worker.hexly.ai`. |
| 5.3 | `feat: add Dockerfile for Railway` | Three-stage Bun build (deps → builder → runner). `AUTH_SECRET=build-placeholder` at build time. `output: 'standalone'` in next.config.ts. |
| 5.4 | `chore: disconnect old Railway auto-deploy` | Rename old Railway service to `noheir-legacy`. **Disconnect GitHub auto-deploy** on old service to prevent Gen 2 commits from breaking the live Vite SPA. Old service stays running on its current build. |
| 5.5 | `chore: deploy new Railway service` | Create new Railway service `noheir`. Connect GitHub repo with auto-deploy on `main`. Set env vars: `WORKER_URL=https://noheir.worker.hexly.ai`, `WORKER_TOKEN`, `AUTH_SECRET`, `ALLOWED_EMAILS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`. Deploy. Verify on Railway's temporary domain. |
| 5.6 | `chore: import data via UI` | Sign in on temporary domain (creates user row), then use the import feature to restore transactions and transfers from CSV. Re-create products and units. All data keyed to the authenticated user's `users.id`. |
| 5.7 | `chore: verify new deployment` | Full smoke test on temporary domain: all 23 pages render, charts display, CRUD works, import/export works, MCP tools connect. Compare key pages against old `noheir-legacy` visually. |
| 5.8 | `chore: cut over DNS to new service` | Point `noheir.hexly.ai` to the new Railway service. Update `NEXTAUTH_URL` to `https://noheir.hexly.ai`. Update Google OAuth redirect URI. Verify auth flow on production domain. |
| 5.9 | `chore: tear down old infrastructure` | Delete `noheir-legacy` Railway service. Cancel Supabase project (or downgrade to free tier as backup for 30 days). `rm -rf _archive/`. |

### Phase 6: Quality S-Tier Certification

| # | Commit | Description |
|---|--------|-------------|
| 6.1 | `chore: verify L1 — unit test coverage >= 90%` | All domain, viewmodel, repository, proxy-logic tests passing. |
| 6.2 | `chore: verify G1 — strict lint + typecheck` | `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. ESLint `max-warnings=0`. `tsc --noEmit` in pre-commit. |
| 6.3 | `chore: verify L2 — E2E API tests in pre-push` | Worker E2E tests in pre-push hook. All endpoints covered. |
| 6.4 | `chore: verify G2 — security scanning` | `gitleaks detect` + `osv-scanner --lockfile=bun.lock` in pre-push. |
| 6.5 | `chore: verify L3 — Playwright browser tests` | Core flows tested in CI. |
| 6.6 | `chore: verify D1 — test isolation` | Unit tests use `:memory:` SQLite (no network). E2E tests use `noheir-db-test` via `X-Target-DB: test` header. Production `noheir-db` is never touched by any test. |

---

## Database Schema (Drizzle)

```typescript
// worker/db/schema.ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// --- Identity ---

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  providerAccountId: text("provider_account_id").notNull().unique(), // Google sub
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// --- Financial Data ---

export const financialProducts = sqliteTable("financial_products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code"),
  channel: text("channel"),
  category: text("category"),
  currency: text("currency").default("CNY"),
  lockPeriodDays: integer("lock_period_days").default(0),
  annualReturnRate: real("annual_return_rate"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const capitalUnits = sqliteTable("capital_units", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  unitCode: text("unit_code").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").default("CNY"),
  status: text("status").default("已成立"),
  strategy: text("strategy"),
  tactics: text("tactics"),
  productId: text("product_id").references(() => financialProducts.id, { onDelete: "set null" }),
  startDate: text("start_date"),
  endDate: text("end_date"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  primaryCategory: text("primary_category").notNull(),
  secondaryCategory: text("secondary_category"),
  tertiaryCategory: text("tertiary_category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  type: text("type").notNull(),
  account: text("account").notNull(),
  currency: text("currency").default("人民币").notNull(),
  tags: text("tags").default("[]"),
  note: text("note"),
  rawIndex: integer("raw_index"),
  hasSecondaryMapping: integer("has_secondary_mapping", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const transfers = sqliteTable("transfers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  primaryCategory: text("primary_category"),
  secondaryCategory: text("secondary_category").default("转账"),
  transactionType: text("transaction_type"),
  inflowAmountCents: integer("inflow_amount_cents").default(0),
  outflowAmountCents: integer("outflow_amount_cents").default(0),
  currency: text("currency").default("人民币").notNull(),
  account: text("account").notNull(),
  tags: text("tags").default("[]"),
  note: text("note"),
  rawIndex: integer("raw_index"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull().unique()
    .references(() => users.id, { onDelete: "cascade" }),
  siteName: text("site_name").default(""),
  settings: text("settings").default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Sunburst chart has no Recharts equivalent** | Medium | Use TreeMap. If unacceptable, keep echarts for this one chart only. |
| **D1 has no array columns or GIN indexes** | Medium | Tags as JSON text + application-level filtering. For < 10k transactions this is fine. |
| **5 RPC functions contain complex behavioral contracts** | High | Contracts fully specified in "RPC → Repository Behavioral Contract" section. Each contract has explicit acceptance criteria. Unit tests verify every behavior. |
| **23 pages is a large UI migration** | High | Phase 3 is the longest phase. Can be parallelized by page groups. |
| **Worker ↔ Next.js network latency** | Medium | `noheir.worker.hexly.ai` deployed to Cloudflare edge (auto-routed, nearest PoP to Railway Singapore). Batch endpoints for import/export reduce roundtrips. |
| **MCP server needs new auth mechanism** | Medium | Phase 4 is self-contained and can be done last. Reuses same WorkerDbClient. |
| **D1 row limits (< 10 million rows per database)** | Low | Personal finance app. < 50k rows total expected. |
| **Server action serialization overhead** | Low | All mutation data is small JSON. Read-heavy workload is SSR (no serialization boundary). |

---

## Dependency Removals

| Package | Reason |
|---------|--------|
| `@supabase/supabase-js` | Replaced by D1 + Drizzle |
| `echarts` | Replaced by Recharts |
| `echarts-for-react` | Replaced by Recharts |
| `react-router-dom` | Replaced by Next.js App Router |
| `react` (v18) | Upgraded to v19 |
| `react-dom` (v18) | Upgraded to v19 |
| `@vitejs/plugin-react-swc` | Replaced by Next.js compiler |
| `vite` | Replaced by Next.js |
| `@tailwindcss/vite` | Replaced by `@tailwindcss/postcss` for Next.js |

## Dependency Additions

| Package | Purpose |
|---------|---------|
| `next` (16) | Framework |
| `react` (19) | UI library |
| `next-auth` (v5) | Authentication |
| `drizzle-orm` | Database ORM (Worker-side) |
| `drizzle-kit` | Migration tooling |
| `hono` | Cloudflare Worker router |
| `recharts` | Charts (already a dep, becomes primary) |
| `@playwright/test` | L3 browser testing |
| `osv-scanner` (system) | G2 vulnerability scanning |
| `gitleaks` (system) | G2 secret scanning |

---

## Success Criteria

- [ ] All 23 pages render correctly with real data
- [ ] All existing functionality preserved (no feature regression)
- [ ] Gen 2 layout: AppShell + Sidebar + SidebarContext
- [ ] React 19 with Server Components for data fetching
- [ ] D1 databases: `noheir-db` (prod) + `noheir-db-test` (test isolation)
- [ ] CF Worker `noheir` at `noheir.worker.hexly.ai` — sole D1 access point
- [ ] No direct D1 access from Next.js or MCP (only via Worker)
- [ ] `users` table with UUID PK, all data tables FK to `users.id`
- [ ] `settings.ownerId` NOT NULL + UNIQUE
- [ ] NextAuth v5 Google OAuth working
- [ ] All charts converted from ECharts to Recharts
- [ ] proxy.ts auth enforcement (no direct DB access from client)
- [ ] All 5 RPC behavioral contracts preserved (matched_field, limit clamping, tags overlap, GREATEST amount filter, metadata field names)
- [ ] 6-dim quality S-tier:
  - L1: Unit tests >= 90% coverage, pre-commit
  - L2: E2E API tests (via `noheir-db-test`), pre-push
  - L3: Playwright browser tests
  - G1: strict TS + ESLint max-warnings=0, pre-commit
  - G2: gitleaks + osv-scanner, pre-push
  - D1: `:memory:` SQLite for unit, `noheir-db-test` for E2E, `noheir-db` never touched by tests
- [ ] MCP server working with same Worker backend
- [ ] Railway deployment successful (Next.js standalone + Dockerfile)
- [ ] Old Railway service (`noheir-legacy`) deleted
- [ ] Supabase project decommissioned
- [ ] Production URL unchanged: https://noheir.hexly.ai
- [ ] Data restored via import feature (no migration script)
