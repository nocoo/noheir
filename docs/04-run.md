# Development and deployment

The v3 target is one native Cloudflare Worker (`noheir-web`) serving Vite assets,
Hono APIs and MCP. The migration checklist and cutover status are in
[23-workers-migration.md](23-workers-migration.md). The existing D1 database is
retained; no financial ownership keys are rewritten.

## Local development

Use Bun 1.4.2 and Node 26.8.1 (the CI versions). Install both test packages:

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run db:migrate
bun run db:seed
bun run dev
```

The Vite development server listens on `http://127.0.0.1:7004`. The Cloudflare
Vite plugin runs the actual Worker with local D1 under `.wrangler/state`.
`CLOUDFLARE_ENV=local` is set by the development command. Local identity is the
seeded `developer@example.test` row; it is allowed only on a loopback hostname
with an explicit local environment. Do not substitute a production binding.
No Google OAuth, shared Worker secret or production credentials are needed.

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
| OAuth issuer | `https://noheir.hexly.ai` |
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

## MCP and Access

MCP clients use `https://noheir.hexly.ai/api/mcp`, OAuth/PKCE S256 and JSON
Streamable HTTP. Existing client registrations and token hashes remain valid.
Browser authorization resolves the Access principal to the original D1 owner.

When retaining OAuth, allow these machine paths through Access:

- `/.well-known/oauth-authorization-server`
- `/api/mcp`
- `/api/mcp/register`
- `/api/mcp/token`
- `/api/mcp/revoke`

Access path matching inherits to descendants even without a wildcard. Therefore
an application for `/api/mcp` also matches authorize and callback. Add explicit,
more-specific `/api/mcp/authorize` and `/api/mcp/callback` destinations to the
existing protected application, preserving its audience and allow policy, before
adding the machine-path bypass application. A more-specific application takes
precedence without inheriting its parent's policy. Verify both human paths still
redirect to Access and verify the audience remains unchanged. Do not leave an
unqualified bypass over the MCP subtree. See [Cloudflare path precedence](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/). The MCP endpoint requires its own bearer token;
metadata and registration remain OAuth protocol endpoints. `/api/live` must be
reachable for read-only health verification. See the migration checklist for
the pending external policy decision and actual deployment evidence.

### Owner configuration before the v3 cutover

The following checklist keeps the implemented OAuth flow. In the Cloudflare
dashboard, open **Zero Trust > Access controls > Applications**. Apply these
changes in order; keep production on v2 until review and configuration checks pass.

1. Edit the existing `noheir-auth` application
   (`0305f64b-b1b4-451a-ae13-0ce17771fd34`). Keep its Allow policy, identity provider
   and root hostname. Add two public hostnames with the paths shown below to the
   **same application**, then save. Do not recreate it: its audience must remain
   `19d100ea22080f644154aad7b35785c1381874d27dec7fd238a2cb8fd7d640ee`.

   | Public hostname | Path | Policy |
   | --- | --- | --- |
   | `noheir.hexly.ai` | Empty (existing) | Existing authorized-user Allow |
   | `noheir.hexly.ai` | `/api/mcp/authorize` | Same Allow |
   | `noheir.hexly.ai` | `/api/mcp/callback` | Same Allow |

2. Create a **Self-hosted and private** application named `noheir-mcp-machine`.
   Add the two public destinations below. Add a policy with action **Bypass**,
   rule **Include**, selector **Everyone**. Do not add this policy to
   `noheir-auth`; doing so would also bypass the financial UI and APIs.

   | Public hostname | Path | Purpose |
   | --- | --- | --- |
   | `noheir.hexly.ai` | `/.well-known/oauth-authorization-server` | OAuth discovery |
   | `noheir.hexly.ai` | `/api/mcp` | MCP plus register/token/revoke descendants |

   The protected authorize/callback destinations from step 1 take precedence
   over this parent path. The new bypass application's audience is not used by
   Noheir. No Access service token or replacement Google OAuth client is needed.

3. Leave the existing `shared-bypass` health rule for
   `noheir.hexly.ai/api/live` unchanged. Preserve all other projects' destinations.
   Keep the Allow email aligned with the original Noheir account: a different
   Access identity cannot create or take over that account.

4. Check from a browser without an Access session: the root, `/api/auth/me`,
   `/api/reports/metadata`, `/api/mcp/authorize` and `/api/mcp/callback` must
   redirect to `nocoo.cloudflareaccess.com`; OAuth discovery must return JSON
   with status 200; an unauthenticated `POST /api/mcp` must return 401. After
   cutover, `bun run verify:production` repeats these checks and also verifies
   the deployed version, commit and D1 connectivity. Complete one browser login
   and an MCP OAuth/PKCE authorization using the existing account.

Read-only inspection on 2026-09-20 confirmed the original protected application
and health bypass above. The two protected child destinations and MCP bypass
were still absent. GitHub environment `noheir / production` already contains
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; no credential setup is pending.
DNS/custom-domain cutover remains part of deployment, after these checks. Retain
the existing origin until acceptance; the retirement list below is for afterward.

References: [public applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/),
[Bypass policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/#bypass),
[path precedence](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/).

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
bun run release -- major
```

The release script updates the root version and changelog, commits and pushes,
waits for CI and deployment of that commit, verifies the live `build_sha`, then
publishes only that version's tag and GitHub release. A failed gate stops before
tag publication. `bun run verify:production` checks version/revision, database
connectivity, no-store, protected browser/API paths and MCP discovery/auth.

## Cutover and retirement

Before cutover, record DNS/routes and take a private D1 export. Compare read-only
user/row fingerprints before and after deployment. The custom domain replaces
the VPS origin. Preserve the old runtime until live checks and owner acceptance.

Legacy resources for owner cleanup after migration:

- VPS `jp2.nocoo.cloud`: `/opt/noheir`, `noheir-app` container/image and its Caddy
  site entry. Preserve shared Caddy/mTLS, the shared `edge` network and all other apps.
- Old Worker `noheir` and `noheir.worker.hexly.ai` route.
- Old Google OAuth client, Auth.js/shared Worker secrets, VPS/GHCR deployment secrets.
- Local obsolete `.env.local` and `worker/.dev.vars` credentials after confirming
  no remaining consumers.

Never delete `noheir-db`. Rollback restores the saved DNS/origin and previous
runtime; data/schema are unchanged by this migration. No remote schema migration
is applied automatically during deployment.
