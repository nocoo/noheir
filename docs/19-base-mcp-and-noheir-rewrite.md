# 19 — base-mcp 设计与 noheir MCP 重写

> 创建独立的 `@nocoo/base-mcp` NPM 包，提供 MCP Server 开发的通用基础设施。
> 基于此重写 noheir MCP，迁移到 Streamable HTTP 传输，实现无缝 OAuth 登录。

## Part 1: @nocoo/base-mcp

### 1.1 项目定位

从 firefly MCP 提取通用代码，形成独立的、可复用的 MCP Server 开发框架。

**核心能力**：
1. OAuth 2.1 无缝登录（PKCE + Dynamic Client Registration）
2. Entity-Driven CRUD 框架（声明式定义 → 自动生成工具）
3. Streamable HTTP 传输（stateless / stateful 可选）
4. 完善的测试工具链

**不包含**：
- 具体业务实体（由各项目自定义）
- 数据库 schema（由各项目自定义）
- 认证 provider 配置（由各项目自定义）

### 1.2 架构设计

```
@nocoo/base-mcp/
├── src/
│   ├── index.ts                 # 公共导出
│   │
│   ├── server/                  # MCP Server 核心
│   │   ├── create-server.ts     # createMcpServer() 工厂
│   │   ├── streamable-http.ts   # Streamable HTTP 传输适配
│   │   └── stdio.ts             # stdio 传输适配（可选）
│   │
│   ├── auth/                    # OAuth 2.1 实现
│   │   ├── oauth-metadata.ts    # /.well-known/oauth-authorization-server
│   │   ├── pkce.ts              # PKCE S256 验证
│   │   ├── token.ts             # Token 生成、验证、刷新
│   │   ├── origin.ts            # Origin 校验（DNS rebinding 防护）
│   │   └── types.ts             # OAuth 相关类型
│   │
│   ├── framework/               # Entity-Driven CRUD 框架
│   │   ├── types.ts             # EntityConfig, DataLayer, Hooks 类型
│   │   ├── register.ts          # registerEntityTools()
│   │   ├── handlers.ts          # CRUD handler 工厂
│   │   ├── projection.ts        # 字段投影（context 优化）
│   │   ├── resolve.ts           # ID/Slug 解析
│   │   └── response.ts          # ok() / error() 响应构建
│   │
│   ├── db/                      # 数据库抽象（Drizzle 适配）
│   │   ├── types.ts             # Db 类型定义
│   │   └── drizzle-adapter.ts   # Drizzle → DataLayer 适配器
│   │
│   └── testing/                 # 测试工具
│       ├── mock-server.ts       # Mock MCP Server
│       ├── mock-db.ts           # Mock Database
│       └── assertions.ts        # MCP 响应断言
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### 1.3 核心 API 设计

#### 1.3.1 Server 创建

```typescript
// @nocoo/base-mcp
import { createMcpServer, type McpServerConfig } from "@nocoo/base-mcp";

const server = createMcpServer({
  name: "noheir",
  version: "3.0.0",
});
// Transport 在 Worker 层处理，不在 config 中声明
// 见 Part 2 "2.3 Streamable HTTP 传输设计"
```

#### 1.3.2 Entity 定义

base-mcp 提供三层抽象，适应不同复杂度：

1. **Simple Entity**: 纯 CRUD，无额外逻辑
2. **Entity with Hooks**: CRUD + 生命周期钩子（beforeCreate, afterUpdate 等）
3. **Custom Tool**: 完全自定义，不走 Entity 框架

```typescript
import { defineEntity, type EntityConfig } from "@nocoo/base-mcp";
import { z } from "zod";

// Simple Entity 示例 (适合 product)
export const productEntity: EntityConfig<Product> = {
  name: "product",
  display: "理财产品",
  plural: "products",
  
  dataLayer: {
    list: (ctx, opts) => ctx.repos.products.list(opts),
    getById: (ctx, id) => ctx.repos.products.getById(id),
    getBySlug: () => null, // 无 slug
    create: (ctx, input) => ctx.repos.products.create(input),
    update: (ctx, id, input) => ctx.repos.products.update(id, input),
    delete: (ctx, id) => ctx.repos.products.archive(id), // archive, not hard delete
  },
  
  schemas: { /* ... */ },
  descriptions: { /* ... */ },
  projection: { /* ... */ },
};

