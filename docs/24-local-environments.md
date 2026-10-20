# Demo, E2E and Production

Shared contract: [system0-envs](../../workflow/tasks/system0-envs/SKILL.md).
The local launcher selects resources, never a second business implementation.

## Commands

```sh
bun run dev                       # preference, then Demo
bun run dev --mode demo            # explicit initial target
bun run dev --mode e2e             # interactive, NOT locked
bun run build
bun run dev:built                  # local built client, same switch
bun run demo:reset                 # stop port 7004 first; resets owned Demo only
bun run test:environments          # native lifecycle, auth and isolation checks
bun run test:environments:browser  # disposable interactive harness + 33 routes
bun run test:e2e                   # existing signed-identity HTTP suite
bun run test:e2e:bdd               # dedicated locked browser E2E
bun run demo:capture               # rich catalog in disposable, hidden-control E2E
bun run prod:login                 # explicit real Cloudflare Access login
bun run dev --mode prod            # explicit real backend; NOT a test command
```

Run build before standalone browser/HTTP tests after changing UI or migrations.
The environment browser and capture commands build automatically. They launch
Chrome through Playwright; regular BDD uses the installed Playwright Chromium.
All browser harnesses reserve 27004 and must run sequentially. HTTP tests use
17004. Occupied ports fail; no harness reuses the daily development server.

Open **https://noheir.dev.hexly.ai**. The existing Caddy proxy sends traffic to
127.0.0.1:7004. No certificate or Caddy mutation is required. Caddy's upstream
Host rewrite remains accepted, but no longer grants identity. The launcher checks
Host and browser Origin; Worker mutations independently check the configured
browser origin. API failure never selects a different environment.

## Resource ownership and identity

| Target | Storage | Identity | Lifetime |
| --- | --- | --- | --- |
| Demo | `.wrangler/environments/demo` | Signed synthetic Access email | Persistent edits, explicit reset |
| Manual E2E | Private `noheir-test-*` system temp directory | Fresh signing key and seeded users | Deleted on switch out or launcher shutdown |
| Automated E2E | Independent private directory per runner | Signed test tokens, including invalid cases | Runner owns cleanup; no Prod credentials |
| Prod | Deployed `https://noheir.hexly.ai` APIs | Real Cloudflare Access token kept server-side | Real data and side effects |

`.wrangler/state` is preserved and unused by the new launcher. It is not silently
imported into Demo. The initial implementation's pre-persistence Demo marker was
preserved in `.wrangler/environments/demo-initial-fixture-preserved`; it is not a
financial backup and is not used by the runtime.

`test-fixture.ts` is the shared native Miniflare/D1 foundation. It applies canonical
migrations and records applied names. It verifies both the private directory
marker and the D1 `_test_marker` before fixture writes and removal. Resume requires
the matching capability and owned temporary path. The Miniflare 5
`resourcePersistencePath` option is essential: `isolatedResourcePersistencePath`
alone is ignored when shared storage is disabled. No shared-storage option is enabled.

Compatibility date, compatibility flags, Worker-first assets and SPA fallback are
read from `wrangler.jsonc`. Native Assets replaces the former hand-written asset
fallback. The local Vite server (or Vite preview for built interactive launches)
serves frontend assets; business APIs execute the real bundled Worker through D1.
The native HTTP/browser fixture also runs asset requests through Worker auth.
Cloudflare edge Access, distributed rate limiting and edge networking are not
simulated or certified by local checks. No application rate-limit binding is
configured in the current production manifest.

All modes execute JWT signature, issuer, audience, expiry and existing-user mapping.
The local launcher issues a fixture token, and the Worker's normal verifier reads
its public key at the controlled JWKS boundary. Other Worker outbound requests
fail closed. The former `LOCAL_USER_EMAIL`/loopback authentication bypass, local
SQL seed entrypoint and deployable local/test environments were removed after the
replacement HTTP and browser paths passed. Unit test doubles remain unit tests;
there is no mock business server or production financial dump.

## Switching and request pinning

The Basalt toggle in application chrome has the accessible name `环境`, with only
`Demo | E2E | Prod` visible. A trusted launcher endpoint provides capability.
Hosted deployments do not implement it, and ignore browser environment preferences.
Cloud CI hides the control. Automated browser E2E shows disabled segments locally
and rejects changes on the server; its launch intent is separate from its mode.

Selection order is automated lock, explicit launcher mode, valid
`noheir:environment-mode` localStorage value, Demo. An existing tab resumes its
server-issued instance through app-specific sessionStorage. Accepted switches
save the enum, retire the old instance and reload `/`, clearing route/module
caches. When browser storage is disabled, a one-time URL fragment hands off an
opaque server-issued instance ID; it is removed after bootstrap. A fragment cannot
enable local tooling in a hosted deployment or choose an arbitrary backend.

The page keeps its original instance ID in memory and sends it with business
requests. The server binds each ID permanently to a fixture or a real Prod session.
A switch never mutates that binding. Retiring manual E2E drains its original
requests before disposing storage; subsequent stale requests return 410. Preference
changes in another tab do not change the active tab. Manual E2E restored after a
launcher restart gets a new database, not an expired automated instance.

Input changes and open dialogs conservatively trigger a discard confirmation.
Cancelling does not contact the switch endpoint and preserves the instance and
preference. The detector can also prompt for an already-saved input; it favors
preserving drafts over silently discarding an untracked form. Startup and target
failures are visible, with a manual selection/reload path.

