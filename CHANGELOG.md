# Changelog

All notable changes to this project will be documented in this file.

## [2.2.2] - 2026-04-12

MCP query bug fix and comprehensive L1 test coverage for MCP utilities.

### Fixes

- **query_transactions date filtering** — Fixed bug where date/amount/keyword filters were silently ignored due to missing field mappings

### Tests

- **MCP L1 Unit Tests** — 88 new unit tests for MCP pure functions:
  - `compact.test.ts` — 26 tests for round2, compact, shortId, compactArray, categoryPath, currencyCode
  - `types.test.ts` — 9 tests for ok/error helpers
  - `unit-availability.test.ts` — 16 tests for enrichWithAvailability with Date mocking
  - `auth.test.ts` — 17 tests for extractBearerToken, validateOrigin
  - `query-where-conditions.test.ts` — 20 tests for buildWhereConditions + regression test

### Refactoring

- Export helper functions from MCP modules for testability
- Remove unused mock-db.ts

## [2.2.1] - 2026-04-10

CI/CD setup and security fixes.

### Features

- **GitHub Actions CI** — Added CI workflow with base-ci@v2026
- **Gitleaks Integration** — Security scanning with allowlist for test fixtures

### Fixes

- **get_unit tool** — Support unit_code parameter in MCP get_unit tool
- **Worker endpoints** — Remove default limit on units/products endpoints
- **CVE fixes** — Update hono, @hono/node-server, next to address security vulnerabilities

## [2.2.0] - 2026-04-07

MCP server upgrade to base-mcp framework with OAuth 2.1 + Streamable HTTP transport, plus comprehensive E2E test coverage.

### Features

- **MCP OAuth 2.1** — Full OAuth 2.1 authentication with PKCE for secure MCP access
- **Streamable HTTP Transport** — Replaced stdio-based MCP with HTTP transport for better integration
- **base-mcp Framework** — Migrated MCP implementation to @nocoo/base-mcp@0.1.0 for cleaner entity/tool registration

### Tests

- **MCP E2E Test Suite** — 63 E2E tests covering all 16 MCP tools:
  - Product tools: list, get, create, update
  - Unit tools: list, get, create, update  
  - Query tools: query_transactions, query_transfers, get_summary, get_monthly_report
  - Summary tools: get_products_summary, get_units_summary
  - Delete tools: delete_product, delete_unit
- **OAuth Token Helper** — `mcp-auth.ts` enables E2E testing without browser login
- **D1 Test Isolation** — X-Target-DB header support for isolated test database

### Architecture

- **MCP Settings Page** — OAuth client registration with manual token copy flow
- **Worker MCP Integration** — MCP server embedded in Cloudflare Worker at `/mcp/*` routes

## [2.1.0] - 2026-04-06

MCP server optimization with progressive disclosure, summary tools, and context-efficient field selection.

### Features

- **MCP Summary Tools** — New `get_units_summary` and `get_products_summary` tools for lightweight aggregation without fetching raw data
- **Field Selection** — `list_units` and `list_products` now support `fields` parameter with presets: `minimal` (~100B/unit), `standard` (~180B/unit), `full` (~450B/unit)
- **Availability Filter** — `list_units` supports `available_within_days` parameter for server-side filtering of upcoming available units
- **Pagination** — Both list tools support `limit`/`offset` pagination (default: 50, max: 200)
- **Product Archive Support** — `list_products` now exposes `include_archived` parameter
- **Contribution Logs** — Full lifecycle logging for capital unit investments with auto-logging on unit operations
- **Availability System** — Computed availability dates based on `latestInvestLog.operationDate + product.lockPeriodDays`
- **Product Archive** — Archive products instead of delete, with isArchived filter support

### Improvements

- **MCP Tool Descriptions** — Rewrote all tool descriptions following six-component framework (Purpose, Guidelines, Limitations, Parameters, Length, Examples)
- **Progressive Disclosure Pattern** — Summary → Filtered List → Single Item workflow reduces context consumption from 20-50KB to <2KB
- **Nullable Field Handling** — MCP tools properly convert string "null" to JSON null for nullable parameters
- **Pagination Stability** — Consistent `ORDER BY desc(createdAt)` across all list queries

### UI/UX

- **Availability Status Colors** — Green for available (≤0 days), Amber for soon (1-30 days), Red for locked (>30 days)
- **Unified Domain Badges** — Consistent badge styling for unitCode, strategy, tactics, status, currency, product across all pages
- **Warehouse Filters** — Channel and product filters with localStorage persistence
- **Liquidity Page** — Collapsible month sections with upcoming units table
- **UnitEditor Component** — Unified dialog for creating/editing units with product association
- **Comparison Charts** — Year/month pickers with standardized bar charts

### Architecture

- **Worker Summary Endpoints** — `GET /api/units/summary` and `GET /api/products/summary` for aggregated statistics
- **Availability Computation** — Server-side computation in `worker/lib/availability.ts`
- **Contribution Logs Schema** — New `contribution_logs` table tracking invest/recall/adjust operations

### Tests

- 686 tests passing (unit + Worker E2E + MCP)
- New E2E tests for summary endpoints, field presets, pagination, and availability filters

## [2.0.0] - 2026-04-02

Major architecture migration from Supabase to Cloudflare D1 + Worker, with restored settings functionality and improved dashboard experience.

### Breaking Changes

