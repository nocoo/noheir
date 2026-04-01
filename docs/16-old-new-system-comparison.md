# Old (Supabase) vs New (D1/Worker) System Comparison

This document details the differences between the old Supabase-based system and the new Cloudflare D1/Worker system, covering all major modules.

## Global Breaking Changes

| Change | Old (Supabase) | New (D1/Worker) | Impact |
|--------|---------------|-----------------|--------|
| **Amount units** | 元 (yuan, decimal) | 分 (cents/fen, integer) | All clients must multiply by 100 on write, divide by 100 on read |
| **User ID format** | Supabase UUID | Google `sub` (providerAccountId) | Existing data migration required |
| **Tags storage** | PostgreSQL array `text[]` | JSON string `'["tag1","tag2"]'` | Clients must `JSON.parse()` on read |
| **Field naming** | snake_case (`created_at`) | camelCase (`createdAt`) | API response shape changed |
| **Security model** | PostgreSQL RLS | Application-layer isolation | Worker validates `X-User-Id` header |

---

## Module 1: Transactions

### Schema Changes

| Field | Old | New | Notes |
|-------|-----|-----|-------|
| `amount` | `DECIMAL` (yuan) | `INTEGER` (cents) | **Breaking** |
| `tags` | `text[]` | `TEXT` (JSON) | **Breaking** |
| `type` | `income \| expense \| transfer` | `income \| expense` | Transfer removed from enum |
| `created_at` | `TIMESTAMPTZ` | `createdAt TEXT` (ISO 8601) | Field renamed |

### API Changes

| Endpoint | Old | New |
|----------|-----|-----|
| Search | `POST /rest/v1/rpc/search_transactions` | `POST /api/transactions/search` |
| Create | `POST /rest/v1/transactions` | `POST /api/transactions` |
| Delete by year | N/A | `DELETE /api/transactions/years/:year` |

### Behavior Changes

- Search `limit` default: 100 (unchanged)
- Search `limit` max: 1000 (PostgREST) → 5000 (Worker clamp)
- Tags filter: PostgreSQL `@>` operator → D1 `LIKE '%"tag"%'`

---

## Module 2: Transfers

### Schema Changes

| Field | Old | New | Notes |
|-------|-----|-----|-------|
| `amount` | `DECIMAL` (yuan) | `INTEGER` (cents) | **Breaking** |
| `tags` | `text[]` | `TEXT` (JSON) | **Breaking** |
| `from_account` | `from_account` | `fromAccount` | camelCase |
| `to_account` | `to_account` | `toAccount` | camelCase |
| `transaction_type` | `transaction_type` | `transactionType` | camelCase |

### API Changes

| Endpoint | Old | New |
|----------|-----|-----|
| Search | `POST /rest/v1/rpc/search_transfers` | `POST /api/transfers/search` |
| Delete by year | N/A | `DELETE /api/transfers/years/:year` |

---

## Module 3: Financial Products

### Schema Changes

| Field | Old | New | Notes |
|-------|-----|-----|-------|
| `channel` | CHECK constraint (7 values) | No constraint | Validation moved to app layer |
| `category` | CHECK constraint (12 values) | No constraint | Validation moved to app layer |
| `annual_return_rate` | `DECIMAL(5,4)` | `REAL` | Precision change |
| `lock_period_days` | `INTEGER DEFAULT 0` | `INTEGER` (nullable) | Nullable in new system |

### Removed Constraints

Old system enforced via PostgreSQL CHECK:
```sql
CHECK (channel IN ('支付宝', '微信', '招商银行', ...))
CHECK (category IN ('货币基金', '债券基金', '股票基金', ...))
```

New system: No DB-level constraints, relies on application validation.

---

## Module 4: Capital Units

### Schema Changes

| Field | Old | New | Notes |
|-------|-----|-----|-------|
| `amount` | `DECIMAL` (yuan) | `INTEGER` (cents) | **Breaking** |
| `start_date` | `DATE` | `TEXT` (ISO date) | Type change |
| `end_date` | `DATE` | `TEXT` (ISO date) | Type change |
| `strategy` | CHECK constraint (8 values) | No constraint | App-layer validation |
| `tactics` | CHECK constraint (10 values) | No constraint | App-layer validation |
| `status` | CHECK constraint (4 values) | No constraint | App-layer validation |

