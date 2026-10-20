# Development and deployment

Production runs one native Cloudflare Worker (`noheir-web`) serving Vite assets,
Hono APIs and scoped REST. The migration checklist and cutover status are in
[23-workers-migration.md](23-workers-migration.md). The existing D1 database is
retained; no financial ownership keys are rewritten.

## Local development

Use Bun 1.4.2 and Node 26.8.1 (the CI versions). Install both test packages:

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run dev
```

Open `https://noheir.dev.hexly.ai` in Chrome. Caddy proxies to the local launcher
on 127.0.0.1:7004. Demo and manual E2E execute the production Worker, migrations,
D1 API and signed identity verification against isolated native local resources.
The local control switches Demo/E2E/Prod; automated E2E has a separate server lock.
See [24-local-environments](24-local-environments.md) for storage ownership, exact
commands, explicit reset, screenshots, feature coverage and current limitations.
The original `.wrangler/state` is preserved and unused. No production data is
seeded into Demo and no Google client or production credentials are needed.

Production requires a verified Access email matching exactly one existing user.
An unknown email is denied; granting Access alone does not provision a financial
account. Existing Google-era user IDs remain the canonical ownership keys.
All SPA pages, including `/terms` and `/privacy`, and their assets require the
same Access session. This matches the existing protected root application; do
not add anonymous exceptions for HTML that depends on protected assets.

## Configuration

`wrangler.jsonc` owns bindings and runtime variables. Production uses:

| Setting | Value |
| --- | --- |
| Worker | `noheir-web` |
| Domain | `noheir.hexly.ai` |
| D1 binding | `DB` / `noheir-db` |
| D1 ID | `586c101d-df19-4e1f-a946-42151c1e199d` |
| Access team | `nocoo` |
| Access audience | `19d100ea22080f644154aad7b35785c1381874d27dec7fd238a2cb8fd7d640ee` |
| REST base URL | `https://noheir.hexly.ai/api/v1` |
| Preview endpoints | `workers.dev` and preview URLs disabled |
| Asset access | `run_worker_first: true` |

`local` and `test` environments have separate local-only database IDs and no
routes. The deployment script refuses either environment, a dirty tree, local
identity in production, or an unexpected database/audience/domain.

## Verification

```sh
bun run typecheck
bun run lint
bun run build
bun run test:coverage
bun run --cwd worker test:coverage
bun run test:e2e
bunx playwright install chromium
bun run test:e2e:bdd
bun run deploy:check
```

The unit coverage floor remains 95% for statements, branches, functions and
lines in the configured scope. This is not a claim that every UI or route is
included. HTTP tests launch Miniflare on 17004 with a per-run temporary SQLite
database, seed marker, controlled JWKS and signed test identities. Browser tests
use a separate fixture on 27004 and the production Vite build. They never reuse
a daily development server or a remote database.

## Scoped REST and Access

This source tree replaces internal AI/MCP/OAuth with `/api/v1`. The refactor is
local-only until separately authorized for deployment; do not infer current
production policy or schema from this document.

Humans use the Access-protected `/api-keys` page to issue a finite set of read,
write, delete and domain-operation grants with a 1-365 day expiry. Plaintext is
shown only once. Revoke compromised or unused keys in that page; issue a new key
instead of editing or extending an existing grant. Keys cannot administer other
keys, site settings or Access. Noheir stores reports, not model credentials, and
makes no model calls.

An external tool uses `Authorization: Bearer <key>` and discovers schemas and
operations at `/api/v1/openapi.json` and `/api/v1/instructions`. See
[scoped API contract](25-scoped-api.md) for money, revision, pagination, retry,
report evidence and replacement semantics. Human Access sessions do not authorize
machine routes. Invalid Bearer headers never fall back to browser identity.

Local Demo/E2E calls also require the current `x-noheir-instance` header shown in
the key page. An originless CLI request is allowed only under `/api/v1`; a present
foreign Origin is rejected. The header selects an existing isolated runtime and
never replaces Bearer authentication. Local keys do not authorize production.

### Separately authorized production policy work

Preserve the existing protected root Access application, audience, user identity
mapping and other projects' shared policies. When publishing this refactor, only
`/api/v1`, `/.well-known/api-catalog` and public read-only `/api/live` may bypass
Access to reach their own Worker boundaries. Keep `/api/api-keys`, `/api/settings`, human business APIs and
all pages/assets protected. Remove obsolete OAuth/MCP policy destinations; no
compatibility or credential conversion is supported. Do not create a bypass on
`/api` or the entire hostname.

The canonical migrations retire credentials and validate/convert legacy financial
preferences and anchors into typed business tables. Ambiguous currency or invalid
financial data stops migration rather than dropping data. Use a private D1 export
and inspect the separately approved deployment procedure before remote migration;
no production migration or policy change is part of the local implementation.

After authorized publication, `bun run verify:production` verifies the exact
revision, D1 health, protected human paths, public OpenAPI and tokenless REST401.
Complete a human login and a newly issued minimal-scope key request separately.
This task does not execute that command against production.

## CI/CD and release

CI runs frozen installs, build, both type lanes, lint, unit coverage, real-HTTP
and browser checks, plus the reusable security/workflow checks. Release uses
`nocoo/base-ci`'s pinned `deploy-worker.yml`. It proves that the source is the
successful main-push CI commit and still the main branch tip before deployment.
No Docker image, VPS SSH or separate API deployment is involved.

Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub environment
`noheir / production`. The deploy token needs the scoped Workers/D1/domain
permissions required by the configured account and zone. Do not commit tokens.

```sh
bun run release -- patch
```

The release script updates the root version and changelog, commits and pushes,
waits for CI and deployment of that commit, verifies the live `build_sha`, then
publishes only that version's tag and GitHub release. A failed gate stops before
tag publication. If deployment fails after the version commit, fix the external
condition and rerun the failed workflow for the same SHA. Verify its successful
CI/deployment and live checks before completing the annotated tag and GitHub
release; do not bump the version again merely to resume a failed gate.
`bun run verify:production` checks version/revision, database
connectivity, no-store, protected browser/API paths and scoped REST discovery/auth.

## Data safety and historical infrastructure

The previous native Worker migration and its exact deployment evidence remain in
[23-workers-migration](23-workers-migration.md). Do not reuse its assertion that
schema is unchanged for the scoped API refactor, which has new canonical SQL
migrations. Keep the original D1 database and financial owner IDs.

JSON export is a financial convenience export, not a disaster-recovery backup.
It includes transactions/transfers/products/units but no raw settings, keys or
credentials. Restore replaces transactions/transfers only. Use a private D1 export
for full database recovery; historical private backups may still contain retired
credentials. Do not claim to erase them from every backup.

Retiring old VPS containers, DNS, shared Caddy/mTLS or another Worker's routes is
outside this local task. Preserve shared infrastructure and other applications.
