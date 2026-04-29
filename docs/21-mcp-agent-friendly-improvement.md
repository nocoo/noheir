# 21 — MCP Agent-Friendly Improvement Plan

> Improve MCP tools to prevent Agent misjudgment on pagination, provide complete views for common business queries, and standardize the tool system.

**Status**: Draft
**Created**: 2026-04-29
**Linear**: (TBD)

## Problem Statement

Current MCP tools have three Agent-facing issues:

1. **Pagination misjudgment**: `list_products`, `list_units`, `query_transactions`, `query_transfers` return `{ count, limit, offset }` where `count` is current page count, not total. Agents often treat the first page as the complete result.

2. **Missing relationship queries**: `list_units` has no `product_id` filter. To answer "which units are linked to product X?", agents must fetch all units and filter client-side by product name (not even product_id), which is unreliable and wasteful.

3. **No completeness signal**: Agents have no way to know if a result is complete or partial, leading to incorrect conclusions.

## Current MCP Tool Inventory

| Tool | Type | Pagination | Filters |
|------|------|------------|---------|
| `list_products` | Browse | `limit` + `offset` | channel, category, currency, include_archived |
| `get_product` | Detail | — | id (full or short) |
| `create_product` | Write | — | — |
| `update_product` | Write | — | — |
| `list_units` | Browse | `limit` + `offset` | status, strategy, tactics, currency |
| `get_unit` | Detail | — | id or unit_code |
| `create_unit` | Write | — | — |
| `update_unit` | Write | — | — |
| `get_products_summary` | Aggregate | — | — |
| `get_units_summary` | Aggregate | — | — |
| `query_transactions` | Browse | `limit` + `offset` | keyword, type, categories, accounts, tags, date, amount, year, month, currency |
| `query_transfers` | Browse | `limit` + `offset` | keyword, accounts, date, year, month, currency |
| `get_summary` | Metadata | — | include (years, accounts, categories, currencies) |
| `get_monthly_report` | Aggregate | — | year, month, currency |
| `aggregate_transactions` | Aggregate | — | group_by, type, year, month, currency |

## Key Design Decisions

### KD-1: Unified Entity Resolver

All tools accepting entity identifiers MUST use the same resolution logic.

#### Product Resolver

| Identifier | Resolution | Ambiguity Handling |
|------------|------------|-------------------|
| `product_id` (full ULID, 26 chars) | Exact match `id = ?` | — |
| `product_id` (short, ≤8 chars) | Prefix match `id LIKE ?` + `LIMIT 2` | If 2 rows matched → error "Ambiguous short ID, use full ID" |
| `product_name` | Exact match `name = ?` | If multiple rows → error "Multiple products named X, use product_id" |
| `product_code` | Exact match `code = ?` | If multiple rows → error "Multiple products with code X, use product_id" |

**Identifier rules**:
- Exactly one identifier is recommended.
- If multiple identifiers are provided, all must resolve to the same product. If they conflict → error "Conflicting identifiers: product_id points to X but product_name points to Y".
- This prevents masking upstream reasoning errors (e.g., correct ID + wrong name).

#### Unit Resolver

| Identifier | Resolution | Ambiguity Handling |
|------------|------------|-------------------|
| `unit_id` (full ULID) | Exact match `id = ?` | — |
| `unit_id` (short, ≤8 chars) | Prefix match `id LIKE ?` + `LIMIT 2` | Ambiguous → error |
| `unit_code` (e.g., C10, A01) | Case-insensitive exact match `UPPER(unit_code) = UPPER(?)` | — |

### KD-2: Unit Lifecycle Vocabulary

`capital_units` does NOT have an `is_archived` field. Unit state is determined by `status` and `end_date`:

| Status | Description | Filter Behavior |
|--------|-------------|-----------------|
| `已成立` | Active, funds committed | Included by default |
| `已清算` | Closed, funds returned | Included by default |
| `已归档` | Archived (has `end_date`) | Excluded by default |

**Filter naming**: Use `include_archived_units` to mean "include units with status=已归档". The status value is literally `已归档`, so the parameter name matches the domain term. Product `is_archived` and unit `status=已归档` are independent concepts — using the same word for both is acceptable since they refer to different entities.

### KD-3: Unified Envelope Specification

**Conservative approach**: No root-level `ok/data` wrapper. Existing top-level data fields (`units`, `products`, `transactions`, etc.) remain unchanged. New metadata fields (`page`, `completeness`, `next`) are added alongside them.