### MCP Tool Ambiguity

The `create_unit` MCP tool accepts `amount` parameter but documentation doesn't specify whether it expects yuan or cents. **Needs clarification.**

---

## Module 5: Reports

### Amount Units

All report endpoints now return amounts in **cents (分)**:
- `total_income`, `total_expense`, `net_amount`
- `total_transfer_in`, `total_transfer_out`
- Category breakdown `total` values

### API Changes

| Endpoint | Old | New |
|----------|-----|-----|
| Metadata | `POST /rest/v1/rpc/get_metadata` | `GET /api/reports/metadata` |
| Monthly summary | `POST /rest/v1/rpc/monthly_summary` | `GET /api/reports/monthly-summary?year=X&month=Y` |
| Yearly summary | N/A | `GET /api/reports/yearly-summary?year=X` |
| Category summary | N/A | `GET /api/reports/category-summary?year=X&month=Y` |

### New Capabilities

1. **Yearly summary** (`GET /api/reports/yearly-summary`)
   - Annual totals by category
   - Year-over-year comparison data

2. **Category summary** (`GET /api/reports/category-summary`)
   - Hierarchical breakdown (primary → secondary → tertiary)
   - Supports year and/or month filtering

### Missing Fields

Monthly report response in new system is missing:
- `year` field
- `month` field

Clients must track these from the request parameters.

---

## Module 6: Authentication

### Architecture Change

| Aspect | Old (Supabase) | New (NextAuth.js v5) |
|--------|---------------|---------------------|
| Provider | Supabase Auth | NextAuth.js + Google OAuth |
| Session | JWT via Supabase client | JWT via NextAuth `auth()` |
| User ID | Supabase UUID | Google `sub` (providerAccountId) |
| API auth | Supabase RLS + anon key | Bearer token + `X-User-Id` header |

### User ID Format

- **Old**: `550e8400-e29b-41d4-a716-446655440000` (UUID)
- **New**: `117234567890123456789` (Google sub, numeric string)

### Security Model

**Old (RLS)**:
```sql
CREATE POLICY "Users can only see own data" ON transactions
  USING (user_id = auth.uid());
```

**New (Application layer)**:
```typescript
// Worker validates X-User-Id header against session
const userId = request.headers.get("X-User-Id");
if (!userId || userId !== session.userId) {
  return new Response("Unauthorized", { status: 401 });
}
```

---

## Migration Checklist

### Data Migration

- [ ] Convert all `amount` values: `amount_cents = amount_yuan * 100`
- [ ] Convert `tags` arrays to JSON strings: `'["tag1", "tag2"]'`
- [ ] Map Supabase UUIDs to Google `sub` values (requires user re-authentication)
- [ ] Convert `DATE` fields to ISO 8601 strings

### Client Updates

- [ ] Update all amount handling (multiply/divide by 100)
- [ ] Parse tags as JSON instead of using directly
- [ ] Update API endpoint paths
- [ ] Handle camelCase field names in responses
- [ ] Remove `type: 'transfer'` from transaction queries

### Testing

- [ ] Verify amount calculations remain correct after cents conversion
- [ ] Test tag filtering with JSON `LIKE` queries
- [ ] Validate user isolation without RLS
- [ ] Test new report endpoints (yearly-summary, category-summary)

---

## Atomic Commit Design

Migration should be implemented in small, independently deployable commits. Each commit must leave the system in a working state.

### Phase 1: Additive Changes (No Breaking)

| Commit | Description | Rollback Safe |
|--------|-------------|---------------|
| **1.1** | Add D1 schema with new field names (parallel to Supabase) | ✅ |
| **1.2** | Add Worker routes for all endpoints | ✅ |
| **1.3** | Add `WorkerDbClient` in Next.js with feature flag | ✅ |
| **1.4** | Add amount conversion helpers (`yuanToCents`, `centsToYuan`) | ✅ |
| **1.5** | Add tags JSON parse/stringify utilities | ✅ |

### Phase 2: Dual-Write (Shadow Traffic)

| Commit | Description | Rollback Safe |
|--------|-------------|---------------|
| **2.1** | Enable dual-write: Supabase (primary) + D1 (shadow) | ✅ |
| **2.2** | Add comparison logging to detect divergence | ✅ |
| **2.3** | Run shadow traffic for 7 days, monitor logs | ✅ |

