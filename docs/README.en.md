<p align="center">
  <img src="../assets/brand/icon-rounded.png" alt="Noheir logo" width="128" height="128" />
</p>

<h1 align="center">Noheir</h1>

<p align="center">Organize personal transactions, accounts and capital to review cash flow, allocation and availability.</p>

<p align="center">
  <a href="https://noheir.hexly.ai">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

## What it does

Noheir is a personal finance web application. Import income, expense and transfer records to analyze cash flow by year, account and category. Capital units and product tables record where money is allocated, investments and redemptions, returns and availability dates.

The current application uses Next.js for pages, sign-in and MCP endpoints, with a Cloudflare Worker accessing D1. The site uses Google sign-in and an email allowlist. Users import or maintain the data; automatic bank-account synchronization is not implemented.

## Features

- Review income, expenses, savings rate, account flows, period comparisons and financial health indicators.
- Manage capital units, financial products and investment / redemption logs, with strategy, warehouse and liquidity views.
- Maintain recurring expenses and categories, and see expected dates in a planning calendar.
- Import Chinese CSV files in the supported format and preview parsing results. Export or restore JSON backups through Data Management.
- Identify recurring expenses and upcoming payments from past transactions. The current “AI Insights” page uses rules. AI Settings can store model configuration, but the insights flow does not call a language model.
- Query transactions, summaries and product-linked capital through MCP, and create, update or delete products and capital units. MCP accesses data under the authorized user's identity.

## Usage

### Web application

Open the [website](https://noheir.hexly.ai) and sign in with an allowlisted Google account. A separate deployment needs its own OAuth application, email allowlist and Worker database connection.

Start with Data Import, choosing either income / expense transactions or transfers. CSV files must use the Chinese headers shown on that page and contain one year of records at a time. Confirming an import replaces that user's existing records of the same type and year. Export a backup from Data Management before importing.

Maintain categories and calculation parameters in Account Settings and General Settings. Record existing capital in the product and capital-unit tables. Recurring expenses in the planning calendar are maintained separately by the user.

JSON exports include transactions, transfers, products, capital units and settings. Restore currently handles only transactions and transfers, replacing those records across all years for the user. It does not restore products, capital units or settings. Investment logs and recurring expenses are not included in exports yet.

### MCP

After signing in, open MCP Configuration and copy the setup for your client. The current endpoint is:

```text
https://noheir.hexly.ai/api/mcp
```

It supports Streamable HTTP and browser-based OAuth authorization. An example HTTP client configuration from the page:

```json
{
  "mcpServers": {
    "noheir": {
      "type": "http",
      "url": "https://noheir.hexly.ai/api/mcp"
    }
  }
}
```

Complete Google sign-in and authorization on the first connection. Replace the URL for your own deployment. The current transport returns JSON over POST and does not provide an SSE stream. Exact configuration syntax depends on the client.

## Development

Install Bun and Node.js 22.12+, preferably an LTS version supported by the test tools. The root application and `worker/` install dependencies separately:

```bash
git clone https://github.com/nocoo/noheir.git
cd noheir
bun install --frozen-lockfile
cd worker
bun install --frozen-lockfile
bunx wrangler d1 migrations apply noheir-db --local
cd ..
cp .env.example .env.local
```

`.env.example` points to the maintainer's production Worker by default. To use local D1, change `WORKER_URL` in `.env.local` to `http://127.0.0.1:37004`, choose your own `WORKER_TOKEN`, and set the same `WORKER_TOKEN` in `worker/.dev.vars`. Both values must match.

| `.env.local` variable | Purpose |
| --- | --- |
| `WORKER_URL` / `WORKER_TOKEN` | Worker address and shared credential |
| `AUTH_SECRET` | Session signing secret; generate one with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application URL, locally `http://localhost:7004` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credentials for your Google OAuth application |
| `ALLOWED_EMAILS` | Comma-separated sign-in email allowlist |
| `ALLOWED_DEV_ORIGINS` | Optional allowed hosts for a development reverse proxy |

Add `http://localhost:7004/api/auth/callback/google` as a callback URL in your Google OAuth application. Local pages still require sign-in. The first sign-in writes the user's identity to the connected D1 database.

Start these processes in separate terminals:

```bash
# Terminal one: local Worker on port 37004
bun run --cwd worker dev
```

```bash
# Terminal two: Next.js on port 7004
bun run dev
```

`bun run build` builds the application and `bun run start` runs the built site. Use `bun run typecheck`, `bun run worker:typecheck` and `bun run lint` for types and code style.

```text
src/app/             Next.js pages, Server Actions, sign-in and MCP routes
src/domain/          Cash-flow, capital, import and settings calculations
src/lib/mcp/         MCP tools, authentication and data access
src/components/      Charts, tables and interactive components
worker/src/          Hono business API and SQL endpoints
worker/db/           Drizzle schema, repositories and D1 migrations
```

The production site uses a Docker standalone build and deploys to a VPS after successful CI. See [running and deployment](04-run.md) for its reverse proxy and environment setup. The Worker publishes separately with the `deploy` script in `worker/` and needs its own D1, domain and `WORKER_TOKEN`. Automatic site deployment does not update the Worker.

## Tests

Run from the repository root:

| Layer | Command |
| --- | --- |
| Application unit and component tests | `bun run test` |
| Worker unit tests | `bun run test:worker` |
| Worker HTTP integration tests | `bun run test:e2e` |
| Browser smoke test | `bun run test:e2e:bdd` |

Install dependencies at both the root and in `worker/` first. Worker unit tests use local SQLite and require a working `better-sqlite3` native module. HTTP tests rebuild the separate `worker/.wrangler/state-e2e/` directory, apply migrations and start a local Worker on port `17004` by default. Override the port with `E2E_PORT`.

For the browser test, first run `bunx playwright install chromium`. The test starts Next.js on port `27004`. It currently checks only the public terms page and does not cover signed-in finance workflows. Use `bun run test:coverage` for an application coverage report.

## Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Bun](https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white)
![D1](https://img.shields.io/badge/D1-F38020)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)
![MCP](https://img.shields.io/badge/MCP-222222)

| Area | Implementation |
| --- | --- |
| Web | Next.js App Router, React, Tailwind CSS and Radix UI |
| Charts | Recharts and Nivo Sunburst |
| Sign-in and MCP | Auth.js / NextAuth, Google OAuth and MCP SDK |
| Services and data | Cloudflare Workers, Hono, D1 and Drizzle ORM |
| Runtime and deployment | Bun, Docker, GitHub Container Registry and a VPS |
| Tests | Vitest, React Testing Library, jsdom, Playwright and SQLite |

Dependency versions are recorded in the [root package.json](../package.json), [Worker package.json](../worker/package.json) and their respective `bun.lock` files.

## Documentation

- [Documentation index](README.md)
- [Running and deployment](04-run.md)
- [Investment and redemption logs](17-contribution-logs.md)
- [MCP OAuth and Next.js architecture](20-mcp-oauth-nextjs-architecture.md)
- [MCP queries and tool design](21-mcp-agent-friendly-improvement.md)
- [Recurring expense calendar](002-recurring-expense-calendar.md)
- [Logo usage](../assets/brand/README.md)

Earlier documents include historical Supabase, Vite and Worker-hosted MCP designs. Use this README for current entry points and commands.

## License

The repository does not contain a license file or declare an open-source license in its package manifests.