// Entity with Hooks 示例 (适合 unit —— 有 availability enrichment)
export const unitEntity: EntityConfig<Unit> = {
  name: "unit",
  display: "理财单元",
  plural: "units",
  
  dataLayer: {
    list: async (ctx, opts) => {
      const units = await ctx.repos.units.list(opts);
      // Availability enrichment: 计算 daysToAvailable, availabilityStatus
      return units.map(u => enrichAvailability(u));
    },
    getById: async (ctx, id) => {
      const unit = await ctx.repos.units.getById(id);
      return unit ? enrichAvailability(unit) : null;
    },
    // ... 其他方法
  },
  
  hooks: {
    // update_unit 修改 productId 时需要记录 contribution log
    beforeUpdate: async (ctx, id, input, existing) => {
      if (input.product_id !== undefined && input.product_id !== existing.product_id) {
        // CAS check: 确保 existing 未被并发修改
        const current = await ctx.repos.units.getById(id);
        if (current?.updated_at !== existing.updated_at) {
          throw new ConflictError("Unit was modified concurrently");
        }
      }
      return input;
    },
    afterUpdate: async (ctx, id, input, result) => {
      if (input.product_id !== undefined) {
        // 记录 contribution log side effect
        await ctx.repos.contributionLogs.create({
          unit_id: id,
          product_id: input.product_id,
          action: "product_changed",
        });
      }
    },
  },
  
  schemas: { /* ... */ },
};

// Custom Tool 示例 (delete_product 有特殊行为)
// delete_product 需要：1) archive product 2) 将关联 units 的 product_id 置 null
// 这种复杂逻辑不适合 Entity CRUD，应该用 Custom Tool
registerCustomTool(server, {
  name: "delete_product",
  description: "Archive a product and unlink all associated units.",
  schema: z.object({ id: z.string() }),
  handler: async (ctx, { id }) => {
    const product = await ctx.repos.products.getById(id);
    if (!product) return error("Product not found");
    
    // Transaction: archive + unlink
    await ctx.db.transaction(async (tx) => {
      await ctx.repos.products.archive(tx, id);
      await ctx.repos.units.unlinkProduct(tx, id);
    });
    
    return ok({ archived: true, unlinked_units: await ctx.repos.units.countByProduct(id) });
  },
});
```

**noheir 实体复杂度分类**：

| Entity | 类型 | 原因 |
|--------|------|------|
| product.list/get/create | Simple Entity | 纯 CRUD |
| product.update | Simple Entity | 纯字段更新 |
| product.delete | Custom Tool | 需要 unlink units |
| unit.list/get | Entity + Enrichment | availability 计算 |
| unit.create/update | Entity + Hooks | productId CAS + contribution log |
| unit.delete | Custom Tool | 需要检查关联 transactions |

#### 1.3.3 OAuth 集成

```typescript
import { 
  createOAuthHandlers,
  validateMcpToken,
  validateOrigin,
  getOAuthMetadata,
} from "@nocoo/base-mcp/auth";

// Next.js App Router 示例
// app/api/mcp/route.ts
export async function POST(request: Request) {
  // 1. Origin 校验
  const originError = validateOrigin(request.headers.get("origin"), siteUrl);
  if (originError) return errorResponse(originError.error, originError.status);
  
  // 2. Token 校验
  const authResult = await validateMcpToken(db, request.headers.get("authorization"));
  if (!authResult.valid) return errorResponse(authResult.error, authResult.status);
  
  // 3. 创建 MCP Server 并处理请求
  const server = createMcpServer(config);
  registerEntityTools(server, productEntity, { db });
  // ... handle request
}

