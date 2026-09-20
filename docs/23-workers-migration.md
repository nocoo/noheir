# Native Workers migration (v3)

Status: v3.0.0 is released and serving production on `noheir-web`.
CI, deployment, live Access/browser checks and data preservation checks pass.
Legacy infrastructure remains available until owner retirement.

## Baseline and decision

The migration starts from `189c51b` after a fast-forward pull on 2026-09-20.
The baseline has 33 pages, 36 exported Server Actions and 64 Worker route
registrations. Existing tests pass: 1,111 application tests and 355 Worker tests;
both type lanes pass. These counts do not imply complete route or browser coverage.

Use Vite, React Router and one Hono Worker, `noheir-web`, with Workers Static
Assets. Retain the existing `noheir-db` D1 binding and schema. This replaces
Next.js, Auth.js, Docker, the public raw-SQL gateway, and shared-secret/user-header
trust. No Next compatibility layer or second application runtime remains.
The old handbook's prohibition on Worker MCP addressed the previous split runtime;
it is superseded by this single-runtime architecture.

## Identity and authentication

- Verify Access JWT signature (RS256/JWKS), issuer, audience and expiry.
- Team: `nocoo`; audience: `19d100ea22080f644154aad7b35785c1381874d27dec7fd238a2cb8fd7d640ee`.
- Resolve verified normalized email to exactly one existing `users` row. Preserve
  its Google-era `id` and every financial/MCP ownership key. Unknown or ambiguous
  email fails closed. Never use Access `sub` to replace an existing primary key.
- Browser clients send no user-id, shared secret or internal-action authority.
  Mutations enforce same origin and server-side validation.
- Run the Worker before assets. Protect HTML/assets as well as application APIs;
  keep the minimal read-only `/api/live` public with no-store and generic errors.
- Local identity requires an explicit local/test environment, loopback request and
  local-only D1 config. Production has no bypass identity or test reset route.

Preserve MCP OAuth/PKCE, client registrations, token hashes, issuer and existing
user IDs. Native Web Standard MCP transport already exists. Replace SQL-over-HTTP
with a per-request D1 adapter; no process-global database or request state.
Authorization requires Access. Machine endpoints retain their own OAuth/MCP
validation. The owner retained OAuth and configured Access exceptions. Read-only
inspection on 2026-09-20 confirmed that the existing protected application keeps
its audience and the authorize/callback destinations. The existing `shared-bypass`
application includes OAuth discovery and `/api/mcp`; no service token is required.
Live probes confirm protected redirects, public discovery and tokenless MCP 401.

Machine metadata, MCP protocol, register, token and revoke
paths bypass Access. Access path matching inherits to descendants even without a
wildcard. First add more-specific authorize/callback destinations to the existing
protected app, retaining its audience, then add machine-path bypasses. Verify the
more-specific protected application wins for both human paths; see the runbook.
The Worker independently verifies the Access JWT on authorize/callback.

## Frontend and API contract

Preserve every financial URL, Basalt UI, theme, domain calculation and query
parameter. Replace async Server Components with React Router route loaders and
existing client views. Use route errors for failed financial reads instead of
presenting an empty balance. Mutations revalidate affected route data.

Existing business REST paths and response shapes remain, but identity always
comes from Worker authentication. Additional endpoints:

| Method / path | Request | Response |
| --- | --- | --- |
| `GET /api/auth/me` | Access session | `{user:{id,email,name,image}}` |
| `POST /api/transactions/import` | `{year,rows}` | `{imported:number}` |
| `POST /api/transfers/import` | `{year,rows}` | `{imported:number}` |
| `POST /api/recurring-expenses/:id/state` | `{transition:"pause"|"resume"|"end"}` | `{success:true}` |

Annual replacement validates all rows and their year before any deletion, then
performs deletion and inserts in one D1 batch. Transaction import retains the
existing whole-year income/expense scope; transfer import is separate. Invalid,
oversized or failed imports must leave existing data intact. State changes verify
ownership and allowed source state in SQL; ended is terminal. Preserve the existing
UTC state timestamp convention while calendar computations use Asia/Shanghai.

