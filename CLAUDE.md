README.md

## Deployment

- **Production URL**: https://noheir.hexly.ai
- **Platform**: Railway (Railpack builder, Caddy SPA serving)
- **Auto-deploy**: Push to `main` branch triggers build & deploy
- **Region**: Asia Southeast 1 (Singapore)
- **Architecture**: Pure client-side SPA — no SSR, no API routes. All backend via Cloudflare Worker + D1.
- **Compile-time env vars** (set in Railway): `VITE_WORKER_URL`

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
| MCP | `mcp/tests/` | `bun run test:mcp` |

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
- MCP server now uses Worker-based auth (WORKER_URL, WORKER_TOKEN, USER_ID) instead of direct Supabase connection.
- MCP tools use snake_case (product_id, unit_code) but Worker API uses camelCase (productId, unitCode). Must convert in MCP handlers.
