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

## Retrospective

- D1 uses SQLite syntax — use `strftime('%Y', date)` instead of `EXTRACT(YEAR FROM date)`.
- Wrangler D1 queries require `--remote` flag for production database.
- MCP server now uses Worker-based auth (WORKER_URL, WORKER_TOKEN, USER_ID) instead of direct Supabase connection.
