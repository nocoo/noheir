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

**Response** (~500B):
```json
{
  "total_count": 45,
  "total_amount": 1234567.89,
  "by_strategy": {
    "远期理财": { "count": 5, "amount": 200000 },
    "36存单": { "count": 12, "amount": 360000 }
  },
  "by_status": {
    "已成立": { "count": 40, "amount": 1100000 },
    "计划中": { "count": 5, "amount": 134567.89 }
  },
  "by_tactics": {
    "定期存款": { "count": 20, "amount": 600000 }
  },
  "availability": {
    "available_now": { "count": 5, "amount": 150000 },
    "available_30d": { "count": 3, "amount": 90000 },
    "locked": { "count": 37, "amount": 994567.89 }
  }
}
```

#### 1.2 `get_products_summary`

**Purpose**: Get aggregated statistics about financial products.

**Response** (~300B):
```json
{
  "total_count": 25,
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
| `fields` | enum | `"minimal"` \| `"standard"` \| `"full"` (default: `"standard"`) |
| `available_within_days` | number | Filter units becoming available within N days |
| `limit` | number | Max results (default: 50, max: 200) |
| `offset` | number | Pagination offset |

**Field presets**:

| Preset | Fields Included | Size |
|--------|-----------------|------|
| `minimal` | `id`, `unitCode`, `amountCents`, `status` | ~80B/unit |
| `standard` | + `strategy`, `tactics`, `currency`, `availableDate`, `isAvailable` | ~150B/unit |
| `full` | + `product.*`, `note`, `startDate`, `endDate`, timestamps | ~400B/unit |

**Example call for upcoming availability check**:
```json
{
  "fields": "minimal",
  "available_within_days": 30,
  "limit": 10
}
```

#### 2.2 `list_products` Enhancements

New parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | enum | `"minimal"` \| `"full"` (default: `"full"`) |
| `limit` | number | Max results (default: 50, max: 200) |
| `offset` | number | Pagination offset |

**Field presets**:

| Preset | Fields Included |
|--------|-----------------|
| `minimal` | `id`, `name`, `channel`, `category` |
| `full` | All fields |

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
- with_products=true increases response size ~3x
- available_within_days filter requires product to have lockPeriodDays set

PARAMETERS:
- fields: Controls response size. "minimal" (~80B/unit) for IDs and amounts only, "standard" (~150B/unit) adds strategy/status/availability, "full" (~400B/unit) includes everything
- available_within_days: Server-side filter for units becoming available soon. More efficient than fetching all and filtering client-side
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
1. get_units_summary               → Check availability.available_30d count
2. list_units (available_within_days=30, fields="standard") → Get upcoming units
```

#### Pattern C: Product-Unit Relationship
```
1. get_products_summary  → Understand product distribution
2. list_products         → Get product IDs
3. list_units (with_products=true, fields="minimal") → See unit-product links
```

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
```sql
SELECT 
  COUNT(*) as total_count,
  SUM(amount_cents) as total_amount_cents,
  strategy,
  status,
  tactics
FROM capital_units
WHERE user_id = ?
GROUP BY GROUPING SETS (
  (strategy),
  (status),
  (tactics),
  ()
)
```

Note: D1/SQLite doesn't support GROUPING SETS. Will need multiple queries or application-level aggregation.

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
