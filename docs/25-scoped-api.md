# Scoped API and AI/MCP Retirement

Status: **Approved for implementation on 2026-10-20. In progress.**

Date: 2026-10-20. The owner approved implementation with TDD and Herdr panes,
followed by local Chrome acceptance. Public API paths and identifiers must not
contain `agent`. Existing MCP/OAuth credentials and model keys are disposable:
remove them and unused dependencies directly, with no compatibility or cutover
project. Production migrations, Access policy changes, push and publication are
not authorized. The former OAuth-preservation invariant is superseded for this
implementation.

## 1. Product Direction

Noheir stores, validates, queries and presents financial information. External
agents choose their own models, read authorized data, perform analysis outside
Noheir and write authorized results back through a documented REST API.

- Remove internal model configuration, AI-branded heuristic insights, MCP and
  its OAuth infrastructure. Do not replace them with another model integration.
- Allow scoped CRUD of financial business resources, with explicit authorization
  for destructive operations and existing financial invariants enforced.
- Keep API-key administration, site identity/appearance and authentication
  configuration human-only through the Access-protected UI.
- Reuse the existing Hono Worker, D1 database, original owner IDs, domain logic
  and Basalt UI. Do not introduce another backend, gateway, agent runtime or SDK.
- Recommend storing externally authored analysis as ordinary private reports.
  Report storage/rendering is not an inference feature; this boundary needs owner
  approval in section 12.

Non-goals: raw SQL access, arbitrary server execution, model billing, chat,
prompts, scheduled agent jobs, embeddings, token delegation, webhooks, a generic
workflow engine, or a public multi-tenant developer platform.

## 2. Investigation Baseline

Source inspection only for this proposal; no new runtime/security test results
are claimed. All three worktrees were clean at inspection time.

| Repository | Inspected revision |
| --- | --- |
| Noheir | `d95279a55b7285c719e61edf13cdb9a292813240` |
| xray | `433095a02e732c54711571d2cf2c652cff230051` |
| his.fm | `4c81209bc28b52337075b80f011835cefe2647e1` |

### Current Noheir

| Finding | Source evidence | Consequence |
| --- | --- | --- |
| AI settings save `enabled/baseURL/modelName/apiKey`; the insight loader runs recurring-payment heuristics, not model inference | `src/app/actions/settings-actions.ts:87`, `src/app/ai-insight/page.tsx:43` | Remove this surface rather than building or repairing an internal AI engine |
| Most business CRUD already exists behind Access; machine routes are MCP/OAuth | `worker/src/index.ts:149`, `worker/src/index.ts:161`, `worker/src/index.ts:200` | Reuse business behavior, not the existing authentication boundary |
| Transaction search returns only `total_returned`, clamps at 5,000 and orders without a unique tie-breaker; tags use manually assembled LIKE SQL | `worker/db/repositories/transactions.ts:30`, `worker/db/repositories/transactions.ts:61`, `worker/db/repositories/transactions.ts:172` | Do not advertise complete or stable reads without a new query contract; parameterize exact tag filtering |
| Some summaries sum across currencies when no currency is supplied | `worker/db/repositories/reports.ts:26`, `worker/db/repositories/reports.ts:176` | Financial aggregation must separate currencies, including UI callers of shared services |
| Ordinary bulk insertion loops over separate writes | `worker/db/repositories/transactions.ts:209` | Do not promise atomic bulk writes by merely exposing this method |
| Capital commit already uses expected-state checks and an atomic D1 batch | `worker/lib/unit-commit.ts`, `worker/src/index.ts:1001` | Preserve this business operation instead of bypassing it with generic unit CRUD |
| Export includes raw settings; restore replaces transactions/transfers only | `worker/src/index.ts:1477`, `worker/src/index.ts:1499` | Existing export is not safe for keys and is not a complete restore contract |
| Account classifications, balance anchors and financial assumptions share a JSON field with site/AI preferences | `src/app/actions/settings-actions.ts`, `src/domain/types.ts:263` | Define the financial/admin boundary before exposing these resources |
| MCP includes useful transaction aggregation, portfolio joins and availability enrichment | `src/lib/mcp/tools/query.ts`, `src/lib/mcp/tools/portfolio.ts`, `src/lib/mcp/tools/unit.ts` | Move useful domain behavior out before deleting protocol code |

