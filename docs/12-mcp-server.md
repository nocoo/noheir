# MCP Server

## 概述

`mcp/` 目录是一个独立的 MCP（Model Context Protocol）服务端，通过 stdio 传输协议向 AI Agent（如 Claude Desktop）暴露财务数据的 **查询与管理** 能力。

Agent 可以通过 14 个工具查询收支交易、内部转账、财务元数据和月度报表，以及对理财产品和资金单元执行完整 CRUD 操作，无需直接操作数据库。

## 目录结构

```
mcp/
├── src/
│   ├── auth.ts                  # Supabase 认证（refresh token 引导流程）
│   ├── index.ts                 # 服务入口（工具注册 + stdio 传输）
│   └── tools/
│       ├── getMonthlyReport.ts  # 月度报表工具
│       ├── getSummary.ts        # 财务元数据工具
│       ├── products.ts          # 理财产品 CRUD 工具
│       ├── queryTransactions.ts # 收支交易查询工具
│       ├── queryTransfers.ts    # 内部转账查询工具
│       └── units.ts             # 资金单元 CRUD 工具
├── tests/
│   ├── unit/
│   │   ├── products.unit.test.ts  # 22 个产品单元测试（mock）
│   │   └── units.unit.test.ts     # 29 个资金单元单元测试（mock）
│   ├── crud.integration.test.ts   # 38 个 CRUD 集成测试（真实 DB）
│   ├── tools.e2e.test.ts          # 59 个查询工具处理函数测试
│   └── mcp.e2e.test.ts            # 20 个协议层端到端测试
├── package.json                 # 独立依赖（MCP SDK、Supabase JS、Zod）
├── tsconfig.json                # TypeScript 配置
├── bunfig.toml                  # Bun 测试预加载配置
└── bun.lock
```

## 架构分层

```
┌─────────────────────────────────────────────────┐
│  MCP 协议层 (index.ts)                           │
│  - 工具注册（Zod schema 定义参数）                  │
│  - stdio 传输（JSON-RPC over stdin/stdout）       │
│  - 结果格式化为 JSON 文本内容块                     │
├─────────────────────────────────────────────────┤
│  工具处理层 (tools/*.ts)                          │
│  - 纯函数：(SupabaseClient, params) → result     │
│  - 查询工具：参数映射为 RPC 入参（p_ 前缀）          │
│  - CRUD 工具：直接操作 Supabase 表 / RPC           │
├─────────────────────────────────────────────────┤
│  认证层 (auth.ts)                                │
│  - 环境变量读取                                    │
│  - Refresh token 引导 + 自动刷新                   │
├─────────────────────────────────────────────────┤
│  数据层 (Supabase Postgres)                       │
│  - RPC: search_transactions_fuzzy                │
│  - RPC: search_transfers_fuzzy                   │
│  - RPC: get_financial_metadata                   │
│  - RPC: get_monthly_report                       │
│  - RPC: get_units_with_products                  │
│  - 表: financial_products, capital_units          │
│  - RLS 策略确保用户数据隔离                         │
└─────────────────────────────────────────────────┘
```

**设计要点**：

- **查询 + CRUD**：4 个查询工具 + 10 个 CRUD 工具（产品 5 + 资金单元 5）。
- **服务端聚合**：查询工具通过 Postgres RPC 函数获取数据，避免 PostgREST `max_rows`（默认 1000）限制。
- **关注点分离**：工具处理函数是纯函数，接受 `(SupabaseClient, params)` 返回类型化结果，可独立于 MCP 协议层测试。
- **MCP SDK v1 API**：使用 `server.tool(name, description, zodShape, callback)` 注册工具。

## 工具说明

### 查询工具

#### `get_summary` — 财务元数据

Agent 应 **首先调用此工具** 了解可用的筛选值，避免幻觉式参数。

- **RPC**: `get_financial_metadata`
- **参数**: 无
- **返回**: 可用年份、账户、分类（三级）、币种、标签、交易/转账总数

#### `query_transactions` — 收支交易查询

支持 16 个可选筛选参数（AND 组合）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `keyword` | string | 模糊搜索（备注、分类、账户） |
| `type` | string | 收入 / 支出 |
| `categories` | string[] | 一级分类 |
| `secondary_categories` | string[] | 二级分类 |
| `tertiary_categories` | string[] | 三级分类 |
| `accounts` | string[] | 账户 |
| `tags` | string[] | 标签（ANY 匹配） |
| `start_date` / `end_date` | string | 日期范围 |
| `min_amount` / `max_amount` | number | 金额范围 |
| `year` / `month` | number | 年 / 月 |
| `currency` | string | 币种 |
| `limit` | number | 返回条数（默认 50，上限 500） |
| `offset` | number | 偏移量 |