Prod activation uses `cloudflared access token --app https://noheir.hexly.ai`, then
verifies `/api/auth/me`. The server supplies the Access `CF_Authorization` cookie
and the Worker JWT assertion; browser credentials cannot replace them. Missing or
expired credentials show an actionable `bun run prod:login` message without
changing the active environment. Tokens and cookies are never returned to the local UI.
The proxy has one fixed deployed target, validates the local origin, and translates
Origin for the deployed same-origin check. Frontend SHA and deployed `/api/live`
revision are logged on activation. Real login, MFA and live Prod proxy behavior
remain **unverified**: the September 28 follow-up found no cached application
token, and browser login timed out waiting for the Access transfer service. No
production data was modified. Automated
entrypoints reject Prod before credentials or network access. The interactive
browser test harness also explicitly disables the Prod boundary.

## Catalog and provenance

`demo-catalog.ts`, version 3, is authored synthetic data with stable UUIDs, integer
cents and Asia/Shanghai dates. It includes 264 transactions, 66 balanced transfer
legs across 2024–2026, 12 owner products, one inaccessible second-owner product,
12 capital units, investment and reversible deleted logs, four colored planning
categories, six recurrence rules, typed financial preferences/classifications/anchors
and an externally authored synthetic report. API keys are issued through the real
human UI/API during acceptance, never seeded as legacy OAuth sessions.
`public/demo/avatar.svg` is original geometric artwork created in this repository;
no external image license or private data is required. Existing Noheir brand art
retains its existing provenance. Internal AI/provider settings and MCP surfaces are
removed; private report storage does not invoke an AI provider.

Demo seeding runs once; catalog upgrades never overwrite edits. Stop the launcher
and explicitly reset to load a newer catalog. Focused E2E remains empty apart from
identities until its scenarios create data through real APIs. Capture uses the rich
catalog in temporary E2E storage and does not touch daily Demo.

Capture browser presentation time and native availability calculations are fixed
at `2026-09-28T12:00:00+08:00`. The native fixture build defines the presentation
clock used by the existing availability function; production builds define it as
null. Explicit dates supplied by ordinary unit tests still take precedence. JWT,
API key expiry and financial write timestamps retain real time; no global Date shim
is installed in the Worker. Interactive Demo calendars use the user's current
browser date; the capture command fixes browser presentation time separately.

## Feature-to-fixture and verification matrix

`L` = real route/API load checked; `A` = relevant operation asserted; `V` = screenshot
reviewed. A static screenshot does not prove all controls on that page were used.

| Routes / feature | Prepared catalog / scenario | Operations exercised | Visual evidence |
| --- | --- | --- | --- |
| `/`, `/income`, `/expense`, `/savings` | Three years, meaningful categories/tags, coherent totals and trends | L; A: year revalidation, search and CRUD in HTTP suite | V: overview and trend surfaces |
| `/flow`, `/compare`, `/financial-health`, `/freedom` | Income, spending, category mix, savings targets and annual comparison | L; A: report HTTP suite | V: flow, comparison, radar and projections |
| `/account`, `/account-detail`, `/account-types`, `/balance-anchors` | Four accounts, paired transfers, debit/credit/prepaid/financial types and opening anchors | L; A: settings and transfer HTTP checks | V: account chart, details and configuration |
| `/capital-dashboard`, `/capital-decisions`, `/funds`, `/warehouse`, `/liquidity`, `/strategy` | All unit statuses, CNY/USD/HKD, strategies/tactics, available/soon/locked/unknown, cyclic product and explicit override | L; A: unit commit/CAS, ownership and availability HTTP/unit scenarios | V: dashboard, badges, warehouse, liquidity and sunburst |
| `/products`, `/capital-logs` | Active/archived products, investment logs, deleted withdraw/adjust with P&L | L; A: browser product create and capital commit; HTTP log restore/delete | V: products table and timeline |
| `/plan/calendar`, `/plan/categories` | Daily/weekly/monthly/yearly, active/paused/ended, four color tokens | L; A: browser creation and HTTP recurrence transitions/category CRUD | V: populated calendar and colored categories |
| `/settings`, `/category-settings` | Savings/return targets, active income and fixed expense classifications | L; A: settings HTTP write/read | V: sliders and category surfaces |
| `/api-keys` | Real scoped key issuance, one-time secret, revoke | New browser/API acceptance; environment draft-discard uses key label | Verification evidence recorded in scoped API plan |
| `/analyses`, `/analyses/:id` | Synthetic external report, period/revision/provenance | New report CRUD, Markdown safety, evidence and API writeback scenarios | Verification evidence recorded in scoped API plan |
| `/manage`, `/import`, `/quality` | Importable financial records and one intentionally unmapped transaction | L; A: CSV preview/import, export download, annual rollback and restore scope | V: management, import and quality surfaces |
| `/login`, `/terms`, `/privacy`, user avatar | Real login composition and legal pages, original synthetic avatar | L; loaded-image assertion | V: all three pages; real Access login/MFA unverified |
| Switch / draft / lifecycle | Manual E2E plus disposable Demo fixtures | A: explicit/saved E2E, cancel, accepted switch, stale 410, fresh reentry, persistence and marker rejection | V: local control; CI captures omit it |
| Auth/error/ownership | Three signed users, unknown/expired/wrong issuer/audience and injected SQL failures | A: HTTP suite and environment tests; UI read failure never becomes zero balance | Error screenshot not separately reviewed |

Captures and `manifest.json` are written to ignored
`test-results/environments-<timestamp>/`. The manifest records revision, fixture
version, all routes, viewport, locale, timezone, anchor and media/API failures.
The 2026-09-28 review covered the 33-route contact sheet plus the detailed local
switch/overview and selected financial/planning pages. These are synthetic-only
local artifacts, not published screenshots.
