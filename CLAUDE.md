README.md

## MCP Server

Local MCP server (`mcp/`) exposes financial data query and asset CRUD to AI agents via stdio transport.

### Quick Start

```bash
# Set env vars and run
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<anon-key> \
SUPABASE_REFRESH_TOKEN=<your-refresh-token> \
bun run mcp:start
```

### Claude Desktop Config

```json
{
  "mcpServers": {
    "noheir": {
      "command": "bun",
      "args": ["run", "<path-to-project>/mcp/src/index.ts"],
      "env": {
        "SUPABASE_URL": "http://127.0.0.1:54321",
        "SUPABASE_ANON_KEY": "<anon-key>",
        "SUPABASE_REFRESH_TOKEN": "<your-refresh-token>"
      }
    }
  }
}
```

### Tools

#### Query Tools (read-only)

| Tool | Description |
|------|-------------|
| `get_summary` | **Call first.** Returns metadata: available years, accounts, categories (3-level), currencies, tags, counts. Use the returned values as filter parameters for other query tools. |
| `query_transactions` | Search/filter transactions with keyword, type, categories, accounts, tags, amount range, date range, year/month, currency. All params optional, AND logic. Returns `{ transactions[], total_returned }`. |
| `query_transfers` | Search/filter transfers with keyword, accounts, transaction_type, tags, amount range, date range, year/month, currency. All params optional, AND logic. Returns `{ transfers[], total_returned }`. |
| `get_monthly_report` | Monthly aggregation by year+month. Returns income/expense totals, net amount, transfer flows, category breakdowns, currencies. Optional currency filter. |

#### Product CRUD (`financial_products` table)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `list_products` | — | `channel`, `category`, `currency` | `{ products[], total_returned }` |
| `get_product` | `id` (uuid) | — | `{ product }` or `{ product: null }` |
| `create_product` | `name`, `channel`, `category` | `code`, `currency` (default CNY), `lock_period_days` (default 0), `annual_return_rate` | `{ product }` |
| `update_product` | `id` (uuid) + at least 1 field | `name`, `code`, `channel`, `category`, `currency`, `lock_period_days`, `annual_return_rate` | `{ product }` |
| `delete_product` | `id` (uuid) | — | `{ success: true }`. Linked units get `product_id` set to null. |

#### Unit CRUD (`capital_units` table)

| Tool | Required Params | Optional Params | Returns |
|------|----------------|-----------------|---------|
| `list_units` | — | `status`, `strategy`, `tactics`, `currency`, `with_products` (bool, joins product data) | `{ units[], total_returned }` |
| `get_unit` | `id` (uuid) | `with_product` (bool) | `{ unit }` or `{ unit: null }` |
| `create_unit` | `unit_code`, `amount`, `strategy`, `tactics` | `currency` (default CNY), `status` (default '已成立'), `product_id`, `start_date`, `end_date`, `note` | `{ unit }` |
| `update_unit` | `id` (uuid) + at least 1 field | `unit_code`, `amount`, `currency`, `status`, `strategy`, `tactics`, `product_id` (nullable), `start_date` (nullable), `end_date` (nullable), `note` (nullable) | `{ unit }` |
| `delete_unit` | `id` (uuid) | — | `{ success: true }` |

#### Enum Values (DB CHECK constraints)

| Field | Valid Values |
|-------|-------------|
| `channel` | 招商银行, 平安银行, 微众银行, 支付宝, 招银香港, 光大永明, 中信建投 |
| `category` (product) | 养老年金, 储蓄保险, 混债基金, 债券基金, 货币基金, 股票基金, 指数基金, 宽基指数, 私募基金, 定期存款, 理财产品, 现金+ |
| `strategy` | 远期理财, 美元资产, 36存单, 长期理财, 短期理财, 中期理财, 进攻计划, 麻麻理财 |
| `tactics` | 养老年金, 个人养老金, 定期存款, 理财产品, 现金产品, 债券基金, 偏股基金, 稳健理财, 增额寿险, 货币基金 |
| `status` (unit) | 已成立, 计划中, 筹集中, 已归档 |
| `currency` | CNY, USD, HKD |

### Testing

```bash
bun run test:mcp  # 168 tests (51 unit + 38 integration + 59 tool handler + 20 protocol-level)
```

## Test Architecture

### 3-Layer Test Strategy

| Layer | Files | DB Required | Runner |
|-------|-------|-------------|--------|
| Unit (204 tests) | `tests/{domain,viewmodels,contexts,hooks,lib,services,smoke}/` | No | `bun run test:unit` |
| E2E (59 tests) | `tests/e2e/` | Yes (local Supabase) | `bun run test:e2e` |
| MCP E2E (168 tests) | `mcp/tests/` | No (mocked) | `bun run test:mcp` |

### Environment Isolation (Two-Layer Defense)

Unit tests must **never** connect to a real Supabase instance. Two independent mechanisms enforce this:

1. **`.env.test`** — Bun automatically loads this when `NODE_ENV=test` and **skips `.env.local`** entirely. Contains safe dummy values (`http://localhost`, `test-key`).
2. **`tests/setup.ts`** (preload) — Force-overrides `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` unconditionally, catching edge cases like explicit `--env-file` flags.

### Git Hooks

| Hook | Runs | Config |
|------|------|--------|
| pre-commit | Unit tests only | `.husky/pre-commit` |
| pre-push | Unit + Lint + E2E/MCP (if Supabase running) | `.husky/pre-push` |

E2E tests are skipped gracefully with a visible warning box when local Supabase is not running.

### E2E Test Conventions

- E2E helpers live in `tests/e2e/helpers/` with hardcoded `127.0.0.1:54321` + Supabase demo keys.
- `cleanup.ts` uses `service_role` key to delete all user data + auth user after tests.
- E2E tests create isolated test users and clean up after themselves.

## Retrospective

- MCP SDK v1 uses `server.tool(name, description, schema, callback)` with raw Zod shapes; v2 switches to `server.registerTool()` with `z.object()` wrappers.
- Supabase client from mcp/node_modules and root node_modules are separate instances — use `any` type in test files to avoid TS structural mismatch errors.
- `bun:test` LSP errors in editor are cosmetic (bun-types not visible to TS language server for test files) — tests run fine.
- Supabase PostgREST enforces `max_rows` (default 1000) on all `.select()` queries. Never fetch full tables client-side for aggregation — use server-side RPC with `SELECT DISTINCT` / `COUNT(*)` instead.
- MCP auth: hardcoding `access_token` in client headers causes silent failures after JWT expiry (default 1h). Use `setSession()` + `autoRefreshToken: true` so Supabase auto-refreshes.
- When adding new RPC functions, remember to apply the migration SQL on **both** local Supabase (`supabase db reset`) and remote (Dashboard SQL Editor).