### Reference Projects: Adopt Patterns, Not Entire Subsystems

| Reference | Adopt | Do not copy |
| --- | --- | --- |
| his.fm `packages/contracts/src/access.ts`, `apps/web/worker/agent-api.ts:178`, `apps/web/worker/management.ts` | Finite scopes, independent read/write permissions, separate human/machine authentication calling shared controllers | Its `tokens:*` and `appearance:*` machine scopes, delegated-token tree or editorial workflow |
| his.fm `apps/web/worker/agent-tokens.ts`, `docs/scoped-api.md` | One-time plaintext display, hash-only storage, expiry/revocation, actor provenance and minimal write-only responses | Owner presets that silently include every administrative capability |
| his.fm `apps/web/worker/agent-contract.ts`, `docs/api-onboarding.md` | OpenAPI 3.1, discovery, capabilities, explicit retry/concurrency instructions | Unpaginated production lists; financial collections need bounded complete traversal |
| xray `packages/worker/src/index.ts`, `packages/worker/src/middleware/access-auth.ts` | Strong machine/human route separation and human-only key administration | A second hostname merely because Xray has one; Noheir can use an isolated prefix on its existing Worker |
| xray `packages/worker/src/lib/query-cursor.ts`, `packages/worker/src/repos/query.ts` | Stable keyset pagination, scope/query-bound cursor validation and honest consistency semantics | Claiming keyset pagination alone is a database snapshot |
| xray `packages/worker/src/repos/channels.ts:281` | Stable external identifiers, duplicate/conflict handling and server-stamped key provenance for external reports | Channel-only immutable ingestion as a substitute for Noheir's requested report CRUD |

Xray's general push-token defaults are not a production-wide arbitrary-scope
editor. His.fm does permit delegated key administration. Neither should be
described as already implementing Noheir's exact proposed policy.

## 3. Architecture and Trust Boundaries

```text
Human browser -- Access JWT + same-origin mutations -- human routes --+
                                                                    |
External agent -- scoped Bearer key -- /api/v1/* ---------------+--> shared services --> D1
                                                                    |
                                                      schema / ownership / financial rules
```

Recommended machine prefix: `/api/v1`. Keep the existing human API paths
for browser use; this is separation of principals, not a legacy API adapter.

1. Register a dedicated machine router that authenticates every non-discovery
   operation and never falls through to browser auth or the SPA.
2. A Bearer key is the only identity accepted by that router, even if an Access
   JWT/cookie is also present. Invalid Bearer credentials never fall back to a
   human identity. Human routes reject agent credentials and remain protected by
   verified Access identity and same-origin mutation checks.
3. Derive `ownerId`, `actorKind` and `keyId` exclusively on the server. Ownership
   fields, actor/source fields and internal-action headers cannot grant access.
4. Scope checks and owner checks precede queries, joins and mutations. Referenced
   products, units and categories must belong to the same owner. Off-owner IDs
   are indistinguishable from absent IDs.
5. Extract shared use cases from `worker/src/index.ts` and MCP handlers by resource
   as needed. Human and machine routers call the same use cases; do not make
   internal HTTP requests or maintain a second financial implementation.
6. Human-only key routes live outside the machine prefix. There is no machine
   endpoint, scope, bulk operation or export projection that manages keys or site
   settings. `/me` can disclose the current key's own non-secret capabilities.

Keep production Access verification, original `users.id` ownership, disabled
workers.dev/preview URLs and the existing local-identity restrictions. Demo
identity must not implicitly authorize machine requests: use explicitly issued
demo-only keys, never production credentials.

## 4. Key Lifecycle and Authorization

### Key Contract

- Generate an opaque, recognizable `nhk_` token with at least 256 bits of CSPRNG
  entropy using Web Crypto. Never encode an owner or permissions as trusted
  client-side claims.
- Store only its SHA-256 digest plus ID, owner, label, display prefix, explicit
  scopes, creation/expiry/revocation timestamps and last-used time. Hashing is
  appropriate here because the secret is high-entropy, not a user password.
