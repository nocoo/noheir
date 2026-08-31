# Changelog

All notable changes to this project will be documented in this file.

## [2.6.2] - 2026-08-31

### Features

- add available date override

### Fixes

- use shanghai calendar in lock ui
- parse iso invest dates as calendar days
- keep availability calc inside next image
- preview latest invest after backdated switch
- tooltip cycle with null lock period
- align switch preview with worker today
- ignore deleted invest logs in mcp
- preview switch using operation date
- narrow available date commit operation
- preview switch product and snapshot date
- skip no-op override and log final product
- tooltip phase uses date override
- align mcp availability with worker
- reject impossible available dates
- **release** — isolate Next build on fixed Bun runtime
- **deps** — align undici with jsdom constraint
- **deps** — refresh vulnerable overrides
- await rejects assertion in mcp-tokens test

### Documentation

- mention override in mcp tool copy
- qualify remaining availability wording
- note override in availability retrospective
- note override in comments and 003 table
- mention override in remaining specs
- qualify availability without invest log
- sync override field counts
- fix override schema contradictions
- record available date override
- note that releases skip the worker deploy

### Tests

- require three mcp invest predicates
- assert mcp query sites use predicate
- lock mcp invest predicate to live rows
- prove override clear and no-op commit
- **release** — lock install to stable Bun stage
- **release** — enforce Bun runtime isolation

### Chores