### Phase 3: Gradual Cutover

| Commit | Description | Rollback Safe |
|--------|-------------|---------------|
| **3.1** | Switch reads to D1 with Supabase fallback | ✅ |
| **3.2** | Disable Supabase writes (D1 primary) | ⚠️ Requires data sync |
| **3.3** | Remove Supabase client code | ❌ Point of no return |

### Phase 4: Cleanup

| Commit | Description | Rollback Safe |
|--------|-------------|---------------|
| **4.1** | Remove feature flags | ✅ |
| **4.2** | Remove conversion utilities (if amounts normalized) | ✅ |
| **4.3** | Archive Supabase data | ✅ |

### Commit Message Convention

```
feat(migration): [phase.step] description

Phase 2.1: Enable dual-write to D1

- Add D1 write calls after Supabase writes
- Shadow traffic only, no user-facing changes
- Rollback: disable D1_DUAL_WRITE env var

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Test Design

### Unit Tests (No DB)

Tests run against mocked data, verifying pure business logic.

#### Amount Conversion

```typescript
// tests/lib/amount-conversion.test.ts
describe("yuanToCents", () => {
  it("converts positive amounts", () => {
    expect(yuanToCents(123.45)).toBe(12345);
  });
  
  it("handles edge case: 0.01 yuan", () => {
    expect(yuanToCents(0.01)).toBe(1);
  });
  
  it("rounds half-up for sub-cent amounts", () => {
    expect(yuanToCents(1.005)).toBe(101); // 100.5 → 101
  });
  
  it("preserves negative sign", () => {
    expect(yuanToCents(-50.00)).toBe(-5000);
  });
});

describe("centsToYuan", () => {
  it("converts to 2 decimal places", () => {
    expect(centsToYuan(12345)).toBe(123.45);
  });
});
```

#### Tags Serialization

```typescript
// tests/lib/tags-serialization.test.ts
describe("tagsToJson", () => {
  it("serializes array to JSON string", () => {
    expect(tagsToJson(["餐饮", "工作餐"])).toBe('["餐饮","工作餐"]');
  });
  
  it("handles empty array", () => {
    expect(tagsToJson([])).toBe("[]");
  });
  
  it("handles null/undefined", () => {
    expect(tagsToJson(null)).toBe("[]");
    expect(tagsToJson(undefined)).toBe("[]");
  });
});

describe("jsonToTags", () => {
  it("parses JSON string to array", () => {
    expect(jsonToTags('["餐饮","工作餐"]')).toEqual(["餐饮", "工作餐"]);
  });
  
  it("handles malformed JSON gracefully", () => {
    expect(jsonToTags("not-json")).toEqual([]);
  });
  
  it("handles empty string", () => {
    expect(jsonToTags("")).toEqual([]);
  });
});
```

#### Field Name Mapping

```typescript
// tests/lib/field-mapping.test.ts
describe("snakeToCamel", () => {
  it("maps transaction fields", () => {
    const input = { created_at: "2026-01-01", secondary_category: "午餐" };
    const output = snakeToCamel(input);
    expect(output).toEqual({ createdAt: "2026-01-01", secondaryCategory: "午餐" });
  });
});

