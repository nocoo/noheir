# Noheir scoped REST API (`/api/v1`)

Machine-facing JSON API for external tools (for example a finance bot). All behavior below is implemented in the Hono Worker (`worker/src/scoped-api.ts`), shared Zod contracts (`src/domain/api-contract.ts`, `worker/db/validation.ts`, `worker/src/financial-service.ts`), and published at runtime as OpenAPI 3.1 (`GET /api/v1/openapi.json`).

**Production base URL:** `https://noheir.hexly.ai/api/v1`

Human browser administration (API keys, site settings) uses Cloudflare Access on `/api/*` routes outside this prefix and **never** accepts Bearer keys.

---

## Quick start

```bash
export NOHEIR_API_KEY='nhk_…'   # issued once from the Access-protected API Keys page
export BASE='https://noheir.hexly.ai/api/v1'

curl -sS "$BASE/capabilities" -H "Authorization: Bearer $NOHEIR_API_KEY" | jq .

curl -sS "$BASE/transactions?limit=5" -H "Authorization: Bearer $NOHEIR_API_KEY" | jq .

curl -sS -X POST "$BASE/transactions" \
  -H "Authorization: Bearer $NOHEIR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-tx-001" \
  -d '{
    "date": "2026-10-01",
    "type": "expense",
    "primaryCategory": "Food",
    "tertiaryCategory": "Meals",
    "amountCents": -1200,
    "account": "Bank",
    "currency": "CNY",
    "tags": []
  }' | jq .
```

Local development may additionally require the `x-noheir-instance` header shown on the API Keys page (instance-bound proxy). Production calls use HTTPS and Bearer only.

---

## Authentication

### Bearer API keys

| Rule | Detail |
| --- | --- |
| Header | `Authorization: Bearer nhk_<token>` — exactly one well-formed Bearer header |
| Token shape | `nhk_` plus 43 characters from `[A-Za-z0-9_-]` (32 bytes CSPRNG, base64url) |
| Transport | HTTPS required except loopback (`127.0.0.1`, `localhost`, `[::1]`) on the configured `SITE_URL` origin |
| Identity | Server resolves `owner_id` from the key digest; client-supplied owner fields are ignored |
| Access JWT | Never substitutes for a Bearer key on `/api/v1`; invalid Bearer never falls back to human identity |
| Storage | Only SHA-256 digest, label, prefix, scopes, timestamps; plaintext shown once at creation |

### Creating and revoking keys (human-only)

Use the **API Keys** page (`/api-keys`) while logged in through Cloudflare Access.

| Human route | Method | Purpose |
| --- | --- | --- |
| `/api/api-keys` | `GET` | List keys (metadata only, no secrets) |
| `/api/api-keys` | `POST` | Create key; response includes one-time `token` |
| `/api/api-keys/{id}` | `DELETE` | Revoke key (`revokedAt` set; digest unusable) |

Create body (`apiKeyCreateSchema`):

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `label` | string | yes | 1–100 chars, trimmed |
| `scopes` | string[] | yes | 1–`API_SCOPES.length` unique entries from scope catalog |
| `expiresInDays` | integer | no (default 90) | 1–365 |

Keys are immutable after creation (scopes and expiry fixed). Rotation = issue a new key and revoke the old one. Revocation is enforced on every request (no positive auth cache).

### Scope catalog

Independent **read**, **write**, and **delete** grants per resource family, plus:

| Scope | Meaning |
| --- | --- |
| `units:commit` | Versioned unit investment/redemption/product switch (`POST …/commit`) |
| `audit:read` | Paginated API audit log |
| `data:replace` | Ledger replacement preview/commit |

Resource families: `transactions`, `transfers`, `products`, `units`, `contribution-logs`, `expense-categories`, `recurring-expenses`, `account-classifications`, `balance-anchors`, `financial-preferences`, `analyses`.

Examples: `transactions:read`, `analyses:write`, `data:replace`.

Conditional scope needs (enforced at runtime):