- **Backend Migration** — Migrated from Supabase (PostgreSQL) to Cloudflare D1 (SQLite) + Worker API
- **Auth System** — Switched from Supabase Auth to custom Worker-based authentication
- **API Routes** — Complete RESTful API redesign with resourceful paths

### Features

- **Settings Restoration** — Full settings functionality restored from legacy system:
  - Color scheme toggle (green/red income/expense swap)
  - Theme mode selector (light/dark/system)
  - Income category classification (active vs passive)
  - Expense category classification (fixed vs flexible)
  - Return rate range settings with visual indicator
  - Balance anchor management
  - MCP configuration with full credential support
- **UI Components** — New Slider and Alert components (shadcn/ui Radix-based)
- **Server Actions** — New settings actions: `saveThemeSettings`, `saveActiveIncomeCategories`, `saveFixedExpenseCategories`, `saveReturnRateSettings`, `saveBalanceAnchors`
- **Category Settings Page** — New `/category-settings` route for income/expense classification
- **Balance Anchors Page** — New `/balance-anchors` route for balance anchor management
- **Zod Validation** — Added Zod schemas for products/units enum constraints
- **Month Filter** — Category summary endpoint now supports month filtering

### Improvements

- **Color Scheme Switching** — CSS variable-based color switching for income/expense colors across all pages
- **Chart Focus Fix** — Removed ugly blue focus outline on Recharts chart elements
- **CSS Variables** — Replaced hardcoded Tailwind colors (emerald/rose) with semantic CSS variables (text-income/text-expense)
- **API Naming** — Resourceful year-scoped paths for transactions and transfers
- **Backup Integrity** — Added `findAllByUser()` for backup to prevent silent data truncation
- **Server-Side Aggregation** — Dashboard now uses server-side aggregation APIs instead of client-side

### Fixes

- Align product/unit action payloads with Worker camelCase schema
- Parse tags JSON string from Worker response
- Correct MCP WorkerClient API paths to match Worker routes
- Add HOSTNAME=0.0.0.0 to bind to all interfaces
- Simplify Dockerfile and remove healthcheck for Railway
- Change default PORT to 8080 for Railway compatibility
- Normalize 404 response format across all GET-by-id endpoints
- Align domain mappers to Drizzle camelCase field names

### Architecture

- **D1 Backend** — SQLite-based serverless database on Cloudflare
- **Worker API** — Cloudflare Worker handling all API requests
- **Migration Script** — Supabase → D1 migration for products and units
- **WorkerClient** — New API client with proper path verification

### Tests

- 267 unit tests (all passing)
- WorkerClient unit tests for API path verification
- Export route regression guards (structural shape + multi-row count)

## [0.2.0] - 2026-03-06

First official release. Covers the full journey from initial Next.js scaffold to a production-ready personal finance analytics app with an AI-integrated MCP server.

### Features

- **Dashboard & Analytics** — Year comparison charts, flow analysis, savings rate, financial freedom metrics, transaction analysis, and an AI insight dashboard
- **Basalt UI System** — Full visual overhaul with 3-tier luminance palette, Inter/DM Sans typography, matte card styling, themed light/dark logo, and CSS-variable color tokens
- **Theme Support** — Dark/light mode toggle with FOUC prevention and system theme listener across all pages (login, dashboard, loading, terms, privacy)
- **MCP Server** — stdio-transport MCP server with 12 tools: 4 read-only query tools (`get_summary`, `query_transactions`, `query_transfers`, `get_monthly_report`) and 8 CRUD tools for financial products and capital units
- **MCP Auth** — Email/password-based auth with auto-refresh tokens for reliable long-running sessions
- **Data Management** — Tabbed data management with JSON export/import for transactions, transfers, products, and capital units
- **Asset Management** — Product and capital unit CRUD with deployment, recall, and archive lifecycle support
- **Supabase Backend** — Full schema with RPC functions, Row Level Security, consolidated migrations, and local dev config
- **E2E Test Suite** — 59 E2E tests covering auth, transactions, transfers, settings, products, units, RPC, and RLS security
- **MCP Test Suite** — 168 MCP tests (51 unit + 38 integration + 59 tool handler + 20 protocol-level)
- **Unit Test Suite** — 327 unit tests across domains, viewmodels, contexts, hooks, lib, and services
- **Tab History Routes** — Route-based tab navigation with history support
- **Command Palette** — Dashboard command palette for quick navigation
- **Version System** — Auto-generated version with git hash, commit count, and branch info

### Dependency Upgrades (Phase 1 & 2)

- **tailwind-merge** 2 → 3 (500x perf improvement)
- **date-fns** 3 → 4 (ESM-first, timezone support)
- **vaul** 0.9 → 1.1
- **next-themes** 0.3 → 0.4
- **sonner** 1 → 2 (multi-toaster support)
- **lucide-react** 0.462 → 0.577
- Batch minor/patch updates: supabase-js, framer-motion, react-hook-form, tailwindcss, @tailwindcss/vite, @types/node, bun-types, happy-dom, typescript-eslint, @eslint/js, eslint, @modelcontextprotocol/sdk

### Architecture

- Migrated from Next.js to Vite + React + shadcn/ui
- Migrated from Tailwind CSS v3 to v4 with @tailwindcss/vite
- MVVM pattern with dedicated viewmodels for each analytics domain
- Two-layer test environment isolation (.env.test + preload setup)
- Git hooks: pre-commit (unit tests), pre-push (unit + lint + E2E/MCP)