- remove unused autoresearch files
- remove unused gen1 archive
- **deps** — bump @types/node 26.2.0 → 26.3.0
- **deps** — bump hono 4.13.3 → 4.13.4
- **deps** — bump lucide-react 1.33.0 → 1.34.0
- **deps** — bump @testing-library/user-event 14.6.5 → 14.6.6
- **deps** — bump @cloudflare/workers-types 5.20260822.1 → 5.20260823.1
- **deps** — bump next 16.3.1 → 16.3.2
- **deps** — bump @cloudflare/workers-types 5.20260821.1 → 5.20260822.1
- **deps** — bump @biomejs/biome 2.5.9 → 2.5.10
- **deps** — bump @cloudflare/workers-types 5.20260820.1 → 5.20260821.1
- **deps** — bump @types/bun 1.3.14 → 1.4.0
- **deps** — bump wrangler 4.124.0 → 4.125.0
- **deps** — bump @cloudflare/workers-types 5.20260819.1 → 5.20260820.1
- **deps** — bump lucide-react 1.32.0 → 1.33.0
- **deps** — bump @testing-library/user-event 14.6.4 → 14.6.5 (#382)
- **deps** — bump @cloudflare/workers-types 5.20260818.1 → 5.20260819.1 (#383)
- **deps** — bump vitest and @vitest/coverage-v8 4.1.10 → 4.1.11
- **deps** — bump wrangler 4.123.0 → 4.124.0
- **deps** — bump hono 4.13.2 → 4.13.3
- **deps** — bump lucide-react 1.31.0 → 1.32.0
- **deps** — bump @cloudflare/workers-types 5.20260817.1 → 5.20260818.1
- **deps** — bump @biomejs/biome 2.5.8 → 2.5.9
- **deps** — bump @cloudflare/workers-types 5.20260814.1 → 5.20260817.1
- **deps** — bump wrangler 4.122.0 → 4.123.0
- **deps** — bump next 16.3.0 → 16.3.1
- **deps** — override root nanoid to 3.3.18 (security)
- **deps** — bump hono 4.13.1 → 4.13.2
- **deps** — bump @cloudflare/workers-types 5.20260813.1 → 5.20260814.1
- **deps** — bump @cloudflare/workers-types 5.20260812.1 → 5.20260813.1
- **deps** — bump wrangler 4.121.0 → 4.122.0
- **deps** — bump @testing-library/user-event 14.6.3 → 14.6.4
- **deps** — bump wrangler 4.120.1 → 4.121.0
- **deps** — bump @cloudflare/workers-types 5.20260811.1 → 5.20260812.1
- **deps** — bump @testing-library/user-event 14.6.3 → 14.6.4
- **deps** — bump @biomejs/biome 2.5.7 → 2.5.8
- **deps** — bump wrangler 4.120.0 → 4.120.1
- **deps** — bump wrangler 4.120.0 → 4.120.1
- **deps** — bump @cloudflare/workers-types 5.20260810.1 → 5.20260811.1
- **deps** — bump lucide-react to 1.31.0
- **deps** — bump @testing-library/jest-dom to 7.0.1
- **deps** — bump sonner 2.0.7 → 2.0.8
- **deps** — bump cloudflare workers types
- **deps** — bump cloudflare workers types
- **deps** — bump esbuild to 0.28.2
- **deps** — bump hono to 4.13.1
- **deps** — secure worker nanoid resolution
- **deps** — bump workers types to 5.20260808.1
- **deps** — bump @types/node to 26.2.0
- **deps** — bump lucide-react to 1.30.0
- **deps** — bump wrangler to 4.120.0
- **deps** — bump lucide-react to 1.29.0
- **deps** — bump postcss to 8.5.26
- **deps** — bump better-sqlite3 to 13.0.3
- **deps** — bump wrangler to 4.119.0
- **deps** — patch vulnerable dependencies
- **deps** — patch vulnerable transitive dependencies
- **deps** — bump biome to 2.5.7
- **deps** — bump next to 16.3.0
- **deps** — bump hono to 4.13.0
- **deps** — bump workers types to 5.20260804.1
- **deps** — bump @testing-library/user-event to 14.6.3
- **deps** — bump @types/better-sqlite3 to 9.6.0
- **deps** — bump @cloudflare/workers-types to 5.20260801.1
- **deps** — bump wrangler to 4.118.0
- **deps** — bump hono to 4.12.33
- **deps** — bump @cloudflare/workers-types to 5.20260731.1
- **deps** — bump wrangler to 4.116.0
- **deps** — bump @playwright/test to 1.62.1
- **deps** — bump @types/react-dom to 19.2.4
- **deps** — bump @types/react to 19.2.18
- **deps** — bump lucide-react to 1.28.0
- **deps** — sync worker biome schema pin to 2.5.6
- **deps** — bump wrangler to 4.115.0
- **deps** — bump recharts to 3.10.1
- **deps** — bump radix-ui to 1.6.7
- **deps** — bump postcss to 8.5.25
- **deps** — bump next to 16.2.12
- **deps** — bump lucide-react to 1.27.0
- **deps** — bump jsdom to ^30.0.1
- **deps** — bump hono to 4.12.32
- **deps** — bump better-sqlite3 to 13.0.2
- **deps** — bump @types/node to 26.1.2
- **deps** — bump @playwright/test to 1.62.0
- **deps** — bump @modelcontextprotocol/sdk to ^1.30.0
- **deps** — bump @cloudflare/workers-types to 5.20260730.1
- **deps** — bump @biomejs/biome to 2.5.6

## [2.6.1] - 2026-07-29

### Features

- **worker** — auto-log initial invest on unit creation

### Fixes

- **worker** — anchor availability math to shanghai calendar days

### Documentation

- record the invest-log and timezone findings
- record the legacy data cleanup
- record how the open questions were settled

### Chores

- **worker** — drop the unused version field

## [2.6.0] - 2026-07-28

### Features

- **db** — add commit_token to capital_units
- **ui** — flag cash holdings with a corner marker
- **ui** — default operation date to today
- **ui** — pass product category to badges
- **ui** — color product badges by category
- **ui** — surface pnl and mcp source in capital logs
- **ui** — three-column unit editor with staged commit
- **ui** — add staged operations panel
- **ui** — add searchable unit swap picker
- **ui** — add unit log timeline with inline pnl edit
- **types** — add mcp to contribution source union
- **actions** — add commitUnit and unit log listing
- **lib** — add staged commit planning module
- **client** — add commitUnit, listUnitLogs and pnl params
- **types** — add pnl, timeline and commit snapshot types
- **worker** — add mcp to contribution sources
- **worker** — include totalPnl in summaries
- **worker** — add unit commit and logs endpoints
- **worker** — add commitUnitSchema
- **worker** — unit commit statement builder
- **worker** — accept pnlCents in log validation
- **worker** — list unit logs with normalized timestamps
- **worker** — normalize mixed created_at encodings
- **schema** — add pnl_cents to contribution_logs
- **db** — add 0008 pnl_cents migration
- add 时间视图 sidebar entry for capital logs

### Fixes

- **worker** — guard the swap partner with the token
- **worker** — prove log authorship with a commit token
- **ui** — resolve product name alongside the snapshot
- **worker** — guard logs on every cas column
- **ui** — resolve archived product and fresh invest date
- **worker** — normalize legacy dates in sort and filter
- **worker** — fold product switch into the cas statement
- **mcp** — mint uuids instead of ulids
- add legacy tactics values to the enum
- **ui** — let basic info column set the panel height
- **ui** — restructure timeline rows and fill column height
- **ui** — trim legacy iso timestamps in date columns
- **ui** — use solid buttons and cards for operations
- **ui** — single-line commit note and aligned columns
- **ui** — anchor product panel to the cas snapshot
- **worker** — guard swap partner product in the batch
- **ui** — default log date to local timezone
- **ui** — distinguish unpicked product from unlink
- **ui** — derive form and cas anchor from one snapshot
- **worker** — return normalized timestamp from log search
- **worker** — keep swap partner product and archive today
- **mcp** — correct withdraw sign and date format
- **worker** — use local date for auto-log operation_date
- **worker** — apply normalized sort to log search
- **worker** — tiebreak latest invest log by normalized time
- use red for all locked units regardless of days remaining

### Refactoring

- **ui** — extract shared unit panel primitives

### Documentation

- record the partner guard gap
- sync pseudocode with the token guard
- record the guard's three iterations
- record second review round
- record review fixes
- record phase 3 completion
- record phase 2 completion
- record phase 1 completion
- return expected snapshot from unit logs endpoint
- allow nullable status in resolveEndDate
- add mcp to contribution source enum
- pin totalPnl type contract across layers
- mirror db nullability in concurrency anchor
- unbreak phase table and add search sort commit
- align note terminology across sections
- cover log search sort and fix migration order
- reuse endDate invariant in commit builder
- tighten commit schema guards and concurrency anchor
- expand mcp defect to sign, source and date

### Tests

- **worker** — pin the same-millisecond commit race
- guard capital enum copies against drift

### Chores

- **deps** — bump next-auth 5.0.0-beta.31 → 5.0.0-beta.32 (#259)
- **deps** — bump @cloudflare/workers-types 5.20260721.1 → 5.20260722.1
- **deps** — bump postcss 8.5.21 → 8.5.22
- **deps** — bump radix-ui 1.6.4 → 1.6.5

### Style

- **ui** — nudge cash flag icon inward

## [2.4.2] - 2026-07-23

### Features

- add hover tooltip panel to warehouse unit cards

### Fixes

- detect initial-lock phase via latestInvestDate + lockPeriodDays
- use Chinese section titles in unit tooltip
- hide tooltip arrow via showArrow prop to remove black block
- make warehouse unit cards keyboard-accessible
- multiply annualReturnRate by 100 for display
- use closed-window denominator for cyclic products in tooltip progress

### Refactoring

- use unified Badge components for strategy/tactics/product in tooltip

### Chores

- **deps** — bump @hono/node-server override 2.0.5 → 2.0.11 (security)
- **deps** — extend sharp override to worker workspace (security)
- **deps** — bump better-sqlite3 12.11.1 → 13.0.1
- **deps** — add sharp override → 0.35.3 (security)
- **deps** — bump @hono/node-server override 1.19.13 → 2.0.5 (security)
- **deps** — bump fast-uri override 3.1.2 → 3.1.4 (security)
- **deps** — bump @biomejs/biome 2.5.4 → 2.5.5
- **deps** — bump @cloudflare/workers-types 5.20260719.1 → 5.20260721.1
- **deps** — bump next 16.2.10 → 16.2.11
- **deps** — bump postcss 8.5.20 → 8.5.21
- **deps** — bump react + react-dom 19.2.7 → 19.2.8
- **deps** — bump wrangler 4.112.0 → 4.113.0
- **deps** — bump @testing-library/jest-dom 6.9.1 → 7.0.0
- **deps** — bump recharts 3.9.2 → 3.10.0
- **deps** — bump radix-ui 1.6.3 → 1.6.4
- **deps** — bump @cloudflare/workers-types 5.20260718.1 → 5.20260719.1
- **deps** — bump postcss 8.5.19 → 8.5.20
- **deps** — bump radix-ui 1.6.2 → 1.6.3
- **deps** — bump hono 4.12.30 → 4.12.31
- **deps** — bump @cloudflare/workers-types 5.20260717.1 → 5.20260718.1
- **deps** — bump lucide-react 1.24.0 → 1.25.0
- **deps** — bump wrangler 4.111.0 → 4.112.0
- **deps** — bump @cloudflare/workers-types 5.20260716.1 → 5.20260717.1
- **deps** — bump tailwindcss 4.3.2 → 4.3.3
- **deps** — bump @tailwindcss/postcss 4.3.2 → 4.3.3
- **deps** — bump @cloudflare/workers-types 5.20260715.1 → 5.20260716.1
- **deps** — bump wrangler 4.110.0 → 4.111.0
- **deps** — bump @cloudflare/workers-types 5.20260713.1 → 5.20260715.1
- **deps** — bump @biomejs/biome 2.5.3 → 2.5.4

## [2.4.1] - 2026-07-15

### Features

- **strategy** — colour sunburst arcs from the project palette

### Fixes

- **strategy** — bind sunburst arc-label colour to --foreground
- **strategy** — let CSS drive sunburst colours so theme flips repaint arcs
- **strategy** — key currency palette on the ISO code, not the display label
- **strategy** — disable inheritColorFromParent so colorForNode drives every ring
- **strategy** — decouple sunburst rings so the currency ring doesn't tint the outer rings
- **strategy** — path-based ids in sunburst hierarchy

### Refactoring

- **strategy** — migrate sunburst from echarts to @nivo/sunburst

### Documentation

- **env** — update .env.example to reflect Cloudflare Worker + NextAuth stack

### Chores

- prune leftover echarts adapters after the nivo migration

## [2.4.0] - 2026-07-13

### Features

- **ci** — switch lint entrypoint from eslint to biome

### Fixes

- **lint** — restore no-console rule for src/**
- eliminate array-index keys and residual noExplicitAny sites
- **a11y** — scope useSemanticElements suppressions to intentional patterns
- **a11y** — explicit type='button' on non-submit buttons

### Refactoring

- **worker** — eliminate non-null assertions in repositories and validation
- apply biome unsafe fixes (isNaN, node: protocol, optional chain, template literals)
- convert React value imports to type imports (biome auto-fix)

### Documentation

- sync zod version note to 4.4.3
- update command-annotation comments from eslint to biome
- note src/** noConsole override in baseline
- point lint instructions at bun run lint (biome)
- fill in biome baseline with final rule decisions
- correct `bun pm trust` semantics under root ignoreScripts gate

### Chores

- **deps** — upgrade @nocoo/base-mcp 0.1.1 → 0.2.0
- **worker** — remove unused MCP dependencies
- **deps** — unify zod on 4.4.3 across the tree
- **deps** — upgrade typescript to ^7.0.2 (+ @typescript/native-preview for next build)
- remove dead lint-staged config and dependency
- remove stale eslint-disable comments
- **deps** — remove eslint and all eslint plugins
- **lint** — resolve remaining biome findings
- **deps** — bump postcss 8.5.17 → 8.5.18
- **deps** — bump hono 4.12.29 → 4.12.30
- **deps** — bump @eslint-react/eslint-plugin 5.14.5 → 5.14.6
- **deps** — bump @cloudflare/workers-types 5.20260711.1 → 5.20260712.1 in worker
- **lint** — switch biome indent to 2 spaces + tailwind directives
- **deps** — add @biomejs/biome@2.5.3 devDep
- **lint** — add biome configs alongside eslint
- **deps** — bump @cloudflare/workers-types 5.20260710.1 → 5.20260711.1 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.14.1 → 5.14.5
- **deps** — bump postcss 8.5.16 → 8.5.17
- **deps** — bump @cloudflare/workers-types 5.20260708.1 → 5.20260710.1 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.13.2 → 5.14.1
- **deps** — bump eslint 10.6.0 → 10.7.0
- **deps** — bump hono 4.12.28 → 4.12.29
- **deps** — bump wrangler 4.107.1 → 4.110.0 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.12.1 → 5.13.2
- **deps** — bump lucide-react 1.23.0 → 1.24.0
- **deps** — bump @eslint-react/eslint-plugin 5.11.2 → 5.12.1
- **deps** — bump @types/node 26.1.0 → 26.1.1
- **deps** — bump @cloudflare/workers-types 5.20260706.1 → 5.20260708.1 in worker
- **deps** — bump wrangler 4.107.0 → 4.107.1 in worker
- remove obsolete one-shot scripts
- drop hardcoded token fallback in migrate script
- **deps** — bump hono 4.12.27 → 4.12.28
- **deps** — bump typescript-eslint 8.62.1 → 8.63.0
- **deps** — bump radix-ui 1.6.1 → 1.6.2
- **deps** — bump vitest 4.1.9 → 4.1.10
- **deps** — bump @vitest/coverage-v8 4.1.9 → 4.1.10
- **deps** — bump @cloudflare/workers-types 5.20260705.1 → 5.20260706.1 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.10.4 → 5.11.2
- **deps** — bump @cloudflare/workers-types 5.20260704.1 → 5.20260705.1 in worker
- **deps** — bump @cloudflare/workers-types 5.20260703.1 → 5.20260704.1 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.10.3 → 5.10.4
- **deps** — bump recharts 3.9.1 → 3.9.2
- **deps** — bump @cloudflare/workers-types 4.20260702.1 → 5.20260703.1 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.10.1 → 5.10.3
- **deps** — bump @cloudflare/workers-types 4.20260701.1 → 4.20260702.1 in worker
- **deps** — bump wrangler 4.106.0 → 4.107.0 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.10.0 → 5.10.1
- add root .npmrc for supply chain security baseline
- **deps** — bump next 16.2.9 → 16.2.10
- **deps** — bump lucide-react 1.22.0 → 1.23.0
- **deps** — bump @types/node 26.0.1 → 26.1.0
- **deps** — bump @next/eslint-plugin-next 16.2.9 → 16.2.10
- **deps** — bump @cloudflare/workers-types 4.20260630.1 → 4.20260701.1 in worker
- **deps** — upgrade dependencies (batch 2026-07-01) (#160)
- **deps** — upgrade dependencies (batch 2026-06-30) (#155)
- **deps** — bump postcss 8.5.15 → 8.5.16 (deps + overrides)
- **deps** — bump lucide-react 1.21.0 → 1.22.0
- **deps** — bump eslint-plugin-import-x 4.17.0 → 4.17.1
- **deps** — bump @eslint-react/eslint-plugin 5.9.5 → 5.10.0
- **deps** — bump @cloudflare/workers-types 4.20260626.1 → 4.20260628.1 in worker
- **deps** — bump @cloudflare/workers-types 4.20260625.1 → 4.20260626.1 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.9.3 → 5.9.5
- **deps** — bump eslint 10.5.0 → 10.6.0
- **deps** — bump @cloudflare/workers-types 4.20260624.1 → 4.20260625.1 in worker
- **deps** — bump wrangler 4.104.0 → 4.105.0 in worker
- **deps** — bump @eslint-react/eslint-plugin 5.9.2 → 5.9.3
- **deps** — bump @types/node 26.0.0 → 26.0.1
- **deps** — bump @cloudflare/workers-types 4.20260623.1 → 4.20260624.1 in worker
- **deps** — bump wrangler 4.103.0 → 4.104.0 in worker
- **deps** — bump recharts 3.8.1 → 3.9.0
- **deps** — bump hono 4.12.26 → 4.12.27 in root + worker (incl. overrides)
- **deps** — bump @playwright/test 1.61.0 → 1.61.1
- **deps** — bump @cloudflare/workers-types 4.20260621.1 → 4.20260623.1 in worker
- **deps** — bump globals 16.4.0 → 17.7.0
- **deps** — bump lint plugins (patch+minor)
- **lint** — drop suppressions for non-existent @eslint-react rule ids

### CI

- bump base-ci to v2026.6 and re-enable worker tests
- enable worker tests and allowlist native postinstall

### Style

- sort imports with biome assist
- format entire codebase with biome

## [2.3.5] - 2026-06-22

### Features

- **deploy** — migrate from appleboy/ssh-action to in-house ssh-deploy@v2026.5

### Fixes

- **security** — also pin undici in worker overrides to 7.28.0
- **security** — pin undici to 7.28.0 to clear GHSA-pr7r-676h-xcf6 / GHSA-vmh5-mc38-953g
- **deps** — add esbuild override to worker subpackage for CVE fix

### Tests

- **ci** — add release.yml smoke test job (actionlint + SHA-pin assertions)
- **l3** — restructure e2e to e2e/bdd, rewrite to BDD smoke test

### Chores

- **lint** — fix findings from the @eslint-react + jsx-a11y + import-x adoption
- **deps** — upgrade eslint 9 → 10, replace eslint-config-next
- **deps** — bump @cloudflare/workers-types 4.20260620.1 → 4.20260621.1 in worker
- **deps** — bump @cloudflare/workers-types 4.20260619.1 → 4.20260620.1 in worker
- **deps** — bump lint-staged 17.0.7 → 17.0.8
- **deps** — bump @types/node 25.9.3 → 26.0.0 (major)
- **deps** — bump wrangler 4.101.0 → 4.103.0 in worker
- **deps** — bump @cloudflare/workers-types 4.20260617.1 → 4.20260619.1 in worker
- **deps** — bump lucide-react 1.20.0 → 1.21.0
- **deps** — bump hono 4.12.25 → 4.12.26
- **ci** — pin base-ci reusable workflow to v2026.5 SHA
- **deps** — bump @cloudflare/workers-types 4.20260616.1 → 4.20260617.1 (#104)
- **deps** — bump wrangler 4.100.0 → 4.101.0
- **deps** — bump lucide-react 1.18.0 → 1.20.0
- **deps** — sync security overrides into worker package
- **deps** — bump worker devDependencies
- **deps** — bump root devDependencies
- **deps** — fix transitive security advisories (ws, vite, @babel/core)
- **worker** — bump better-sqlite3 12.10.0 → 12.10.1
- **deps** — bump @cloudflare/workers-types in worker 4.20260611.1 → 4.20260613.1
- **deps** — bump lucide-react 1.17.0 → 1.18.0
- **deps** — bump tailwindcss and @tailwindcss/postcss 4.3.0 → 4.3.1

### CI

- enable L3 BDD in CI via base-ci
- enable L3 Playwright E2E tests in CI

## [2.3.4] - 2026-06-13

### Features

- **plan-calendar** — replace day dots with informative colored banners

### Fixes

- **capital** — split unit edits into diff payloads to honor productId-alone rule
- **plan-calendar** — banner amount uses text-foreground for WCAG AA
- **plan-calendar** — keyboard bubbling + banner contrast
- **overview** — show recent transactions for selected year
- **deps** — override esbuild ^0.28.1 to clear OSV advisories

### Refactoring

- **client** — drop targetDb param + X-Target-DB header
- **worker** — drop DB_TEST binding and X-Target-DB routing

### Documentation

- record retirement of noheir-db-test + X-Target-DB

### Tests

- **e2e** — pin L2 port to 17004 per the personal port plan
- **e2e** — runner owns wrangler lifecycle, switch to bun test
- **e2e** — use BASE_URL helper instead of hardcoded 127.0.0.1:8787
- **e2e** — boot wrangler dev --local in runner, drop X-Target-DB

### Chores

- **worker** — pin manual dev port to 37004
- **deps** — worker wrangler ^4.99.0 → ^4.100.0
- **deps** — worker @cloudflare/workers-types ^4.20260610.1 → ^4.20260611.1
- **deps** — esbuild ^0.28.0 → ^0.28.1
- **deps** — worker @cloudflare/workers-types ^4.20260608.1 → ^4.20260610.1
- **deps** — worker wrangler ^4.98.0 → ^4.99.0
- **deps** — hono ^4.12.24 → ^4.12.25 (root + worker)
- **deps** — @types/node ^25.9.2 → ^25.9.3
- **deps** — next 16.2.8 → 16.2.9
- **deps** — eslint-config-next ^16.2.7 → ^16.2.9
- **deps** — upgrade next to 16.2.8
- **deps** — worker hono override 4.12.24 (security)
- **deps** — hono ^4.12.23 → ^4.12.24 (security)

## [2.3.3] - 2026-06-08

### Features

- **plan** — flip FEATURE_PLAN_CALENDAR to true (P3-C11)
- **plan** — /plan/calendar page + composition shell (P3-C10)
- **plan** — /plan/categories page + client shell (P3-C9)
- **plan** — RuleList — interactive rule list with status menus (P3-C8)
- **plan** — DayDetailPopover — modal listing a day's occurrences (P3-C7)
- **plan** — PlanSummaryCards — three-window KPI cards (P3-C6)
- **plan** — PlanCalendar — month view with occurrence dots (P3-C5)
- **plan** — RecurringExpenseForm — create/edit recurring rules (P3-C4)
- **plan** — CategoryForm — create/edit expense category (P3-C3)
- **plan** — FrequencyPicker — coupled recurrence-shape picker (P3-C2)
- **plan** — ColorTokenPicker — 24-token closed-set color picker (P3-C1)
- **actions** — pause/resume/end state-machine actions (P2-C9)
- **actions** — recurring-expense CRUD Server Actions (P2-C8)
- **actions** — expense-category Server Actions (P2-C7)
- **client** — WorkerDbClient methods for category + recurring (P2-C5+C6)
- **domain** — mappers + format helpers + reviewer housekeeping (P2-C4)
- **domain** — sumWindow + sumMonth + sumNextDays (P2-C3)
- **domain** — computeOccurrences pure function (P2-C2)
- **types** — RecurrenceRule + Zod input/update schemas (P2-C1)
- **worker** — recurring-expenses SQL endpoints + status guard (P1-C6)
- **worker** — expense-categories SQL endpoints (P1-C5)
- **worker** — recurring_expenses repository (P1-C4)
- **worker** — expense_categories repository (P1-C3)
- **db** — add 0007_recurring_expenses migration (P1-C2)
- **schema** — add expense_categories + recurring_expenses tables (P1-C1)

### Fixes

- **plan** — router.refresh after mutations (P3-C9/C10 fix)
- **plan** — status chip shows date + 已到期 not 已过期 (P3-C8 fix)
- **plan** — switch DayDetailPopover to Radix Dialog (P3-C7 fix)
- **plan** — clamp number inputs + weekday keyboard nav (P3-C2 fix)
- **actions** — legal state-transition guard for pause/resume/end (P2-C9 fix)

### Documentation

- **plan** — release smoke checklist + automated gate results (P3-C12)
- **plan** — tighten Phase 1/3 atomic plan after review v2
- **plan** — expand Implementation Phases to atomic commit plan
- **plan** — align success criterion #4 with unified occurrence ceiling
- **plan** — unify occurrence ceiling so endDate also caps ended rules
- **plan** — preserve historic occurrences after end, fix two corner cases
- **plan** — align 002 spec with worker convention and tighten semantics
- **plan** — add 002 spec for recurring expense calendar

### Tests

- **ui** — add RTL + jsdom infra for Phase 3 component tests (P3-C0)
- **worker** — status/endedAt guard regression suite (P1-C7)

### Chores

- **deps** — lucide-react ^0.577.0 → ^1.17.0; inline GithubIcon
- **deps** — lint-staged ^16.4.0 → ^17.0.7
- **deps** — typescript ^5.9.3 → ^6.0.3
- **deps** — @types/node ^20.19.37 → ^25.9.2
- **worker/deps** — compat bumps across @nocoo/base-mcp, hono, zod, dev tools
- **deps** — esbuild ^0.27.4 → ^0.28.0
- **deps** — radix-ui ^1.4.3 → ^1.5.0; pin zod to 4.3.6
- **navigation** — add 资金计划 NavGroup behind FEATURE_PLAN_CALENDAR=false (P2-C10)

## [2.3.2] - 2026-06-06

### Features

- **unit-editor** — add product link and investment timeline visualization

### Fixes

- **version** — read APP_VERSION from package.json instead of hardcoding
- **ci** — use full tsc --noEmit in pre-commit instead of incremental --build
- **deps** — add ws@8.20.1 override to resolve CVE

### Chores

- **deps** — bump @playwright/test to 1.60.0
- **deps** — bump tailwindcss and @tailwindcss/postcss to 4.3.0
- **deps** — bump tailwind-merge to 3.6.0
- **deps** — bump echarts to 6.1.0
- **deps** — bump date-fns to 4.4.0
- **deps** — bump vitest and @vitest/coverage-v8 to 4.1.8
- **deps** — bump @types/react to 19.2.17 and @types/bun to 1.3.14
- **deps** — bump react and react-dom to 19.2.7
- **deps** — bump postcss to 8.5.15
- **deps** — bump hono to 4.12.23
- **deps** — bump qs to 6.15.2
- **deps** — upgrade next to 16.2.7
- **deps** — declare trustedDependencies for ignore-scripts compatibility
- **ci** — bump base-ci to v2026.2 with ignore-scripts: true
- **deps** — align eslint-config-next to 16.2.6
- use VPS_PORT secret for SSH deploy port (jp2 SSH 22→52722)
- **deps** — upgrade next to 16.2.6

### CI

- **security** — bump base-ci to v2026.4 with extra-install-dirs=worker (Shai-Hulud defense)

## [2.3.1] - 2026-05-09

### Features

- **products** — add cyclic lock mechanism for periodic open/lock windows
- **warehouse** — use availability color for card background, strategy color for left line

### Fixes

- **deps** — override fast-uri to 3.1.2 to resolve GHSA-q3j6 and GHSA-v39h
- **cyclic-lock** — correct availableDate semantics, validation, and API response
- **warehouse** — make card grid columns scale down more gradually
- **lint** — add coverage/ to eslint globalIgnores
- **worker** — restore vitest.config.ts mistakenly removed in 115c4be
- **deps** — upgrade hono to fix CVEs (GHSA-69xw, GHSA-9vqf)
- **deps** — override ip-address to 10.2.0 to resolve GHSA-v2v4-37r5-5v8g

### Documentation

- fix test commands and add worker unit test layer in CLAUDE.md
- update test references from bun test to vitest

### Tests

- **src** — migrate src/__tests__ from bun:test to vitest

### Chores

- remove orphaned vitest sub-configs superseded by root config
- **worker** — migrate tests from bun:test to vitest
- **scripts** — drop bun-based check-coverage in favor of vitest --coverage
- **test** — add vitest with @vitest/coverage-v8 and 95% thresholds

## [2.3.0] - 2026-04-29

### Features

- **mcp** — enhance get_product with linked units info
- **mcp** — add get_product_portfolio tool
- **mcp** — add product_id filter and response to list_units
- **mcp** — apply unified envelope to all browse tools
- **mcp** — add envelope types and product resolver
- **worker** — add /api/live with D1 probe, surety standard
- **web** — upgrade /api/live to surety standard
- **scripts** — add automated release script
- **api** — add GET /api/live health check endpoint (#7)

### Fixes

- **mcp** — use SQL aggregate for portfolio summary when truncated
- **mcp** — address review findings
- **proxy** — mark /api/live as public
- **ui** — prevent wrapping in fixed-width capital table columns
- **ui** — keep badges on a single line in tables
- **proxy** — allow /api/auth/* through middleware
- resolve OSV vulnerability and clean unused ignores
- correct logo path in README
- **ui** — use B05 background tokens for table bg-muted
- **worker/db** — add is_archived migration for fresh envs
- **ui** — align bg-card usage to B05 luminance spec
- **tests** — assert concrete order in sort-by-type test
- **tests** — scope mcp-tokens mock.module so it does not leak
- **mcp/query** — apply tags filter via JSON LIKE patterns
- **ui** — remove shadow-sm/shadow-md from non-overlay components
- **ui** — replace basalt anti-patterns in form components
- resolve TypeScript 'possibly undefined' errors in release script
- **deps** — upgrade hono (4.12.14 not yet on npm, ignore CVE)
- **ci** — 迁移到 base-ci@v2026，禁用缺失的 L2 E2E

### Refactoring

- **mcp** — remove deprecated pagination fields
- **worker** — unify WORKER_SECRET/WORKER_SHARED_SECRET to WORKER_TOKEN
- **db** — unify WORKER_SECRET to WORKER_TOKEN in Next.js side

### Documentation

- **mcp** — clarify truncation behavior in portfolio description
- add MCP agent-friendly improvement plan
- **mcp** — standardize tool descriptions
- **claude** — refresh deployment overview, log /api/auth middleware lesson
- **readme** — point production-deploy section at new run guide
- **run** — rewrite deployment guide for self-hosted Docker + GHCR

### Tests

- **e2e** — make L2 runner CI-aware via WORKER_URL/WORKER_SECRET
- **noheir** — boost mcp-tokens, mcp/query, mcp/unit coverage
- **mcp-auth** — cover validateMcpToken with mocked dependencies
- **capital-dashboard** — cover availability buckets and buildStrategyChartData
- **liquidity-ladder** — cover buildUpcomingUnits with various edge cases
- **account-detail** — cover buildAccountType, anchors, sort by type/category, edge cases
- **transaction-mappers** — cover toDomainTransfer and buildMonthlyData
- **year-comparison** — cover buildYearVsYearData and buildMonthVsMonthData branches

### Chores

- **git** — ignore worker/.dev.vars
- **deps** — bump hono override 4.12.12 -> 4.12.14 (GHSA-458j-xx4x-4375)
- remove stale hono CVE ignores from osv-scanner.toml

### CI

- add Release workflow — auto CD to jp2 after CI passes
- upgrade base-ci to v2026.1
- enable L2 API E2E job
- ignore GHSA-458j-xx4x-4375 hono medium CVE

### Build

- **docker** — use port 7004 to align with local dev
- **docker** — drop WORKER_* build-time placeholders

## [2.2.2] - 2026-04-12

MCP query bug fix and comprehensive L1 test coverage for MCP utilities.

### Fixes

- **query_transactions date filtering** — Fixed bug where date/amount/keyword filters were silently ignored due to missing field mappings

### Tests

- **MCP L1 Unit Tests** — 88 new unit tests for MCP pure functions:
  - `compact.test.ts` — 26 tests for round2, compact, shortId, compactArray, categoryPath, currencyCode
  - `types.test.ts` — 9 tests for ok/error helpers
  - `unit-availability.test.ts` — 16 tests for enrichWithAvailability with Date mocking
  - `auth.test.ts` — 17 tests for extractBearerToken, validateOrigin
  - `query-where-conditions.test.ts` — 20 tests for buildWhereConditions + regression test

### Refactoring

- Export helper functions from MCP modules for testability
- Remove unused mock-db.ts

## [2.2.1] - 2026-04-10

CI/CD setup and security fixes.

### Features

- **GitHub Actions CI** — Added CI workflow with base-ci@v2026
- **Gitleaks Integration** — Security scanning with allowlist for test fixtures

### Fixes

- **get_unit tool** — Support unit_code parameter in MCP get_unit tool
- **Worker endpoints** — Remove default limit on units/products endpoints
- **CVE fixes** — Update hono, @hono/node-server, next to address security vulnerabilities

## [2.2.0] - 2026-04-07

MCP server upgrade to base-mcp framework with OAuth 2.1 + Streamable HTTP transport, plus comprehensive E2E test coverage.

### Features

- **MCP OAuth 2.1** — Full OAuth 2.1 authentication with PKCE for secure MCP access
- **Streamable HTTP Transport** — Replaced stdio-based MCP with HTTP transport for better integration
- **base-mcp Framework** — Migrated MCP implementation to @nocoo/base-mcp@0.1.0 for cleaner entity/tool registration

### Tests

- **MCP E2E Test Suite** — 63 E2E tests covering all 16 MCP tools:
  - Product tools: list, get, create, update
  - Unit tools: list, get, create, update  
  - Query tools: query_transactions, query_transfers, get_summary, get_monthly_report
  - Summary tools: get_products_summary, get_units_summary
  - Delete tools: delete_product, delete_unit
- **OAuth Token Helper** — `mcp-auth.ts` enables E2E testing without browser login
- **D1 Test Isolation** — X-Target-DB header support for isolated test database

### Architecture

- **MCP Settings Page** — OAuth client registration with manual token copy flow
- **Worker MCP Integration** — MCP server embedded in Cloudflare Worker at `/mcp/*` routes

## [2.1.0] - 2026-04-06

MCP server optimization with progressive disclosure, summary tools, and context-efficient field selection.

### Features

- **MCP Summary Tools** — New `get_units_summary` and `get_products_summary` tools for lightweight aggregation without fetching raw data
- **Field Selection** — `list_units` and `list_products` now support `fields` parameter with presets: `minimal` (~100B/unit), `standard` (~180B/unit), `full` (~450B/unit)
- **Availability Filter** — `list_units` supports `available_within_days` parameter for server-side filtering of upcoming available units
- **Pagination** — Both list tools support `limit`/`offset` pagination (default: 50, max: 200)
- **Product Archive Support** — `list_products` now exposes `include_archived` parameter
- **Contribution Logs** — Full lifecycle logging for capital unit investments with auto-logging on unit operations
- **Availability System** — Computed availability dates based on `latestInvestLog.operationDate + product.lockPeriodDays`
- **Product Archive** — Archive products instead of delete, with isArchived filter support

### Improvements

- **MCP Tool Descriptions** — Rewrote all tool descriptions following six-component framework (Purpose, Guidelines, Limitations, Parameters, Length, Examples)
- **Progressive Disclosure Pattern** — Summary → Filtered List → Single Item workflow reduces context consumption from 20-50KB to <2KB
- **Nullable Field Handling** — MCP tools properly convert string "null" to JSON null for nullable parameters
- **Pagination Stability** — Consistent `ORDER BY desc(createdAt)` across all list queries

### UI/UX

- **Availability Status Colors** — Green for available (≤0 days), Amber for soon (1-30 days), Red for locked (>30 days)
- **Unified Domain Badges** — Consistent badge styling for unitCode, strategy, tactics, status, currency, product across all pages
- **Warehouse Filters** — Channel and product filters with localStorage persistence
- **Liquidity Page** — Collapsible month sections with upcoming units table
- **UnitEditor Component** — Unified dialog for creating/editing units with product association
- **Comparison Charts** — Year/month pickers with standardized bar charts

### Architecture

- **Worker Summary Endpoints** — `GET /api/units/summary` and `GET /api/products/summary` for aggregated statistics
- **Availability Computation** — Server-side computation in `worker/lib/availability.ts`
- **Contribution Logs Schema** — New `contribution_logs` table tracking invest/recall/adjust operations

### Tests

- 686 tests passing (unit + Worker E2E + MCP)
- New E2E tests for summary endpoints, field presets, pagination, and availability filters

## [2.0.0] - 2026-04-02

Major architecture migration from Supabase to Cloudflare D1 + Worker, with restored settings functionality and improved dashboard experience.

### Breaking Changes

- **Backend Migration** — Migrated from Supabase (PostgreSQL) to Cloudflare D1 (SQLite) + Worker API
- **Auth System** — Switched from Supabase Auth to custom Worker-based authentication
- **API Routes** — Complete RESTful API redesign with resourceful paths

### Features

- **Settings Restoration** — Full settings functionality restored from legacy system:
  - Color scheme toggle (green/red income/expense swap)
  - Theme mode selector (light/dark/system)
  - Income category classification (active vs passive)
  - Expense category classification (fixed vs flexible)
  - Return rate range settings with visual indicator
  - Balance anchor management
  - MCP configuration with full credential support
- **UI Components** — New Slider and Alert components (shadcn/ui Radix-based)
- **Server Actions** — New settings actions: `saveThemeSettings`, `saveActiveIncomeCategories`, `saveFixedExpenseCategories`, `saveReturnRateSettings`, `saveBalanceAnchors`
- **Category Settings Page** — New `/category-settings` route for income/expense classification
- **Balance Anchors Page** — New `/balance-anchors` route for balance anchor management
- **Zod Validation** — Added Zod schemas for products/units enum constraints
- **Month Filter** — Category summary endpoint now supports month filtering

### Improvements

- **Color Scheme Switching** — CSS variable-based color switching for income/expense colors across all pages
- **Chart Focus Fix** — Removed ugly blue focus outline on Recharts chart elements
- **CSS Variables** — Replaced hardcoded Tailwind colors (emerald/rose) with semantic CSS variables (text-income/text-expense)
- **API Naming** — Resourceful year-scoped paths for transactions and transfers
- **Backup Integrity** — Added `findAllByUser()` for backup to prevent silent data truncation
- **Server-Side Aggregation** — Dashboard now uses server-side aggregation APIs instead of client-side

### Fixes

- Align product/unit action payloads with Worker camelCase schema
- Parse tags JSON string from Worker response
- Correct MCP WorkerClient API paths to match Worker routes
- Add HOSTNAME=0.0.0.0 to bind to all interfaces
- Simplify Dockerfile and remove healthcheck for Railway
- Change default PORT to 8080 for Railway compatibility
- Normalize 404 response format across all GET-by-id endpoints
- Align domain mappers to Drizzle camelCase field names

### Architecture

- **D1 Backend** — SQLite-based serverless database on Cloudflare
- **Worker API** — Cloudflare Worker handling all API requests
- **Migration Script** — Supabase → D1 migration for products and units
- **WorkerClient** — New API client with proper path verification

### Tests

- 267 unit tests (all passing)
- WorkerClient unit tests for API path verification
- Export route regression guards (structural shape + multi-row count)

## [0.2.0] - 2026-03-06

First official release. Covers the full journey from initial Next.js scaffold to a production-ready personal finance analytics app with an AI-integrated MCP server.

### Features

- **Dashboard & Analytics** — Year comparison charts, flow analysis, savings rate, financial freedom metrics, transaction analysis, and an AI insight dashboard
- **Basalt UI System** — Full visual overhaul with 3-tier luminance palette, Inter/DM Sans typography, matte card styling, themed light/dark logo, and CSS-variable color tokens
- **Theme Support** — Dark/light mode toggle with FOUC prevention and system theme listener across all pages (login, dashboard, loading, terms, privacy)
- **MCP Server** — stdio-transport MCP server with 12 tools: 4 read-only query tools (`get_summary`, `query_transactions`, `query_transfers`, `get_monthly_report`) and 8 CRUD tools for financial products and capital units
- **MCP Auth** — Email/password-based auth with auto-refresh tokens for reliable long-running sessions
- **Data Management** — Tabbed data management with JSON export/import for transactions, transfers, products, and capital units
- **Asset Management** — Product and capital unit CRUD with deployment, recall, and archive lifecycle support
- **Supabase Backend** — Full schema with RPC functions, Row Level Security, consolidated migrations, and local dev config
- **E2E Test Suite** — 59 E2E tests covering auth, transactions, transfers, settings, products, units, RPC, and RLS security
- **MCP Test Suite** — 168 MCP tests (51 unit + 38 integration + 59 tool handler + 20 protocol-level)
- **Unit Test Suite** — 327 unit tests across domains, viewmodels, contexts, hooks, lib, and services
- **Tab History Routes** — Route-based tab navigation with history support
- **Command Palette** — Dashboard command palette for quick navigation
- **Version System** — Auto-generated version with git hash, commit count, and branch info

### Dependency Upgrades (Phase 1 & 2)

- **tailwind-merge** 2 → 3 (500x perf improvement)
- **date-fns** 3 → 4 (ESM-first, timezone support)
- **vaul** 0.9 → 1.1
- **next-themes** 0.3 → 0.4
- **sonner** 1 → 2 (multi-toaster support)
- **lucide-react** 0.462 → 0.577
- Batch minor/patch updates: supabase-js, framer-motion, react-hook-form, tailwindcss, @tailwindcss/vite, @types/node, bun-types, happy-dom, typescript-eslint, @eslint/js, eslint, @modelcontextprotocol/sdk

### Architecture

- Migrated from Next.js to Vite + React + shadcn/ui
- Migrated from Tailwind CSS v3 to v4 with @tailwindcss/vite
- MVVM pattern with dedicated viewmodels for each analytics domain
- Two-layer test environment isolation (.env.test + preload setup)
- Git hooks: pre-commit (unit tests), pre-push (unit + lint + E2E/MCP)