JSON backup still exports more entities than it restores. Restore replaces only
transactions/transfers. Preserve this limitation and test it explicitly. Currency
amounts remain integer cents; availability and invest-log semantics do not change.

## Work ownership

All agents first verify `/Users/nocoo/workspace/personal/noheir` with `pwd` and
`git rev-parse --show-toplevel`. Only the coordinator installs, stages, commits,
pushes, changes deployment configuration or touches production.

| Owner | Files |
| --- | --- |
| Pi | Frontend `src/app` pages/actions/client views, components/hooks, router/main, browser API client; relevant frontend tests. Excludes all API/metadata routes and backend MCP/service/db files. |
| Grok | Worker libraries, validation, Access middleware, backend unit tests, direct D1 adapter and MCP services. |
| Coordinator | Worker HTTP/MCP entrypoints; root/Worker config and locks; local test harness and HTTP tests; CI/hooks, docs, release/deployment and integration review. |

Pi provider failures, including `Provider finish_reason: error`, are retried after
checking actual agent state. Lifecycle waits have a separate time-based monitor.

## Delivery and acceptance

1. [x] Pull, inventory, baseline tests and architecture audit.
2. [x] Commit this plan, canonical project handbook and implementation contract.
3. [x] Native Worker auth/MCP/business boundary and Vite routes/client integration.
4. [x] Build/type/lint/unit checks; retain all existing coverage floors.
5. [x] Isolated local real-HTTP tests with per-run SQLite and a verified test
   marker, signed JWT failures, ownership isolation, OAuth/PKCE/replay/refresh,
   state transitions, import rollback and backup scope.
6. [x] Browser acceptance: all routes render, year filtering, financial overview,
   unit commit, recurring rules, import preview/commit, backup and error states.
7. [x] Implement native deployment workflow with successful-CI source verification,
   immutable build revision and live checks. The production workflow passed.
8. [x] Read-only production identity/count fingerprint, D1 backup, Access path
   policy inspection, deploy and domain cutover; repeat live/data checks.
9. [x] Publish v3.0.0 only after successful CI and deployment; update all active
   documentation, push atomic commits and record exact release evidence.

Keep commits buildable and grouped by logical boundary. No hook bypasses, lowered
coverage thresholds, production fixture writes or unverified release claims.

## Local acceptance evidence (2026-09-20)

- Root unit/component suite passes. Coverage: statements 98.21%, branches 96.20%,
  functions 100%, lines 99.22% in the existing configured scope.
- Worker unit suite passes. Coverage: statements 99.03%, branches 97.79%,
  functions 100%, lines 99.78%. No thresholds were lowered or exclusions added.
- Real HTTP: 183 tests across 18 files pass against native Workerd and local D1.
  This includes 10,000-row annual import and restore, injected SQL failure after
  an earlier JSON chunk with full rollback, date/cents validation, ownership,
  state races, OAuth/PKCE/single-use code/refresh, wrong-owner callback denial,
  wrong-client refresh rejection without consumption, paired-token revocation
  and an actual MCP financial query isolated to its original owner.
- Browser: 40 tests pass against the built client and an independent local
  Worker. All 33 routes render; year navigation, product/recurring expense
  creation, CSV preview/commit, backup download, failed reads and capital-unit
  commit with persisted audit log are covered.
- Both TypeScript lanes, zero-warning Biome, frozen installs for both locks,
  OSV for both locks, actionlint and YAML style checks pass. Gitleaks runs again
  on push. Normal pre-commit hooks passed for the runtime migration commit.
- Production build and Wrangler dry-run pass; the Worker bundle is approximately
  292 KiB gzipped. Routes are lazy-loaded. The documented local migrate/seed/dev
  flow was exercised on an independent temporary D1; `/api/auth/me` and health
  succeeded. The temporary development database was removed afterward.
- The private D1 export was restored into in-memory SQLite: 14 tables, 2 users,
  8,158 transactions. Identity and table-count fingerprints are stored privately
  for cutover comparison. No remote fixture writes or schema changes occurred.
- GitHub production deployment credentials were provisioned. The existing DNS,
  Access applications/policies and old Worker configuration were backed up
  privately before deployment. The later production cutover is recorded below.
