README.md

## MCP Server

Local MCP server (`mcp/`) exposes read-only financial data to AI agents via stdio transport.

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

| Tool | Description |
|------|-------------|
| `query_transactions` | Search/filter transactions with keyword, type, categories, accounts, tags, amount range, date range, year/month, currency |
| `query_transfers` | Search/filter transfers with keyword, accounts, transaction_type, tags, amount range, date range, year/month, currency |
| `get_summary` | Metadata: available years, accounts, categories, currencies, tags, counts |
| `get_monthly_report` | Monthly aggregation: income/expense totals, net amount, transfer flows, category breakdowns, currencies |

### Testing

```bash
bun run test:mcp  # 66 tests (59 tool handler + 7 protocol-level)
```

## Test Architecture

### 3-Layer Test Strategy

| Layer | Files | DB Required | Runner |
|-------|-------|-------------|--------|
| Unit (204 tests) | `tests/{domain,viewmodels,contexts,hooks,lib,services,smoke}/` | No | `bun run test:unit` |
| E2E (59 tests) | `tests/e2e/` | Yes (local Supabase) | `bun run test:e2e` |
| MCP E2E (66 tests) | `mcp/tests/` | No (mocked) | `bun run test:mcp` |

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
