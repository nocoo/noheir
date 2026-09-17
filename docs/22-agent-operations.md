# 22 · 部署边界与界面约定

当前测试命令和 6DQ 状态见根 CLAUDE.md。本页保留运维与显示约束，发布操作须属于当前授权任务。

## 部署拓扑


- **Architecture**: Next.js (standalone, port 7004) handles UI + NextAuth + MCP OAuth + API routes; Cloudflare Worker provides SQL API to D1.
- **Image**: `Dockerfile` (multi-stage, `oven/bun:1`) → published to GHCR as `ghcr.io/<owner>/noheir:latest` and `:<sha>`.
- **Edge**: Cloudflare in front of an origin VPS (jp2.nocoo.cloud, Azure 日本). A shared `proxy-caddy` at `/opt/proxy/` terminates TLS with a Cloudflare Origin Certificate (`*.hexly.ai`) and enforces **Authenticated Origin Pulls (mTLS)**, so direct-to-IP traffic is rejected. App containers (`noheir-app`, `neo-app`, …) join the shared docker network `edge`; Caddy reverse-proxies to them by container name.
- **CI/CD**: `.github/workflows/ci.yml` runs lint + unit tests on every push/PR. `.github/workflows/release.yml` is chained via `workflow_run` — on green CI for `main` it builds & pushes the image, then SSHes into the VPS to `docker compose pull && up -d --no-deps app`, runs an in-container health check, and finally smoke-tests via the public URL. Only the app container rolls; `proxy-caddy` is never touched by app deploys.
- **Runtime env vars** (injected by the host's `.env`, never baked into the image): `WORKER_URL`, `WORKER_TOKEN`, `AUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`.
- **GitHub Actions secrets** required by `release.yml`: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_PULL_USER`, `GHCR_PULL_TOKEN` (PAT with `read:packages`). Host-side compose file references the same image tag.
- See [docs/04-run.md](04-run.md) for the full deploy guide.
- Public `GET /api/live` executes read-only `SELECT 1` through the existing authenticated Worker SQL gateway, with a five-second timeout. It returns the current top-level version, `database.connected`, and `Cache-Control: no-store`; missing configuration or dependency failure returns HTTP 503 without private diagnostics. Keep the route public and verify the deployed response after each release.


## 领域标签与可用状态


### Unified Badge System

All domain labels (unitCode, strategy, tactics, status, currency, product) MUST use the unified Badge components from `src/components/ui/colored-badge.tsx`:

| Data Type | Component | Color Source |
|-----------|-----------|--------------|
| Unit Code (e.g., C10, A01) | `<UnitCodeBadge unitCode={...} />` | Hash by prefix |
| Strategy (e.g., 远期理财) | `<StrategyBadge strategy={...} />` | `STRATEGY_TOKEN_MAP` |
| Tactics (e.g., 定期存款) | `<TacticsBadge tactics={...} />` | `TACTICS_TOKEN_MAP` |
| Status (e.g., 已成立) | `<StatusBadge status={...} />` | `STATUS_TOKEN_MAP` |
| Currency (e.g., CNY, USD) | `<CurrencyBadge currency={...} />` | `CURRENCY_TOKEN_MAP` |
| Product Name | `<ProductBadge productName={...} />` | Hash by name |

**Key principle**: The same label (e.g., `C10` or `远期理财`) must display with identical color and style across ALL pages. Never use raw `<Badge>` for domain-specific data.

### Availability Status Colors

| State | Color | Label |
|-------|-------|-------|
| Available (≤0 days) | Green | "已可用" / "可用" |
| Soon (1-30 days) | Amber | "N天" |
| Locked (>30 days) | Red/Destructive | "锁定中" |
