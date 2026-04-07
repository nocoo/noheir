# MCP Server v3

> **⚠️ 架构已变更**：MCP OAuth 已从 Worker 迁移到 Next.js。
> 详见 [20-mcp-oauth-nextjs-architecture.md](./20-mcp-oauth-nextjs-architecture.md)

## Overview

The MCP (Model Context Protocol) server is now integrated into Next.js at `src/app/api/mcp/`. It exposes financial data query and management capabilities to AI Agents (Claude Desktop, Cursor, Claude Code) via Streamable HTTP transport with OAuth 2.1 authentication.

**Current Status**: OAuth flow complete, MCP tools pending migration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  MCP Client (Claude Desktop / Cursor / Claude Code)         │
│                                                             │
│  1. POST /api/mcp → 401 Unauthorized                        │
│  2. GET /.well-known/oauth-authorization-server → discover  │
│  3. POST /api/mcp/register → dynamic client registration    │
│  4. Generate PKCE code_verifier + code_challenge            │
│  5. Open browser → /api/mcp/authorize?...                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js (Railway)                                          │
│                                                             │
│  OAuth Endpoints:                                           │
│  ├─ GET  /.well-known/oauth-authorization-server            │
│  ├─ POST /api/mcp/register                                  │
│  ├─ GET  /api/mcp/authorize → redirect to login if needed   │
│  ├─ GET  /api/mcp/callback → generate authorization code    │
│  ├─ POST /api/mcp/token → exchange code for tokens          │
│  └─ POST /api/mcp/revoke → revoke tokens                    │
│                                                             │
│  MCP Endpoint:                                              │
│  └─ POST /api/mcp → Streamable HTTP (OAuth Bearer Token)    │
│                     ↓                                       │
│              SQL API Client                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker (Cloudflare) — SQL API Only                         │
│  ├─ POST /api/v1/query → SELECT                             │
│  └─ POST /api/v1/execute → INSERT/UPDATE/DELETE             │
│            ↓                                                │
│         D1 Database                                         │
└─────────────────────────────────────────────────────────────┘
```

## Client Configuration

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "noheir": {
      "url": "https://noheir.hexly.ai/api/mcp"
    }
  }
}
```

First connection triggers OAuth login via browser. Subsequent connections use stored tokens automatically.

### Cursor

Add the MCP server URL in Cursor settings → MCP Servers.

## Directory Structure

```
src/
├── app/
│   ├── .well-known/oauth-authorization-server/
│   │   └── route.ts              # OAuth metadata (RFC 8414)
│   └── api/mcp/
│       ├── route.ts              # MCP server endpoint
│       ├── authorize/route.ts    # OAuth authorize
│       ├── callback/route.ts     # OAuth callback
│       ├── register/route.ts     # Client registration
│       ├── token/route.ts        # Token exchange
│       └── revoke/route.ts       # Token revocation
├── lib/
│   ├── db.ts                     # SQL API client
│   └── mcp/
│       ├── auth.ts               # Token validation
│       └── server.ts             # MCP server factory (tools TODO)
└── services/
    ├── mcp-clients.ts            # Client CRUD
    ├── mcp-auth-codes.ts         # Auth session CRUD
    └── mcp-tokens.ts             # Token CRUD
```

## Tools

### Query Tools (4)

| Tool | Description |
|------|-------------|
| `query_transactions` | Query income/expense transactions (16 filters) |
| `query_transfers` | Query internal transfers (13 filters) |
| `get_summary` | Get financial metadata (years, accounts, categories) |
| `get_monthly_report` | Get monthly report by year/month |

### Product CRUD (5)

| Tool | Type | Description |
|------|------|-------------|
| `list_products` | Simple Entity | List products with filters |
| `get_product` | Simple Entity | Get product by ID |
| `create_product` | Simple Entity | Create new product |
| `update_product` | Simple Entity | Update product fields |
| `delete_product` | Custom Tool | Archive product + unlink units |

