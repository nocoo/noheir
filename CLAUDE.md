README.md

## Deployment

- **Production URL**: https://noheir.hexly.ai
- **Platform**: Railway (Railpack builder, Caddy SPA serving)
- **Auto-deploy**: Push to `main` branch triggers build & deploy
- **Region**: Asia Southeast 1 (Singapore)
- **Architecture**: Next.js handles MCP OAuth + API routes; Cloudflare Worker provides SQL API to D1.
- **Compile-time env vars** (set in Railway): `WORKER_URL`, `WORKER_SECRET`, `NEXTAUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

## Backend (Cloudflare Worker + D1)

- **Worker**: `worker/` directory, deployed to `noheir.worker.hexly.ai`
- **Database**: Cloudflare D1 (SQLite), database ID in `worker/wrangler.toml`
- **Schema**: Drizzle ORM, schema in `worker/db/schema.ts`
- **Migrations**: `worker/db/migrations/`

### Common Commands

```bash
# Query D1 (remote)
npx wrangler d1 execute noheir-db --remote --command "SELECT COUNT(*) FROM transactions"

# Run migrations
npx wrangler d1 migrations apply noheir-db --remote

# Local dev
cd worker && bun run dev
```

## Test Architecture

### Test Strategy

| Layer | Files | Runner |
|-------|-------|--------|
| Unit | `tests/{domain,viewmodels,contexts,hooks,lib,services,smoke}/` | `bun run test:unit` |
| Worker E2E | `worker/tests/e2e/` | `bun run test:e2e` (in worker/) |

### Git Hooks

| Hook | Runs | Config |
|------|------|--------|
| pre-commit | Unit tests only | `.husky/pre-commit` |
| pre-push | Unit + Lint | `.husky/pre-push` |

## Visual Design Principles

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

## Retrospective

- D1 uses SQLite syntax — use `strftime('%Y', date)` instead of `EXTRACT(YEAR FROM date)`.
- Wrangler D1 queries require `--remote` flag for production database.
- MCP server moved from Worker to Next.js API routes (`src/app/api/mcp/`). Worker now only provides SQL API.
- **Local npm links don't work in Docker builds**: `"@nocoo/base-mcp": "link:../base-mcp"` causes `FileNotFound` during Railway/Docker builds because the linked package doesn't exist in the build container. Solution: inline needed functions directly into the project (e.g., `src/lib/mcp/pkce.ts`) or publish to npm registry.
