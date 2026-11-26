# Noheir

Personal finance app on one native Cloudflare Worker (`Hono` + `D1` + Vite/React Router + `/api/v1` REST).
Docs: [README.md](README.md) · [Docs](docs/README.md) · [Runbook](docs/04-run.md) · [API](docs/api.md) · [Local Envs](docs/24-local-environments.md) · [Retrospective](Retrospective.md)

## Commands

Run from root (Bun 1.4.2 / Node 26.12.1 in CI). Root and `worker/` install separately (`worker` tests need `better-sqlite3`). Config: `wrangler.jsonc`, `vite.config.ts`, `.env.example`.

```sh
bun install --frozen-lockfile && bun install --cwd worker --frozen-lockfile
bun run prepare  # install Husky hooks
bun run dev  # https://noheir.dev.hexly.ai -> :7004 (Demo/E2E/Prod; --mode e2e)
bun run demo:reset  # stop :7004 first; resets owned Demo only
bun run typecheck && bun run lint  # S1 (root+worker TS 7) & S2 (Biome, 0 warnings)
bun run build  # B1 (build before HTTP/browser tests)
bun run test:coverage && bun run --cwd worker test:coverage  # L1 (>=80% all 4 metrics)
bun run test:e2e  # L3 Worker HTTP (:17004) + env tests
bunx playwright install chromium && bun run test:e2e:bdd  # L4 browser (:27004)
bun run deploy:check  # build + wrangler deploy --dry-run
```

See [Local Envs](docs/24-local-environments.md) for `dev:built`, `test:environments:browser`, and `demo:capture`.

## Invariants

- One Hono Worker serves Vite assets, human APIs, and `/api/v1` REST over D1; no internal LLM/credentials, MCP/OAuth, Next.js, or SQL gateway (external inference only).
- Verify Access signature, issuer, audience, expiry; map normalized email to one `users.id` (never Access `sub`). Unknown/ambiguous users fail closed.
- Run Worker before assets; disable `workers.dev`/previews. Demo/E2E use signed fixture JWTs + local JWKS; never bypass auth by env, loopback, or headers.
- Browser mutations require same-origin; derive ownership server-side, ignoring `user-id`/internal-action headers and JSON owner fields.
- Human key/site admin rejects Bearer; `/api/v1` never falls back to Access. Keys are hash-only, expiring, revocable, with independent read/write/delete grants.
- Omit `agent` from public APIs. Update [docs/api.md](docs/api.md) on `/api/v1` route, schema, limit, scope, or problem `code` changes (`worker/tests/api-docs.test.ts`; `/api/v1/openapi.json`).
- Shared financial mutations require `If-Match` (plus `Idempotency-Key` on `/api/v1`), atomic writes, actor audit, and financial revisions.
- Reports keep separate revisions, immutable creator/external ID, post-delete receipts, inert Markdown (no HTML/remote images), same-owner read-granted evidence, unverified labels.
- CSV import replaces a user's whole year of income/expense (transfers separate). Validate all rows, chunk under D1 param limits, commit in one atomic batch; never pre-delete.
- JSON export exceeds restore (transactions/transfers across all years only); not a DR backup—use private D1 export.
- Money is integer cents; parameterize SQLite. Calendar math uses Asia/Shanghai helpers (writes + fixtures); recurring end timestamps keep UTC.
- Writes use ISO `CNY`/`USD`/`HKD`; never mix currencies or implicit FX (legacy UI uses `CNY`). Missing invest history and balance anchors stay unknown, not zero.
- Availability derives from latest invest log or explicit override (never `start_date`); established units with a product create an invest log, planned units do not.
- Preserve MVVM, `@nocoo/basalt`, colored-badge wrappers, and availability colors ([UI & Ops](docs/22-agent-operations.md)).
- Keep Workers globals out of browser `tsc` (DOM conflicts; use `src/worker-types.d.ts`). Root `package.json` version feeds UI and Worker.
- `/api/live` runs read-only `SELECT 1`, returns version/`build_sha`/DB status with `no-store` (200/503), hides diagnostics, no uptime contract.
- Keep `noheir-db` and shared Caddy/mTLS/`edge` infra. Releases need approval (`bun run release -- patch|minor|major`; clean tree, never tag failed gates; [runbook](docs/04-run.md)).

## Quality & Local Gates

Follows `system1-quality`; CI slots live in `.github/workflows/quality-slots.yml` (`quality / Z1: Gate` required on `main`). Status terms: `enforced`, `planned`, `manual`, `N/A`.

- **Exceptions / gaps**: `L2 Runtime` is `N/A` (Worker app covered by L3/L4); `P1 Package` verifies Worker bundling via `wrangler deploy --dry-run` reusing `B1` (`b1-dist`); `L4` (`test:e2e:bdd`) reuses `B1` (`b1-dist`); `deploy:check` dry-run and doc alignment are `manual`.
- **Coverage & flakes**: App and Worker require >=80% on all 4 metrics in scope (Views excluded); never lower below floor, skip/focus, or mask flakes (`--repeat-each=30` or delete).
- **Pre-commit**: `.husky/pre-commit` (`bun run prepare`) checks staged snapshots (`S1/S2/L1`, blocks `.env*`/`worker/.dev.vars`). Local probes: `bun run test:l1-gate` ([L1 gate](docs/26-l1-gate-evidence.md)).
- **Pre-push**: `.husky/pre-push` runs `L1/S2/G2/L3` + redacted `G1` (`origin/main..HEAD`, not stdin refs); `B1` and `L4` run in CI.

## Resources & Isolation

| Lane       | Endpoint / State                              | Boundary                                                          |
| ---------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Dev        | `:7004` (`noheir.dev.hexly.ai`), Demo/temp D1 | Signed fixtures; `Demo`/`E2E`/`Prod`; `.wrangler/state` untouched |
| L3 HTTP    | `:17004`, per-run temp SQLite                 | Real Worker HTTP, local JWKS, refuses occupied ports              |
| L4 Browser | `:27004`, independent temp SQLite             | Built assets, sequential harnesses, never reuses server           |
| Prod       | `noheir.hexly.ai` (`noheir-web`, `noheir-db`) | `prod:login` / `dev --mode prod` explicit; no test traffic        |

Local requests are instance-bound (stale -> `410`); `_test_marker` + private dir marker guard writes/cleanup ([Local Envs](docs/24-local-environments.md)).

## Retrospective

Record incidents in [Retrospective.md](Retrospective.md); promote recurring rules to `Invariants` and deterministic safeguards to tests/hooks.