- Show plaintext once in the human UI, with `no-store` and no analytics/logging
  of the value. Never put tokens in query strings, URLs or stored browser state.
- Propose 90-day default expiry, maximum 365 days; expiry is mandatory. A key's
  grants and expiry are immutable after creation. Rotation means issuing a new
  key and explicitly revoking the old one, not automatic privilege expansion.
- Authenticate against current database state on every request. No positive
  authentication cache that delays revocation. An in-flight committed request
  cannot be undone by subsequent revocation; all later requests must fail.
- Retain revoked-key metadata for provenance, not usable secrets. Key
  administration itself is audited; no key can issue, list, rotate or revoke
  keys, including itself. No refresh token, OAuth flow or delegation hierarchy.
- Accept a single well-formed `Authorization: Bearer ...` header over HTTPS.
  Reject empty/unknown/duplicate grants during issuance and malformed stored
  grants during authentication. Unknown scopes never confer future privileges.

### Finite Scope Catalog

This is the proposed complete scope family list, not wildcard syntax. For each
`read / write / delete` cell, define three literal enum values such as
`transactions:read`, `transactions:write`, `transactions:delete`.

| Resource family / path | Explicit actions | Notes |
| --- | --- | --- |
| `transactions` / `/transactions` | read / write / delete | Income/expense rows, bounded search and atomic batch creation |
| `transfers` / `/transfers` | read / write / delete | Preserve current transfer-row semantics; not a new double-entry ledger |
| `products` / `/products` | read / write / delete | Reference-aware deletion; no hidden cascade or ownership reassignment |
| `units` / `/units` | read / write / delete; separate `units:commit` | CRUD cannot bypass investment/redemption, product switch or availability rules |
| `contribution-logs` / `/contribution-logs` | read / write / delete | Versioned correction, soft deletion and restoration; distinct from immutable API audit |
| `expense-categories` / `/expense-categories` | read / write / delete | Existing recurring-expense category records, not a new transaction taxonomy |
| `recurring-expenses` / `/recurring-expenses` | read / write / delete | State transitions under write; bounded calendar occurrences under read |
| `account-classifications` / `/account-classifications` | read / write / delete | Financial data, subject to section 12 approval |
| `balance-anchors` / `/balance-anchors` | read / write / delete | Financial data, subject to section 12 approval |
| `financial-preferences` / `/financial-preferences` | read / write / delete | Typed financial assumptions/classifications only; delete resets documented defaults; section 12 approval required |
| `analyses` / `/analyses` | read / write / delete | Externally authored reports; section 12 approval required |
| `audit` / `/audit-events` | read only | Allowlisted operation metadata; never credentials, settings values or copied financial payloads |
| Destructive ledger replacement | separate `data:replace` | Also requires read/write/delete on every affected transaction/transfer resource |

Permission rules:

- Read does not imply write/delete; write does not imply read/delete. Mutation
  responses contain only IDs, versions and affected counts, not hidden records.
- `units:commit` authorizes the documented operation's automatic contribution
  logs; it does not authorize arbitrary log CRUD. Its preflight requires
  `units:read` and the read scopes of any linked product/log data it returns.
- No global `reports:read`, `query:all`, `data:all`, `admin`, `*`, `keys:*` or
  `settings:*` shortcut. Composite queries require every source read scope named
  in their contract. They fail with missing scopes rather than silently returning
  an incomplete financial result.
- Cross-resource writes and destructive side effects require the affected
  resource grants or an explicit domain-operation grant. For example, ordinary
  product deletion must not silently delete contribution history.
- Names for accounts, transaction category paths and tags currently derive from
  records. Metadata endpoints expose distinct values from explicitly selected,
  authorized sources. Renaming these attributes uses authorized record updates;
  do not invent standalone account/tag CRUD tables for this refactor.
- Scopes cover resource families within one owner. No per-account/year/amount
  ACL or rule language in v1. UI presets expand into displayed, finite grants at
  issuance and never gain newly introduced scopes automatically.
- Suggested presets: Analyst (financial reads), Report Writer (selected financial
  reads plus analyses read/write), Bookkeeper (selected reads/writes), and Custom.
  None includes delete, `data:replace` or key/site administration by default.