This minimizes breaking changes — MCP clients that ignore unknown fields will continue to work.

```typescript
// Existing response shape (unchanged):
{ units: [...], count: 50, limit: 50, offset: 0 }

// New response shape (additive):
{
  units: [...],
  // Deprecated (keep for backward compat):
  count: 50,
  limit: 50,
  offset: 0,
  // New metadata:
  page?: PageMeta,
  completeness?: CompletenessMeta,
  next?: NextHint,
}
```

#### Metadata Types

```typescript
interface PageMeta {
  returned: number;    // items in this page
  total: number;       // total matching items in DB
  limit: number;
  offset: number;
  has_more: boolean;   // offset + returned < total
}

interface CompletenessMeta {
  complete: boolean;   // true = this is the full answer
  truncated: boolean;  // true = data was cut off (hard cap)
  total?: number;      // total available (if applicable)
  returned?: number;   // actually returned (if applicable)
}

interface NextHint {
  recommended: "answer" | "paginate" | "narrow" | "related_tool";
  tool?: string;       // suggested next tool name
  args?: Record<string, unknown>; // suggested args
}
```

#### Metadata by Tool Category

| Category | `page` | `completeness` | `next` |
|----------|--------|----------------|--------|
| **Browse** | ✅ (always) | ❌ Not used | ✅ When `has_more=true` |
| **Detail** | ❌ | ✅ `complete=true` | ✅ When related data exists |
| **Portfolio** | ❌ | ✅ (always) | ✅ When truncated |
| **Aggregate** | ❌ | ❌ Not used | ❌ |
| **Write** | ❌ | ❌ Not used | ❌ |

**Key rule**: Browse tools use `page` only, NOT `completeness`. The reason: `has_more=false` does NOT mean the Agent has the full result set — it only means the current page is the last page. For example, `offset=50, total=75, returned=25, has_more=false` is the last page but not the full set. Using `completeness.complete=true` here would be misleading.

Only Detail/Portfolio tools use `completeness` by default. Write tools may return it only if useful (e.g., after a bulk operation). Aggregate tools omit it unless a future aggregate is capped/truncated.

## Improvement Plan

### Phase 1: Unified Envelope with Pagination Metadata

**Goal**: All paginated tools return explicit pagination and continuation signals.

#### 1.1 New Envelope Structure

Replace current `{ count, limit, offset }` with the unified envelope (see KD-3).

**Applied to**: `list_products`, `list_units`, `query_transactions`, `query_transfers`

**Before** (list_units):
```json
{
  "units": [...],
  "count": 50,
  "limit": 50,
  "offset": 0
}
```

**After**:
```json
{
  "units": [...],
  "page": {
    "returned": 50,
    "total": 200,
    "limit": 50,
    "offset": 0,
    "has_more": true
  },
  "next": {
    "recommended": "paginate",
    "tool": "list_units",
    "args": { "offset": 50, "limit": 50 }
  },
  // Deprecated (backward compat):
  "count": 50,
  "limit": 50,
  "offset": 0
}
```

**Note**: Browse tools do NOT include `completeness`. See KD-3 for rationale.

#### 1.2 Implementation Detail

Each paginated tool needs an additional COUNT query:

```sql
-- Existing query (unchanged)
SELECT ... FROM table WHERE conditions LIMIT ? OFFSET ?

-- New: total count query
SELECT COUNT(*) as total FROM table WHERE conditions
```

**Performance note**: COUNT queries are cheap for the current data volumes (products: ~50, units: ~200, transactions: ~5000). If data grows significantly, consider caching or approximate counts.

#### 1.3 Backward Compatibility

Keep old top-level `count`, `limit`, `offset` fields for 1-2 releases, mark as deprecated in tool description. Remove after confirming no clients depend on them.

### Phase 2: Add `get_product_portfolio` Tool

**Goal**: One-call answer for "what units are linked to product X?"

#### 2.1 Tool Definition

```typescript
server.tool(
  "get_product_portfolio",
  `Get a complete view of a financial product and all its linked capital units.

WHEN TO USE:
- When you need to answer "which units are under product X?"
- When you need the total amount, status distribution, or strategy breakdown for a product
- When you need to evaluate a product's portfolio composition

DO NOT USE FOR:
- Browsing all products (use list_products)
- Getting a single product's details without units (use get_product)

