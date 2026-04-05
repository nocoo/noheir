# 001 Capital Unit Date Fields Refactor

## Background

Current implementation incorrectly uses `capitalUnits.endDate` as "product maturity date". This conflicts with the actual domain model.

## Domain Model (Correct)

### Capital Unit Lifecycle
- `startDate`: Unit creation date
- `endDate`: Unit archive date (only set when status is `已归档`, null otherwise)
- A unit can only be in ONE product at a time
- `productId` CAN be null (unit not deployed to any product)

### Investment Timeline
- Each investment is recorded in `contributionLogs` with `operationType: "invest"`
- Switching products: keeps existing `withdraw` + `invest` logging behavior; availability computation uses the latest `invest` log only
- **Available Date** = `latestInvest.operationDate + product.lockPeriodDays` (computed, not stored)

### Unit Availability
- If `productId = null`: not deployed, `availableDate = null`, `isAvailable = false`
- If `productId != null` but no invest log: `availableDate = null`, `isAvailable = false`
- If has invest log: `availableDate = latestInvest.operationDate + product.lockPeriodDays`
  - `isAvailable = true` if `today >= availableDate` OR `product.lockPeriodDays === 0`
  - `isAvailable = false` if `today < availableDate`

**Interpreting availability state**:
| `availableDate` | `isAvailable` | `daysUntilAvailable` | Meaning |
|-----------------|---------------|----------------------|---------|
| `null` | `false` | `null` | Data insufficient (no product or no invest log) |
| non-null | `false` | positive | Locked, N days until available |
| non-null | `true` | 0 or negative | Available (negative = available since N days ago) |

### Archive State Machine
| Transition | `endDate` Action |
|------------|------------------|
| Any → `已归档` | Auto-set to today (user can override) |
| `已归档` → Any other | Clear to null |

---

## Current State (Problems)

### `capitalUnits` table
| Field | Current Usage | Correct Usage |
|-------|---------------|---------------|
| `startDate` | ❓ Unclear | Unit creation date |
| `endDate` | ❌ Product maturity date | Unit archive date (null if active) |
| `productId` | ✅ Current product (nullable) | No change |
| `status` | ✅ Unit status | No change |

### Pages using `endDate` incorrectly
1. **`/funds`** - Shows `endDate` as maturity date in table
2. **`/capital-decisions`** - Uses `endDate` for decision logic
3. **`/warehouse`** - Uses `endDate` for visualization
4. **Liquidity Ladder** - Groups by `endDate` month for maturity forecast

---

## Changes Required

### 1. Schema: No Change
Keep `capitalUnits.endDate` as-is, just change its semantic usage.

### 2. Backend: Add `availableDate` Computation

**Location**: `worker/db/repositories/units.ts`

Backend computes and returns availability fields. Frontend only maps/displays them.

**Repository enhancement**:
```typescript
// worker/db/repositories/units.ts

// New method: get latest invest log per unit (batch)
async getLatestInvestLogs(userId: string, unitIds: string[]): Promise<Map<string, ContributionLog>>

// Enhanced list/get methods return:
interface UnitWithAvailability {
  ...existingFields,
  availableDate: string | null;      // Computed: latestInvest.operationDate + product.lockPeriodDays
  isAvailable: boolean;              // See truth table below
  daysUntilAvailable: number | null; // Positive = days until available; Negative = days since available; null = no data
  latestInvestDate: string | null;   // For reference
}

// isAvailable truth table:
// - availableDate = null → false (data insufficient)
// - availableDate != null && today >= availableDate → true
// - availableDate != null && today < availableDate → false

// daysUntilAvailable:
// - availableDate = null → null
// - availableDate != null → availableDate - today (can be negative if already available)
```

**Computation logic** (in repository or service layer):
```typescript
function computeAvailability(
  latestInvestLog: ContributionLog | null,
  product: FinancialProduct | null,
  today: Date = new Date()
): { availableDate: string | null; isAvailable: boolean; daysUntilAvailable: number | null }
```

### 3. Frontend: Map Fields Only

**Location**: `src/lib/capital-mappers.ts`

Frontend receives pre-computed fields from API, no longer derives from `endDate`.

```typescript
// src/lib/capital-mappers.ts
// Remove: daysUntilMaturity computation from endDate
// Add: direct mapping of availableDate, isAvailable, daysUntilAvailable from API response
```

### 4. Rename Checklist