describe("camelToSnake", () => {
  it("maps for Supabase writes", () => {
    const input = { createdAt: "2026-01-01", secondaryCategory: "午餐" };
    const output = camelToSnake(input);
    expect(output).toEqual({ created_at: "2026-01-01", secondary_category: "午餐" });
  });
});
```

### Integration Tests (Real D1)

Tests run against local D1 database, verifying data layer correctness.

#### Repository Tests

```typescript
// worker/tests/transactions.test.ts
describe("TransactionRepository", () => {
  describe("findAllByYear", () => {
    it("returns all transactions for year without limit", async () => {
      // Seed 100 transactions in 2026
      await seedTransactions(100, { year: 2026 });
      
      const result = await repo.findAllByYear(userId, 2026);
      
      expect(result).toHaveLength(100); // No 50-row default limit
    });
    
    it("excludes other years", async () => {
      await seedTransactions(50, { year: 2025 });
      await seedTransactions(50, { year: 2026 });
      
      const result = await repo.findAllByYear(userId, 2026);
      
      expect(result).toHaveLength(50);
      expect(result.every(t => t.year === 2026)).toBe(true);
    });
    
    it("isolates by user", async () => {
      await seedTransactions(10, { userId: "user-a", year: 2026 });
      await seedTransactions(10, { userId: "user-b", year: 2026 });
      
      const result = await repo.findAllByYear("user-a", 2026);
      
      expect(result).toHaveLength(10);
      expect(result.every(t => t.userId === "user-a")).toBe(true);
    });
  });
});
```

#### Amount Storage Tests

```typescript
// worker/tests/amount-storage.test.ts
describe("Amount storage in cents", () => {
  it("stores 123.45 yuan as 12345 cents", async () => {
    const tx = await repo.create({
      ...baseTransaction,
      amountCents: 12345,
    });
    
    const stored = await db.select().from(transactions).where(eq(id, tx.id));
    expect(stored[0].amountCents).toBe(12345);
  });
  
  it("aggregates correctly in cents", async () => {
    await repo.create({ ...baseTransaction, amountCents: 10000 }); // 100 yuan
    await repo.create({ ...baseTransaction, amountCents: 5050 });  // 50.50 yuan
    
    const report = await reportService.getMonthlyReport(userId, 2026, 1);
    
    expect(report.totalExpense).toBe(15050); // 150.50 yuan in cents
  });
});
```

### E2E Tests (Full Stack)

Tests run against deployed Worker, verifying API contracts.

#### API Contract Tests

```typescript
// worker/tests/e2e/transactions.e2e.test.ts
describe("GET /api/transactions/years/:year", () => {
  it("returns all transactions without limit", async () => {
    // Seed 100 transactions via API
    for (let i = 0; i < 100; i++) {
      await client.createTransaction({ ...baseData, note: `tx-${i}` });
    }
    
    const response = await fetch(`${BASE_URL}/api/transactions/years/2026`, {
      headers: authHeaders,
    });
    const data = await response.json();
    
    expect(data.total_returned).toBe(100);
    expect(data.transactions).toHaveLength(100);
  });
});
```

#### Dual-Write Verification

```typescript
// tests/e2e/dual-write.e2e.test.ts
describe("Dual-write consistency", () => {
  it("writes to both Supabase and D1", async () => {
    const tx = await createTransactionViaApp({
      amount: 123.45,
      note: "dual-write-test",
    });
    
    // Verify Supabase
    const supabaseRow = await supabase
      .from("transactions")
      .select()
      .eq("id", tx.id)
      .single();
    expect(supabaseRow.data.amount).toBe(123.45); // yuan
    
    // Verify D1
    const d1Row = await workerClient.getTransaction(tx.id);
    expect(d1Row.amountCents).toBe(12345); // cents
  });
});
```

### Test Coverage Requirements

| Layer | Coverage Target | Focus Areas |
|-------|----------------|-------------|
| Unit | 95%+ | Conversion utilities, field mapping, business logic |
| Integration | 80%+ | Repository methods, complex queries, aggregations |
| E2E | Critical paths | Auth flow, CRUD operations, report generation |

### CI Pipeline

```yaml
# .github/workflows/test.yml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: bun test tests/           # 327+ unit tests
      
  integration:
    runs-on: ubuntu-latest
    services:
      d1:
        image: cloudflare/d1-local
    steps:
      - run: bun test worker/tests/    # 118+ integration tests
      
  e2e:
    runs-on: ubuntu-latest
    needs: [unit, integration]
    steps:
      - run: bun test worker/tests/e2e/ # 59+ E2E tests
```

---

## Risk Assessment

### High Risk

1. **Amount unit change** — Silent data corruption if clients don't update
2. **User ID format change** — Requires re-authentication or mapping table
3. **RLS removal** — Security depends entirely on application code

### Medium Risk

1. **CHECK constraint removal** — Invalid enum values can enter database (now mitigated by Zod validation)
2. **Tags format change** — Existing queries will fail silently
3. **Limit max increase** — 5000 vs 1000 could cause performance issues

### Low Risk

1. **Field naming convention** — Straightforward find/replace
2. **New report endpoints** — Additive, no breaking changes
3. **Date type change** — ISO 8601 is widely supported