## 5. HTTP and Discovery Contract

Use JSON, full resource IDs and one public wire format: camelCase fields, money
as integer `*Cents`, tags as arrays, ISO currency codes, explicit nullability.
Do not use MCP-style shortened IDs, omitted false/empty values or rounded money.
Document rate units separately from money, and preserve existing signed amount
semantics. Validate safe integers and aggregate overflow.
Derive calendar year/month/day from the validated date on the server; callers
cannot submit contradictory date components or modify ownership/audit columns.

- `GET /resource`, `GET /resource/{id}`, `POST /resource`, `PATCH /resource/{id}`,
  `DELETE /resource/{id}`. Singletons have the corresponding documented methods.
  Use named POST operations only for real domain actions, such as
  `/units/{id}/commit`, `/recurring-expenses/{id}/state` and log restoration.
- GET filters are typed and allowlisted: date range, currency, account, category
  path, tags, amount range, status and text where relevant. Use a bounded POST
  query endpoint only for filters that cannot reasonably fit a URL; it still
  requires read permission, not write permission.
- Return `{ data, meta }`; list metadata includes `returned`, `nextCursor`,
  `hasMore`, `dataRevision`, `asOf` and normalized filters. Exact `total` is opt-in
  with documented cost. A returned count is never labeled a total.
- Use `application/problem+json` with stable `type`, `title`, `status`, `code`,
  `requestId` and safe field errors. No SQL, stack traces, raw requests or secrets.
  Statuses: 400 invalid input, 401 invalid credentials, 403 insufficient scope,
  404 absent/off-owner resource, 405 unsupported method with `Allow`, 409 business
  conflict or changed dataset, 412 stale `If-Match`, 413 body limit, 428 missing
  required precondition, 429 throttling with `Retry-After`.
- Authenticate/scope-check first, then validate resource-specific input. Reject
  unknown mutation fields, invalid dates, invalid enums, excessive nesting,
  pagination/filter bounds and unsupported media types explicitly.
- Include a request ID on every result, `WWW-Authenticate: Bearer` on 401,
  and `Cache-Control: no-store` on private responses. Do not enable permissive
  browser CORS for machine APIs. CORS is not authorization.

Public discovery contains no user data, live balances or token metadata:

| Endpoint | Purpose |
| --- | --- |
| `/.well-known/api-catalog` | Link the versioned API, OpenAPI and agent guide |
| `/api/v1/openapi.json` | OpenAPI 3.1, HTTP Bearer scheme, schemas, operation IDs, `x-required-scopes`, limits and examples |
| `/api/v1/instructions` | Read/aggregate/write workflows, financial semantics, retries and scope guidance |
| `/api/v1/me` | Authenticated current key ID/label/scopes/expiry and opaque owner ID; no owner email or key list |
| `/api/v1/capabilities` | Authenticated available operations, schema version, limits and financial conventions |

Reuse installed Zod 4, including its JSON Schema conversion, for wire schemas.
Bind explicit operation metadata to route registration/scope enforcement and
OpenAPI generation. Do not independently hand-maintain a second set of DTOs and
permissions. Financial refinements still require runtime validation/tests; JSON
Schema cannot express every cross-record constraint. No new contract framework
or generated client SDK is needed for the first release.

## 6. Queries That Support Reliable Financial Analysis

### Bounded, Complete Reads

Default page size 100, maximum 500, with stable keyset order including a unique
ID; for example `(date DESC, createdAt DESC, id DESC)`. Apply all owner, scope,
filter and soft-deletion predicates before pagination. Use limit-plus-one to
detect continuation, not a silent fixed cap.

Cursors bind the resource, owner/key, normalized filters, ordering, revision and
continuation tuple. Validate them strictly; they are never an authorization
token. A cursor from another key/query is rejected. Signing is optional only if
all fields are validated and independently re-authorized; do not add another
secret/service solely to make pagination work.

Recommend a monotonic per-owner financial `dataRevision`, incremented in the
same atomic batch as every financial mutation through both browser and machine
paths. A page/query either reads a consistent revision or returns
`409 dataset_changed`. A later page with an old revision also fails rather than
claiming a snapshot. Clients restart traversal; this intentionally favors
correctness over keeping a long read alive during concurrent editing.

