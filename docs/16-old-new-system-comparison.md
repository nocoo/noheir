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

- Search `limit` default: 100 → 50
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

## Risk Assessment

### High Risk

1. **Amount unit change** — Silent data corruption if clients don't update
2. **User ID format change** — Requires re-authentication or mapping table
3. **RLS removal** — Security depends entirely on application code

### Medium Risk

1. **CHECK constraint removal** — Invalid enum values can enter database
2. **Tags format change** — Existing queries will fail silently
3. **Default limit reduction** — Pagination behavior changes

### Low Risk

1. **Field naming convention** — Straightforward find/replace
2. **New report endpoints** — Additive, no breaking changes
3. **Date type change** — ISO 8601 is widely supported