- The upstream `a3f2568` change disables old Worker default/preview URLs; the
  replacement `wrangler.jsonc` retains both protections.

Independent review follow-up before cutover:

| Finding | Resolution |
| --- | --- |
| P1: settings writes accepted ownership/row fields from JSON | `812daea`: validate writable fields and project repository writes; exercise both insert/update with forged identity |
| P1: units could link and expose another owner's product | `71dacea`: reject foreign/missing product links, scope REST/MCP/portfolio joins and name lookups by owner; test stale cross-owner relations |
| P2: browser-only recurrence constraints could be bypassed | `9b2bb63`: validate complete schedules in the Worker, merge patches before validation, reject impossible dates and preserve omitted currency/interval |
| P2: anonymously served legal HTML depended on protected assets | `6ad48b3`: require Access for legal pages and assets consistently, matching the existing protected root application; retain authenticated legal routes |
| P2: validated full-rule updates could overwrite concurrent edits | Compare every persisted snapshot field in the atomic update, return 409 on a stale snapshot, and test interleaved writes without relying on timestamp precision |

The follow-up build and 183 HTTP tests passed; the browser acceptance suite has
40 passing scenarios. Every fix passed
normal pre-commit type, lint and unit-coverage checks. The owner's exact Access
configuration sequence is in [the runbook](04-run.md#verified-access-configuration).
Independent review signed off `3e365fa` with no remaining findings. The later
live Access/DNS/deployment checks are recorded below.

## Production acceptance (2026-09-20)

- Release: [v3.0.0](https://github.com/nocoo/noheir/releases/tag/v3.0.0), tagged at
  `1e3a1a497138f51af58ca216a1a1df12c2c63388`. [PR #577](https://github.com/nocoo/noheir/pull/577)
  is merged. The release commit passed [CI 35508195820](https://github.com/nocoo/noheir/actions/runs/35508195820).
- [Deployment 35508249724](https://github.com/nocoo/noheir/actions/runs/35508249724),
  attempt 2, passed. The first attempt uploaded the Worker but Cloudflare rejected
  the existing externally managed CNAME with code 100117. After saving the exact
  record, the coordinator removed that CNAME and immediately attached the already
  uploaded Worker. No code or version change was needed for the successful retry.
- `noheir.hexly.ai` is a custom domain on `noheir-web`; Cloudflare manages its
  proxied `AAAA 100::` record. workers.dev and preview URLs are disabled.
- `bun run verify:production` passed against the released SHA: v3.0.0, connected
  D1, no-store health, protected SPA/API/authorize/callback paths, public OAuth
  discovery and tokenless MCP 401. The existing Access audience is unchanged.
- A real browser with an existing Access session loaded the Vite assets and
  displayed v3.0.0. `/api/auth/me` returned the original pre-cutover user ID/email;
  report metadata, product summary and unit summary returned 200. No production
  financial writes were used for acceptance. Fresh interactive login and a new
  external MCP OAuth grant were not repeated; the existing session and public
  boundaries were checked, with OAuth lifecycle coverage in isolated HTTP tests.
- Private D1 exports immediately before and after cutover restore successfully
  into in-memory SQLite. Sorted-row hashes match for all 14 tables, including
  identities, financial data, OAuth registrations and token hashes: 2 users and
  8,158 transactions. No remote schema migration or ownership rewrite occurred.
- Old `noheir`, its hostname, and the VPS runtime remain for rollback and owner
  cleanup. GitHub production deployment credentials are configured. No additional
  Access application, service token or Google client is required.

## Rollout and rollback

The cutover deployed `noheir-web` against the existing D1 and switched
`noheir.hexly.ai` from the VPS origin to the Worker custom domain. Keep the existing Worker, VPS container,
Caddy entry and credentials until owner cleanup. Do not delete D1 or its data.
No schema/ownership conversion occurred. Rollback first removes the Worker
custom-domain association, then restores the saved proxied CNAME to
`jp2.nocoo.cloud` and the retained v2.6.4 runtime. Preserve D1 throughout. Once stable,
remind the owner to delete the old Noheir container/image, Caddy route, old Worker
route and obsolete Google/shared-secret/deploy credentials without touching other
services on the shared VPS.
