# 18 - MCP Server Optimization

## Overview

Optimize the NoHeir MCP server to reduce context consumption while maintaining full functionality and flexibility. Based on MCP specification best practices and research findings on tool description quality.

**Status**: Planning  
**Linear**: (TBD)

## Problem Statement

Current MCP implementation issues:

1. **Context Bloat**: `list_units` and `list_products` return full datasets, consuming 10-50KB per call
2. **Redundant Fields**: Full object returned when only summary needed
3. **No Aggregation Tools**: Agent must fetch all data to compute simple statistics
4. **Description Quality**: Some tools lack clear purpose, usage guidelines, and limitations (97% of MCP tools have "smells" per arXiv research)

## Design Principles

Based on [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) and [arXiv research on tool description quality](https://arxiv.org/html/2602.14878v1):

### 1. Progressive Disclosure

```
Summary → Filtered List → Single Item
   ↓           ↓              ↓
 ~500B      ~2-10KB        ~300B
```

Agent should be able to:
- Get overview without fetching all data
- Filter server-side before data reaches context
- Drill down to specific items only when needed

### 2. Six Components of Quality Tool Descriptions

| Component | Requirement |
|-----------|-------------|
| **Purpose** | Clear statement of what tool does, independent of task |
| **Guidelines** | When to use, how to use, activation criteria |
| **Limitations** | Known constraints, failure cases, edge cases |
| **Parameters** | Semantic explanation beyond just types |
| **Length** | 3-4 sentences minimum; complex tools warrant more |
| **Examples** | Can be omitted for simple tools (research shows minimal impact) |

### 3. Response Size Targets

| Tool Type | Target Size | Strategy |
|-----------|-------------|----------|
| Summary | < 1KB | Aggregated counts and totals |
| List (filtered) | < 5KB | Pagination, field selection, server-side filters |
| Single item | < 500B | Full detail for one record |

## Current Tool Inventory

### Query Tools (Read-only)

| Tool | Current Issues | Context Cost |
|------|---------------|--------------|
| `get_summary` | ✅ Good - returns metadata only | ~500B |
| `query_transactions` | ⚠️ Can return 500 rows | 5-50KB |
| `query_transfers` | ⚠️ Can return 500 rows | 5-50KB |
| `get_monthly_report` | ✅ Good - aggregated | ~1KB |

### Product Tools

| Tool | Current Issues | Context Cost |
|------|---------------|--------------|
| `list_products` | ⚠️ Returns all products, no pagination | 5-20KB |
| `get_product` | ✅ Good - single item | ~300B |
| `create_product` | ✅ Good | ~300B |
| `update_product` | ✅ Good | ~300B |
| `delete_product` | ✅ Good | ~50B |

### Unit Tools

| Tool | Current Issues | Context Cost |
|------|---------------|--------------|
| `list_units` | ❌ Returns all units with full product join | 10-50KB |
| `get_unit` | ✅ Good - single item | ~500B |
| `create_unit` | ✅ Good | ~300B |
| `update_unit` | ✅ Good | ~300B |
| `delete_unit` | ✅ Good | ~50B |

## Optimization Plan

### Phase 1: New Summary Tools

Add lightweight aggregation tools that return statistics without raw data.

#### 1.1 `get_units_summary`

**Purpose**: Get aggregated statistics about capital units without fetching individual records.

**When to use**: Before deciding whether to list/filter units. Provides counts and totals by dimension.

**Parameters**: None (returns full summary)

**Implementation Notes**:
- Availability calculation requires: `latestInvestLog.operationDate` + `product.lockPeriodDays`
- Units without product or without invest log have `availableDate = null`, counted as "unknown"
- All amounts returned in cents (`amount_cents`) to match DB schema

**Response** (~600B):
```json
{
  "total_count": 45,
  "total_amount_cents": 123456789,
  "by_strategy": {
    "远期理财": { "count": 5, "amount_cents": 20000000 },
    "36存单": { "count": 12, "amount_cents": 36000000 }
  },
  "by_status": {
    "已成立": { "count": 40, "amount_cents": 110000000 },
    "计划中": { "count": 5, "amount_cents": 13456789 }
  },
  "by_tactics": {
    "定期存款": { "count": 20, "amount_cents": 60000000 }
  },
  "availability": {
    "available_now": { "count": 5, "amount_cents": 15000000 },
    "available_30d": { "count": 3, "amount_cents": 9000000 },
    "locked": { "count": 30, "amount_cents": 89456789 },
    "unknown": { "count": 7, "amount_cents": 10000000 }
  }
}
```

**Availability Calculation Logic** (from `worker/lib/availability.ts`):
1. Fetch all units with product join
2. Fetch latest invest log per unit from contribution_logs (operationType = 'invest')
3. For each unit: `availableDate = latestInvestDate + product.lockPeriodDays`
4. Categorize: `available_now` (days ≤ 0), `available_30d` (1-30 days), `locked` (> 30 days), `unknown` (no data)

#### 1.2 `get_products_summary`

**Purpose**: Get aggregated statistics about financial products.

**Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_archived` | boolean | `false` | Include archived products in counts |

**Note**: Matches existing `list_products` behavior which excludes archived by default.

**Response** (~300B):
```json
{
  "total_count": 25,
  "archived_count": 3,
  "by_channel": { "招商银行": 8, "支付宝": 5 },
  "by_category": { "定期存款": 10, "理财产品": 8 },
  "by_currency": { "CNY": 22, "USD": 3 }
}
```

### Phase 2: Enhanced List Tools

Add field selection and improved filtering to existing list tools.

#### 2.1 `list_units` Enhancements

New parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | enum | `"minimal"` \| `"standard"` \| `"full"` (default: `"minimal"`) |
| `available_within_days` | number | Filter units becoming available within N days (requires `fields="standard"` or `"full"`) |
| `limit` | number | Max results (default: 50, max: 200) |
| `offset` | number | Pagination offset |

**Field presets**:

| Preset | Fields Included | Size | Notes |
|--------|-----------------|------|-------|
| `minimal` | `id`, `unitCode`, `amountCents`, `status`, `strategy`, `tactics`, `currency`, `productId` | ~100B/unit | Basic info + productId for relationship lookup |
| `standard` | + `availableDate`, `isAvailable`, `daysUntilAvailable`, `latestInvestDate` | ~180B/unit | Requires product join + contribution_logs lookup |
| `full` | + `product.*`, `note`, `startDate`, `endDate`, timestamps | ~450B/unit | Complete data with nested product |

**Key Implementation Details**:
- `minimal`: Direct query on `capital_units` table only, no joins
- `standard`: Joins `financial_products` + queries `contribution_logs` for latest invest date, then computes availability per `worker/lib/availability.ts`
- `full`: Same as `standard` but includes all product fields and unit metadata
- `available_within_days`: Server-side filter applied AFTER availability computation; only valid with `standard` or `full`

**Example call for upcoming availability check**:
```json
{
  "fields": "standard",
  "available_within_days": 30,
  "limit": 10
}
```

#### 2.2 `list_products` Enhancements

New parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | enum | `"minimal"` \| `"full"` (default: `"full"`) |
| `include_archived` | boolean | Include archived products (default: `false`) |
| `limit` | number | Max results (default: 50, max: 200) |
| `offset` | number | Pagination offset |

**Note**: `include_archived` matches existing Worker behavior where archived products are excluded by default.

**Field presets**:

| Preset | Fields Included |
|--------|-----------------|
| `minimal` | `id`, `name`, `channel`, `category`, `currency` |
| `full` | All fields including `lockPeriodDays`, `annualReturnRate`, timestamps |

### Phase 3: Tool Description Quality Improvements

Rewrite all tool descriptions following the six-component framework.

#### Example: Improved `list_units` Description

**Before** (current):
```
List all capital units (资金单元) with optional filters. Set with_products=true to include linked product details.
```

**After** (improved):
```
Get a filtered list of capital units with configurable detail level.

WHEN TO USE:
- After calling get_units_summary to understand the data shape
- When you need specific unit records matching certain criteria
- Use fields="minimal" for quick lookups, fields="full" for detailed analysis

LIMITATIONS:
- Max 200 results per call; use offset for pagination
- Availability fields (`availableDate`, `isAvailable`, `daysUntilAvailable`) only available with `fields="standard"` or `"full"`
- `available_within_days` filter requires `fields="standard"` or `"full"` (ignored with `minimal`)
- Availability calculation requires both: (1) unit linked to product with `lockPeriodDays`, and (2) at least one invest log in contribution_logs

PARAMETERS:
- fields: Controls response size and data. "minimal" (~100B/unit) for basic info + productId, "standard" (~180B/unit) adds computed availability, "full" (~450B/unit) includes nested product and all metadata
- available_within_days: Server-side filter for units becoming available within N days. Requires fields="standard" or "full"
```

### Phase 4: Workflow Optimization

Document recommended tool call sequences for common tasks.

#### Pattern A: Capital Overview
```
1. get_units_summary     → Understand totals and distribution
2. list_units (filtered) → Get specific subset if needed
3. get_unit              → Drill into single unit details
```

#### Pattern B: Availability Check
```
1. get_units_summary                                       → Check availability.available_30d count
2. list_units (available_within_days=30, fields="standard") → Get upcoming units with availability info
```

#### Pattern C: Product-Unit Relationship
```
1. get_products_summary                     → Understand product distribution
2. list_products (fields="minimal")         → Get product IDs and names
3. list_units (fields="minimal")            → Get units with productId field
4. (optional) get_unit (with_product=true)  → Drill into specific unit with full product details
```

Note: `minimal` preset includes `productId` for relationship lookup. Use `get_unit(id, with_product=true)` for full nested product data.

## Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `mcp/src/index.ts` | Add new tools, enhance existing tool parameters and descriptions |
| `mcp/src/worker-client.ts` | Add new API methods for summary endpoints |
| `worker/src/index.ts` | Add new API routes |
| `worker/db/repositories/units.ts` | Add summary aggregation queries |
| `worker/db/repositories/products.ts` | Add summary aggregation query |

### New Worker API Endpoints

```
GET /api/units/summary      → Aggregated unit statistics
GET /api/products/summary   → Aggregated product statistics
```

### Database Queries

#### Units Summary Query

D1/SQLite doesn't support `GROUPING SETS`, so we use application-level aggregation:

```typescript
// 1. Fetch all units with product join
const units = await repos.units.findAllWithProducts(userId);

// 2. Fetch latest invest logs for all units
const latestInvestLogs = await repos.contributionLogs.getLatestInvestLogs(userId, unitIds);

// 3. Compute availability for each unit
const unitsWithAvailability = repos.units.enrichWithAvailability(units, latestInvestLogs);

// 4. Aggregate in application code
const summary = {
  total_count: units.length,
  total_amount_cents: units.reduce((sum, u) => sum + u.amountCents, 0),
  by_strategy: groupByWithSum(units, 'strategy'),
  by_status: groupByWithSum(units, 'status'),
  by_tactics: groupByWithSum(units, 'tactics'),
  availability: categorizeByAvailability(unitsWithAvailability),
};
```

#### Products Summary Query

```sql
-- Active products summary (include_archived = false)
SELECT 
  COUNT(*) as total_count,
  channel,
  category,
  currency
FROM financial_products
WHERE user_id = ? AND is_archived = false
GROUP BY channel, category, currency

-- Archived count (separate query)
SELECT COUNT(*) as archived_count
FROM financial_products
WHERE user_id = ? AND is_archived = true
```

### Atomic Commits

1. `feat(worker): add units summary endpoint`
2. `feat(worker): add products summary endpoint`
3. `feat(mcp): add get_units_summary tool`
4. `feat(mcp): add get_products_summary tool`
5. `feat(mcp): add fields parameter to list_units`
6. `feat(mcp): add available_within_days filter to list_units`
7. `feat(mcp): add pagination to list_units and list_products`
8. `docs(mcp): improve tool descriptions with six-component framework`
9. `test(mcp): add tests for new summary tools`
10. `test(worker): add tests for summary endpoints`

## Testing Strategy

### Unit Tests
- Summary aggregation logic
- Field preset filtering
- Parameter validation

### Integration Tests
- Summary endpoint returns correct aggregates
- Field presets return expected fields only
- Pagination works correctly

### E2E Tests
- Full MCP tool call roundtrip for new tools
- Verify response sizes meet targets

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Typical overview query context | 20-50KB | < 2KB |
| Tool calls for "show me my capital" | 1 (returns all) | 2 (summary → filtered list) |
| Tool description completeness | ~3 components | 5-6 components |

## References

- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Tool Description Quality Research](https://arxiv.org/html/2602.14878v1)
- [Code Execution with MCP - Anthropic](https://www.anthropic.com/engineering/code-execution-with-mcp)
- Current implementation: `docs/12-mcp-server.md`