Verify D1 read/batch/session behavior before selecting the concrete SQL sequence.
Sequential HTTP reads or `Promise.all` alone do not establish snapshot
consistency. No historical row-version store or change-feed service is proposed.
Analysis collections have their own pagination/version checks; saving a report
does not change the underlying financial revision.

### Query Surface

| Query | Purpose / required source scopes |
| --- | --- |
| `/transactions/aggregate` | Count/sum and bounded grouping by month/category/account/tag/currency; transactions read |
| `/transfers/aggregate` | Inflow/outflow by account/time/currency; transfers read |
| `/summaries/cash-flow` | Income/expense plus separately labeled transfers; transactions and transfers read |
| `/summaries/portfolio` and `/products/{id}/portfolio` | Holdings, latest investment, realized P&L and availability; products, units and contribution-logs read |
| `/accounts/balances` | Anchor-based balance reconstruction with assumptions/unknown states; transactions, transfers, account-classifications and balance-anchors read |
| `/recurring-expenses/occurrences` | Existing deterministic recurrence/calendar expansion; recurring-expenses read, plus expense-categories read if category details are requested |
| `/metadata` | Available years/currencies/account names/tags/category paths from explicitly selected authorized source families |

Aggregates operate on the complete filtered dataset in SQL, not on one result
page. Group dimensions and result cardinality are bounded. High-cardinality
groups paginate or require narrower filters; never omit groups silently. Tags
are multi-valued: tag group totals overlap and must not be presented as additive.

Separate totals by currency unless a single currency is explicitly selected. No
implicit FX, no mixed-currency grand total and no transfer double-counting as
income/expense. Use Asia/Shanghai calendar dates, preserve the existing UTC
convention for recurring-state end timestamps, and expose all interval semantics.
Availability uses an explicit override or investment history, never `startDate`.
Missing history/anchors remain unknown, not zero or automatically available.

Normalize known stored currency aliases once before cutover and use one shared
currency convention thereafter. Unknown values or ambiguous account/currency
anchors block that data conversion for owner review; do not guess CNY. This is
a necessary data correction, not a permanent legacy-format fallback. Preserve
the current application's cents convention rather than inventing an FX ledger.

## 7. Safe Writes, Retries and Audit

### Concurrency

Expose an integer `version` and resource ETag. Require `If-Match` for updates,
deletes and stateful domain operations; missing is 428, stale is 412. Row version
checks happen in the mutation SQL, not only in a preceding SELECT. Human writes
must update the same versions/revision so agents cannot overwrite UI changes.

Retain the capital commit's full expected snapshot initially as its domain
precondition; the API's version check is an additional shared concurrency
boundary. If the internals are later consolidated, preserve its proven atomic
behavior and tests, not two alternative public commit paths.

### Idempotency and Atomicity

- Require `Idempotency-Key` on machine mutations. Deduplicate by owner, key and
  idempotency value, with a fingerprint of method, path, validated input and
  preconditions. Same fingerprint replays the original minimal result; changed
  input is `409 idempotency_conflict`.
- Recheck current authentication and scopes before replay. Check for a completed
  replay before evaluating an old mutation precondition against current state.
  Otherwise a successful-but-timed-out update would incorrectly become stale.
- Store the mutation, revision increment, audit event and idempotency result in
  one atomic D1 batch with database uniqueness/conditional-write guards. Never
  reserve a key and then perform an unguarded second write. Concurrent duplicate
  requests must produce exactly one financial effect.
- Propose a documented seven-day replay window. After expiry, do not promise
  deduplication or instruct clients to blindly retry uncertain writes. A stable
  `externalId` gives analysis creation longer-lived deduplication where needed.
- Reject oversized batches before writing; validate every row and same-owner
  reference before an atomic bounded batch. Reuse import chunking under D1 bind
  limits; fix ordinary bulk methods that currently perform partial writes.
- Existing business side effects remain explicit: investment logs, product
  switches, soft-deleted log restoration, recurring state transitions and
  reference-aware deletions. Client-authored `source` cannot impersonate a human.

