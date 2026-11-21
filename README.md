<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Noheir logo" width="128" height="128" />
</p>

<h1 align="center">Noheir</h1>

<p align="center">个人现金流、账户、资金配置与可用性规划系统。</p>

<p align="center"><a href="https://noheir.hexly.ai">站点</a> · <a href="docs/README.en.md">English</a></p>

## 这是什么

Noheir 用于导入收入、支出与转账记录，并按年度、账户与分类进行分析；通过产品、资金单元与出资日志追踪资金投向、收益与可用性，并为周期性支出提供规划日历。数据由所有者自行导入或维护，不提供银行自动同步。外部分析工具可通过受限作用域的 REST API 读取数据并写回私有 Markdown 报告；Noheir 内部不集成任何模型。

生产环境采用 Vite / React Router 与原生 Cloudflare Worker（Hono、Workers Static Assets 与 D1），浏览器登录由 Cloudflare Access 处理。当前源码以受限作用域 Bearer Key 替代了原有的 MCP/OAuth 方案，相关重构与运行时迁移记录见 [迁移计划](docs/23-workers-migration.md)。

## 功能

- **收支与转账管理**：支持按单年导入包含中文表头的 CSV（经服务端校验后在单个原子 D1 batch 中替换该用户当年的收支或转账记录），支持 JSON 导出与恢复。
- **资金配置与可用性**：通过产品、资金单元与出资日志追踪投向与收益；可用性取自最新一条投资日志或显式覆写值，缺失投资历史时保持未知。金额以整数分存储，日历计算统一使用 `Asia/Shanghai` 辅助函数；各币种（`CNY` / `USD` / `HKD`）分开汇总，不做隐式汇率换算。
- **周期性支出规划**：提供周期性支出规划日历与预测视图。
- **受限作用域 REST API（`/api/v1`）**：支持在 **API Keys** 页面签发带过期时间、可吊销、仅存哈希值的密钥（读/写/删权限独立），支持基于 `nextCursor` 的分页、写入 `Idempotency-Key`、更新/删除乐观锁 `If-Match: "version"`、机器发现端点 `/api/v1/openapi.json` 与 `/api/v1/instructions`，以及惰性渲染的私有 Markdown 报告（不执行 HTML、不加载远端图片、不调用模型）。密钥管理与站点设置仅限人工通过 Cloudflare Access 操作。

## 使用