### Unit CRUD (5)

| Tool | Type | Description |
|------|------|-------------|
| `list_units` | Entity + Enrichment | List units with availability info |
| `get_unit` | Entity + Enrichment | Get unit by ID with availability |
| `create_unit` | Entity + Hooks | Create unit (endDate invariant) |
| `update_unit` | Entity + Hooks | Update unit (CAS + contribution logs) |
| `delete_unit` | Custom Tool | Delete unit (checks contribution logs) |

### Summary Tools (2)

| Tool | Description |
|------|-------------|
| `get_products_summary` | Aggregated product stats by channel/category |
| `get_units_summary` | Aggregated unit stats by strategy/tactics |

## Entity Design

### Product Entity (Simple)

Standard CRUD operations. Delete is a custom tool because it needs to:
1. Archive the product (soft delete)
2. Unlink all associated units (set `product_id` to NULL)

### Unit Entity (With Hooks)

**Availability Enrichment**: Each unit includes:
- `daysToAvailable`: Days until funds can be withdrawn
- `availabilityStatus`: "available" | "locked" | "unknown"

**Business Constraints**:
- **endDate Invariant**: `status=已归档` requires endDate; others must have null
- **productId CAS**: Changing productId requires compare-and-swap check
- **Contribution Logs**: productId changes auto-generate withdraw/invest logs

## OAuth 2.1 Flow

### Token Lifecycle

| Token Type | TTL | Rotation |
|------------|-----|----------|
| Authorization Code | 5 min | N/A (one-time) |
| Access Token | 1 hour | N/A |
| Refresh Token | 30 days | Every use |

### Refresh Token Rotation

- Each refresh generates a new refresh token
- Old token marked as rotated
- **Reuse Detection**: If a rotated token is reused, entire token family is revoked (security breach)

### Token Revocation

`POST /mcp/revoke` supports revoking:
- `access_token`: Revokes the access token only
- `refresh_token`: Revokes both access and refresh tokens

## Database Tables

```sql
-- OAuth clients (dynamic registration)
mcp_clients (id, client_id, client_name, redirect_uris, ...)

-- Authorization sessions (authorize → callback)
mcp_auth_sessions (id, state, client_id, code_challenge, code, user_id, ...)

-- Access tokens
mcp_tokens (id, access_token_hash, client_id, user_id, scope, expires_at, ...)

-- Refresh tokens (with rotation tracking)
mcp_refresh_tokens (id, refresh_token_hash, access_token_id, rotated_at, rotated_to, ...)
```

## Testing

```bash
# Run MCP E2E tests
cd worker && bun test tests/e2e/mcp.e2e.ts

# Run all worker tests
cd worker && bun test
```

### Test Coverage

| Layer | File | Tests |
|-------|------|-------|
| OAuth E2E | `worker/tests/e2e/oauth.e2e.ts` | OAuth flow, token refresh, revocation |
| MCP E2E | `worker/tests/e2e/mcp.e2e.ts` | Origin validation, auth, HTTP methods |

## Migration from v2

The v2 stdio-based MCP server in `mcp/` is deprecated. See `mcp/DEPRECATED.md` for migration instructions.

Key differences:
- **Transport**: stdio → Streamable HTTP
- **Auth**: Environment variables → OAuth 2.1 with PKCE
- **Deployment**: Local bun process → Worker integrated
- **Session**: Persistent → Stateless (each request independent)

## Troubleshooting

### "Missing or invalid Authorization header"

OAuth token missing or expired. The client should auto-refresh. If not, disconnect and reconnect to trigger re-authentication.

### "Origin not allowed"

The request origin doesn't match the configured site URL. Ensure the client is making requests from an allowed origin.

### "Token has been revoked"

The token was explicitly revoked (e.g., user logged out). Reconnect to get new tokens.

## Related Documentation

- [Architecture Overview](../README.md)
- [base-mcp Design](./19-base-mcp-and-noheir-rewrite.md)