### Destructive Replacement and Exports

Do not expose unbounded delete-by-filter. A separate replacement workflow covers
transaction-year replacement, transfer-year replacement and existing ledger-only
restore. Propose `POST /ledger-replacements/preview` and
`POST /ledger-replacements` with exact resource/year selection, validated rows,
affected counts, payload digest and expected financial revision. Preview writes
nothing; commit repeats validation and atomically checks the preview precondition.
Preview is not an authorization token or a substitute for `data:replace` plus all
affected resource read/write/delete grants. Empty replacement is explicitly
identified as deletion, not silently inferred from missing fields.

Agent export is complete traversal of explicitly selected authorized resource
collections, under one checked financial revision. It never returns the current
raw settings export. Include financial preferences only if their proposed
business-data classification is approved and scoped. Keys, credentials, site
settings and private infrastructure metadata are always excluded. This is not a
private D1 disaster-recovery backup; ledger restore still does not restore all
products, units or application configuration.

### Audit and Limits

Record server-derived actor/key identity, request ID, operation, resource IDs,
timestamp, version transition and affected counts atomically with successful
mutations. Preserve original creator separately from later editors. Finance
records and their editable contribution history are not the immutable security
audit. Audit read is an allowlisted metadata projection, not a side channel for
financial payloads, site preferences or token material.

Record key issuance/revocation via the human path. Do not log Bearer headers,
full bodies or report contents. Show useful key last-use metadata and mutation
history in the human UI. Apply per-key/owner request and body/query/batch limits,
with a lower budget for expensive aggregation/replacement; use native available
Worker controls rather than an in-memory isolate-global limiter. Concrete rate
budgets must be measured on local fixtures and recorded before release.

## 8. External Analysis Writeback

Recommended neutral resource: `/analyses`, with a private Reports UI replacing
the old AI insight page, subject to owner approval.

Minimal fields: full ID, title, Markdown body, period start/end, currencies,
optional stable `externalId`, structured evidence metadata, version and server
timestamps. No model key, prompt runner, inference state or background task.

- Evidence records the producer's query filters, source resource families,
  observed data revision and retrieval time. Optionally include referenced
  financial resource IDs; validating/resolving those references requires the
  corresponding read scopes and same-owner checks.
- Server-stamp authenticated creator/key and later editor identities. An optional
  model/author label supplied by an agent is unverified descriptive metadata,
  never trusted provenance. The server cannot attest that prose is accurate or
  that a claimed query was actually used.
- Display the source revision and whether current financial data has changed
  since that revision. Store the submission revision separately; receiving a
  report does not prove that it analyzed the latest data.
- A create with the same owner/external ID and identical initial content can
  return the existing minimal receipt; different content conflicts and must use
  an explicit versioned update. Retain the creation fingerprint separately from
  later edits. Preserve external ID uniqueness after deletion so a delayed retry
  cannot resurrect a deleted report.
- Scoped agents may edit/delete authorized reports, not just their own. Do not
  inherit Xray's creator-only immutable ingestion rule; retain actor attribution
  when a report changes. Read remains independent of write/delete.
- Render Markdown with raw HTML disabled and safe URL handling. Disable remote
  image loading by default to prevent external tracking/data leakage. Use an
  existing maintained renderer if available; otherwise select one small mature
  library rather than implementing a Markdown parser or sanitizer.
- Reports are untrusted content, not instructions to the product or agents.
  The API guide must distinguish report/note text from operational guidance.

Agent workflow: discover -> inspect granted capabilities -> fetch aggregates
and supporting records at a known revision -> analyze externally -> save a report
with evidence -> return its private UI link. Noheir never calls the model.

## 9. Data and Code Change Map

