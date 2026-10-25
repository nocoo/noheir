# Operations and UI constraints

Current commands and validation scope are maintained in [AGENTS.md](../AGENTS.md).

## Runtime

Vite assets, Hono business APIs and scoped Bearer REST run in one native Worker with a
D1 binding. Access authenticates humans; verified email resolves the existing
financial user ID. Machine `/api/v1` endpoints authenticate their own scoped keys;
key and site administration remain human-only. Internal model inference and MCP
have been removed; external tools write ordinary private analysis reports.
Never trust browser-supplied user IDs or internal-action headers.

The [runbook](04-run.md) owns deployment, rollback and old-resource cleanup.
Deployments must use the successful CI commit and verify its live build revision.
Public `/api/live` performs a read-only D1 probe and returns version, build SHA,
database status and no-store; dependency failures return a generic 503.

## Basalt integration

The installed `@nocoo/basalt` 3.2.0 artifact is the UI API authority. Configure
the product's Blue preset with `AccentProvider accent="primary" persist={false}`;
ordinary surfaces and controls use the package's `basalt-*` tokens, not a second
application theme. Financial colors and stable domain-label mappings remain
independent from the control accent.

Business routes inherit one persistent route layout, following the installed
template's nesting; `/login` remains outside the workspace shell:

```text
AppShell (workspace)
├── AppSkipLink
├── Sidebar
└── AppMain
    ├── AppHeader
    └── island spacing wrapper
        └── ContentIsland
            └── Outlet / route error boundary
                └── page heading, sections and business content
```

Page components and route errors must not create another AppShell. Sidebar scroll,
collapsed state and open groups survive navigation, query changes and child-loader
failures. Only the ContentIsland is keyed by pathname to reset page scrolling;
query-only changes keep the content instance. The shared layout loader supplies
available years on navigation and revalidation, including after imports. Mobile
navigation closes and restores focus to the persistent header trigger.

Navigation uses public link-capable components: `EditableNavItem` inside
`SidebarNav`, and `NavigationMenuLink asChild` in the collapsed rail. The router
adapter forwards anchor attributes, events and refs. Do not paint selected rows
with `accent` or override native hover; selection must persist while the pointer
highlights another destination. Keep the logo aligned in both rail modes.

Let public controls own focus, selection and surface styling. Application-owned
composites may supply business content, responsive layout and domain colors;
they must not fork generic control styling. Verify light/dark, keyboard focus,
mobile navigation and bounded year selection in Chrome, not only component tests.

The remaining local UI modules are domain-colored badges, a thin inline `cmdk`
container, application-controlled asynchronous confirmation, and a Radix progress
bar that supports indeterminate values. They are not parallel generic themes.
Custom financial chart content uses the public `overlayPanelClass` surface helper;
the package's `chartTooltipContentStyle` only clears the outer Recharts wrapper
and must not be mistaken for a painted tooltip surface.

## Domain labels and availability

### Unified Badge System

All domain labels (unitCode, strategy, tactics, status, currency, product) MUST use the unified Badge components from `src/components/ui/colored-badge.tsx`:

| Data Type                  | Component                            | Color Source         |
| -------------------------- | ------------------------------------ | -------------------- |
| Unit Code (e.g., C10, A01) | `<UnitCodeBadge unitCode={...} />`   | Hash by prefix       |
| Strategy (e.g., 远期理财)  | `<StrategyBadge strategy={...} />`   | `STRATEGY_TOKEN_MAP` |
| Tactics (e.g., 定期存款)   | `<TacticsBadge tactics={...} />`     | `TACTICS_TOKEN_MAP`  |
| Status (e.g., 已成立)      | `<StatusBadge status={...} />`       | `STATUS_TOKEN_MAP`   |
| Currency (e.g., CNY, USD)  | `<CurrencyBadge currency={...} />`   | `CURRENCY_TOKEN_MAP` |
| Product Name               | `<ProductBadge productName={...} />` | Hash by name         |

**Key principle**: The same label (e.g., `C10` or `远期理财`) must display with identical color and style across ALL pages. Never use raw `<Badge>` for domain-specific data.

### Availability Status Colors

| State               | Color           | Label             |
| ------------------- | --------------- | ----------------- |
| Available (≤0 days) | Green           | "已可用" / "可用" |
| Soon (1-30 days)    | Amber           | "N天"             |
| Locked (>30 days)   | Red/Destructive | "锁定中"          |