- **RPC**: `search_transactions_fuzzy`
- **返回**: `{ transactions: TransactionRow[], total_returned }` — 每条包含 `matched_field` 标记命中字段

#### `query_transfers` — 内部转账查询

支持 13 个可选筛选参数（AND 组合）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `keyword` | string | 模糊搜索（备注、分类、账户） |
| `accounts` | string[] | 账户 |
| `transaction_type` | string | 转入 / 转出 |
| `tags` | string[] | 标签 |
| `start_date` / `end_date` | string | 日期范围 |
| `min_amount` / `max_amount` | number | 金额范围（取流入/流出较大值） |
| `year` / `month` | number | 年 / 月 |
| `currency` | string | 币种 |
| `limit` / `offset` | number | 分页 |

- **RPC**: `search_transfers_fuzzy`
- **返回**: `{ transfers: TransferRow[], total_returned }` — 每条包含 `matched_field`

#### `get_monthly_report` — 月度报表

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `year` | number | 是 | 年份 |
| `month` | number | 是 | 月份 |
| `currency` | string | 否 | 按币种筛选 |

- **RPC**: `get_monthly_report`
- **返回**: 收入/支出总额、净额、交易/转账笔数、转账流入/流出总额、按分类的支出/收入明细（按金额降序，含分类名、总额、笔数）、涉及币种

### 理财产品 CRUD

操作 `financial_products` 表，支持产品的创建、查询、更新和删除。

#### `list_products` — 列出理财产品

| 参数 | 类型 | 说明 |
|------|------|------|
| `channel` | string | 按渠道筛选 |
| `category` | string | 按分类筛选 |
| `currency` | string | 按币种筛选（CNY/USD/HKD） |

- **数据源**: 直接表查询 `financial_products`
- **返回**: `{ products, total_returned }`

#### `get_product` — 获取单个产品

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 产品 UUID |

- **返回**: `{ product }` — 未找到时返回 `null`

#### `create_product` — 创建产品

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 产品名称 |
| `channel` | string | 是 | 渠道（招商银行/支付宝/微众银行 等 7 个） |
| `category` | string | 是 | 分类（债券基金/货币基金/定期存款 等 12 个） |
| `code` | string | 否 | 产品代码 |
| `currency` | string | 否 | 币种（默认 CNY） |
| `lock_period_days` | number | 否 | 锁定期天数（默认 0） |
| `annual_return_rate` | number | 否 | 年化收益率 |

- **返回**: `{ product }` — 包含完整创建后的产品记录

#### `update_product` — 更新产品

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 产品 UUID |
| `name` / `code` / `channel` / `category` / `currency` / `lock_period_days` / `annual_return_rate` | 各类型 | 否 | 要更新的字段 |

- **约束**: 至少提供一个更新字段，否则抛出 `"no fields to update"`
- **返回**: `{ product }` — 更新后的完整记录

#### `delete_product` — 删除产品

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 产品 UUID |

- **FK 行为**: 删除产品后，关联的资金单元的 `product_id` 自动设为 `null`（`ON DELETE SET NULL`）
- **返回**: `{ success: true }`

### 资金单元 CRUD

操作 `capital_units` 表，支持资金单元的创建、查询、更新和删除。通过 `product_id` 外键与理财产品关联。

#### `list_units` — 列出资金单元

| 参数 | 类型 | 说明 |
|------|------|------|
| `status` | string | 按状态筛选（已成立/计划中/已归档/已终止） |
| `strategy` | string | 按策略筛选 |
| `tactics` | string | 按战术筛选 |
| `currency` | string | 按币种筛选 |
| `with_products` | boolean | 是否联查关联产品（使用 `get_units_with_products` RPC） |

- **数据源**: 直接表查询或 RPC（当 `with_products=true` 时）
- **返回**: `{ units, total_returned }`

#### `get_unit` — 获取单个资金单元

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 资金单元 UUID |
| `with_product` | boolean | 否 | 是否联查关联产品 |

- **返回**: `{ unit }` — 未找到时返回 `null`

#### `create_unit` — 创建资金单元

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `unit_code` | string | 是 | 单元编码 |
| `amount` | number | 是 | 金额 |
| `strategy` | string | 是 | 策略（短期理财/中期理财/长期理财 等 8 个） |
| `tactics` | string | 是 | 战术（债券基金/货币基金/定期存款 等 10 个） |
| `currency` | string | 否 | 币种（默认 CNY） |
| `status` | string | 否 | 状态（默认 已成立） |
| `product_id` | string | 否 | 关联产品 ID |
| `start_date` | string | 否 | 起始日期 |
| `end_date` | string | 否 | 结束日期 |
| `note` | string | 否 | 备注 |

