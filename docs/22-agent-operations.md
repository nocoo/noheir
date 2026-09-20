# Operations and UI constraints

Current commands and validation scope are maintained in [AGENTS.md](../AGENTS.md).

## Runtime

Vite assets, Hono business APIs and MCP/OAuth run in one native Worker with a
D1 binding. Access authenticates humans; verified email resolves the existing
financial user ID. Machine MCP endpoints authenticate their own tokens.
Never trust browser-supplied user IDs or internal-action headers.

The [runbook](04-run.md) owns deployment, rollback and old-resource cleanup.
Deployments must use the successful CI commit and verify its live build revision.
Public `/api/live` performs a read-only D1 probe and returns version, build SHA,
database status and no-store; dependency failures return a generic 503.

## Domain labels and availability

### Unified Badge System

All domain labels (unitCode, strategy, tactics, status, currency, product) MUST use the unified Badge components from `src/components/ui/colored-badge.tsx`:

| Data Type | Component | Color Source |
|-----------|-----------|--------------|
| Unit Code (e.g., C10, A01) | `<UnitCodeBadge unitCode={...} />` | Hash by prefix |
| Strategy (e.g., 远期理财) | `<StrategyBadge strategy={...} />` | `STRATEGY_TOKEN_MAP` |
| Tactics (e.g., 定期存款) | `<TacticsBadge tactics={...} />` | `TACTICS_TOKEN_MAP` |
| Status (e.g., 已成立) | `<StatusBadge status={...} />` | `STATUS_TOKEN_MAP` |
| Currency (e.g., CNY, USD) | `<CurrencyBadge currency={...} />` | `CURRENCY_TOKEN_MAP` |
| Product Name | `<ProductBadge productName={...} />` | Hash by name |

**Key principle**: The same label (e.g., `C10` or `远期理财`) must display with identical color and style across ALL pages. Never use raw `<Badge>` for domain-specific data.

### Availability Status Colors

| State | Color | Label |
|-------|-------|-------|
| Available (≤0 days) | Green | "已可用" / "可用" |
| Soon (1-30 days) | Amber | "N天" |
| Locked (>30 days) | Red/Destructive | "锁定中" |