打开 [Noheir 站点](https://noheir.hexly.ai) 并通过 Cloudflare Access 完成认证。已验证的邮箱必须匹配现有的 Noheir 用户；原有财务用户 ID 保持不变，新的 Access 身份不会自动创建空账户。

### CSV 导入与备份边界

按导入界面所示的中文列名导入单年 CSV。交易导入会替换该用户当年的收入/支出记录，转账导入会替换该用户当年的转账记录。确认前可预览解析结果；有计划的替换操作前请先导出备份。

**备份范围说明**：JSON 导出仅包含交易、转账、产品与资金单元，不含原始设置与凭据；恢复操作仅跨所有年份替换交易与转账，不会恢复产品、资金单元或设置，且出资日志与周期性支出不包含在导出内容中。该导出并非完整容灾备份，运维人员仍应保留 D1 导出。

### 受限作用域 API 与报告

在 **API Keys** 页面创建带过期时间的密钥，仅勾选所需权限并将一次性密钥保存至工具的安全存储中。

- 基础路径：`/api/v1`；认证方式：`Authorization: Bearer <key>`。
- 人类可读文档：[docs/api.md](docs/api.md)；机器发现：`/api/v1/openapi.json` 与 `/api/v1/instructions`。
- 使用 `nextCursor` 分页读取财务记录；数据集变更时需重新拉取。各币种汇总保持独立。
- 变更请求需携带 `Idempotency-Key`；更新或删除需携带先前读取到的版本 `If-Match: "version"`，遇到冲突时应复核而非直接覆盖。
- 写入外部 Markdown 分析报告时需附带周期、币种、源修订号、同所有者证据以及可选的未验证作者/模型标签。
- 本地调用还需携带密钥页面显示的当前 `x-noheir-instance`；本地夹具密钥不可用于生产环境。

详见 [API 设计与验收记录](docs/25-scoped-api.md) 与 [Access 部署边界](docs/04-run.md#scoped-rest-and-access)。

## 开发

CI 锁定 Bun 1.4.2 与 Node 26.12.1。分别安装根目录与 Worker 测试依赖后，启动本地 Demo 运行时：

```sh
git clone https://github.com/nocoo/noheir.git
cd noheir
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run prepare
bun run dev
```

打开 `https://noheir.dev.hexly.ai`（转发至 `:7004`）。本地默认进入持久化 Demo，可切换到每次新建的 E2E 或 Prod；右上角 `Demo | E2E | Prod` 切换仅本地显示，自动化 E2E 由启动器锁定。演示数据全部合成，原有本地数据保留，测试绝不连接生产环境。详见 [本地环境命令与特性矩阵](docs/24-local-environments.md)。

```text
src/app/             财务页面与类型化浏览器操作
src/routes.tsx       React Router 数据路由
src/domain/          财务计算与视图模型
src/components/      Basalt 控件、图表与表格
worker/src/          Hono 财务服务、Access 校验与受限作用域 Bearer REST
worker/db/           数据库 Schema、仓储与 D1 迁移
scripts/             隔离测试夹具与发布/部署脚本
```

### 发布与部署

`main` 分支 CI 通过后会触发固定版本的原生 Worker 发布工作流，校验 CI 源 commit 并将 UI 与 API 一同部署；生产校验在打 tag 前会核对精确 `build_sha`、根包版本、D1 连通性与认证边界。

GitHub 环境 `noheir / production` 需配置 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`。发布入口为 `bun run release -- major`（或 `minor` / `patch`）。切换或清理前请阅读 [部署、回滚与旧版清理指南](docs/04-run.md)；清理旧 VPS 与旧 Worker 时严禁删除现有的 `noheir-db`。

## 测试

| 检查项                   | 命令                                 |
| ------------------------ | ------------------------------------ |
| 应用单元/组件覆盖率      | `bun run test:coverage`              |
| Worker 单元覆盖率        | `bun run --cwd worker test:coverage` |
| 双端 TypeScript 检查     | `bun run typecheck`                  |
| Biome 代码检查           | `bun run lint`                       |
| 生产构建                 | `bun run build`                      |
| 真实 HTTP 与 SQLite 测试 | `bun run test:e2e`                   |
| 浏览器端到端测试         | `bun run test:e2e:bdd`               |
| 部署包预检               | `bun run deploy:check`               |

运行浏览器测试前需先执行 `bunx playwright install chromium`。HTTP 测试使用端口 `17004`，浏览器测试使用端口 `27004` 与构建产物；每次运行都会创建独立本地 SQLite 数据库并在写入与清理前校验标记。HTTP 认证使用本地签名 JWT 与拦截 JWKS，绝不连接生产 Access 与 D1。应用与 Worker 单元测试在配置范围内保留四项指标 >=95% 的覆盖率底线，排除项与证据见 [AGENTS.md](AGENTS.md)。

## 技术栈

| 领域         | 实现                                                         |
| ------------ | ------------------------------------------------------------ |
| Web 前端     | Vite、React、React Router、Tailwind CSS、`@nocoo/basalt`     |
| 图表         | Recharts、Nivo Sunburst                                      |
| 身份与 API   | Cloudflare Access、`jose`、受限作用域 Bearer Key             |
| 服务端与存储 | Cloudflare Workers、Hono、D1、Drizzle ORM                    |
| 交付与构建   | Bun、GitHub Actions、Workers Static Assets                   |
| 测试         | Vitest、Testing Library、Playwright、本地 Miniflare / SQLite |

## 文档

- [文档总览](docs/README.md)
- [运维手册](docs/04-run.md) 与 [Workers 迁移计划](docs/23-workers-migration.md)
- [项目规则与验证口径](AGENTS.md)
- [本地环境矩阵](docs/24-local-environments.md)
- [出资日志设计](docs/17-contribution-logs.md)
- [受限作用域 API 与外部报告](docs/25-scoped-api.md) 与 [API 参考](docs/api.md)
- [周期性支出日历](docs/002-recurring-expense-calendar.md)
- [Logo 溯源](assets/brand/README.md)

早期编号文档保留了历史架构与设计决策；当前命令请以运维手册与项目规则为准。

## 许可证

本仓库目前未附带独立 LICENSE 文件，未声明开源许可证。
