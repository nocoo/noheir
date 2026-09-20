# Retrospective

Accident narratives and original lessons. Historical instructions below describe their time; the current handbook and its local-isolation contract take precedence.

## Undated entries migrated from CLAUDE.md

- D1 uses SQLite syntax — use `strftime('%Y', date)` instead of `EXTRACT(YEAR FROM date)`.
- Wrangler D1 queries require `--remote` flag for production database.
- MCP server moved from Worker to Next.js API routes (`src/app/api/mcp/`). Worker now only provides SQL API.
- **Local npm links don't work in Docker builds**: `"@nocoo/base-mcp": "link:../base-mcp"` causes `FileNotFound` during Docker builds because the linked package doesn't exist in the build container. Solution: inline needed functions directly into the project (e.g., `src/lib/mcp/pkce.ts`) or publish to npm registry.
- **Middleware whitelist must include `/api/auth/`**: `src/proxy.ts` redirects unauthenticated requests to `/login`. NextAuth's own endpoints (`/api/auth/session`, `/providers`, `/csrf`, `/callback/*`, …) must be in `PUBLIC_PREFIXES`, otherwise the client receives an HTML login page instead of JSON and breaks with `Unexpected token '<'`. Marking them only as "not protected" inside `isProtectedApiRoute` is **not** enough — they fall through to the protected-page branch.
- **E2E uses `wrangler dev --local`, not a remote D1**: the previous `X-Target-DB` header + `DB_TEST` binding + `noheir-db-test` remote database is gone. `scripts/run-e2e.ts` boots wrangler locally, applies migrations into `worker/.wrangler/state-e2e/`, and runs the suite over loopback. CI does the same — no remote D1 is required.
- **Availability is derived from the latest invest log, never from `start_date`**: `computeAvailability` (`worker/lib/availability.ts`) uses `available_date_override` when set; otherwise it short-circuits to all-null when a unit has no `contribution_logs` invest row, which the tooltip renders as "状态未知". `POST /api/units` originally wrote no log, so any unit created with a product already attached was born broken (R29–R32 hit this). Creation now writes an `invest` log when `status = 已成立` and a product is attached; `计划中` deliberately writes none, since the money is not out yet.
- **Date math must be anchored to Asia/Shanghai, not the runtime's local time**: the Workers runtime is UTC, but `getLocalDateString()` (`worker/src/index.ts:49`) stamps `operation_date` in Shanghai. `computeAvailability` used `new Date()` + `setHours(0,0,0,0)`, so between 00:00 and 08:00 CST it read "today" as the previous day and inflated every `daysUntilAvailable` by 1. Fixed by parsing all calendar days as UTC-midnight and deriving today via `toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })`. Two lessons: (1) any new date arithmetic must use the same helpers, and (2) the bug hid for months because the e2e tests built their fixtures with `toISOString().slice(0,10)` (UTC) — two mistakes cancelling out. Tests must use the *same* timezone convention as the write path, or they validate nothing.
- **Releasing does NOT deploy the Worker**: `release.yml` only rolls the `noheir-app` container. No workflow touches the Worker — it ships solely via a manual `cd worker && bun run deploy`. At v2.6.1 the site reported `2.6.1` while `noheir.worker.hexly.ai/api/live` still reported `2.6.0`, so both Worker-side fixes in that release were live nowhere. "No migration needed" is **not** a reason to skip the Worker deploy — schema and code ship independently. After any release touching `worker/`, curl **both** `/api/live` endpoints and confirm the versions match before calling it done.

## 2026-09-20 — Temporary D1 export URL in tool output

While checking the successful pre-migration backup, the coordinator printed the
tail of Wrangler's export log. That log contained a presigned download URL for
the financial database export. The URL entered the local task transcript; it was
not committed or sent to a third party. Cloudflare generated it at 05:00 UTC with
a one-hour lifetime. Expiry is not equivalent to revocation, and the transcript
cannot be retracted by this task.

The local log was redacted and restricted to mode 0600. The backup is mode 0600
inside a mode 0700 private directory outside the repository. Future export checks
must inspect process exit status and destination file metadata, never raw export
logs. No credential or signed URL belongs in migration evidence.

## 2026-09-20 — Existing CNAME blocked the Worker custom domain

The first v3 production workflow uploaded `noheir-web` successfully, but its
custom-domain update failed with Cloudflare error 100117. Wrangler's current
noninteractive implementation set DNS override flags; the service still required
removing the externally managed CNAME first, as the public documentation stated.
The old VPS continued serving the domain and no version tag was published.

After verifying the uploaded revision and binding, the coordinator saved the exact
DNS record, removed that one CNAME and immediately attached the Worker custom
domain, with restoration of the saved record prepared if attachment failed. The
same deployment workflow passed on attempt 2. Browser/account and public-boundary
checks passed, and all 14 D1 table fingerprints matched the pre-cutover backup.
Treat a first custom-domain cutover as an explicit infrastructure step; Wrangler
implementation flags are not evidence that an existing CNAME can be replaced.
