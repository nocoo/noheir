# 20 — MCP OAuth Next.js 架构

> 2026-04-07 重构完成：MCP OAuth 从 Worker 迁移到 Next.js，Worker 仅提供 SQL API。

## 1. 架构概述

```
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Client (Claude Desktop / Cursor / Claude Code)                 │
│                                                                     │
│  1. POST /api/mcp → 401 Unauthorized                                │
│  2. GET /.well-known/oauth-authorization-server → 发现端点           │
│  3. POST /api/mcp/register → 动态客户端注册                          │
│  4. 生成 PKCE code_verifier + code_challenge                        │
│  5. 打开浏览器 → /api/mcp/authorize?...                             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js (Railway)                                                  │
│                                                                     │
│  OAuth Endpoints:                                                   │
│  ├─ GET  /.well-known/oauth-authorization-server → 元数据           │
│  ├─ POST /api/mcp/register → 客户端注册                             │
│  ├─ GET  /api/mcp/authorize → 创建 auth session, 跳转登录           │
│  ├─ GET  /api/mcp/callback → 生成 authorization code                │
│  ├─ POST /api/mcp/token → 交换 access/refresh token                 │
│  └─ POST /api/mcp/revoke → 撤销 token                               │
│                                                                     │
│  MCP Endpoint:                                                      │
│  └─ POST /api/mcp → Streamable HTTP (验证 Bearer Token)             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  src/lib/db.ts (SQL API Client)                             │   │
│  │  query(), execute(), batch(), firstOrNull()                 │   │
│  └────────────────────────┬────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ HTTP + WORKER_SECRET
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Worker (Cloudflare)                                                │
│                                                                     │
│  SQL API Only:                                                      │
│  ├─ POST /api/v1/query → SELECT 查询                                │
│  └─ POST /api/v1/execute → INSERT/UPDATE/DELETE                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  D1 Database (SQLite)                                       │   │
│  │  mcp_clients, mcp_auth_sessions, mcp_tokens, mcp_refresh_*  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 目录结构

```
noheir/
├── src/
│   ├── app/
│   │   ├── .well-known/oauth-authorization-server/
│   │   │   └── route.ts          # OAuth 元数据 (RFC 8414)
│   │   └── api/mcp/
│   │       ├── route.ts          # MCP Server endpoint
│   │       ├── authorize/route.ts
│   │       ├── callback/route.ts
│   │       ├── register/route.ts
│   │       ├── token/route.ts
│   │       └── revoke/route.ts
│   │
│   ├── lib/
│   │   ├── db.ts                 # SQL API Client (calls Worker)
│   │   └── mcp/
│   │       ├── auth.ts           # Token validation
│   │       └── server.ts         # MCP server factory
│   │
│   └── services/
│       ├── mcp-clients.ts        # Client CRUD
│       ├── mcp-auth-codes.ts     # Auth session CRUD
│       └── mcp-tokens.ts         # Token CRUD
│
└── worker/
    └── src/index.ts              # SQL API endpoints only
```

## 3. OAuth 2.1 + PKCE 流程

### 3.1 完整流程

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   MCP Client     │     │    Next.js       │     │    Browser       │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │ 1. POST /api/mcp       │                        │
         │ ───────────────────────>                        │
         │        401 Unauthorized│                        │
         │ <───────────────────────                        │
         │                        │                        │
         │ 2. GET /.well-known/   │                        │
         │    oauth-auth-server   │                        │
         │ ───────────────────────>                        │
         │        OAuth metadata  │                        │
         │ <───────────────────────                        │
         │                        │                        │
         │ 3. POST /api/mcp/      │                        │
         │    register            │                        │
         │ ───────────────────────>                        │
         │        client_id       │                        │
         │ <───────────────────────                        │
         │                        │                        │
         │ 4. Generate PKCE       │                        │
         │    code_verifier       │                        │
         │    code_challenge      │                        │
         │                        │                        │
         │ 5. Open browser ──────────────────────────────────>
         │    /api/mcp/authorize? │                        │
         │    client_id=...&      │                        │
         │    code_challenge=...  │                        │
         │                        │                        │
         │                        │ 6. Create auth session │
         │                        │ 7. Redirect to login   │
         │                        │ <───────────────────────
         │                        │                        │
         │                        │ 8. User authenticates  │
         │                        │    (Google OAuth)      │
         │                        │ ───────────────────────>
         │                        │                        │
         │                        │ 9. Redirect to callback│
         │                        │ <───────────────────────
         │                        │                        │
         │                        │10. Generate auth code  │
         │                        │11. Redirect to client  │
         │                        │    localhost callback  │
         │ <──────────────────────────────────────────────────
         │    ?code=...&state=... │                        │
         │                        │                        │
         │12. POST /api/mcp/token │                        │
         │    code + code_verifier│                        │
         │ ───────────────────────>                        │
         │    access_token +      │                        │
         │    refresh_token       │                        │
         │ <───────────────────────                        │
         │                        │                        │
         │13. POST /api/mcp       │                        │
         │    Authorization:      │                        │
         │    Bearer <token>      │                        │
         │ ───────────────────────>                        │
         │    MCP response        │                        │
         │ <───────────────────────                        │
```