| Old Name | New Name | Location |
|----------|----------|----------|
| `daysUntilMaturity` | `daysUntilAvailable` | `capital-mappers.ts`, domain types |
| `buildMaturityDistribution` | `buildAvailabilityDistribution` | `capital-dashboard.ts` (bucket distribution: 7d/30d/90d/90d+) |
| `buildMonthlyMaturities` | `buildMonthlyAvailability` | `liquidity-ladder.ts` (monthly aggregation) |
| `MonthlyMaturity` | `MonthlyAvailability` | `liquidity-ladder.ts` type |
| UI "到期" / "解锁" | "可用" | `/funds`, `/capital-decisions`, `/warehouse` |
| `endDate` (in maturity context) | `availableDate` | All pages showing "maturity" |

**Two distinct modules**:
- `liquidity-ladder.ts`: Monthly aggregation of future available funds (bar chart by month × strategy)
- `capital-dashboard.ts`: Bucket distribution by time range (7d/30d/90d/90d+)

### 5. Frontend Pages

| Page | Current | After Refactor |
|------|---------|----------------|
| `/funds` table | Shows `unit.endDate` | Shows computed `availableDate` |
| `/funds` sort | Sorts by `endDate` | Sorts by `availableDate` |
| `/capital-decisions` | Uses `endDate` | Uses `availableDate` |
| `/warehouse` | Uses `endDate` for visualization | Uses `availableDate` |
| Liquidity Ladder | Groups by `endDate` month | Groups by `availableDate` month |
| Unit Editor | Input for `endDate` | Remove; auto-set on archive |

### 6. Data Migration Strategy

**Approach**: New data only. No automatic migration of existing `endDate`.

- New logic computes `availableDate` from `contributionLogs`
- Units without invest logs will show `availableDate = null`
- User manually adds invest logs to populate correct data over time

**Legacy `endDate` handling**:
- Existing `endDate` values (incorrectly used as maturity dates) are preserved temporarily
- **Invariant**: After this refactor, backend and frontend MUST NOT interpret `endDate` on non-archived units as any business meaning
- **Cleanup rule**: When `status !== 已归档`, `endDate` can be batch-cleared via future cleanup script
- Old `endDate` will show as "—" in UI (not displayed as available date)

---

## Implementation Tasks

### Phase 1: Backend (worker/)
- [ ] 1.1 Add `computeAvailability()` helper in `worker/db/repositories/units.ts` or new `worker/lib/availability.ts`
- [ ] 1.2 Add repository method: `getLatestInvestLogs(userId, unitIds)` in `worker/db/repositories/contribution-logs.ts`
- [ ] 1.3 Enhance `GET /units` and `GET /units/:id` to return `availableDate`, `isAvailable`, `daysUntilAvailable`
- [ ] 1.4 Update unit update logic: auto-set/clear `endDate` based on status transitions
- [ ] 1.5 Add backend tests in `worker/tests/`

### Phase 2: Frontend Types & Mappers (src/)
- [ ] 2.1 Update `src/domain/types.ts`: add `availableDate`, `isAvailable`, `daysUntilAvailable`; keep `endDate` for archive only
- [ ] 2.2 Update `src/lib/capital-mappers.ts`: remove `daysUntilMaturity` derivation from `endDate`, map new fields from API
- [ ] 2.3 Rename `daysUntilMaturity` → `daysUntilAvailable` in types

### Phase 3: Frontend Pages (src/)
- [ ] 3.1 `/funds`: display `availableDate`, sort by `availableDate`, update column header to "可用日期"
- [ ] 3.2 `/capital-decisions`: replace `endDate` usage with `availableDate`
- [ ] 3.3 `/warehouse`: replace `endDate` usage with `availableDate`
- [ ] 3.4 `capital-dashboard.ts`: rename `buildMaturityDistribution` → `buildAvailabilityDistribution`, use `availableDate`
- [ ] 3.5 `liquidity-ladder.ts`: rename `buildMonthlyMaturities` → `buildMonthlyAvailability`, use `availableDate`
- [ ] 3.6 Unit Editor: remove `endDate` input field

### Phase 4: Tests & Cleanup
- [ ] 4.1 Add/update backend tests in `worker/tests/` for availability computation
- [ ] 4.2 Update frontend unit tests in `src/__tests__/`
- [ ] 4.3 Update e2e tests in `worker/tests/e2e/`
- [ ] 4.4 Update MCP tools documentation
- [ ] 4.5 Rename test fixtures: maturity → available where applicable

---

## Decisions

1. **productId nullable**: Yes, units can exist without a product (not deployed).
2. **Data migration**: New data only. Existing `endDate` preserved but ignored. User adds invest logs manually.
3. **No invest log**: `availableDate = null`. User will manually add invest logs.
4. **Archive state machine**: 
   - Any → `已归档`: auto-set `endDate` to today, user can override
   - `已归档` → Any: clear `endDate` to null
5. **Naming**: Rename maturity → available throughout codebase.
