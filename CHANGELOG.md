# Changelog

All notable changes to this project will be documented in this file.

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