### 3.2 Token 生命周期

| Token Type | TTL | 用途 |
|------------|-----|------|
| Authorization Code | 10 min | 一次性，换取 token |
| Access Token | 30 days | MCP 请求认证 |
| Refresh Token | 90 days | 刷新 access token |

### 3.3 Token Rotation

每次使用 refresh token 时：
1. 发放新的 access token + refresh token
2. 撤销该 client+user 的所有旧 token
3. 防止 token 泄露后被滥用

## 4. 数据库表

```sql
-- OAuth 客户端（动态注册）
CREATE TABLE mcp_clients (
  id TEXT PRIMARY KEY,
  client_id TEXT UNIQUE NOT NULL,    -- noheir_mcp_<ulid>
  client_name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,        -- JSON array
  grant_types TEXT NOT NULL,          -- JSON array
  created_at TEXT,
  updated_at TEXT
);

-- 授权会话（authorize → callback 中间状态）
CREATE TABLE mcp_auth_sessions (
  id TEXT PRIMARY KEY,
  state TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  scope TEXT NOT NULL,
  code TEXT,                          -- callback 生成
  user_id TEXT,                       -- callback 填充
  consumed INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at TEXT
);

-- Access Tokens
CREATE TABLE mcp_tokens (
  id TEXT PRIMARY KEY,
  access_token_hash TEXT UNIQUE NOT NULL,
  access_token_preview TEXT NOT NULL,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  client_name TEXT,
  scope TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT,
  last_used_at TEXT
);

-- Refresh Tokens
CREATE TABLE mcp_refresh_tokens (
  id TEXT PRIMARY KEY,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  access_token_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT
);
```

## 5. 关键文件说明

### 5.1 SQL API Client (`src/lib/db.ts`)

```typescript
// 封装 Worker SQL API 调用
export function getDb(): Db {
  return {
    query: <T>(sql, params?) => callWorkerApi('/api/v1/query', { sql, params }),
    execute: (sql, params?) => callWorkerApi('/api/v1/execute', { sql, params }),
    firstOrNull: <T>(sql, params?) => query<T>(sql, params).then(r => r.results[0] ?? null),
  };
}
```

### 5.2 Token Validation (`src/lib/mcp/auth.ts`)

```typescript
// 验证 MCP Bearer Token
export async function validateMcpToken(db: Db, authHeader: string | null): Promise<McpAuthOutcome> {
  const bearerToken = extractBearerToken(authHeader);
  if (!bearerToken) return { valid: false, status: 401, error: "Missing token" };
  
  const tokenHash = await sha256(bearerToken);
  const token = await getValidTokenByHash(db, tokenHash);
  if (!token) return { valid: false, status: 401, error: "Invalid token" };
  
  updateLastUsed(db, token.id).catch(() => {}); // Fire-and-forget
  return { valid: true, token };
}

// Origin 验证（DNS rebinding 防护）
export function validateOrigin(origin: string | null, siteUrl: string): McpAuthError | null {
  if (!origin) return null;  // CLI clients
  // 允许: 同源, loopback, 非 HTTP 协议 (vscode://, electron://)
  // 拒绝: 其他 HTTP 源
}
```

### 5.3 OAuth Endpoints

| Endpoint | 文件 | 功能 |
|----------|------|------|
| `GET /.well-known/oauth-authorization-server` | `src/app/.well-known/.../route.ts` | OAuth 元数据 |
| `POST /api/mcp/register` | `src/app/api/mcp/register/route.ts` | 客户端注册 |
| `GET /api/mcp/authorize` | `src/app/api/mcp/authorize/route.ts` | 创建 auth session |
| `GET /api/mcp/callback` | `src/app/api/mcp/callback/route.ts` | 生成 auth code |
| `POST /api/mcp/token` | `src/app/api/mcp/token/route.ts` | Token 交换 |
| `POST /api/mcp/revoke` | `src/app/api/mcp/revoke/route.ts` | Token 撤销 |

## 6. 环境变量

