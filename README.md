<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Noheir logo" width="128" height="128" />
</p>

<h1 align="center">Noheir</h1>

<p align="center">整理个人收支、账户与存量资金，查看现金流、配置和到期安排。</p>

<p align="center">
  <a href="https://noheir.hexly.ai">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

Noheir 是个人财务管理 Web 应用。导入收支和转账流水后，可以按年份、账户与分类分析现金流；资金单元和产品表用于记录现有资金的投向、投入赎回、收益和可用日期。

当前应用使用 Next.js 提供页面、登录和 MCP 接口，通过 Cloudflare Worker 访问 D1。站点采用 Google 登录与邮箱白名单。数据由使用者导入或维护，当前没有银行账户自动同步。

## 功能

- 查看收入、支出、储蓄率、账户流向、时段对比及财务健康指标。
- 管理资金单元、金融产品和投入 / 赎回记录，查看策略分布、仓库视图和流动性梯队。
- 维护周期支出与分类，在资金计划日历中查看预计发生日期。
- 导入指定格式的中文 CSV，预览解析结果；通过数据管理页面导出或恢复 JSON 备份。
- 从历史交易识别周期性支出和即将到期的付款。“AI 洞察”当前使用规则计算；AI 设置页可保存模型配置，但该洞察流程不调用大模型。
- 通过 MCP 查询流水、汇总和产品关联资金，并创建、修改或删除产品与资金单元。MCP 使用用户授权后的身份访问数据。

## 使用

### Web 应用

