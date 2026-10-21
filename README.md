<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Noheir logo" width="128" height="128" />
</p>

<h1 align="center">Noheir</h1>

<p align="center">Personal cash flow, accounts, capital allocation and availability planning.</p>

<p align="center"><a href="https://noheir.hexly.ai">Website</a> · <a href="docs/README.md">Documentation</a></p>

## What it does

Noheir imports income, expense and transfer records, then analyzes them by year,
account and category. Products, capital units and contribution logs track where
money is invested, returns and availability. Recurring expenses have a planning
calendar. Data is imported or maintained by the owner; there is no automatic bank
synchronization. External tools perform analysis and can write private Markdown
reports back through a scoped REST API. Noheir has no internal model integration.

Production uses Vite/React Router and a native Cloudflare Worker with
Hono, Workers Static Assets and D1. Cloudflare Access handles browser login.
The current source replaces MCP/OAuth with scoped Bearer keys. This refactor is
under local acceptance, not yet published. Historical runtime migration evidence
is recorded in the [migration plan](docs/23-workers-migration.md).

## Use

Open the [website](https://noheir.hexly.ai) and authenticate through Access. Your
verified email must match an existing Noheir user. The original financial user
ID remains unchanged; a new Access identity does not create an empty account.

Import a single year's CSV with the Chinese column names shown in the import
screen. Transaction import replaces that user's income/expense rows for the year;
transfer import replaces that user's transfer rows for the year. Preview the
parsed records before confirming. Replacement is validated server-side and uses
one atomic D1 batch. Export a backup before intentional replacement.

**Backup scope:** JSON export includes transactions, transfers, products, units
only, without raw settings or credentials. Restore replaces only transactions
and transfers across all years. It does not restore products, units or settings. Contribution logs and recurring
expenses are not included in the export. It is not a complete disaster-recovery
backup; operators should also retain a D1 export.

Availability uses the latest investment log or explicit override. Missing
investment history remains unknown. Amounts are stored as integer cents, and
calendar calculations use the established Asia/Shanghai helpers.

## Scoped API and Reports

Create an expiring key on **API Keys**, choose only the required scopes and save
its one-time secret in your tool's secure storage. Read/write/delete grants are
independent. Key administration and site settings remain human-only.

- Base path: `/api/v1`; authentication: `Authorization: Bearer <key>`.
- Human-readable reference: [docs/api.md](docs/api.md). Machine discovery:
  `/api/v1/openapi.json` and `/api/v1/instructions`.
- Page through financial records using `nextCursor`; restart if the dataset
  changes. Currency totals stay separate, with no implicit exchange conversion.
- Mutations require `Idempotency-Key`; updates/deletes also require the version
  read earlier as `If-Match: "version"`. Review conflicts instead of overwriting.
- Write external Markdown analyses with period, currencies, source revision,
  same-owner evidence and optional unverified author/model labels. Reports do not
  execute HTML, load remote images or invoke models.
- Local calls additionally use the active `x-noheir-instance` shown in the key
  page. Local fixture keys are not production keys.

See the [API design and acceptance record](docs/25-scoped-api.md) and
[Access deployment boundary](docs/04-run.md#scoped-rest-and-access).

## Development

CI pins Bun 1.4.2 and Node 26.8.1. Install the root application and Worker test
package, then start the native local Demo runtime:

```sh
git clone https://github.com/nocoo/noheir.git
cd noheir
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run dev
```

Open `https://noheir.dev.hexly.ai`. Local `Demo | E2E | Prod` switching uses
real APIs with persistent synthetic Demo or disposable native D1 fixtures.
Authentication stays active through signed fixture identities. Existing local
data is preserved; production is never an automated test target.
See [environment commands and feature matrix](docs/24-local-environments.md).

本地默认进入持久化 Demo，可切换到每次新建的 E2E。右上角环境切换仅本地显示；
自动化 E2E 由启动器锁定。演示数据全部合成，原本地数据保留，测试不连接生产。

```text
src/app/             Financial pages and typed browser operations
src/routes.tsx       React Router data routes
src/domain/          Financial calculations and view models
src/components/      Basalt controls, charts and tables
worker/src/          Hono financial services, Access and scoped Bearer REST
worker/db/           Schema, repositories and D1 migrations
scripts/             Isolated test fixtures and release/deployment tools
```

## Validation

| Check | Command |
| --- | --- |
| Application unit/component coverage | `bun run test:coverage` |
| Worker unit coverage | `bun run --cwd worker test:coverage` |
| Both TypeScript lanes | `bun run typecheck` |
| Biome | `bun run lint` |
| Production build | `bun run build` |
| Real HTTP and SQLite | `bun run test:e2e` |
| Browser journeys | `bun run test:e2e:bdd` |
| Deployment bundle | `bun run deploy:check` |

Install Chromium with `bunx playwright install chromium` before browser tests.
HTTP tests use port 17004; browser tests use 27004 and the built assets. Each run
creates its own local SQLite database and checks a marker before data writes and
cleanup. HTTP authentication uses locally signed JWTs and an intercepted JWKS;
production Access and D1 are never contacted. Unit coverage retains the four
95% floors in the configured scope; exclusions and current evidence are listed
in [AGENTS.md](AGENTS.md).

## Deployment

Successful main CI triggers the pinned native Worker release workflow. The
workflow verifies the CI source commit and deploys UI/API together. Production
verification checks the exact `build_sha`, root package version, D1 connectivity
and authentication boundaries before release tagging.

GitHub environment `noheir / production` needs `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. `bun run release -- major` is the release entrypoint.
See [deployment, rollback and legacy cleanup](docs/04-run.md) before cutover.
The existing `noheir-db` must not be deleted when retiring the old VPS and Worker.

## Stack

| Area | Implementation |
| --- | --- |
| Web | Vite, React, React Router, Tailwind CSS, Basalt |
| Charts | Recharts, Nivo Sunburst |
| Identity / API | Cloudflare Access, jose, scoped Bearer keys |
| API / storage | Cloudflare Workers, Hono, D1, Drizzle ORM |
| Delivery | Bun, GitHub Actions, Workers Static Assets |
| Tests | Vitest, Testing Library, Playwright, local Miniflare/SQLite |

## Documentation

- [Runbook](docs/04-run.md) and [migration plan](docs/23-workers-migration.md)
- [Project rules and validation scope](AGENTS.md)
- [Contribution logs](docs/17-contribution-logs.md)
- [Scoped API and external reports](docs/25-scoped-api.md)
- [Recurring expense calendar](docs/002-recurring-expense-calendar.md)
- [Logo provenance](assets/brand/README.md)

Earlier numbered documents retain historical architecture and design decisions;
use the runbook and project rules for current commands. This repository currently
contains no license file and declares no open-source license.