### Next.js (Railway)

```env
NEXTAUTH_URL=https://noheir.hexly.ai
WORKER_URL=https://noheir.worker.hexly.ai
WORKER_SECRET=<shared-secret>
AUTH_GOOGLE_ID=<google-oauth-client-id>
AUTH_GOOGLE_SECRET=<google-oauth-client-secret>
ALLOWED_EMAILS=user@example.com  # 可选，限制允许的邮箱
```

### Worker (Cloudflare)

```env
WORKER_SECRET=<shared-secret>  # 与 Next.js 匹配
```

## 7. 客户端配置

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

首次连接会自动触发 OAuth 流程，在浏览器中完成登录后即可使用。

---

## 8. 后续 MCP 工具恢复计划

当前 MCP Server 已完成 OAuth 认证，但工具尚未迁移。以下是恢复计划：

### 8.1 待迁移工具清单

| 工具 | 类型 | 复杂度 | 优先级 |
|------|------|--------|--------|
| `list_products` | Entity CRUD | 低 | P0 |
| `get_product` | Entity CRUD | 低 | P0 |
| `create_product` | Entity CRUD | 低 | P0 |
| `update_product` | Entity CRUD | 低 | P0 |
| `delete_product` | Custom Tool | 中 | P1 |
| `list_units` | Entity + Enrichment | 中 | P0 |
| `get_unit` | Entity + Enrichment | 中 | P0 |
| `create_unit` | Entity + Hooks | 高 | P1 |
| `update_unit` | Entity + Hooks | 高 | P1 |
| `delete_unit` | Custom Tool | 中 | P1 |
| `query_transactions` | Query Tool | 中 | P0 |
| `query_transfers` | Query Tool | 中 | P0 |
| `get_summary` | Query Tool | 低 | P0 |
| `get_monthly_report` | Query Tool | 低 | P1 |
| `get_products_summary` | Summary Tool | 低 | P1 |
| `get_units_summary` | Summary Tool | 低 | P1 |

### 8.2 原子化 Commit 计划

```
Phase 1: 基础查询工具 (P0) ✅ DONE
├── feat(mcp): add query_transactions tool
├── feat(mcp): add query_transfers tool
├── feat(mcp): add get_summary tool
└── test(mcp): add query tools tests

Phase 2: Product CRUD (P0) ✅ DONE
├── feat(mcp): add product entity definition
├── feat(mcp): register product CRUD tools
└── test(mcp): add product tools tests

Phase 3: Unit CRUD (P0 + P1) ✅ DONE
├── feat(mcp): add unit entity with availability enrichment
├── feat(mcp): register unit list/get tools
├── feat(mcp): add unit create with endDate invariant
├── feat(mcp): add unit update with productId CAS
└── test(mcp): add unit tools tests

Phase 4: Custom Tools (P1) ✅ DONE
├── feat(mcp): add delete_product with unlink logic
├── feat(mcp): add delete_unit with validation
└── test(mcp): add delete tools tests

Phase 5: Summary Tools (P1) ✅ DONE
├── feat(mcp): add get_monthly_report tool
├── feat(mcp): add get_products_summary tool
├── feat(mcp): add get_units_summary tool
└── test(mcp): add summary tools tests
```

### 8.3 6DQ 质量检查

每个 Phase 完成后验证：

| 维度 | 检查项 |
|------|--------|
| **Design** | 工具 schema 是否清晰？description 是否足够？ |
| **Dependencies** | 是否正确调用 SQL API？是否有循环依赖？ |
| **Data** | 查询是否正确？是否有 SQL 注入风险？ |
| **Defects** | 边界条件是否处理？错误消息是否友好？ |
| **Documentation** | 工具用法是否在 description 中说明？ |
| **Deployment** | 是否在 staging 验证？是否影响现有功能？ |

### 8.4 迁移注意事项

1. **SQL API 适配**：Worker 原有的 repository 直接访问 D1，现在需要通过 SQL API
2. **User ID 传递**：从 OAuth token 获取 user_id，传递给 SQL 查询
3. **Transaction 支持**：SQL API 暂不支持 transaction，需要改为顺序执行
4. **错误处理**：SQL API 错误需要转换为 MCP 错误格式

---

## 9. 相关文档

- [12-mcp-server.md](./12-mcp-server.md) - MCP Server v3 概述（需更新）
- [19-base-mcp-and-noheir-rewrite.md](./19-base-mcp-and-noheir-rewrite.md) - 原始设计文档
- [@nocoo/base-mcp](https://www.npmjs.com/package/@nocoo/base-mcp) - OAuth 工具包
