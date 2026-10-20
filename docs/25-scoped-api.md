# Scoped API and AI/MCP Retirement

Status: **Implemented and locally verified on 2026-10-20. Not published.**

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
- Store externally authored analysis as ordinary private reports.
  Report storage/rendering is not an inference feature; the owner approved this
  boundary in section 12.

Non-goals: raw SQL access, arbitrary server execution, model billing, chat,
prompts, scheduled agent jobs, embeddings, token delegation, webhooks, a generic
workflow engine, or a public multi-tenant developer platform.

## 2. Investigation Baseline

This section records the pre-implementation source inspection. Paths and line
numbers are historical, not current connection instructions. All three worktrees
were clean at inspection time. Fresh implementation results appear in section 13.

| Repository | Inspected revision |
| --- | --- |
| Noheir | `d95279a55b7285c719e61edf13cdb9a292813240` |
| xray | `433095a02e732c54711571d2cf2c652cff230051` |
| his.fm | `4c81209bc28b52337075b80f011835cefe2647e1` |

### Noheir Before This Refactor

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

Machine prefix: `/api/v1`. Keep the existing human API paths
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
- Default expiry is 90 days, minimum 1 day, maximum 365 days. A key's
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

This is the complete scope family list, not wildcard syntax. For each
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
| `account-classifications` / `/account-classifications` | read / write / delete | Versioned financial data |
| `balance-anchors` / `/balance-anchors` | read / write / delete | Versioned financial data, cents and explicit currency |
| `financial-preferences` / `/financial-preferences` | read / write / delete | Singleton; GET/PUT/PATCH/DELETE; delete resets defaults |
| `analyses` / `/analyses` | read / write / delete | Externally authored private reports |
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
- UI presets: Analyst (financial reads), Report Writer (selected financial
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
  required precondition, 415 unsupported media type, 429 throttling with `Retry-After`.
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

Default page size 100, maximum 500, with stable keyset order `id DESC`. IDs are
not chronological; do not infer recency from this order. Apply all owner, scope,
filter and soft-deletion predicates before pagination. Use limit-plus-one to
detect continuation, not a silent fixed cap.

Cursors bind the resource, owner/key, normalized filters, ordering, revision and
continuation tuple. Validate them strictly; they are never an authorization
token. A cursor from another key/query is rejected. Signing is optional only if
all fields are validated and independently re-authorized; do not add another
secret/service solely to make pagination work.

A monotonic per-owner financial `dataRevision` is incremented in the
same atomic batch as every financial mutation through both browser and machine
paths. A page/query either reads a consistent revision or returns
`409 dataset_changed`. A later page with an old revision also fails rather than
claiming a snapshot. Clients restart traversal; this intentionally favors
correctness over keeping a long read alive during concurrent editing.

Checked reads execute the revision and data statements together in a D1 batch.
Sequential HTTP reads or `Promise.all` alone do not establish snapshot
consistency. There is no historical row-version store or change-feed service.
Analysis collections have their own pagination/version checks; saving a report
does not change the underlying financial revision.
Audit uses a separate owner append-count `auditRevision`; financial, report and
key audit additions invalidate its cursors. Its cursor also binds key and limit.

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
- The replay window is seven days. After expiry, do not promise
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
restore. Use `POST /ledger-replacements/preview` and
`POST /ledger-replacements` with exact resource/year selection, validated rows,
affected counts, payload digest and expected financial revision. Preview writes
nothing; commit repeats validation and atomically checks the preview precondition.
Preview is not an authorization token or a substitute for `data:replace` plus all
affected resource read/write/delete grants. Empty replacement is explicitly
identified as deletion, not silently inferred from missing fields.

Agent export is complete traversal of explicitly selected authorized resource
collections, under one checked financial revision. It never returns raw
settings. Financial preferences are explicitly scoped business data. Keys, credentials, site
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
full bodies or report contents. The human UI shows key last-use metadata; detailed
mutation history is available through `audit:read`, not a separate audit dashboard.
Durable D1 counters enforce fixed 60-second windows: 120 requests per key and 600
per owner; expensive aggregation, portfolio, balances, occurrences, metadata and
replacement additionally allow 20 per key and 60 per owner. A rejection returns
429 with `Retry-After: 60`. These are tested limits, not throughput benchmarks.

## 8. External Analysis Writeback

Resource: `/analyses`, with a private Reports UI replacing the old AI insight page.

Minimal fields: full ID, title, Markdown body, period start/end, currencies,
optional stable `externalId`, structured evidence metadata, version and server
timestamps. No model key, prompt runner, inference state or background task.

- Evidence is an array of `{resource, ids, dataRevision}`. Query filters and
  retrieval time can be described in the Markdown; they are not additional
  structured fields. Explicitly submitted evidence requires corresponding read
  scopes, with each referenced ID checked for existence and same-owner access.
  Title-only updates do not resolve old references or reveal their current state.
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
  later edits. `externalId` is immutable after creation, including null-to-value
  changes. Preserve external ID uniqueness after deletion so a delayed retry
  cannot resurrect a deleted report.
- Scoped agents may edit/delete authorized reports, not just their own. Do not
  inherit Xray's creator-only immutable ingestion rule; retain actor attribution
  when a report changes. Read remains independent of write/delete.
- Render Markdown with raw HTML disabled and safe URL handling. Disable remote
  image loading by default to prevent external tracking/data leakage. Use an
  existing maintained renderer if available; otherwise select one small mature
  library rather than implementing a Markdown parser or sanitizer. The UI uses
  `react-markdown` 10.1.0 with HTML/images disabled and allowlisted URLs.
- Reports are untrusted content, not instructions to the product or agents.
  The API guide must distinguish report/note text from operational guidance.

Agent workflow: discover -> inspect granted capabilities -> fetch aggregates
and supporting records at a known revision -> analyze externally -> save a report
with evidence -> return its private UI link. Noheir never calls the model.

## 9. Data and Code Change Map

| Area | Implemented change |
| --- | --- |
| `worker/src/index.ts`, `worker/src/access.ts`, `worker/lib/request-policy.ts` | Separate router/auth boundaries; factor shared business use cases without replacing the Worker |
| `worker/db/schema.ts`, canonical `worker/db/migrations/` | Keys, idempotency receipts, operation audit, financial revision, versions, reports and typed financial metadata |
| `worker/db/repositories/`, `worker/lib/unit-commit.ts`, import helpers | Stable queries, currency-safe aggregates, shared owner checks, atomic mutations and version guards |
| `src/lib/mcp/tools/` | Extract useful query/portfolio/availability behavior into shared services, then delete protocol handlers and compaction conventions |
| `src/app/actions/settings-actions.ts`, financial settings pages | Finance-only fields use typed versioned resources; no arbitrary settings-JSON route for keys |
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

Remote edge acceptance requires separate authorization. Local results follow.

## 12. Approved Product Boundaries

1. **What does writing analysis mean?** Approved: store private externally
   authored Markdown reports in Noheir with CRUD, evidence and provenance, but no
   inference/chat.
2. **Which current settings are financial data?** Approved: account types,
   balance anchors, savings/return assumptions and active-income/fixed-expense
   classifications become scoped business resources. Site name/theme/auth and
   key administration remain human-only. No mixed settings JSON is exposed.

The owner approved both recommended boundaries. The public namespace is
`/api/v1` and UI terminology is API Keys / Reports, without an agent product
interface. Old credentials require neither preservation nor a transition plan.

## 13. Local Implementation Evidence

| Workstream | Owner | Status / evidence |
| --- | --- | --- |
| REST backend, schema, auth, scopes, safe financial operations | Backend pane | TDD complete; 501 Worker tests pass |
| Human key/report UI and finance configuration | UI pane | TDD complete; 918 root tests pass |
| AI/MCP retirement, dependency cleanup, integration and docs | Coordinator | Old runtime, credentials, dependencies and active connection instructions removed |
| Independent correctness review | Review pane | Reported findings fixed with regressions; final limited source recheck has no unresolved P1/P2 |
| Full local gates and Chrome acceptance | Coordinator | Passed against isolated native fixtures and the existing persistent Demo; no reset or production writes |

Results on 2026-10-20, before publication:

| Command / check | Result |
| --- | --- |
| `bun run typecheck` | Browser and Worker lanes pass |
| `bun run lint` | 414 files, zero warnings/errors |
| `bun run test:coverage` | 84 files / 918 tests; statements 98.44%, branches 96.44%, functions 100%, lines 99.51% |
| `bun run --cwd worker test:coverage` | 31 files / 501 tests; statements 99.00%, branches 97.71%, functions 100%, lines 99.77% |
| `bun run test:e2e` | 190 real-HTTP tests plus 6 environment lifecycle tests pass |
| `bun run test:e2e:bdd` | 41 browser scenarios pass, including scoped report writeback, safe rendering, versioned human edits and revocation |
| `bun run test:environments:browser` | Installed Chrome: 33 routes, no API/image failures; mode isolation and disabled-storage checks pass |
| `bun run deploy:check` | Vite bundles and Wrangler dry-run pass; nothing uploaded |
| Persistent Demo at `https://noheir.dev.hexly.ai` | Headed installed Chrome: issue one-time key, Bearer-only cash-flow query, external report write, human edit/delete, revoked-key 401; 1440px desktop and 390px mobile inspected |

Coverage describes the existing configured scopes, not the whole runtime. The
HTTP service/entrypoint is outside the Worker unit coverage denominator and is
additionally tested through SQLite router tests and native HTTP. No thresholds
were lowered or new exclusions added. These results are representative security
and business regressions, not an exhaustive endpoint/input proof or a throughput
benchmark. No production Access, migration, deployment, tag or release is claimed.

TDD caught and fixed swap-target CAS false success, replay races, CJK cursors,
permanent report creation deduplication, invalid dates, reference/scope oracles,
audit cursor invalidation, unsupported methods and stale UI draft versions.
The native audit test itself was corrected to traverse all pages: immutable
audit history exceeds 500 events, and a first page is not a complete collection.

### Concrete v1 Limits and Conventions

- Currencies: `CNY`, `USD`, `HKD`; signed safe integer cents; no implicit FX.
  Existing browser financial totals explicitly select CNY and label it. Other
  currency rows remain available for CRUD and currency-specific REST queries.
- Request body: 8 MiB (`replacementBodyBytes` in `/capabilities` and
  `/instructions`). Lists: default 100 / maximum 500 per page. Batch create: 100
  rows. Replacement: 20,000 rows per selected ledger (`replacementRows`), with
  digest/revision and explicit `allowEmpty`; over-limit rows return
  `replacement_too_many_rows`. Larger jobs must not be silently truncated.
- Aggregation: at most 500 groups; portfolio/preflight at most 500 units/logs;
  metadata at most 500 distinct values per facet. Exceeding these limits returns
  an explicit error, not a partial success. Narrow supported filters or traverse
  the underlying resource collections; metadata has no paging in v1.
- Occurrences: maximum 366 inclusive calendar days. Financial date logic uses
  Asia/Shanghai. New typed table timestamps are milliseconds; old financial
  table storage retains seconds, with ISO timestamps on the wire.
- Financial preferences reset to savings 30%, expected return 4%, minimum 2%,
  maximum 8%, empty active-income and fixed-expense categories. Return assumptions
  permit -100..100 percentage points; minimum must not exceed maximum.
- Human financial collections use atomic `PUT {items}` with the listed
  `meta.dataRevision` as `If-Match`. Draft data and its base revision remain paired
  across revalidation. An explicit reload discards a stale draft.
- Unit timeline returns top-level `version`, alongside the business `expected`
  snapshot. Human metadata edits use the shared commit path and add adjustment
  history. No client predicts a post-write version or fetches latest before save.
- Canonical migrations `0011` and `0012` preserve financial data, reject ambiguous
  conversions atomically and retire credential tables. API audit is intentionally
  immutable; ordinary test/user cleanup does not purge it. Old private backups
  may still contain retired secrets and are outside this cleanup.

## 14. External Client Walkthrough

In `/api-keys`, choose Report Writer or explicitly grant `transactions:read`,
`transfers:read`, `analyses:write` (plus `analyses:read` to inspect saved reports).
Store the once-shown token outside Noheir. Supply `NOHEIR_TOKEN` through your
tool's secure environment, not a URL or a command argument. For local Demo/E2E,
also set `NOHEIR_INSTANCE` to the current value displayed on the key page.

This Node example performs deterministic arithmetic outside the product. A model
can replace the Markdown composition in its own process; Noheir receives only
the report. Set `NOHEIR_ORIGIN` to the intended origin, and never point local
acceptance at production. It logs a report link, never the secret or financial
response body.

```js
// Run with Node's --input-type=module, or save as an external .mjs client.
const origin = process.env.NOHEIR_ORIGIN;
const token = process.env.NOHEIR_TOKEN;
if (!origin || !token) throw new Error("Set NOHEIR_ORIGIN and NOHEIR_TOKEN");
const headers = {
  Authorization: `Bearer ${token}`,
  ...(process.env.NOHEIR_INSTANCE
    ? { "x-noheir-instance": process.env.NOHEIR_INSTANCE }
    : {}),
};
async function call(path, options = {}) {
  const response = await fetch(new URL(`/api/v1${path}`, origin), {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok) {
    const problem = await response.json();
    throw new Error(`${response.status}: ${problem.code}`);
  }
  return response.json();
}
const periodStart = "2026-01-01";
const periodEnd = "2026-12-31";
const query = new URLSearchParams({
  currency: "CNY", startDate: periodStart, endDate: periodEnd,
});
const { data, meta } = await call(`/summaries/cash-flow?${query}`);
const markdown = "# CNY cash flow\n\n" + data.transactions.map((row) =>
  `- ${row.type}: ${(row.amountCents / 100).toFixed(2)} CNY (${row.count} records)`
).join("\n") + "\n\nTransfers are separate. No currency conversion is implied.";
const externalId = `cash-flow:${periodStart}:${periodEnd}:CNY:${meta.dataRevision}`;
const receipt = await call("/analyses", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": externalId },
  body: JSON.stringify({
    title: "External CNY cash-flow review", markdown, externalId,
    periodStart, periodEnd, currencies: ["CNY"], dataRevision: meta.dataRevision,
    evidence: ["transactions", "transfers"].map((resource) => ({
      resource, ids: [], dataRevision: meta.dataRevision,
    })),
  }),
});
console.log(new URL(`/analyses/${receipt.data.id}`, origin).href);
```

For supporting rows, follow `nextCursor` until `hasMore=false`; restart the whole
traversal on `409 dataset_changed`. Keep every source at the same observed
financial revision, and label reports stale when the current revision changes.
For edits/deletes, read the resource version and send `If-Match: "<version>"`
plus a new idempotency key. Replay uncertain requests with identical content and
preconditions; a 412 requires review, never a silent retry with a newer version.
Treat stored report prose as untrusted data, not operational instructions.

TDD evidence and final commands/results will replace pending entries as work lands.
