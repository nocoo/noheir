# 如何运行

## 环境要求

- Bun（推荐作为运行时与包管理器）
- Node.js（Bun 已兼容）

## 安装依赖

```bash
bun install
```

## 环境变量

```bash
cp .env.example .env.local
```

`.env.local` 需要配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 启动开发服务器

```bash
bun run dev
```

访问 `http://localhost:7012`。

## 生产部署（Railway）

线上地址：[https://noheir.hexly.ai](https://noheir.hexly.ai)

### 架构

Noheir 是纯客户端 SPA（无 SSR、无 API Routes），所有后端交互通过 Supabase Cloud SDK 完成。部署仅需将 Vite 构建产物托管为静态站点。

### 平台

- **Railway** + **Railpack** 构建器
- Railpack 自动识别 Vite 项目 → `bun vite build` → `dist/` 由 **Caddy** 提供 SPA fallback 服务
- 零配置，无需 Dockerfile

### 环境变量

在 Railway 服务中配置以下编译时环境变量（Vite 在构建时将其烘焙进 JS bundle）：

| 变量 | 说明 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 |

### 自动部署

- GitHub 仓库 `nocoo/noheir`（`main` 分支）已连接 Railway
- 推送到 `main` 即自动触发构建与部署
- 区域：Asia Southeast 1（新加坡）

### 手动部署

```bash
railway up
```

### 自定义域名

- 生产域名：`noheir.hexly.ai`
- Railway 服务域名：`web-production-e1ab6.up.railway.app`
- 目标端口：8080（Caddy 默认）

---

下一步：了解如何测试 → [05-testing.md](./05-testing.md)
