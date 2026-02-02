<div align="center">
  <img src="public/logo/logo-128.png" alt="Noheir Logo" width="128" height="128">
  <h1>Noheir（个人财务管理）</h1>
  <p>收支分析、储蓄率追踪、多账户管理、资产配置与财务健康评估</p>
</div>

## 👋 概览

Noheir 是一款个人财务管理 Web 应用，帮助用户从收支到资产形成完整的财务视图，并通过可视化与指标体系辅助决策。

文档从此处进入，逐级阅读：

- [01-overview.md](./docs/01-overview.md)
- [02-core-features.md](./docs/02-core-features.md)
- [03-structure.md](./docs/03-structure.md)
- [04-run.md](./docs/04-run.md)
- [05-testing.md](./docs/05-testing.md)
- [06-docs-guidelines.md](./docs/06-docs-guidelines.md)
- [07-dev-guidelines.md](./docs/07-dev-guidelines.md)
- [08-data-and-security.md](./docs/08-data-and-security.md)

## 🚀 快速运行

```bash
bun install
cp .env.example .env.local
bun run dev
```

访问 `http://localhost:7012`。

## 🧭 Agent 指南（必读）

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
│   ├── hooks/             # 自定义 Hooks
│   ├── lib/               # 工具与核心逻辑
│   ├── pages/             # 页面级组件
│   ├── services/          # 数据服务
│   └── types/             # 类型定义
├── scripts/               # 开发辅助脚本
└── docs/                  # 项目文档
```

### 开发服务器

```bash
bun run dev
```

### 测试与文档要求

- 代码规范检查：`bun run lint`
- UT 覆盖率目标：**90%**
- 更新代码必须同步更新对应文档
- README 只保留概览与入口，细节下沉到 `docs/`

### 提交要求（原子化）

- 一个 commit 只包含一个逻辑变更
- 保持每个 commit 可回滚、可构建
- 修改行为或流程必须附带文档更新

## 🧪 Husky 与提交检查

### 安装与启用

```bash
bun install
bun run prepare
git config core.hooksPath .husky
```

如本地已配置 `core.hooksPath`，请确保值为 `.husky`（不要使用 `.husky/_`）。

### Hook 行为

- `pre-commit`：运行 `bun run test`（TS 单元测试）
- `pre-push`：运行 `bun run test` + `bun run lint`

### 约束与目标

- 不允许跳过测试（禁止使用 `HUSKY=0` 或绕过 hooks）
- 如存在测试与 Lint 体系，应遵循上述规则进行调整
- 原则上修复所有 UT 和 Lint 的 Error/Warning，单个 case 允许压制
- UT 覆盖率目标：**90%**，不易测试的模块建议拆分

## 🧪 测试基建（bun test）

### 依赖与类型

```bash
bun add -d bun-types
```

### 运行测试

```bash
bun run test
bun run test:coverage
```

### 用例目录

- `tests/` 存放单元测试