| Area | Planned change |
| --- | --- |
| `worker/src/index.ts`, `worker/src/access.ts`, `worker/lib/request-policy.ts` | Separate router/auth boundaries; factor shared business use cases without replacing the Worker |
| `worker/db/schema.ts`, canonical `worker/db/migrations/` | Keys, idempotency receipts, operation audit, financial revision and resource versions; reports/financial metadata if approved |
| `worker/db/repositories/`, `worker/lib/unit-commit.ts`, import helpers | Stable queries, currency-safe aggregates, shared owner checks, atomic mutations and version guards |
| `src/lib/mcp/tools/` | Extract useful query/portfolio/availability behavior into shared services, then delete protocol handlers and compaction conventions |
| `src/app/actions/settings-actions.ts`, financial settings pages | If approved, move finance-only fields to typed versioned resources; no arbitrary settings-JSON route for keys |
| `src/app/ai-settings/`, `src/app/ai-insight/`, AI-only domain/detector/types/tests | Remove; retain legitimate recurring-expense calendar and non-AI financial calculations |
| `src/app/mcp-tokens/`, `src/services/mcp-*`, `worker/src/mcp.ts`, `src/lib/mcp/` | Remove MCP/OAuth clients, authorization sessions, token management, discovery and protocol routes |
| Root dependencies/locks, `worker/src/env.ts`, Wrangler configuration | Remove MCP-only packages/configuration after reference checks; retain Hono, jose, Zod and D1 |
| Routes/navigation, new API-key and Reports pages | Basalt controls, MVVM, one-time key view, finite scope selection, expiry/revocation, report provenance |
| Demo catalog, local environment scripts, fixtures, HTTP/browser tests, deployment verification | Replace AI/MCP fixtures/contracts with scoped API behavior while preserving isolated Demo/E2E/Prod modes |
| `AGENTS.md`, README, runbook, feature/MCP docs | Update only with implemented behavior; clearly mark retired historical docs, no misleading connection instructions |

Account classifications and anchors should become small owner-scoped versioned
resources; remaining approved financial assumptions can use one typed per-owner
preferences row. No general-purpose EAV metadata system is needed. Convert the
current balance-anchor values to cents with validation; require explicit
resolution of accounts that span currencies, missing currency evidence or
duplicate/ambiguous anchors. Stop on ambiguous data rather than silently dropping
it. Historical transaction category/account/tag strings remain valid attributes.

Retirement removes `ai_config` from live settings, AI model credentials from
application exports/fixtures, and OAuth tables through new canonical migrations.
Do not print existing secrets or manipulate provider credentials/Keychain. Old
private backups may still contain old settings; report that limitation rather
than claiming deletion from every historical copy. No production cleanup occurs
without a separately approved cutover.

Do not convert MCP OAuth tokens into API keys or copy their broad scopes. Humans
issue new explicitly scoped keys. Preserve financial records carrying historical
`source: "mcp"`; that value is provenance, not a retained protocol path. New
machine writes use a server-assigned API source plus key audit identity.

## 10. Layered Implementation and Cutover

Each slice must leave a locally runnable product and land as a tested atomic
commit. Local increments are not authorization to publish an incomplete API.
There is no compatibility period for old machine credentials; production
operations are outside this task.

1. **Contract and first useful vertical slice.** Resolve section 12, define wire
   schemas/scopes, implement human key lifecycle plus machine auth/discovery and
   paginated transaction/transfer reads with safe aggregation. Establish key
   audit and financial revision tracking across all existing human write paths
   before promising consistent reads. Verify using synthetic local keys and
   data. Remove unused internal AI configuration and heuristic UI after the
   replacement navigation is ready.
2. **Complete financial read coverage.** Add portfolio, logs, recurrence,
   metadata and approved financial-config reads. Move shared queries out of MCP;
   enforce currency, revision and completeness semantics for UI/API callers.
3. **Safe financial control.** Complete shared resource versions, atomic mutation
   audit and idempotency, then all scoped CRUD/domain actions, bounded bulk and
   destructive replacement preview/commit. Cover human-vs-agent races before
   exposing writes.
4. **External reports and human operations.** Add report CRUD/UI if approved,
   key presets/rotation guidance, audit visibility and executable onboarding
   examples. Verify an external script can read, analyze outside the server and
   write a report without any model integration in Noheir.
5. **Retire and release the complete replacement.** Remove MCP/OAuth routes,
   packages, tables and fixtures; remove stored AI config and update the project
   contract/docs. Complete regression/security/edge acceptance before any release.

### Production Operations Are Out of Scope