打开[站点](https://noheir.hexly.ai)，使用白名单内的 Google 账号登录。自行部署时需配置自己的 OAuth 应用、邮箱白名单和 Worker 数据库连接。

首次导入从“数据导入”页面开始，分别选择“收支流水”或“转账数据”。CSV 必须使用页面列出的中文表头，每次文件只包含同一年的数据。确认导入会替换该用户对应年份、对应类型的已有流水，导入前可在“数据管理”导出备份。

随后在账户设置、通用设置中维护分类和计算参数；在产品表、资金表中记录存量资金。资金计划中的周期支出由使用者单独维护。

JSON 导出包含流水、产品、资金单元与设置。恢复目前只处理收支和转账，并替换该用户全部年份的这两类流水；产品、资金单元和设置不会恢复，投入日志与周期支出尚未纳入导出。

### MCP

登录后打开“MCP 配置”，复制适合客户端的配置。当前服务地址为：

```text
https://noheir.hexly.ai/api/mcp
```

支持 Streamable HTTP 和 OAuth 浏览器授权。以页面提供的 HTTP 客户端配置为例：

```json
{
  "mcpServers": {
    "noheir": {
      "type": "http",
      "url": "https://noheir.hexly.ai/api/mcp"
    }
  }
}
```

客户端首次连接时完成 Google 登录与授权。自行部署时替换为自己的站点地址。当前传输以 POST 返回 JSON，未提供 SSE 长连接；具体配置格式以所用客户端为准。

## 开发

需要 Bun 和 Node.js 22.12+，建议使用受测试工具支持的 LTS 版本。根应用和 `worker/` 分别安装依赖：

```bash
git clone https://github.com/nocoo/noheir.git
cd noheir
bun install --frozen-lockfile
cd worker
bun install --frozen-lockfile
bunx wrangler d1 migrations apply noheir-db --local
cd ..
cp .env.example .env.local
```

`.env.example` 默认指向维护者的生产 Worker。使用本地 D1 时，将 `.env.local` 中的 `WORKER_URL` 改为 `http://127.0.0.1:37004`，设置自己的 `WORKER_TOKEN`，并在 `worker/.dev.vars` 中设置相同的 `WORKER_TOKEN`。两者必须匹配。

| `.env.local` 变量 | 用途 |
| --- | --- |
| `WORKER_URL` / `WORKER_TOKEN` | Worker 地址与共享凭据 |
| `AUTH_SECRET` | 会话签名密钥，可用 `openssl rand -base64 32` 生成 |
| `NEXTAUTH_URL` | 当前应用地址，本地为 `http://localhost:7004` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 自己的 Google OAuth 应用凭据 |
| `ALLOWED_EMAILS` | 逗号分隔的登录邮箱白名单 |
| `ALLOWED_DEV_ORIGINS` | 使用开发反向代理时允许的 host，可选 |

在 Google OAuth 应用中添加回调地址 `http://localhost:7004/api/auth/callback/google`。本地页面仍需要正常登录；首次登录会把用户信息写入所连接的 D1。

在两个终端分别运行：

```bash
# 终端一：本地 Worker，端口 37004
bun run --cwd worker dev
```

```bash
# 终端二：Next.js，端口 7004
bun run dev
```

`bun run build` 构建应用，`bun run start` 运行构建后的站点。类型与代码风格检查使用 `bun run typecheck`、`bun run worker:typecheck` 和 `bun run lint`。

```text
src/app/             Next.js 页面、Server Actions、登录与 MCP 路由
src/domain/          收支、资金配置、导入及设置的计算逻辑
src/lib/mcp/         MCP 工具、鉴权与数据访问
src/components/      图表、表格与交互组件
worker/src/          Hono 业务 API 与 SQL 接口
worker/db/           Drizzle schema、repository 与 D1 迁移
```

生产站点使用 Docker standalone 构建，CI 成功后发布到 VPS；站点的反向代理和环境配置见[运行与部署说明](docs/04-run.md)。Worker 使用 `worker/` 包中的 `deploy` 命令独立发布，需要自己的 D1、域名和 `WORKER_TOKEN`；站点自动部署不会更新 Worker。

## 测试

从仓库根目录运行：

| 测试层 | 命令 |
| --- | --- |
| 应用单元与组件测试 | `bun run test` |
| Worker 单元测试 | `bun run test:worker` |
| Worker HTTP 集成测试 | `bun run test:e2e` |
| 浏览器冒烟测试 | `bun run test:e2e:bdd` |

先完成根目录和 `worker/` 的依赖安装；Worker 单元测试使用本地 SQLite，需要可用的 `better-sqlite3` 原生模块。HTTP 测试会重建独立的 `worker/.wrangler/state-e2e/`，应用迁移并启动本地 Worker，默认端口 `17004`，可用 `E2E_PORT` 覆盖。

浏览器测试需要先运行 `bunx playwright install chromium`，随后自动启动端口 `27004` 的 Next.js。当前仅检查公开服务条款页，未覆盖登录后的财务操作。`bun run test:coverage` 可生成应用测试的覆盖率报告。

## 技术栈

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Bun](https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white)
![D1](https://img.shields.io/badge/D1-F38020)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)
![MCP](https://img.shields.io/badge/MCP-222222)

| 部分 | 实现 |
| --- | --- |
| Web | Next.js App Router、React、Tailwind CSS、Radix UI |
| 图表 | Recharts、Nivo Sunburst |
| 登录与 MCP | Auth.js / NextAuth、Google OAuth、MCP SDK |
| 服务与数据 | Cloudflare Workers、Hono、D1、Drizzle ORM |
| 运行与部署 | Bun、Docker、GitHub Container Registry、VPS |
| 测试 | Vitest、React Testing Library、jsdom、Playwright、SQLite |

依赖以[根 package.json](package.json)、[Worker package.json](worker/package.json) 和各自的 `bun.lock` 为准。

## 文档

- [文档索引](docs/README.md)
- [运行与部署](docs/04-run.md)
- [投入与赎回记录](docs/17-contribution-logs.md)
- [MCP OAuth 与 Next.js 架构](docs/20-mcp-oauth-nextjs-architecture.md)
- [MCP 查询与工具设计](docs/21-mcp-agent-friendly-improvement.md)
- [周期支出日历](docs/002-recurring-expense-calendar.md)
- [Logo 使用说明](assets/brand/README.md)

早期文档包含 Supabase、Vite 和 Worker MCP 的历史方案；当前入口与运行命令以本 README 为准。

## 许可证

当前仓库未包含许可证文件，也未在包配置中声明开源许可证。