RETURNS:
- Product details
- All linked capital units (hard cap: 1000)
- Summary: total units, amounts by currency, status/strategy/tactics distribution
- Completeness indicator (truncated if >1000 units)`,
  {
    product_id: z.string().optional().describe("Product ID (full ULID or 8-char prefix)"),
    product_name: z.string().optional().describe("Product name (exact match; error if ambiguous)"),
    product_code: z.string().optional().describe("Product code (exact match; error if ambiguous)"),
    include_archived_units: z.boolean().optional().describe("Include units with status=已归档 (default: false)"),
  },
  async (args) => {
    // At least one identifier required
    if (!args.product_id && !args.product_name && !args.product_code) {
      return error("Provide at least one of: product_id, product_name, product_code");
    }

    // 1. Resolve product using KD-1 resolver
    //    - product_id: full → exact, short → LIKE prefix% LIMIT 2, ambiguous → error
    //    - product_name: exact match, multiple → error
    //    - product_code: exact match, multiple → error
    // 2. Query linked units (with hard cap 1001 to detect truncation)
    //    - Default: exclude status=已归档
    //    - If include_archived_units=true: include all statuses
    // 3. Build summary
    // 4. Return with completeness indicator
  },
)
```

#### 2.2 Return Structure

```json
{
  "product": {
    "id": "01ABC123...",
    "name": "招行定期A",
    "code": "CMB-D-001",
    "channel": "招商银行",
    "category": "定期",
    "currency": "CNY",
    "lock_period_days": 90,
    "annual_return_rate": 3.5,
    "is_archived": false
  },
  "units": [
    {
      "id": "01XYZ789...",
      "code": "C10",
      "amount": 50000,
      "currency": "CNY",
      "status": "已成立",
      "strategy": "远期理财",
      "tactics": "定期存款",
      "start": "2026-01-15",
      "days_left": 45,
      "avail": "l"
    }
  ],
  "summary": {
    "total_units": 3,
    "total_amount_by_currency": { "CNY": 130000 },
    "by_status": { "已成立": 2, "已清算": 1 },
    "by_strategy": { "远期理财": 2, "短期理财": 1 },
    "by_tactics": { "定期存款": 2, "活期": 1 }
  },
  "completeness": {
    "complete": true,
    "truncated": false,
    "total_units": 3,
    "returned_units": 3
  }
}
```

#### 2.3 Truncation Handling

When units exceed 1000:

```json
{
  "completeness": {
    "complete": false,
    "truncated": true,
    "total_units": 1500,
    "returned_units": 1000
  }
}
```

Agent should then: use `list_units({ product_id: "..." })` with pagination, or ask user to narrow scope.

### Phase 3: Add `product_id` Filter to `list_units`

**Goal**: Transitional improvement before `get_product_portfolio` covers all cases.

#### 3.1 Changes to `list_units`

Add filter parameter:

```typescript
{
  // ... existing filters
  product_id: z.string().optional().describe("Filter by linked product ID (full or 8-char prefix)"),
  product_name: z.string().optional().describe("Filter by linked product name (exact match)"),
}
```

**Resolution logic** (uses KD-1 resolver):
- `product_id` full → `u.product_id = ?`
- `product_id` short (≤8) → resolve to full ID first via product resolver, then filter
- `product_name` → resolve to product_id first, then filter by `u.product_id = ?`

**Important**: Always resolve to `product_id` before filtering, never filter by `p.name` directly (avoids name ambiguity).

#### 3.2 Add `product_id` to Response

Current response only has `product: unit.product_name`. Add both short and full:

```typescript
{
  id: shortId(unit.id),
  code: unit.unit_code,
  // ...
  product_id: unit.product_id ? shortId(unit.product_id) : null,  // short for display
  product_id_full: unit.product_id || null,                        // full for subsequent calls
  product: unit.product_name,
}
```

**Why both**: Agent uses `product_id` (short) for display/quick reference, `product_id_full` when calling `get_product_portfolio` or `list_units` with exact filter.

### Phase 4: Standardize Tool System

**Goal**: Clear tool categories so Agents choose the right tool.

#### 4.1 Tool Categories

| Category | Tools | Purpose | Returns |
|----------|-------|---------|---------|
| **Browse** | `list_products`, `list_units`, `query_transactions`, `query_transfers` | Explore/filter data | Page with `has_more` |
| **Detail** | `get_product`, `get_unit` | Single record lookup | Full record |
| **Portfolio** | `get_product_portfolio` | Relationship query | Complete view + summary |
| **Aggregate** | `get_products_summary`, `get_units_summary`, `get_summary`, `get_monthly_report`, `aggregate_transactions` | Statistics | Totals and breakdowns |
| **Write** | `create_product`, `update_product`, `create_unit`, `update_unit` | Data mutation | Created/updated record |