Delete the obsolete MCP/OAuth handlers, credentials and configuration directly.
Do not build conversion, compatibility, dual-operation or rollback machinery for
old machine credentials. Preserve the existing financial database and historical
financial provenance. All migrations and acceptance in this task use isolated
local fixtures or the owned Demo environment. Any later production deployment and
external Access policy changes need separate authorization.

## 11. Acceptance and Verification

Keep the existing 6DQ gates and isolation rules; do not lower thresholds or
exclude new logic. Use canonical local migrations and reserved L2/L3 fixtures,
never daily-development or remote financial data.

- **Contract/auth matrix:** enumerate every machine path/method and expected
  scopes; test absent/malformed/expired/revoked keys, unknown stored grants,
  unsupported methods, no fallthrough, invalid Bearer with valid Access identity,
  and no browser cookie authorization on machine routes.
- **Ownership/least privilege:** second-owner rows and linked IDs, read-only and
  write-only keys, all missing-scope combinations for composites, safe minimal
  write receipts, immutable actor fields, no keys/settings through export, batch,
  metadata, errors, references, reports or audit projections.
- **Query correctness:** page sizes/tie dates, no silent truncation, filter-bound
  cursors, all records exactly once at an unchanged revision, mutation during
  pagination, complete aggregates, mixed currencies, tag escaping/overlap, safe
  integer totals, financial intervals and unknown availability/balance states.
- **Mutation correctness:** human/agent stale-write races, concurrent duplicate
  creates/commits, response-loss retries, expired replay window, no extra audit
  on replay, revocation before replay, versioned deletes/restores, mid-batch
  failure rollback, replacement preview invalidation and D1 chunk/body limits.
- **UI/workflow:** one-time key view, explicit scopes and expiry, revocation,
  financial CRUD unchanged, report read/edit/delete/provenance, unsafe Markdown
  and remote content, all retired navigation/routes absent, no model calls.
- **Retirement/migration:** finance preservation, same owner IDs, legacy MCP
  provenance retained, AI config removed without logging, unknown currency/anchor
  values fail closed, no MCP imports/dependencies/OAuth endpoints or protocol
  bypass assumptions in active tests/deployment scripts.
- **Documentation parity:** generated OpenAPI and operation scope registry agree;
  examples run against local synthetic fixtures; limits/status codes/retry
  behavior match implementation. Validate actual route coverage, not only unit
  coverage percentages.

Required implementation gates:

```sh
bun run typecheck
bun run lint
bun run build
bun run test:coverage
bun run --cwd worker test:coverage
bun run test:e2e
bun run test:e2e:bdd
bun run deploy:check
```

Authorized edge acceptance follows local gates. Actual results belong in
implementation/release evidence, not this draft.

## 12. Approved Product Boundaries

1. **What does writing analysis mean?** Approved: store private externally
   authored Markdown reports in Noheir with CRUD, evidence and provenance, but no
   inference/chat. Alternative: remove analysis UI/storage entirely and have
   agents return their analysis only in their own client. The current request
   suggests writeback, but the presentation/storage scope is not yet confirmed.
2. **Which current settings are financial data?** Approved: account types,
   balance anchors, savings/return assumptions and active-income/fixed-expense
   classifications become scoped business resources. Site name/theme/auth and
   key administration remain human-only. Alternative: leave all current settings
   human-only; agents must then explicitly report unavailable balance/assumption
   inputs rather than claim full financial-data coverage. No mixed settings JSON
   is exposed in either option.

The owner approved both recommended boundaries. The public namespace is
`/api/v1` and UI terminology is API Keys / Reports, without an agent product
interface. Old credentials require neither preservation nor a transition plan.

## 13. Implementation Progress

| Workstream | Owner | Status / evidence |
| --- | --- | --- |
| REST backend, schema, auth, scopes, safe financial operations | Backend pane | Pending TDD implementation |
| Human key/report UI and finance configuration | UI pane | Pending TDD implementation |
| AI/MCP retirement, dependency cleanup, integration and docs | Coordinator | In progress |
| Independent correctness review | Review pane | Pending |
| Full local gates and Chrome acceptance | Coordinator | Pending |

TDD evidence and final commands/results will replace pending entries as work lands.