- **返回**: `{ unit }` — 包含完整创建后的记录

#### `update_unit` — 更新资金单元

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 资金单元 UUID |
| 其他字段 | 各类型 | 否 | 要更新的字段（支持 `null` 清除 `product_id`、`start_date`、`note`） |

- **约束**: 至少提供一个更新字段
- **返回**: `{ unit }` — 更新后的完整记录

#### `delete_unit` — 删除资金单元

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 资金单元 UUID |

- **返回**: `{ success: true }`

## 认证机制

采用 **两阶段 Refresh Token 引导**：

1. **配置阶段** (`getAuthConfig()`): 读取 3 个必需环境变量
   - `SUPABASE_URL` — Supabase API 端点
   - `SUPABASE_ANON_KEY` — 公开匿名密钥
   - `SUPABASE_REFRESH_TOKEN` — 用户长期 refresh token

2. **引导阶段** (`createAuthenticatedSupabaseClient()`):
   - 创建临时客户端，用 refresh token 换取 session（access + refresh token）
   - 创建正式客户端，启用 `autoRefreshToken: true`
   - 通过 `setSession()` 注入 session，后续自动刷新

> **为什么不直接设置 access_token？** 硬编码 access_token 会在 JWT 过期（默认 1 小时）后静默失败。使用 `setSession()` + `autoRefreshToken: true` 可自动续期。

## 运行

```bash
# 设置环境变量并启动
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<anon-key> \
SUPABASE_REFRESH_TOKEN=<your-refresh-token> \
bun run mcp:start
```

### Claude Desktop 配置

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

## 测试

### 三层测试

| 层级 | 文件 | 测试数 | 测试内容 | 需要数据库 |
|------|------|--------|---------|-----------|
| 单元测试 | `unit/*.unit.test.ts` | 51 | Mock Supabase 客户端测试 CRUD 处理函数 | 否 |
| 集成测试 | `crud.integration.test.ts` | 38 | 直接调用 CRUD 处理函数 + 真实 Supabase | 是（本地） |
| 工具处理 E2E | `tools.e2e.test.ts` | 59 | 直接调用查询处理函数 + 真实 Supabase | 是（本地） |
| 协议 E2E | `mcp.e2e.test.ts` | 20 | 子进程 stdio 完整 JSON-RPC 往返 | 是（本地） |

### 运行命令

```bash
# 从项目根目录运行（推荐）
bun run test:mcp    # 全部 168 个测试

# 仅单元测试（无需数据库）
bun test mcp/tests/unit/

# 仅集成测试
bun test mcp/tests/crud.integration.test.ts

# 仅 E2E
bun test mcp/tests/mcp.e2e.test.ts
bun test mcp/tests/tools.e2e.test.ts
```

### 测试设计

- **Mock 单元测试** — CRUD 处理函数使用 mock Supabase 客户端测试，覆盖成功/错误/边界情况
- **真实数据库集成测试** — 连接本地 Supabase，完整 CRUD 生命周期 + 筛选 + FK 约束
- **协议 E2E** — 启动 MCP 子进程，通过 `StdioClientTransport` 完整 JSON-RPC 往返
- **隔离用户** — 每个测试文件创建独立用户
- **清理** — `afterAll` 使用 service_role 删除所有测试数据和用户
- **独立依赖** — `mcp/` 有自己的 `node_modules`，测试中使用 `any` 类型规避 Supabase 客户端实例不匹配

### 环境隔离

`bunfig.toml` 预加载 `tests/setup.ts`，强制覆盖 Supabase 环境变量为安全假值，防止单元测试意外连接生产数据库。

## 独立包说明

`mcp/` 拥有独立的 `package.json`、`node_modules` 和 `tsconfig.json`，与根项目分离。三个核心依赖：

| 依赖 | 版本 | 用途 |
|------|------|------|
| `@modelcontextprotocol/sdk` | ^1.26.0 | MCP 协议实现 |
| `@supabase/supabase-js` | ^2.89.0 | Supabase 客户端 |
| `zod` | ^3.25.76 | 工具参数 schema 定义与验证 |

`tsconfig.json` 配置了 `@/*` 路径别名指向根项目的 `src/`，用于共享类型定义。

下一步：返回文档入口 → [README.md](../README.md)