#### 4.2 Description Convention

Each tool description MUST include:

```
WHEN TO USE:
- <specific scenarios>

DO NOT USE FOR:
- <scenarios where another tool is better>

LIMITATIONS:
- <known constraints>
```

#### 4.3 `get_product` Enhancement

Add linked unit count and navigation hint to help Agent decide next step:

```json
{
  "id": "...",
  "name": "招行定期A",
  // ... existing fields
  "linked_units_count": 3,
  "linked_units_amount": { "CNY": 130000 },
  "completeness": { "complete": true, "truncated": false },
  "next": {
    "recommended": "related_tool",
    "tool": "get_product_portfolio",
    "args": { "product_id": "01ABC123" }
  }
}
```

**When `linked_units_count > 0`**: Return `next` hint pointing to `get_product_portfolio`.
**When `linked_units_count === 0`**: No `next` needed (no related data to explore).

This is more reliable than relying on Agent to read `linked_units_count` and infer the next tool.

### Phase 5: Comprehensive Testing

#### 5.1 Test Layers

| Layer | Harness | What to Test | Command |
|-------|---------|-------------|---------|
| L1 Unit | Mock `Db`, mock `McpServer` | Each tool's SQL logic, parameter validation, envelope format | `bun run test` |
| L2 Workflow | Mock `Db` with sequential responses | Product resolver → units → summary multi-step flows | `bun run test` |
| L3 Smoke (optional) | Real MCP route, mock auth | Full MCP client call → response shape | `bun run test:e2e` |

**L1 Unit** (blocking): Every tool function tested in isolation with mock Db. Validates:
- SQL query construction (correct WHERE clauses, parameter binding)
- Envelope structure (`page`, `completeness`, `next`)
- Error handling (not found, ambiguous, validation)
- Edge cases (empty results, boundary values)

**L2 Workflow** (blocking): Multi-tool scenarios with mock Db that returns sequential results. Validates:
- Product resolver → `get_product_portfolio` flow
- `get_product` → `next` hint → `get_product_portfolio` flow
- Pagination: first page → `has_more` → second page → `has_more: false`

**L3 Smoke** (non-blocking, only if MCP route harness exists): Single end-to-end call through real MCP endpoint. Not required for first release; add when `src/__tests__/mcp/` has mature route test helpers.

#### 5.2 New Test Cases

**Envelope tests** (`src/__tests__/mcp/envelope.test.ts`):
- Paginated tool returns `page` with `total`, `has_more`
- `has_more: false` when all results returned
- `total` matches actual DB count
- `next.recommended` is `"paginate"` when `has_more: true`
- `next` is absent when `has_more: false`
- Browse tools do NOT include `completeness`
- Backward-compatible `count`/`limit`/`offset` still present during deprecation period

**Product resolver tests** (`src/__tests__/mcp/resolver.test.ts`):
- Full ID → exact match
- Short ID (8 chars) → prefix match, single result
- Short ID → ambiguous (2+ matches) → error
- product_name → exact match, single result
- product_name → ambiguous → error
- product_code → exact match, single result
- product_code → ambiguous → error
- No identifier provided → error

**`get_product_portfolio` tests** (`src/__tests__/mcp/portfolio.test.ts`):
- Returns product + all linked units + summary
- Handles product with no linked units (empty units, summary all zeros)
- Handles product with archived units (status=已归档) excluded by default
- Handles `include_archived_units=true` → includes 已归档
- Handles product not found
- Handles truncation at 1000 units (completeness.truncated=true)
- Accepts product_id, product_name, product_code (each via resolver)
- Rejects when no identifier provided
- Returns `completeness.complete=true` when not truncated

**`list_units` with product_id filter** (`src/__tests__/mcp/unit.test.ts`):
- Filters by full product_id
- Filters by short product_id (resolver)
- Filters by product_name (resolver)
- Response includes `product_id` (short) and `product_id_full`
- Combines with existing filters (status, strategy, etc.)

**`get_product` enhancement** (`src/__tests__/mcp/product.test.ts`):
- Returns `linked_units_count` and `linked_units_amount`
- Returns `next` hint when linked_units_count > 0
- No `next` when linked_units_count === 0

