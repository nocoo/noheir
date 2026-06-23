# 如何运行

## 环境要求

- Bun ≥ 1.0
- （可选）Docker ≥ 24，仅在本地复现生产构建时需要
- （可选）Wrangler CLI，用于操作 Cloudflare Worker / D1

## 安装依赖

```bash
bun install                  # 根目录
cd worker && bun install     # worker 子包独立安装
```

> 仓库使用 **两层供应链硬约束**，防御 node-gyp 风格的 install-hook 投毒（Snyk 2026-06）：
>
> | 层 | 位置 | 机制 | 当前白名单 |
> |----|------|------|-----------|
> | 根 | `bunfig.toml` | `[install] ignoreScripts = true` —— 阻断**全部**依赖的 install/postinstall/prepare 等脚本（含 trustedDependencies 中列出的包）。这是 deny-all 防御。 | （无脚本可跑） |
> | worker | `worker/package.json#trustedDependencies` | 显式 allowlist。Bun 默认会信任内置 367 包白名单；定义该字段后**替换**默认列表，只放行其中包的脚本。 | `better-sqlite3`、`esbuild`、`workerd` |
>
> **为什么 worker 不能用 `ignoreScripts`？** `worker/` 用 `better-sqlite3` 跑单元测试，它的 `install` 钩子（`prebuild-install`）必须运行才能下载 `.node` prebuilt binary，否则测试无法 require。所以 worker 不能简单 deny-all，需要走显式 allowlist。
>
> **bunfig 不跨目录继承**：`cd worker && bun install` 不会读取根 `bunfig.toml`。这是 Bun 1.3.x 的行为，**不要**靠根 bunfig 间接约束 worker。
>
> ### 校验配置生效
>
> ```bash
> # 在根 / worker 各自跑一次：
> bun pm untrusted          # 看被阻断的包；root 应当为空（无 trusted 脚本本来就少），worker 应列出 sharp 等非白名单 native dep
> bun install --verbose 2>&1 | rg -i "lifecycle scripts|starting scripts"
> #   root：应看到 [Lifecycle Scripts] ignoring … 但**没有** [Scripts] Starting scripts
> #   worker：应只看到 [Scripts] Starting scripts for "better-sqlite3" / "workerd"
> ```
>
> ### 临时放行脚本（不建议长期使用）
>
> 若某个被阻断的包确实需要本地编译/下载产物，**先 `cd` 到该包所在 package（根或 worker），然后**：
>
> ```bash
> bun pm untrusted          # 确认是哪个包
> bun pm trust <pkg>        # 执行该包的脚本，并把它写入当前 package.json#trustedDependencies
> ```
>
> ⚠️ `bun pm trust <pkg>` 有持久副作用：
>
> 1. 直接修改 `package.json` 的 `trustedDependencies` 字段（worker 会真的扩允许列表）；
> 2. 同步执行该包的 install/postinstall。
>
> 对 root 而言，因为 `bunfig.toml ignoreScripts=true` 会**覆盖** trustedDependencies，加进 root 的 `package.json#trustedDependencies` 也不会让脚本跑——只能临时把 `ignoreScripts` 注释掉或挪到 worker 模式。请在 PR 描述里写明动机。
>
> （历史误区：早期文档曾写 `bun install --trusted=<pkg>`，Bun 1.3.14 没有这个 flag，会被默默忽略。正确命令是 `bun pm trust`。）

## 环境变量

```bash
cp .env.example .env.local
```

`.env.local` 主要字段：

| 变量 | 说明 |
|------|------|
| `WORKER_URL` | Cloudflare Worker SQL API 地址 |
| `WORKER_TOKEN` | 与 Worker 共享的 Bearer Token |
| `AUTH_SECRET` | NextAuth JWT 签名密钥 |
| `NEXTAUTH_URL` | 当前实例对外 URL（开发时通常是反向代理后的 https 域名） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 凭据 |
| `ALLOWED_EMAILS` | 逗号分隔的白名单邮箱 |
| `ALLOWED_DEV_ORIGINS` | 反向代理时允许的 host（仅 dev） |

## 启动开发服务器

```bash
bun run dev
```

默认访问 `http://localhost:7004`。

---

## 生产部署

### 架构总览

```
Browser ──HTTPS──▶ Cloudflare ──HTTPS + mTLS──▶ proxy-caddy ──HTTP──▶ noheir-app (Bun, :7004)
                                                                     │
                                                                     └──HTTPS──▶ Cloudflare Worker ──▶ D1
```