- **Reports (`analyses`)** — each `evidence[].resource` requires `{resource}:read`; referenced IDs must belong to the same owner.
- **Ledger replacement** — for each selected ledger (`transactions` / `transfers`), requires `{ledger}:read`, `{ledger}:write`, and `{ledger}:delete`.
- **Unit delete with logs** — also requires `contribution-logs:delete`.
- **Expense category delete with rules** — also requires `recurring-expenses:write` to detach rules.
- **Recurring occurrences** — `includeCategories=true` requires `expense-categories:read`.
- **Metadata** — each value in `sources` requires `{source}:read`.

---

## Conventions

| Topic | Contract |
| --- | --- |
| Money | Signed safe integers in **cents** (`amountCents`, `balanceCents`, …) |
| Currencies | `CNY`, `USD`, `HKD` only for API writes; aggregates never mix currencies |
| FX | No implicit conversion; multi-currency totals are per-currency rows |
| Dates | `YYYY-MM-DD` (ISO calendar day); business calendar helpers use **Asia/Shanghai** |
| Timestamps | `createdAt`, `updatedAt`, and `deletedAt` in JSON responses are ISO-8601 strings or `null`. `wire()` accepts legacy storage: Unix seconds or milliseconds, zoneless SQLite `YYYY-MM-DD HH:MM:SS[.fff]` text (parsed as UTC), and other values normalized like contribution-log timestamps. Unparseable values become `null` instead of failing the request. New writes still use the resource-specific storage rules (ledger rows: Unix seconds). |
| Rates | Financial preference percentages are **percentage points** (not ratios) |
| Ordering | Lists use stable `id DESC` keyset pagination |
| Unknown vs zero | Missing balance anchors or investment history → **unknown** (`status: "unknown"` on balances), not `0` |
| Transfers | Separate from income/expense rows; not double-entry |
| Reports | Stored Markdown is opaque to the API; the web UI renders Markdown inertly (no raw HTML, no remote images). `author` / `model` are unverified text |
| Ownership | Off-owner IDs return `404 not_found` (same as missing) |

---

## Response envelope