// app/.well-known/oauth-authorization-server/route.ts
export function GET() {
  return Response.json(getOAuthMetadata(issuer));
}
```

### 1.4 OAuth 2.1 流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Client (Claude Desktop / Cursor)                               │
│                                                                     │
│  1. POST /api/mcp → 401 Unauthorized                                │
│  2. GET /.well-known/oauth-authorization-server → 发现端点           │
│  3. POST /api/mcp/register → 动态客户端注册（返回 client_id）         │
│  4. 生成 PKCE code_verifier + code_challenge                        │
│  5. 打开浏览器 → /api/mcp/authorize?...&code_challenge=...          │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OAuth Server (app 内置)                                            │
│                                                                     │
│  /api/mcp/authorize                                                 │
│    ├─ 如果已有 session → 直接跳到 callback                           │
│    └─ 如果没有 → 跳转 /login → Google OAuth / 密码登录               │
│                                                                     │
│  /api/mcp/callback                                                  │
│    ├─ 验证 session                                                  │
│    ├─ 生成 authorization code                                       │
│    └─ 重定向到 MCP Client 的 localhost callback                      │
│                                                                     │
│  /api/mcp/token                                                     │
│    ├─ 验证 PKCE code_verifier                                       │
│    ├─ 生成 access_token + refresh_token                             │
│    └─ 返回给 MCP Client                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.5 从 firefly 提取的模块

| firefly 路径 | base-mcp 路径 | 改动 |
|--------------|---------------|------|
| `src/lib/mcp/framework/types.ts` | `src/framework/types.ts` | 移除 `@/lib/db` 依赖，泛型化 |
| `src/lib/mcp/framework/register.ts` | `src/framework/register.ts` | 无改动 |
| `src/lib/mcp/framework/handlers.ts` | `src/framework/handlers.ts` | 无改动 |
| `src/lib/mcp/framework/projection.ts` | `src/framework/projection.ts` | 无改动 |
| `src/lib/mcp/framework/resolve.ts` | `src/framework/resolve.ts` | 泛型化 Db 类型 |
| `src/lib/mcp/framework/response.ts` | `src/framework/response.ts` | 无改动 |
| `src/lib/mcp/auth.ts` | `src/auth/token.ts` | 泛型化 |
| `src/lib/mcp/oauth.ts` | `src/auth/pkce.ts` + `src/auth/oauth-metadata.ts` | 拆分 |
| `src/lib/mcp/server.ts` | `src/server/create-server.ts` | 泛型化 |

### 1.6 测试策略

| 层级 | 文件 | 测试内容 |
|------|------|----------|
| Unit | `src/**/*.test.ts` | 各模块独立测试 |
| Integration | `tests/integration/` | 完整 OAuth 流程、Entity CRUD |
| E2E | `tests/e2e/` | MCP 协议往返 |

**测试覆盖率目标**: 90%+

### 1.7 发布计划

**原则**：先在 noheir 验证 API 设计，再发布 NPM 正式版。

1. **创建 GitHub 仓库**: `nocoo/base-mcp`
2. **初始化项目**: pnpm + TypeScript + Vitest
3. **从 firefly 提取代码**: 逐模块迁移 + 泛型化
4. **编写测试**: TDD，先写测试再迁移
5. **发布预发版**: `@nocoo/base-mcp@0.1.0-alpha.1`（仅供 noheir 验证）
6. **完成 noheir 重写**: Part 2 全部完成
7. **API 稳定后发布正式版**: `@nocoo/base-mcp@0.1.0`
8. **文档**: README + API 文档

**版本策略**：
- `0.1.0-alpha.x`: 开发阶段，API 可能变动
- `0.1.0`: noheir 验证通过后的首个稳定版
- 在 noheir 之外的第二个项目（如 firefly）集成后再考虑 `1.0.0`

### 1.8 Commit 计划 (Part 1)

| # | Commit | 内容 | 状态 |
|---|--------|------|------|
| 1 | `feat: init project structure` | pnpm init, tsconfig, vitest, eslint | ✅ |
| 2 | `feat: add response builders` | `src/framework/response.ts` + tests | ✅ |
| 3 | `feat: add projection engine` | `src/framework/projection.ts` + tests | ✅ |
| 4 | `feat: add id/slug resolver` | `src/framework/resolve.ts` + tests | ✅ |
| 5 | `feat: add entity types` | `src/framework/types.ts` | ✅ (合并到 #3) |
| 6 | `feat: add CRUD handlers` | `src/framework/handlers.ts` + tests | ✅ |
| 7 | `feat: add entity registration` | `src/framework/register.ts` + tests | ✅ |
| 8 | `feat: add PKCE verification` | `src/auth/pkce.ts` + tests | ✅ |
| 9 | `feat: add OAuth metadata` | `src/auth/oauth-metadata.ts` + tests | ✅ |
| 10 | `feat: add origin validation` | `src/auth/origin.ts` + tests | ✅ |
| 11 | `feat: add token management` | `src/auth/token.ts` + tests | ✅ |
| 12 | `feat: add server factory` | `src/server/create-server.ts` + tests | ✅ |
| 13 | `feat: add streamable HTTP transport` | N/A (使用 SDK 自带) | ⏭️ 跳过 |
| 14 | `feat: add testing utilities` | `src/testing/*` | ✅ |
| 15 | `feat: add public exports` | `src/index.ts` | ✅ (已在 #1 中) |
| 16 | `docs: add README` | README.md | ✅ |
| 17 | `chore: publish v0.1.0-alpha.1` | npm publish (预发版，仅供 noheir 验证) | ✅ |

**Part 1 完成统计**：
- 代码行数：~1500 行
- 测试数量：157 个
- 测试覆盖率：96.61%
- GitHub: https://github.com/nocoo/base-mcp

---

## Part 2: noheir MCP 重写

### 2.1 目标

基于 `@nocoo/base-mcp` 重写 noheir MCP Server：

1. **传输协议**: stdio → Streamable HTTP
2. **认证方式**: 静态 Token → OAuth 2.1 无缝登录
3. **代码架构**: 手写工具 → Entity-Driven 声明式
4. **部署位置**: 本地进程 → Worker 内置（或独立部署）

### 2.2 当前 vs 目标架构

**当前架构 (v2)**:
```
Claude Desktop ──stdio──► MCP Server (bun 进程)
                              │
                              │ WORKER_TOKEN
                              ▼
                         Worker API
```

**目标架构 (v3)**:
```
Claude Desktop ──HTTP──► Worker /mcp 端点
                              │
                              │ OAuth Bearer Token
                              ▼
                         Worker (Hono + MCP)
```

### 2.3 Streamable HTTP 传输设计

**选择 Stateless 模式**：每个 HTTP 请求独立处理，不维护 WebSocket 连接。

理由：
- Worker 无持久连接能力
- MCP 工具调用本身是请求-响应模式
- 简化部署和调试

**HTTP 方法定义**：

| Method | Path | 用途 | Session 行为 |
|--------|------|------|-------------|
| POST | /mcp | 执行 MCP 请求（tools/call, resources/read 等） | 每请求新建 session |
| GET | /mcp | SSE 通知流（可选，v1 不实现） | N/A |
| DELETE | /mcp | 关闭 session（stateless 下为 no-op） | N/A |

**Stateless Session 处理**：

```typescript
// worker/src/mcp/transport.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export async function handleMcpRequest(
  request: Request,
  server: McpServer,
): Promise<Response> {
  // WebStandardStreamableHTTPServerTransport 使用 Web Standard APIs (Request, Response, ReadableStream)
  // 原生支持 Cloudflare Workers, Deno, Bun, Hono.js 等 Web-standard 运行时
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless: 无 session ID
    enableJsonResponse: true,      // 返回 JSON 而非 SSE stream
  });
  
  await server.connect(transport);
  
  try {
    // handleRequest 接受 Web Request，返回 Web Response
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}
```

**注意**：SDK 提供两种 HTTP transport：
- `StreamableHTTPServerTransport`: Node.js HTTP 包装层，用于 Express/Node HTTP
- `WebStandardStreamableHTTPServerTransport`: Web Standard APIs，用于 Cloudflare Workers/Deno/Bun/Hono

**Client 兼容性**：

- Claude Desktop: 支持 Streamable HTTP（2024-11 起）
- Cursor: 支持（需验证版本）
- 其他客户端: 需要支持 MCP 2025-03-26 spec

**不支持的功能（v1 scope out）**：

- Server-initiated notifications（需要 SSE 或 WebSocket）
- Session resumability（stateless 无状态）
- Progress streaming（单次响应）

这些功能如果后续需要，可以升级到 Stateful 模式（Durable Objects）。

### 2.4 Worker 改造

在现有 Worker 基础上添加 MCP 端点：

```typescript
// worker/src/index.ts (新增部分)

import { createMcpServer } from "@nocoo/base-mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// MCP 端点
app.post("/mcp", async (c) => {
  // 1. Origin 校验
  const originError = validateOrigin(c.req.header("origin"), siteUrl);
  if (originError) return c.json({ error: originError.error }, originError.status);
  
  // 2. Token 校验
  const authResult = await validateMcpToken(db, c.req.header("authorization"));
  if (!authResult.valid) return c.json({ error: authResult.error }, authResult.status);
  
  // 3. 创建 MCP Server
  const userId = authResult.token.user_id;
  const server = createMcpServer({ name: "noheir", version: "3.0.0" });
  
  // 4. 注册 Entity Tools
  const repos = createAllRepos(db, userId);
  registerEntityTools(server, productEntity, { repos });
  registerEntityTools(server, unitEntity, { repos });
  // ... 其他 entities
  
  // 5. 注册 Extra Tools (非 CRUD)
  registerQueryTools(server, { repos });
  registerReportTools(server, { repos });
  
  // 6. WebStandard HTTP Transport (Stateless)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

// GET /mcp - SSE notifications (v1 不实现，返回 405)
app.get("/mcp", (c) => {
  return c.json({ error: "SSE notifications not supported in v1" }, 405);
});

// DELETE /mcp - Session close (stateless 下为 no-op)
app.delete("/mcp", (c) => {
  return c.json({ closed: true }, 200);
});

// OAuth 端点
app.get("/.well-known/oauth-authorization-server", (c) => {
  return c.json(getOAuthMetadata(siteUrl));
});

app.post("/mcp/register", async (c) => handleRegister(c));
app.get("/mcp/authorize", async (c) => handleAuthorize(c));
app.get("/mcp/callback", async (c) => handleCallback(c));
app.post("/mcp/token", async (c) => handleToken(c));
```

### 2.5 Entity 定义

创建 `worker/mcp/entities/` 目录：

```typescript
// worker/mcp/entities/product.ts
import { type EntityConfig } from "@nocoo/base-mcp";
import { z } from "zod";
import type { Product } from "../../db/types";

export const productEntity: EntityConfig<Product> = {
  name: "product",
  display: "理财产品",
  plural: "products",
  
  dataLayer: {
    list: async (ctx, opts) => ctx.repos.products.list(opts),
    getById: async (ctx, id) => ctx.repos.products.getById(id),
    getBySlug: async () => null,
    create: async (ctx, input) => ctx.repos.products.create(input),
    update: async (ctx, id, input) => ctx.repos.products.update(id, input),
    // delete 不在 Entity 中定义，由 Custom Tool 处理
    // 见 worker/mcp/tools/delete-product.ts
  },
  
  schemas: {
    list: {
      channel: z.string().optional(),
      category: z.string().optional(),
      currency: z.enum(["CNY", "USD", "HKD"]).optional(),
      include_archived: z.boolean().optional(),
      fields: z.enum(["minimal", "full"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    create: {
      name: z.string().describe("产品名称 (必填)"),
      channel: z.string().describe("渠道 (必填)"),
      category: z.string().describe("分类 (必填)"),
      code: z.string().optional().describe("产品代码"),
      currency: z.enum(["CNY", "USD", "HKD"]).default("CNY"),
      lock_period_days: z.number().int().min(0).default(0),
      annual_return_rate: z.number().optional(),
    },
    update: {
      name: z.string().optional(),
      code: z.string().nullable().optional(),
      channel: z.string().optional(),
      category: z.string().optional(),
      currency: z.enum(["CNY", "USD", "HKD"]).optional(),
      lock_period_days: z.number().int().min(0).optional(),
      annual_return_rate: z.number().nullable().optional(),
    },
  },
  
  descriptions: {
    list: `Get a filtered list of financial products (理财产品).

WHEN TO USE:
- After calling get_products_summary to understand data shape
- When you need specific product records matching certain criteria

LIMITATIONS:
- Max 200 results per call; use offset for pagination
- By default, archived products are excluded`,
    get: "Get a single financial product by ID.",
    create: "Create a new financial product. Required: name, channel, category.",
    update: "Update an existing financial product. Only provided fields are updated.",
    delete: "Delete (archive) a financial product. Linked units get product_id set to NULL.",
  },
  
  projection: {
    omit: ["created_at", "updated_at", "archived_at", "user_id"],
    groups: {
      timestamps: ["created_at", "updated_at"],
      full: ["created_at", "updated_at", "archived_at"],
    },
  },
};
```

### 2.6 工具映射

**工具名称兼容策略**：v3 保持与 v2 相同的工具名称，避免客户端迁移成本。

| 当前 MCP 工具 (v2) | v3 工具名 | 类型 | 备注 |
|--------------------|-----------|------|------|
| `query_transactions` | `query_transactions` | Extra Tool | 保持原名 |
| `query_transfers` | `query_transfers` | Extra Tool | 保持原名 |
| `get_summary` | `get_summary` | Extra Tool | 保持原名 |
| `get_monthly_report` | `get_monthly_report` | Extra Tool | |
| `list_products` | `list_products` | Simple Entity | |
| `get_product` | `get_product` | Simple Entity | |
| `create_product` | `create_product` | Simple Entity | |
| `update_product` | `update_product` | Simple Entity | |
| `delete_product` | `delete_product` | Custom Tool | 有 unlink 逻辑 |
| `get_products_summary` | `get_products_summary` | Extra Tool | |
| `list_units` | `list_units` | Entity + Enrichment | availability 计算 |
| `get_unit` | `get_unit` | Entity + Enrichment | |
| `create_unit` | `create_unit` | Entity + Hooks | |
| `update_unit` | `update_unit` | Entity + Hooks | productId CAS |
| `delete_unit` | `delete_unit` | Custom Tool | 检查关联 |
| `get_units_summary` | `get_units_summary` | Extra Tool | |

### 2.7 新增 OAuth 相关表

OAuth 2.1 + Dynamic Client Registration 需要完整的元数据存储：

```sql
-- D1 migrations

-- MCP OAuth 客户端 (动态注册)
CREATE TABLE mcp_clients (
  id TEXT PRIMARY KEY,
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT,              -- 机密客户端用（可选）
  client_name TEXT NOT NULL,
  client_uri TEXT,                      -- 客户端主页（可选）
  logo_uri TEXT,                        -- Logo URL（可选）
  redirect_uris TEXT NOT NULL,          -- JSON array of registered URIs
  grant_types TEXT NOT NULL,            -- JSON array: ["authorization_code", "refresh_token"]
  response_types TEXT NOT NULL,         -- JSON array: ["code"]
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none', -- none | client_secret_basic | client_secret_post
  scope TEXT NOT NULL DEFAULT 'noheir:read noheir:write',  -- 允许的 scope
  contacts TEXT,                        -- JSON array of contact emails（可选）
  tos_uri TEXT,                         -- Terms of Service（可选）
  policy_uri TEXT,                      -- Privacy Policy（可选）
  software_id TEXT,                     -- 客户端软件标识（可选）
  software_version TEXT,                -- 客户端软件版本（可选）
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- MCP 授权会话 (authorize → callback 中间状态)
CREATE TABLE mcp_auth_sessions (
  id TEXT PRIMARY KEY,
  state TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  scope TEXT NOT NULL,
  nonce TEXT,                           -- OpenID Connect nonce（可选）
  code TEXT,                            -- 授权后填充
  user_id TEXT,                         -- 授权后填充
  expires_at INTEGER NOT NULL,
  consumed INTEGER DEFAULT 0,           -- 是否已使用
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (client_id) REFERENCES mcp_clients(client_id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_auth_sessions_state ON mcp_auth_sessions(state);
CREATE INDEX idx_mcp_auth_sessions_code ON mcp_auth_sessions(code);
CREATE INDEX idx_mcp_auth_sessions_expires ON mcp_auth_sessions(expires_at);

-- MCP Access Tokens
CREATE TABLE mcp_tokens (
  id TEXT PRIMARY KEY,
  access_token_hash TEXT UNIQUE NOT NULL,
  access_token_preview TEXT NOT NULL,   -- 前 8 位，用于日志
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  client_name TEXT,                     -- 冗余存储，方便显示
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,             -- Access token 过期时间
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT,
  last_used_at TEXT,
  last_used_ip TEXT,                    -- 最后使用 IP（可选）
  
  FOREIGN KEY (client_id) REFERENCES mcp_clients(client_id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_tokens_hash ON mcp_tokens(access_token_hash);
CREATE INDEX idx_mcp_tokens_user ON mcp_tokens(user_id);
CREATE INDEX idx_mcp_tokens_expires ON mcp_tokens(expires_at);

-- MCP Refresh Tokens (单独表，支持 rotation)
CREATE TABLE mcp_refresh_tokens (
  id TEXT PRIMARY KEY,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  access_token_id TEXT NOT NULL,        -- 关联的 access token
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,             -- Refresh token 过期时间（通常 30 天）
  rotated_at TEXT,                      -- 被 rotate 的时间
  rotated_to TEXT,                      -- rotate 后的新 refresh token ID
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT,
  
  FOREIGN KEY (client_id) REFERENCES mcp_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (access_token_id) REFERENCES mcp_tokens(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_refresh_tokens_hash ON mcp_refresh_tokens(refresh_token_hash);
CREATE INDEX idx_mcp_refresh_tokens_user ON mcp_refresh_tokens(user_id);
CREATE INDEX idx_mcp_refresh_tokens_expires ON mcp_refresh_tokens(expires_at);
```

**Token 生命周期**：

| Token 类型 | 有效期 | Rotation |
|-----------|--------|----------|
| Authorization Code | 5 分钟 | N/A (一次性) |
| Access Token | 1 小时 | N/A |
| Refresh Token | 30 天 | 每次使用都 rotate |

**Refresh Token Rotation**：
- 每次用 refresh token 换新 access token 时，同时发放新 refresh token
- 旧 refresh token 标记为已 rotate，保留 24 小时用于检测 token theft
- 如果已 rotate 的 refresh token 被再次使用，撤销整个 token family

### 2.8 测试策略

| 层级 | 位置 | 测试内容 |
|------|------|----------|
| Unit | `worker/mcp/entities/*.test.ts` | Entity 定义校验 |
| Unit | `worker/mcp/tools/*.test.ts` | Extra Tools 逻辑 |
| Integration | `worker/tests/mcp/` | OAuth 流程 + MCP 工具 |
| E2E | `worker/tests/e2e/mcp.e2e.ts` | 完整 MCP 协议 |

**TDD 流程**:
1. 先写测试（基于现有 MCP 行为）
2. 实现代码
3. 运行测试确认通过
4. 原子化提交

### 2.9 迁移步骤

#### Phase 1: 基础设施 (Worker 层)

| # | Commit | 内容 | 状态 |
|---|--------|------|------|
| 1 | `feat(worker): add mcp oauth tables` | D1 migrations (mcp_clients, mcp_auth_sessions, mcp_tokens, mcp_refresh_tokens) | ✅ |
| 2 | `feat(worker): add mcp oauth repositories` | CRUD for all 4 tables + refresh token rotation 检测逻辑 | ✅ (合并到 #1) |
| 3 | `feat(worker): add oauth endpoints` | register, authorize, callback, token (含 refresh_token grant) + revoke | ✅ |
| 4 | `test(worker): add oauth e2e tests` | 完整 OAuth 流程测试 (16 tests) | ✅ (合并到 #3) |

**Phase 1 完成统计**：
- OAuth 表：4 个 (mcp_clients, mcp_auth_sessions, mcp_tokens, mcp_refresh_tokens)
- OAuth 端点：6 个 (metadata, register, authorize, callback, token, revoke)
- E2E 测试：16 个

#### Phase 2: MCP Server 集成

| # | Commit | 内容 | 状态 |
|---|--------|------|------|
| 5 | `feat(worker): add /mcp endpoint skeleton` | Streamable HTTP 传输 + OAuth token 验证 | ✅ |
| 6 | `feat(worker): add product entity` | productEntity + tests | ✅ |
| 7 | `feat(worker): add unit entity` | unitEntity + tests | ✅ |
| 8 | `feat(worker): add query tools` | query_transactions, query_transfers, get_summary, get_monthly_report | ✅ (合并) |
| 9 | `feat(worker): add summary tools` | get_products_summary, get_units_summary | ✅ (合并到 #8) |
| 10 | `feat(worker): add delete tools` | delete_product, delete_unit | ✅ (合并到 #8) |
| 11 | `test(worker): add mcp e2e tests` | 完整 MCP 协议测试 | ✅ |

**Phase 2 完成统计**：
- Entity 定义：2 个 (product, unit)
- Extra Tools：6 个 (query_transactions, query_transfers, get_summary, get_monthly_report, get_products_summary, get_units_summary)
- Custom Tools：2 个 (delete_product, delete_unit)
- 工具总数：18 个 (5 product CRUD + 5 unit CRUD + 6 extra + 2 custom)
- E2E 测试：Origin/Auth/Methods 验证

#### Phase 3: 清理

| # | Commit | 内容 |
|---|--------|------|
| 17 | `chore: deprecate old mcp/ directory` | 标记废弃，保留一段时间 |
| 18 | `docs: update 12-mcp-server.md` | 更新文档 |
| 19 | `chore: remove deprecated mcp/` | 删除旧代码 |

#### Phase 4: 发布正式版

| # | Commit | 内容 |
|---|--------|------|
| 20 | `chore(base-mcp): publish v0.1.0` | API 验证通过，发布正式版 |

### 2.10 回滚计划

如果新 MCP 出现问题：
1. 旧 `mcp/` 目录保留到 v3 稳定后再删除
2. Claude Desktop 可以同时配置新旧 MCP（不同名称）
3. Worker 的 REST API 不受影响

### 2.11 验收标准

- [x] OAuth 2.1 无缝登录：首次授权后无感 (Phase 1 完成)
- [x] 100% 功能覆盖：18 个工具全部定义
- [ ] 测试覆盖率 90%+ (需运行完整 E2E)
- [ ] 文档更新完成 (Phase 3)
- [ ] 旧 MCP 可安全删除 (Phase 3)

---

## 时间线

| 阶段 | 预计时间 | 产出 |
|------|----------|------|
| Part 1: base-mcp | 2-3 天 | `@nocoo/base-mcp@0.1.0-alpha.1` 预发版 |
| Part 2 Phase 1: OAuth | 1 天 | Worker OAuth 端点 |
| Part 2 Phase 2: MCP | 2 天 | Worker MCP 集成 |
| Part 2 Phase 3: 清理 | 0.5 天 | 文档 + 删除旧代码 |
| Part 2 Phase 4: 正式版 | 0.5 天 | `@nocoo/base-mcp@0.1.0` 正式发布 |
| **总计** | **6-7 天** | |

---

## 依赖关系

```
@nocoo/base-mcp (Part 1)
       │
       ▼
noheir Worker (Part 2)
       │
       ├─ @nocoo/base-mcp (framework, auth)
       ├─ @modelcontextprotocol/sdk
       ├─ hono
       └─ drizzle-orm
```

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| base-mcp API 设计不够通用 | 先发预发版在 noheir 验证，API 稳定后再发正式版 |
| OAuth 流程复杂，调试困难 | 详细日志 + E2E 测试 |
| Worker Cold Start 影响 MCP 响应 | D1 查询优化 + 必要时用 Durable Objects |
| Claude Desktop 对 HTTP MCP 支持问题 | 保留 stdio fallback 选项 |
| Entity CRUD 框架不够灵活 | 提供 hooks 机制 + Custom Tool escape hatch |
