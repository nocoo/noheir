# Noheir documentation

Start with the [project README](../README.md) and [project rules](../AGENTS.md).

| Document | Scope |
| --- | --- |
| [04-run](04-run.md) | Native Workers development, Access/MCP, CI/CD, rollback and cleanup |
| [23-workers-migration](23-workers-migration.md) | Architecture, identity invariants, work ownership, acceptance and deployment evidence |
| [17-contribution-logs](17-contribution-logs.md) | Investment/redemption records |
| [21-mcp-agent-friendly-improvement](21-mcp-agent-friendly-improvement.md) | Tool querying, product links and pagination |
| [22-agent-operations](22-agent-operations.md) | Financial/UI constraints and operational guidance |
| [001-capital-unit-date-refactor](001-capital-unit-date-refactor.md) | Capital dates |
| [002-recurring-expense-calendar](002-recurring-expense-calendar.md) | Recurring expenses and planning calendar |
| [003-unit-commit-and-log-enrichment](003-unit-commit-and-log-enrichment.md) | Atomic capital operations and log enrichment |
| [Logo](../assets/brand/README.md) | Brand assets and provenance |

## Historical architecture

Documents 01–03, 05–16, 18–20 record earlier Supabase, Next.js, Docker and split
Worker designs. In particular, [20-mcp-oauth-nextjs-architecture](20-mcp-oauth-nextjs-architecture.md)
describes the former move into Next.js; its runtime/deployment commands are
superseded by the native Worker migration. Financial semantics and incident
narratives remain useful, but old authentication headers and server paths are
not the current API contract.