Successful JSON responses:

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid",
    "dataRevision": 12,
    "auditRevision": 40,
    "returned": 2,
    "nextCursor": "…",
    "hasMore": true,
    "total": 120,
    "asOf": "2026-10-20T10:00:00.000Z",
    "filters": {}
  }
}
```

`meta` fields are endpoint-specific. Every response includes `meta.requestId`; the same value is echoed as `X-Request-Id`. `Cache-Control: no-store`.

**Mutations** (create/update/delete/operations) return a minimal receipt unless the endpoint returns a full resource:

```json
{ "data": { "id": "…", "version": 3, "affected": 1 }, "meta": { "requestId": "…" } }
```

HTTP `201` for creates (including `POST` batch and `POST` analyses); `200` otherwise. Write grants do not imply read access to the mutated row.

---

## Pagination and list filters

### Query parameters (list endpoints)

Shared `listQuerySchema` (where supported):

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `limit` | int | 100 | 1–500 |
| `cursor` | string | — | Opaque; max 8000 chars |
| `total` | `true` \| `false` | `false` | When `true`, `meta.total` is included |
| `currency` | `CNY` \| `USD` \| `HKD` | — | Analyses: membership in `currencies` JSON |
| `startDate` / `endDate` | date | — | Resource-specific date column; analyses map to `periodStart` / `periodEnd` overlap |
| `account` | string | — | max 200 |
| `tag` | string | — | Exact tag match via `json_each` (transactions/transfers) |
| `type` | `income` \| `expense` | — | Transactions only |
| `category` | string | — | Maps to `primary_category` |
| `status` | string | — | Units / recurring expenses |
| `q` | string | — | Case-insensitive substring on `name`, `title`, or `note` (max 200) |
| `minAmountCents` / `maxAmountCents` | int | — | Inclusive |
| `includeDeleted` | `true` \| `false` | `false` | Contribution logs only |
| `groupBy` | see aggregates | — | Aggregate endpoints only |

Unsupported filters for a resource → `400` with `unsupported_filter_*`.

### Revision-bound cursors

List cursors encode `{ binding, revision, id }` where `binding` canonicalizes owner, key, resource, filters, and sort order. If `dataRevision` changes between pages → `409 dataset_changed` (restart from first page). Audit lists bind `auditRevision` similarly.

---

## Concurrency

| Mechanism | Usage |
| --- | --- |
| `ETag` | `GET` single resource returns `ETag: "<version>"` (quoted integer) |
| `If-Match` | Required on `PATCH`, `DELETE`, `PUT` financial-preferences, unit commit, log restore, recurring state, collection replace preconditions |
| Format | `If-Match: "7"` — quoted non-negative integer, no leading zeros except `"0"` |
| `dataRevision` | Owner-wide financial revision (or `analysis_revisions` for analysis reads); returned on reads |
| Stale write | `412 stale_version` when version precondition fails |
| Concurrent read | `checkedRead` may return `409 dataset_changed` if revision moves mid-read |

Financial-preferences and human bulk classification/anchor replace use owner revision preconditions (`coalesce(owner_revisions.revision,0)`).

---

## Idempotency (machine mutations)

Required on **every** `POST` / `PUT` / `PATCH` / `DELETE` from an API key, except `POST /ledger-replacements/preview` (preview is read-only side effect).

| Header | Pattern | Retention |
| --- | --- | --- |
| `Idempotency-Key` | `^[A-Za-z0-9._:-]{1,128}$` | 7 days |

Fingerprint = SHA-256 of canonical `{ method, path, input, ifMatch }`. Same key + fingerprint replays stored `{ status, data }`. Same key + different fingerprint → `409 idempotency_conflict`. Missing key → `428 idempotency_key_required`; malformed → `400 invalid_idempotency_key`.

On uncertain network failure, retry with the **same** key and body within seven days.

---

## Rate limits

Fixed 60-second windows (`api_rate_limits`), per key and per owner:

| Budget | Key limit | Owner limit |
| --- | --- | --- |
| All requests | 120 / min | 600 / min |
| Expensive routes | 20 / min | 60 / min |

**Expensive** = path ends with `/aggregate`, `/portfolio`, `/balances`, `/occurrences`, `/metadata`, or contains `/ledger-replacements`.

Exceeded → `429 rate_limit_exceeded` with `Retry-After: 60`.

---

## Errors

`Content-Type: application/problem+json`:

```json
{
  "type": "https://noheir.hexly.ai/problems/not_found",
  "title": "not found",
  "status": 404,
  "code": "not_found",
  "requestId": "…",
  "errors": [{ "path": "field", "message": "…" }]
}
```

`errors` appears for validation-style failures (for example `invalid_input`).

| HTTP | Code (representative) |
| --- | --- |
| 400 | `invalid_query`, `invalid_input`, `invalid_json`, `invalid_cursor`, `invalid_batch`, `invalid_commit`, `invalid_replacement`, `replacement_too_many_rows`, `replacement_digest_mismatch`, `year_mismatch`, `aggregate_too_many_groups`, … |
| 401 | `invalid_credentials` |
| 403 | `insufficient_scope` (+ `missingScopes`) |
| 404 | `not_found` |
| 405 | `method_not_allowed` (`Allow` header set) |
| 409 | `dataset_changed`, `stale_version`, `business_conflict`, `idempotency_conflict`, `currency_mismatch`, `unit_commit_required`, … |
| 412 | `stale_version` (version precondition) |
| 413 | `request_body_too_large` (global body limit on Worker) |
| 415 | `unsupported_media_type` (JSON required for bodies) |
| 428 | `if_match_required`, `idempotency_key_required` |
| 429 | `rate_limit_exceeded` |
| 500 | `internal_error` |

`401` responses include `WWW-Authenticate: Bearer`.

Unexpected non-`ApiError` failures on scoped routes are logged once as structured JSON (`level`, `requestId`, `method`, `path`, error `name`/`message`/`stack`) before the client receives `500 internal_error`. The log line is server-side only; the problem body still exposes only `requestId` and `code`.

---

## Discovery

<!-- route: GET /api/v1/openapi.json -->

### `GET /openapi.json`

| | |
| --- | --- |
| Scopes | none (public; registered before auth middleware — no Bearer required) |
| Response | OpenAPI 3.1 document; paths under `/api/v1/…`; `x-required-scopes` per operation |

<!-- route: GET /api/v1/instructions -->

### `GET /instructions`

| | |
| --- | --- |
| Scopes | none (public) |
| Response | JSON operator guide (`version`, `authentication`, `reads`, `money`, `writes`, `audit`, `reports`, `replacement`, `limits`) |

<!-- route: GET /api/v1/me -->

### `GET /me`

| | |
| --- | --- |
| Scopes | none (authenticated key required) |
| Response | Key metadata (`id`, `label`, `prefix`, `scopes`, timestamps) + `ownerId` |

<!-- route: GET /api/v1/capabilities -->

### `GET /capabilities`

| | |
| --- | --- |
| Scopes | none |
| Response | `schemaVersion`, granted `scopes`, `limits` (pagination, batch, `replacementRows`, `replacementBodyBytes`, idempotency, rate limits), `conventions` |

---

## Transactions

Resource schema (`transactionSchema`): `date`, `primaryCategory`, `tertiaryCategory`, `type` (`income` \| `expense`), `amountCents`, `account`, `currency` (default `CNY`), `tags` (string array, max 100 items, each 1–200 chars), optional `secondaryCategory`, `note` (max 4000).

<!-- route: GET /api/v1/transactions -->

### `GET /transactions`

| Scopes | `transactions:read` |
| Query | Full list schema |
| Response | `data`: transaction[]; `meta`: pagination + `dataRevision` |

<!-- route: POST /api/v1/transactions -->

### `POST /transactions`

| Scopes | `transactions:write` |
| Headers | `Idempotency-Key` |
| Body | Full create schema |
| Response | `201` + `{ id, version: 1, affected: 1 }` |

<!-- route: GET /api/v1/transactions/{id} -->

### `GET /transactions/{id}`

| Scopes | `transactions:read` |
| Headers | Response `ETag` |
| Errors | `404 not_found` |

<!-- route: PATCH /api/v1/transactions/{id} -->

### `PATCH /transactions/{id}`

| Scopes | `transactions:write` |
| Headers | `If-Match`, `Idempotency-Key` |
| Body | Partial fields |
| Errors | `412 stale_version`, `400 empty_update` |

<!-- route: DELETE /api/v1/transactions/{id} -->

### `DELETE /transactions/{id}`

| Scopes | `transactions:delete` |
| Headers | `If-Match`, `Idempotency-Key` |

<!-- route: GET /api/v1/transactions/aggregate -->

### `GET /transactions/aggregate`

| Scopes | `transactions:read` |
| Query | List filters + `groupBy`: `currency` (default), `month`, `category`, `account`, `tag` |
| Response | Grouped sums per currency; `meta.overlapping: true` when `groupBy=tag` |
| Limits | Max 500 groups; else `400 aggregate_too_many_groups` |

<!-- route: POST /api/v1/transactions/batch -->

### `POST /transactions/batch`

| Scopes | `transactions:write` |
| Headers | `Idempotency-Key` |
| Body | `{ "items": [ … ] }` — 1–100 creates |
| Response | `201` `{ ids, affected, version: 1 }` |

---

## Transfers

Schema (`transferSchema`): `date`, `account`, `currency`, `tags`, `inflowAmountCents` / `outflowAmountCents` (default 0), optional categories / `transactionType` / `note`.

<!-- route: GET /api/v1/transfers -->
<!-- route: POST /api/v1/transfers -->
<!-- route: GET /api/v1/transfers/{id} -->
<!-- route: PATCH /api/v1/transfers/{id} -->
<!-- route: DELETE /api/v1/transfers/{id} -->
<!-- route: GET /api/v1/transfers/aggregate -->
<!-- route: POST /api/v1/transfers/batch -->

Same patterns as transactions with `transfers:*` scopes. Aggregate sums `inflowAmountCents` and `outflowAmountCents` separately.

---

## Products

Create schema: `name` (required), optional `code`, `channel`, `category` (enums in `worker/db/enums.ts`), `currency`, `lockPeriodDays`, `openDays`, `cycleDays`, `annualReturnRate`, `isArchived`. Open/cycle day coupling rules apply.

<!-- route: GET /api/v1/products -->
<!-- route: POST /api/v1/products -->
<!-- route: GET /api/v1/products/{id} -->
<!-- route: PATCH /api/v1/products/{id} -->
<!-- route: DELETE /api/v1/products/{id} -->

| Method | Scopes |
| --- | --- |
| GET list/detail | `products:read` |
| POST / PATCH | `products:write` + idempotency / If-Match |
| DELETE | `products:delete`; `409 resource_referenced` if units or contribution logs reference product |

<!-- route: GET /api/v1/products/{id}/portfolio -->

### `GET /products/{id}/portfolio`

| Scopes | `products:read`, `units:read`, `contribution-logs:read` |
| Query | `currency?`, `status?` |
| Response | Holdings with availability enrichment (max 500 units) |

---

## Units (capital units)

Create: `unitCode`, `amountCents`, `currency`, `status`, `strategy`, `tactics`, optional `productId`, dates, `note`. Status enum: `已成立`, `计划中`, `筹集中`, `已归档`. Creating `已成立` with `productId` auto-inserts an invest contribution log (Asia/Shanghai date).

API key `PATCH` **cannot** change `amountCents`, `productId`, `status`, or `currency` → `409 unit_commit_required`. Use commit flow.

<!-- route: GET /api/v1/units -->
<!-- route: POST /api/v1/units -->
<!-- route: GET /api/v1/units/{id} -->
<!-- route: PATCH /api/v1/units/{id} -->
<!-- route: DELETE /api/v1/units/{id} -->

DELETE with contribution logs requires `contribution-logs:delete` unless logs already absent.

<!-- route: GET /api/v1/units/{id}/preflight -->

### `GET /units/{id}/preflight`

| Scopes | `units:read`, `products:read`, `contribution-logs:read` |
| Response | `{ unit, expected, logs }` for commit staging; `ETag` = unit version |
| Limits | Max 500 active logs |

<!-- route: POST /api/v1/units/{id}/commit -->

### `POST /units/{id}/commit`

| Scopes | `units:commit` |
| Headers | `If-Match`, `Idempotency-Key` |
| Body | `commitUnitSchema`: `expected` (unit snapshot), optional `metadata`, `operations` (max 3, unique kinds), `operationDate?`, `commitNote?` |
| Operations | `swap_unit_code`, `switch_product`, `set_available_date` |
| Errors | `409 unit_snapshot_changed`, `400 empty_commit`, `409 currency_mismatch`, … |
| Response | `200` `{ id, version, affected: 1 }` |

---

## Contribution logs

Create: `unitId`, `operationType` (`invest` \| `withdraw` \| `adjust`), `amountCents`, `operationDate`, optional `productId`, `balanceAfterCents`, `pnlCents`, `note`. API creates set `source: "api"`.

DELETE is soft-delete (`deletedAt` set). List omits deleted unless `includeDeleted=true`.

<!-- route: GET /api/v1/contribution-logs -->
<!-- route: POST /api/v1/contribution-logs -->
<!-- route: GET /api/v1/contribution-logs/{id} -->
<!-- route: PATCH /api/v1/contribution-logs/{id} -->
<!-- route: DELETE /api/v1/contribution-logs/{id} -->

<!-- route: POST /api/v1/contribution-logs/{id}/restore -->

### `POST /contribution-logs/{id}/restore`

| Scopes | `contribution-logs:write` |
| Headers | `If-Match`, `Idempotency-Key` |
| Errors | `409 log_not_deleted` if not soft-deleted |

---

## Expense categories

`name` (1–50), `colorToken` (`chart-1` … `chart-24`), optional `sortOrder`.

<!-- route: GET /api/v1/expense-categories -->
<!-- route: POST /api/v1/expense-categories -->
<!-- route: GET /api/v1/expense-categories/{id} -->
<!-- route: PATCH /api/v1/expense-categories/{id} -->
<!-- route: DELETE /api/v1/expense-categories/{id} -->

DELETE with attached recurring rules needs `recurring-expenses:write`.

---

## Recurring expenses

Full create schema in `createRecurringExpenseSchema` (`frequency`, `interval`, calendar fields, `amountCents` positive, `currency`, etc.).

<!-- route: GET /api/v1/recurring-expenses -->
<!-- route: POST /api/v1/recurring-expenses -->
<!-- route: GET /api/v1/recurring-expenses/{id} -->
<!-- route: PATCH /api/v1/recurring-expenses/{id} -->
<!-- route: DELETE /api/v1/recurring-expenses/{id} -->

<!-- route: GET /api/v1/recurring-expenses/occurrences -->

### `GET /recurring-expenses/occurrences`

| Scopes | `recurring-expenses:read` (+ `expense-categories:read` if `includeCategories=true`) |
| Query | `startDate`, `endDate` (required), `id?`, `includeCategories` |
| Window | Inclusive dates, max 366-day span |
| Limits | 500 rules, 5000 occurrence rows |

<!-- route: POST /api/v1/recurring-expenses/{id}/state -->

### `POST /recurring-expenses/{id}/state`

| Scopes | `recurring-expenses:write` |
| Headers | `If-Match`, `Idempotency-Key` |
| Body | `{ "transition": "pause" \| "resume" \| "end" }` |
| Errors | `409 invalid_transition`, `409 invalid_status` |

---

## Account classifications

`accountName`, `type`: `debit` \| `credit` \| `prepaid` \| `financial` \| `unclassified`.

Machine API: per-row CRUD (no bulk `PUT` — that is human-only on `/api/account-classifications`).

<!-- route: GET /api/v1/account-classifications -->
<!-- route: POST /api/v1/account-classifications -->
<!-- route: GET /api/v1/account-classifications/{id} -->
<!-- route: PATCH /api/v1/account-classifications/{id} -->
<!-- route: DELETE /api/v1/account-classifications/{id} -->

---

## Balance anchors

`accountName`, `currency`, `date`, `balanceCents`.

<!-- route: GET /api/v1/balance-anchors -->
<!-- route: POST /api/v1/balance-anchors -->
<!-- route: GET /api/v1/balance-anchors/{id} -->
<!-- route: PATCH /api/v1/balance-anchors/{id} -->
<!-- route: DELETE /api/v1/balance-anchors/{id} -->

---

## Financial preferences

Singleton per owner (`id` = owner user id). Fields: `savingsRateTarget`, `expectedReturnRate`, `minReturnRate`, `maxReturnRate`, `activeIncomeCategories`, `fixedExpenseCategories` (string arrays max 500). `minReturnRate <= maxReturnRate`.

<!-- route: GET /api/v1/financial-preferences -->

### `GET /financial-preferences`

| Scopes | `financial-preferences:read` |
| Response | Stored row or defaults at `version: 0` |

<!-- route: PUT /api/v1/financial-preferences -->
<!-- route: PATCH /api/v1/financial-preferences -->

### `PUT` / `PATCH /financial-preferences`

| Scopes | `financial-preferences:write` |
| Headers | `If-Match`, `Idempotency-Key` |
| Body | Full or partial preferences |
| Create | `If-Match: "0"` when no row exists |

<!-- route: DELETE /api/v1/financial-preferences -->

### `DELETE /financial-preferences`

| Scopes | `financial-preferences:delete` |
| Effect | Resets to schema defaults (not a hard delete) |

---

## Analyses (reports)

| Field | Constraints |
| --- | --- |
| `title` | 1–200 chars |
| `markdown` | max 100_000 chars |
| `periodStart` / `periodEnd` | dates, `periodEnd >= periodStart` |
| `currencies` | 1–3 ISO codes |
| `dataRevision` | non-negative snapshot label at creation time |
| `externalId` | optional 1–200; immutable after create; dedup receipt on conflict |
| `author` / `model` | optional unverified labels |
| `evidence` | max 100 entries: `{ resource, ids[], dataRevision }` |

<!-- route: GET /api/v1/analyses -->
<!-- route: POST /api/v1/analyses -->
<!-- route: GET /api/v1/analyses/{id} -->
<!-- route: PATCH /api/v1/analyses/{id} -->
<!-- route: DELETE /api/v1/analyses/{id} -->

`POST` with same `externalId` + body replays creation receipt; different body → `409 external_id_conflict`. Reads use `analysis_revisions` for `dataRevision`.

---

## Summaries and balances

<!-- route: GET /api/v1/summaries/cash-flow -->

### `GET /summaries/cash-flow`

| Scopes | `transactions:read`, `transfers:read` |
| Query | List filters applied independently to each ledger |
| Response | `{ transactions: [...], transfers: [...] }` grouped by currency/type |

<!-- route: GET /api/v1/summaries/portfolio -->

### `GET /summaries/portfolio`

| Scopes | `products:read`, `units:read`, `contribution-logs:read` |
| Query | `currency?`, `status?` |
| Response | All units (≤500) with availability fields |

<!-- route: GET /api/v1/accounts/balances -->

### `GET /accounts/balances`

| Scopes | `transactions:read`, `transfers:read`, `account-classifications:read`, `balance-anchors:read` |
| Query | `asOf` (required date), `currency?`, `account?` |
| Response | Per account/currency: anchor metadata, `reconstructedBalanceCents`, `status` `known` \| `unknown` |

---

## Metadata

<!-- route: GET /api/v1/metadata -->

### `GET /metadata`

| Scopes | `{source}:read` for each source |
| Query | `sources` — comma-separated `transactions` and/or `transfers` (unique) |
| Response | Facets: `years`, `currencies`, `accounts`, `categoryPaths`, `tags` — each complete up to 500 values (no truncation) |

---

## Ledger replacement

Whole-year (or all-years) **replace** for `transactions` and/or `transfers`. Max **20,000 rows** per selected ledger (`transactions` / `transfers` array) in one request. The entire JSON body must stay within the global **8 MiB** limit (`replacementBodyBytes` on `/capabilities` and `/instructions`; over limit → `413 request_body_too_large`). Not a full JSON backup/restore.

Preview does not mutate data and does **not** require `Idempotency-Key`.

**Commit write path:** after all rows pass validation, the server deletes the scoped year (or all years when `year` is `null`) and inserts the payload in **one atomic D1 batch** using chunked `INSERT … SELECT … FROM json_each(?)` statements (512 KiB JSON chunks per ledger), with the same mutation guard, `expectedDataRevision` precondition, idempotency, and row-level audit triggers as before. This replaces the former one-`INSERT`-per-row pattern (which hit D1 per-invocation statement limits around ~500 rows per ledger).

Body (`replacementSchema`):

| Field | Notes |
| --- | --- |
| `year` | `1900–2100` or `null` for all years |
| `transactions` / `transfers` | Optional arrays (max **20,000** each); at least one ledger required; more than 20,000 → `400 replacement_too_many_rows` |
| `allowEmpty` | default `false`; empty array requires `true` |
| `expectedDataRevision` | Must match current owner revision at commit |
| `digest` | Required on commit; must match preview digest |

All row dates must match `year` when `year` is set.

<!-- route: POST /api/v1/ledger-replacements/preview -->

### `POST /ledger-replacements/preview`

| Scopes | `data:replace` + per-ledger read/write/delete |
| Response | `{ digest, expectedDataRevision, year, affected, inserted, deletion }` |

<!-- route: POST /api/v1/ledger-replacements -->

### `POST /ledger-replacements`

| Scopes | same |
| Headers | `Idempotency-Key` |
| Body | Same as preview plus matching `digest` |
| Effect | Deletes existing rows in scope, inserts payload atomically (chunked `json_each` inserts) |
| Errors | `400 replacement_digest_mismatch`, `400 replacement_too_many_rows`, `409 dataset_changed` (preview), `412 stale_version` (commit when `expectedDataRevision` is stale) |

---

## Audit

<!-- route: GET /api/v1/audit-events -->

### `GET /audit-events`

| Scopes | `audit:read` |
| Query | `limit` (1–500, default 100), `cursor?` |
| Pagination | Binds `auditRevision` (append count on `api_audit`); `409 dataset_changed` on drift |
| Response | Events: `actorKind`, `keyId`, `requestId`, `operation`, `resource`, `resourceId`, versions, `createdAt` |

---

## Related material

- Design record: [25-scoped-api.md](25-scoped-api.md)
- Operations: [04-run.md](04-run.md), [AGENTS.md](../AGENTS.md)
- Live OpenAPI: `GET /api/v1/openapi.json`
