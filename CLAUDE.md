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

### Testing

```bash
bun run test:mcp  # 42 tests (36 tool handler + 6 protocol-level)
```

## Retrospective

- MCP SDK v1 uses `server.tool(name, description, schema, callback)` with raw Zod shapes; v2 switches to `server.registerTool()` with `z.object()` wrappers.
- Supabase client from mcp/node_modules and root node_modules are separate instances — use `any` type in test files to avoid TS structural mismatch errors.
- `bun:test` LSP errors in editor are cosmetic (bun-types not visible to TS language server for test files) — tests run fine.