- **应用**：Next.js 16 standalone 构建，Bun 运行，监听 7004
- **后端**：Cloudflare Worker（`worker/`）+ D1（SQLite），见 [12-mcp-server.md](./12-mcp-server.md)
- **边缘**：Cloudflare 代理 + Universal SSL
- **源站**：自托管 VPS（jp2.nocoo.cloud, Azure 日本），独立反代层 `proxy-caddy` 终止 TLS（Cloudflare Origin Certificate `*.hexly.ai`），并启用 **Authenticated Origin Pulls** (mTLS) 拒绝直连 IP 的流量
- **反代架构**：`/opt/proxy/` 跑唯一一份 Caddy 占 80/443，所有 app 容器接入共享 docker network `edge`，Caddy 通过容器名（`noheir-app:7004`）反代到内网。新增项目只需在 `/opt/proxy/Caddyfile` 加一个 site block + app compose 引用 `edge` external network
- **镜像分发**：GitHub Container Registry（GHCR），标签为 `:latest` 与 `:<commit-sha>`

### 镜像构建

`Dockerfile` 为三阶段：deps → builder → runner（`oven/bun:1`）。
关键点：
- 构建阶段只为 `next-auth` 等 module-init 时读取 env 的库注入占位符（`AUTH_SECRET=build-placeholder`、`NEXTAUTH_URL=http://localhost:7004`），**真实密钥永不烘焙进镜像**。
- 运行阶段只 copy `.next/standalone`、`.next/static`、`public`，启动命令 `bun server.js`。

本地复现：

```bash
docker build -t noheir:local .
docker run --rm -p 7004:7004 --env-file .env.local noheir:local
```

### 源站准备（一次性）

源站需要：

1. Docker + Docker Compose
2. 共享反代层 `/opt/proxy/`（**全 VPS 仅一份**，由所有 app 共享）：
   - `docker-compose.yml`：仅 `caddy` 一个 service，绑 `80:80` 和 `443:443`，加入 external network `edge`
   - `Caddyfile`：每个域名一个 site block，复用 `(hexly_tls)` snippet（Cloudflare Origin Cert `*.hexly.ai` + `client_auth` 信任 CF AOP CA），`reverse_proxy <container-name>:<port>`
   - `certs/`：Origin Cert + 私钥 + `cf-origin-pull-ca.pem`
3. App 工作目录（示例 `/opt/noheir/`），内含：
   - `docker-compose.yml`：仅 `app` 一个 service，`container_name: noheir-app`，`expose: ["7004"]`，加入 external network `edge`，**不再绑定主机端口**
   - `.env`（chmod 600）：上表中的所有运行时变量
4. 共享 docker network：`docker network create edge`（一次性，由 proxy 和所有 app 共用）
5. SSH 公钥：单独生成一对部署密钥（每个项目一对），公钥放进 `~/.ssh/authorized_keys`，私钥配进 GitHub Actions secret
6. 防火墙：仅放行 22（部署用，可按需收紧到 GitHub Actions IP 段或临时开启）、80、443

### CI / CD

两个 workflow：

| Workflow | 文件 | 触发 | 作用 |
|----------|------|------|------|
| CI | `.github/workflows/ci.yml` | push / PR | Lint + 单测 |
| Release | `.github/workflows/release.yml` | CI 在 `main` 上成功后自动触发，或 `workflow_dispatch` 手动 | 构建镜像 → 推 GHCR → SSH 部署 → 健康检查 → 边缘 smoke test |

Release 步骤要点：
1. `docker/build-push-action` 构建并推送 `:latest` 与 `:<sha>` 两个 tag，使用 `type=gha` 缓存
2. `appleboy/ssh-action` 进入源站执行：
   ```
   docker compose pull app
   docker compose up -d --no-deps app   # 仅滚动 app，proxy-caddy 永不动
   # 容器内健康检查 fetch http://127.0.0.1:7004/
   docker image prune -f
   ```
3. 最后 `curl https://<public-domain>/` 走 Cloudflare 边缘做 smoke test

### 所需 GitHub Actions Secrets

| 名称 | 用途 |
|------|------|
| `VPS_HOST` | 源站 hostname / IP |
| `VPS_USER` | SSH 用户 |
| `VPS_SSH_KEY` | 部署私钥 |
| `GHCR_PULL_USER` | GHCR 拉取账号 |
| `GHCR_PULL_TOKEN` | PAT（classic，scope `read:packages`） |

> 推送镜像本身用 workflow 自动注入的 `GITHUB_TOKEN`，无需另配。

### 回滚

镜像同时打了 `:latest` 与 `:<sha>` 两个 tag。回滚直接在源站把 compose 中的 image 临时改成历史 sha 后 `docker compose up -d --no-deps app` 即可，或重新触发某个旧 commit 的 Release（`workflow_dispatch` 指定该 commit）。

### 本地手动触发 Release

```bash
gh workflow run release.yml
```

---

下一步：了解如何测试 → [05-testing.md](./05-testing.md)
