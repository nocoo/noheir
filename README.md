<div align="center">
  <img src="public/logo-128.png" alt="Noheir Logo" width="128" height="128">
  <h1>Noheir（个人财务管理）</h1>
  <p>收支分析、储蓄率追踪、多账户管理、资产配置与财务健康评估</p>
</div>

## 👋 概览

Noheir 是一款个人财务管理 Web 应用，帮助用户从收支到资产形成完整的财务视图，并通过可视化与指标体系辅助决策。

## 🧭 文档入口（按编号顺序阅读）

- [01-overview.md](./docs/01-overview.md)
- [02-core-features.md](./docs/02-core-features.md)
- [03-structure.md](./docs/03-structure.md)
- [04-run.md](./docs/04-run.md)
- [05-testing.md](./docs/05-testing.md)
- [06-docs-guidelines.md](./docs/06-docs-guidelines.md)
- [07-dev-guidelines.md](./docs/07-dev-guidelines.md)
- [08-data-and-security.md](./docs/08-data-and-security.md)
- [09-pages-and-data-flow.md](./docs/09-pages-and-data-flow.md)
- [10-mvvm-guidelines.md](./docs/10-mvvm-guidelines.md)
- [11-e2e-testing.md](./docs/11-e2e-testing.md)
- [12-mcp-server.md](./docs/12-mcp-server.md)
- [13-basalt-migration.md](./docs/13-basalt-migration.md)
- [14-gen2-rewrite.md](./docs/14-gen2-rewrite.md)
- [15-api-naming-reform.md](./docs/15-api-naming-reform.md)
- [16-old-new-system-comparison.md](./docs/16-old-new-system-comparison.md)
- [17-contribution-logs.md](./docs/17-contribution-logs.md)

## 🚀 快速运行

```bash
bun install
cp .env.example .env.local
bun run dev
```

访问 `http://localhost:7004`。

## 🌐 生产部署

- **形态**：Docker 镜像（多阶段 `oven/bun:1`）→ GitHub Container Registry → 自托管 VPS
- **接入**：Cloudflare 边缘 + 源站 mTLS（Authenticated Origin Pulls）
- **CI/CD**：GitHub Actions —— `CI` 通过后自动触发 `Release`，构建镜像并 SSH 部署
- **详细部署文档**：[docs/04-run.md](./docs/04-run.md#生产部署)

## 🤖 Agent 指南（必读）

### 主要功能

- 收支分析与分类洞察
- 储蓄率与财务健康度评估
- 资产与资金单元管理
- 数据导入与质量校验
- 可选 AI 助手分析

### 主要目录结构

```
noheir/
├── public/                # 静态资源
├── src/
│   ├── components/        # 业务与通用组件
│   ├── contexts/          # 全局上下文
│   ├── domain/            # 纯业务规则与计算
│   ├── hooks/             # 自定义 Hooks
│   ├── lib/               # 工具与核心逻辑
│   ├── pages/             # 页面级组件
│   ├── services/          # 数据服务
│   ├── types/             # 类型定义
│   ├── viewmodels/         # 视图模型与派生逻辑
│   └── main.tsx           # 应用入口
├── mcp/                   # MCP server（AI agent 数据接口）
├── supabase/              # 数据库迁移与 Supabase 配置
├── tests/                 # 单元测试 + E2E 测试
├── scripts/               # 开发辅助脚本
└── docs/                  # 项目文档
```

### 如何运行开发服务器

```bash
bun run dev
```

### 测试与文档要求

- 代码规范检查：`bunx eslint . --max-warnings=0`
- UT：`bun test`
- 覆盖率：`bun test --coverage`
- UT 覆盖率目标：**90%**
- 更新代码必须同步更新相应文档
- README 只保留概览与入口，细节下沉到 `docs/`

### 提交要求（原子化）

- 一个 commit 只包含一个逻辑变更
- 保持每个 commit 可回滚、可构建
- 修改行为或流程必须附带文档更新

### 文档与代码联动

- 任何新功能、目录调整或运行方式变更，必须同步更新 `docs/` 与 `README.md`