**Edge cases**:
- Empty result sets (page.total=0, page.returned=0, has_more=false, no next, no completeness)
- Single result (page.total=1, page.returned=1, has_more=false)
- Exactly at limit boundary (e.g., 50 results with limit 50 → has_more depends on total)
- Detail/Portfolio empty case (completeness.complete=true, data is null or empty)

#### 5.3 Coverage Target

Per project standard (CLAUDE.md): **90% line coverage** for MCP tools.

Commands:
```bash
bun run test                    # L1 + L2 unit/workflow tests
bun run test:coverage           # With coverage report
bun run typecheck               # Type checking
bun run lint                    # Lint (eslint --max-warnings=0)
```

### Phase 6: Atomic Commit Strategy

Each commit should be independently deployable and testable. Test files are organized by feature area, not by tool name.

#### Commit 1: Envelope Infrastructure + Product Resolver
- Add `PageMeta`, `CompletenessMeta`, `NextHint` types to `types.ts`
- Add `okWithPage()`, `okWithCompleteness()` helper functions — these merge metadata into the existing top-level payload (e.g., `{ units: [...], page: {...} }`), NOT a new root wrapper
- Add `resolveProduct()` utility function (KD-1 resolver)
- **Files**: `src/lib/mcp/tools/types.ts`, `src/lib/mcp/tools/resolver.ts` (new)
- **Tests**: `src/__tests__/mcp/envelope.test.ts` (new), `src/__tests__/mcp/resolver.test.ts` (new)

#### Commit 2: Apply Envelope to All Browse Tools
- Update `list_products`, `list_units`, `query_transactions`, `query_transfers` with unified envelope
- Add COUNT queries to each
- Keep backward-compatible `count`/`limit`/`offset` fields (deprecated)
- **Files**: `src/lib/mcp/tools/product.ts`, `src/lib/mcp/tools/unit.ts`, `src/lib/mcp/tools/query.ts`
- **Tests**: `src/__tests__/mcp/envelope.test.ts` (extend), `src/__tests__/mcp/product.test.ts` (new), `src/__tests__/mcp/query.test.ts` (update)
- **Why combined**: All browse tools share the same envelope change; splitting would create 4 commits for identical pattern.

#### Commit 3: Add `product_id` Filter + Response to `list_units`
- Add `product_id` and `product_name` filter parameters (using KD-1 resolver)
- Add `product_id` (short) and `product_id_full` to response
- **Files**: `src/lib/mcp/tools/unit.ts`
- **Tests**: `src/__tests__/mcp/unit.test.ts` (update)
- **Why separate from Commit 2**: Filter addition is a feature change, not just envelope format change.

#### Commit 4: Add `get_product_portfolio`
- New tool implementation with product resolver
- Summary calculation
- Truncation handling (hard cap 1000)
- `completeness` and `next` in response
- **Files**: `src/lib/mcp/tools/portfolio.ts` (new), `src/lib/mcp/tools/index.ts`, `src/lib/mcp/server.ts`
- **Tests**: `src/__tests__/mcp/portfolio.test.ts` (new)
- **Note**: Must update `server.ts` to call `registerPortfolioTools()` — just exporting from `index.ts` does NOT register the tool.

#### Commit 5: Enhance `get_product` with Navigation
- Add `linked_units_count` and `linked_units_amount`
- Add `completeness` and `next` hint (pointing to `get_product_portfolio` when linked_units_count > 0)
- **Files**: `src/lib/mcp/tools/product.ts`
- **Tests**: `src/__tests__/mcp/product.test.ts` (extend)

#### Commit 6: Update Tool Descriptions
- Add WHEN TO USE / DO NOT USE FOR / LIMITATIONS to all tools
- **Files**: All tool files
- **Tests**: No new tests needed (description changes only)

#### Commit 7: Deprecation Cleanup
- Remove old backward-compatible `count`/`limit`/`offset` top-level fields
- **Files**: All paginated tool files
- **Tests**: Update existing tests (remove backward-compat assertions)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| COUNT query performance | Low (current data volumes small) | Monitor; add caching if needed |
| Breaking existing MCP clients | Medium | Keep backward-compatible fields during deprecation period |
| `get_product_portfolio` with >1000 units | Low | Hard cap + truncation signal + suggest narrowing |
| Tool count increase | Low | Clear categories + description convention |

## Success Criteria

1. Agent no longer treats first page as complete result (verifiable by testing with Claude)
2. "Which units are under product X?" answerable in one MCP call
3. All paginated tools return `total` and `has_more`
4. 90% test coverage for new/modified code
5. Each commit passes CI independently
