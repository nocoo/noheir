# 17. Capital Contribution Logs

## Context

当前系统中，资金单元 (`capital_units`) 通过 `productId` 字段直接关联理财产品，但没有记录历史变更。用户无法追溯：
- 什么时候把多少钱投入了哪个产品
- 资金的进出历史
- 某产品累计收到了多少投入

本功能新增 `contribution_logs` 表，记录资金投入/取出的完整历史，并在 `capital_units.productId` 变更时自动记录日志。

---

## Database Schema

**Table:** `contribution_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| user_id | TEXT | NOT NULL, FK users(id) CASCADE | 用户隔离 |
| unit_id | TEXT | NOT NULL, FK capital_units(id) CASCADE | 关联资金单元 |
| product_id | TEXT | FK financial_products(id) RESTRICT | 关联产品（可选） |
| product_name | TEXT | | 产品名称快照（审计用，产品删除后仍可追溯） |
| operation_type | TEXT | NOT NULL | "invest" / "withdraw" / "adjust" |
| amount_cents | INTEGER | NOT NULL | 金额（分），正=投入，负=取出 |
| balance_after_cents | INTEGER | | 操作后余额快照 |
| operation_date | TEXT | NOT NULL | YYYY-MM-DD |
| source | TEXT | DEFAULT "manual" | "manual" / "auto" / "import" |
| note | TEXT | | 备注 |
| deleted_at | INTEGER | | 软删除时间戳 |
| created_at | INTEGER | NOT NULL | 创建时间 |
| updated_at | INTEGER | NOT NULL | 更新时间 |

**设计要点:**
- `product_id` 使用 **RESTRICT** 而非 SET NULL，防止删除有历史记录的产品破坏审计
- `product_name` 作为快照字段，即使产品被删除（未来放开限制时）也能追溯

**Enums:**
```ts
CONTRIBUTION_OPERATION_TYPES = ["invest", "withdraw", "adjust"] as const
CONTRIBUTION_SOURCES = ["manual", "auto", "import"] as const
```

---

## Breaking Changes

### DELETE /api/products/:id 行为变更

由于 `contribution_logs.product_id` 使用 RESTRICT 外键约束，**已有投入日志的产品无法删除**。

**变更前:** 删除任意产品均成功
**变更后:** 删除有关联 contribution_logs 的产品返回 409 Conflict

**影响范围:**
- `worker/src/index.ts` - `DELETE /api/products/:id` 路由
- `worker/tests/e2e/products.e2e.test.ts` - 需新增测试用例

**实现:**

依赖 DB RESTRICT 外键约束，捕获外键错误并转换为 409。这样避免了"检查-删除"之间的并发窗口。

```ts
// worker/src/index.ts - DELETE /api/products/:id
app.delete("/api/products/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const id = c.req.param("id");

  try {
    const ok = await repos.products.delete(userId, id);
    return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
  } catch (err) {
    // D1 RESTRICT constraint violation
    if (err instanceof Error && err.message.includes("FOREIGN KEY constraint failed")) {
      return c.json({ 
        error: "Cannot delete product with contribution history. Archive it instead.",
        hasContributionLogs: true,
      }, 409);
    }
    throw err;  // Re-throw other errors for global handler
  }
});
```

**新增测试:**
```ts
// worker/tests/e2e/products.e2e.test.ts
test("DELETE /api/products/:id returns 409 when product has contribution logs", async () => {
  // Create product, unit, and contribution log
  // Attempt delete -> expect 409
});
```

---

## API Design

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contribution-logs/search` | 搜索日志（支持分页） |
| GET | `/api/contribution-logs/summary/unit/:unitId` | 资金单元投入汇总 |
| GET | `/api/contribution-logs/summary/product/:productId` | 产品投入汇总 |
| GET | `/api/contribution-logs/:id` | 获取单条 |
| POST | `/api/contribution-logs` | 创建 |
| PUT | `/api/contribution-logs/:id` | 更新 |
| DELETE | `/api/contribution-logs/:id` | 软删除 |
| POST | `/api/contribution-logs/:id/restore` | 恢复 |

> **Note:** Seed endpoint (`POST /api/contribution-logs/seed`) 已于 2026-04-05 执行并移除。初始数据已填充完成。

### Search Request

```ts
POST /api/contribution-logs/search
{
  unitId?: string;
  productId?: string;
  operationType?: "invest" | "withdraw" | "adjust";
  source?: "manual" | "auto" | "import";
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;
  includeDeleted?: boolean;
  limit?: number;      // default 100, max 500
  offset?: number;
}
```

### Summary Response

```ts
{
  summary: {
    totalInvested: number;   // cents
    totalWithdrawn: number;  // cents
    netAmount: number;       // cents
    logCount: number;
    unitCount?: number;      // only for product summary
  }
}
```

---

## Auto-logging on productId Change

当 `PUT /api/units/:id` 修改 `productId` 时，自动创建日志记录。

### 约束

**修改 `productId` 时，禁止同时修改任何其他字段**。请求只能包含 `productId` 一个字段，否则返回 400 错误。

理由：
1. 避免语义不清（如同时改金额和产品，是先调整再转移还是转移后调整？）
2. 避免分支代码静默丢失其他字段更新
3. 保证日志语义清晰，便于审计

### 逻辑

1. **从产品 A 移出**: 创建 `withdraw` 日志（金额为负，使用当前金额）
2. **移入产品 B**: 创建 `invest` 日志（金额为正，使用当前金额）
3. **source = "auto"**: 标记为系统自动记录
4. **事务保证**: 使用 D1 batch 确保 unit 更新和日志创建原子执行

### Validation Schema 修改

```ts
// worker/db/validation.ts
export const updateUnitSchema = z.object({
  unitCode: z.string().min(1).optional(),
  amountCents: z.number().int().min(0).optional(),
  currency: z.enum(CURRENCIES).optional(),
  status: z.enum(UNIT_STATUSES).optional(),
  strategy: z.enum(STRATEGIES).optional(),
  tactics: z.enum(TACTICS).optional(),
  productId: z.string().uuid().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" },
).refine(
  (data) => {
    // If productId is being updated, it must be the ONLY field
    if (data.productId !== undefined) {
      const otherFields = Object.keys(data).filter(k => k !== "productId");
      return otherFields.length === 0;
    }
    return true;
  },
  { message: "productId must be updated alone; cannot combine with other fields" },
);
```

### 实现

修改 `worker/src/index.ts` 中的 `PUT /api/units/:id` 路由。

**核心挑战**: D1 batch 内的语句无法依赖前一条语句的执行结果。需要同时保证：
1. CAS 并发安全（防止基于过期状态写日志）
2. 原子性（UPDATE 和日志同时成功或失败）

**解决方案**: 两阶段执行 + 补偿回滚

1. **阶段一**: 单独执行 CAS UPDATE，检查 changes
2. **阶段二**: 若 UPDATE 成功，batch 插入日志
3. **补偿**: 若日志插入失败，回滚 UPDATE（将 product_id 改回原值）

```ts
app.put("/api/units/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json();

  // Validation (includes productId-only constraint)
  const parsed = updateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  // Get original unit before update
  const original = await repos.units.findById(userId, id);
  if (!original) {
    return c.json({ error: "Not found" }, 404);
  }

  const productIdChanging = parsed.data.productId !== undefined 
    && original.productId !== parsed.data.productId;

  if (productIdChanging) {
    const newProductId = parsed.data.productId;

    // Phase 1: CAS UPDATE - include original product_id in WHERE
    const updateSql = original.productId
      ? `UPDATE capital_units SET product_id = ? WHERE id = ? AND user_id = ? AND product_id = ?`
      : `UPDATE capital_units SET product_id = ? WHERE id = ? AND user_id = ? AND product_id IS NULL`;
    
    const updateStmt = original.productId
      ? db.prepare(updateSql).bind(newProductId, id, userId, original.productId)
      : db.prepare(updateSql).bind(newProductId, id, userId);

    const updateResult = await updateStmt.run();
    
    // CAS check
    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return c.json({ 
        error: "Conflict: unit was modified by another request. Please retry.",
      }, 409);
    }

    // Phase 2: Insert logs (UPDATE succeeded, we "own" this transition)
    const today = new Date().toISOString().slice(0, 10);
    const logStatements: D1PreparedStatement[] = [];

    if (original.productId) {
      const oldProduct = await repos.products.findById(userId, original.productId);
      logStatements.push(
        db.prepare(
          `INSERT INTO contribution_logs 
           (id, user_id, unit_id, product_id, product_name, operation_type, amount_cents, operation_date, source, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), userId, id, original.productId, oldProduct?.name ?? null,
          "withdraw", -original.amountCents, today, "auto",
          `Auto: moved out to ${newProductId ? "another product" : "unassigned"}`,
          Date.now(), Date.now()
        )
      );
    }

    if (newProductId) {
      const newProduct = await repos.products.findById(userId, newProductId);
      logStatements.push(
        db.prepare(
          `INSERT INTO contribution_logs 
           (id, user_id, unit_id, product_id, product_name, operation_type, amount_cents, operation_date, source, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), userId, id, newProductId, newProduct?.name ?? null,
          "invest", original.amountCents, today, "auto",
          `Auto: moved in from ${original.productId ? "another product" : "unassigned"}`,
          Date.now(), Date.now()
        )
      );
    }

    try {
      if (logStatements.length > 0) {
        await db.batch(logStatements);
      }
    } catch (logError) {
      // Phase 3: Compensate - rollback the UPDATE
      const rollbackSql = newProductId
        ? `UPDATE capital_units SET product_id = ? WHERE id = ? AND user_id = ? AND product_id = ?`
        : `UPDATE capital_units SET product_id = ? WHERE id = ? AND user_id = ? AND product_id IS NULL`;
      
      try {
        if (newProductId) {
          await db.prepare(rollbackSql).bind(original.productId, id, userId, newProductId).run();
        } else {
          await db.prepare(rollbackSql).bind(original.productId, id, userId).run();
        }
      } catch {
        // Rollback failed - log for manual intervention but don't mask original error
        console.error(`Failed to rollback unit ${id} productId change after log insert failure`);
      }
      
      throw logError; // Re-throw to trigger 500
    }

    // Return updated unit
    const row = await repos.units.findById(userId, id);
    return c.json({ unit: row });
  }

  // Non-productId updates: use normal path
  const row = await repos.units.update(userId, id, stripUndefined(parsed.data));
  if (!row) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ unit: row });
});
```

---

## File Changes

### Phase 1: Database Layer

| File | Change |
|------|--------|
| `worker/db/schema.ts` | Add `contributionLogs` table (with `product_name` snapshot) |
| `worker/db/enums.ts` | Add `CONTRIBUTION_OPERATION_TYPES`, `CONTRIBUTION_SOURCES` |
| `worker/db/types.ts` | Export `ContributionLog`, `NewContributionLog` |
| `worker/db/validation.ts` | Add Zod schemas; add `productId`-only constraint to `updateUnitSchema` |

### Phase 2: Repository

| File | Change |
|------|--------|
| `worker/db/repositories/contribution-logs.ts` | New file |
| `worker/db/repositories/index.ts` | Export new repo |

### Phase 3: API Routes

| File | Change |
|------|--------|
| `worker/src/index.ts` | Add 9 contribution-logs routes (8 CRUD + 1 seed) |
| `worker/src/index.ts` | Modify `PUT /api/units/:id` for atomic auto-logging |
| `worker/src/index.ts` | Modify `DELETE /api/products/:id` to check contribution logs |

### Phase 4: Frontend Client

| File | Change |
|------|--------|
| `src/lib/worker-db-client.ts` | Add 7 methods |
| `src/lib/capital-mappers.ts` | Add `toDomainContributionLog()` |

### Phase 5: Domain Types

| File | Change |
|------|--------|
| `src/domain/types.ts` | Add `DomainContributionLog`, `ContributionSummary` |

### Phase 6: Frontend UI

| File | Change |
|------|--------|
| `src/app/capital-logs/page.tsx` | Server Component (new) |
| `src/app/capital-logs/capital-logs-client.tsx` | Client Component (new) |
| `src/app/actions/contribution-log-actions.ts` | Server Actions (new) |
| `src/components/capital/contribution-log-form.tsx` | Dialog form (new) |
| `src/components/capital/contribution-summary-card.tsx` | Stats card (new) |

### Phase 7: Tests

| File | Change |
|------|--------|
| `worker/tests/contribution-logs.test.ts` | Repository unit tests (new) |
| `worker/tests/e2e/contribution-logs.e2e.test.ts` | API E2E tests (new) |
| `worker/tests/e2e/products.e2e.test.ts` | Add test for 409 on delete with logs |
| `worker/tests/e2e/units.e2e.test.ts` | Add test for productId-only constraint |

---

## Atomic Commits

1. **feat(db): add contribution_logs schema and enums**
   - schema.ts, enums.ts, types.ts
   - Run migration

2. **feat(db): add validation schemas for contribution logs**
   - validation.ts: add contribution log schemas
   - validation.ts: add productId-only constraint to updateUnitSchema

3. **feat(worker): add contribution-logs repository**
   - contribution-logs.ts, index.ts

4. **feat(worker): add contribution-logs API routes**
   - index.ts (9 routes: 8 CRUD + 1 seed)

5. **feat(worker): add atomic auto-logging on unit productId change**
   - Modify `PUT /api/units/:id` route with D1 batch

6. **feat(worker): prevent product deletion with contribution history**
   - Modify `DELETE /api/products/:id` route

7. **test(worker): add contribution-logs tests**
   - Unit tests + E2E tests
   - Add product deletion 409 test
   - Add productId-only constraint test

8. **feat(frontend): add contribution-logs client and mappers**
   - worker-db-client.ts, capital-mappers.ts, types.ts

9. **feat(frontend): add contribution-logs UI**
   - page.tsx, client.tsx, actions.ts, form.tsx, summary-card.tsx

10. **chore(data): run seed to populate initial contribution logs**
    - Execute `POST /api/contribution-logs/seed` once after deployment

---

## Test Plan

### L1 - Unit Tests

```ts
// worker/tests/contribution-logs.test.ts
describe("ContributionLogsRepo", () => {
  test("create and findById")
  test("search with filters")
  test("summarizeByUnit calculates totals")
  test("summarizeByProduct with multiple units")
  test("softDelete and restore")
  test("user isolation")
})
```

### L3 - API E2E Tests

```ts
// worker/tests/e2e/contribution-logs.e2e.test.ts
describe("Contribution Logs API", () => {
  test("POST /api/contribution-logs creates log")
  test("POST /api/contribution-logs validates unitId exists")
  test("POST /api/contribution-logs/search filters correctly")
  test("GET /api/contribution-logs/summary/unit/:id returns totals")
  test("DELETE soft-deletes and restore recovers")
  test("POST /api/contribution-logs/seed is idempotent")
  test("POST /api/contribution-logs/seed can resume after partial failure")
})

// worker/tests/e2e/units.e2e.test.ts (additions)
describe("Units API - Auto-logging", () => {
  test("PUT /api/units/:id auto-logs on productId change")
  test("PUT /api/units/:id creates withdraw + invest when switching products")
  test("PUT /api/units/:id rejects productId with other fields")
  test("PUT /api/units/:id with productId change is atomic (logs created or nothing)")
  test("PUT /api/units/:id returns 409 when productId was concurrently modified")
})

// worker/tests/e2e/products.e2e.test.ts (additions)
describe("Products API - Deletion guard", () => {
  test("DELETE /api/products/:id returns 409 when product has contribution logs")
  test("DELETE /api/products/:id succeeds when product has no contribution logs")
})
```

---

## Verification

```bash
# 1. Generate and apply migration
cd worker && bunx drizzle-kit generate
npx wrangler d1 migrations apply noheir-db --remote

# 2. Run worker unit tests
bun run test:worker

# 3. Run worker E2E tests
bun run test:worker:e2e

# 4. Manual API test (local dev)
# Start worker: bun run worker:dev
curl -X POST http://localhost:8787/api/contribution-logs \
  -H "Authorization: Bearer $WORKER_SHARED_SECRET" \
  -H "X-User-Id: test-user" \
  -H "Content-Type: application/json" \
  -d '{"unitId":"...", "operationType":"invest", "amountCents":100000, "operationDate":"2026-04-05"}'

# 5. Frontend verification
# Visit /capital-logs, create/edit/delete logs
```

---

## Data Seeding (One-time)

部署后执行一次性数据填充，为已有的资金单元创建初始投入日志。

### 逻辑

对于每个 `capital_units` 记录：
- 如果有 `product_id`，创建一条 `invest` 日志
- `operation_date` = `start_date`（如果为空则用 `created_at`）
- `amount_cents` = 资金单元的 `amount_cents`
- `product_name` = 关联产品的名称快照
- `source` = `"import"`
- `note` = `"Initial investment (data migration)"`

### 幂等性设计

Seed 端点设计为**幂等且可断点续传**：
- 每个 unit 插入前先检查是否已存在 `source="import"` 的日志（**包括软删除的**）
- 已存在则跳过，不重复创建
- 中途失败后可重新执行，继续处理剩余 units
- 使用 D1 batch 分批插入，每批 50 条，保证部分原子性

### Implementation

```ts
// worker/src/index.ts
app.post("/api/contribution-logs/seed", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const db = c.get("db");

  // Get all units with products
  const units = await repos.units.findAllWithProducts(userId, {});
  
  let created = 0;
  let skipped = 0;
  const BATCH_SIZE = 50;
  
  // Process in batches for partial atomicity
  for (let i = 0; i < units.length; i += BATCH_SIZE) {
    const batch = units.slice(i, i + BATCH_SIZE);
    const statements: D1PreparedStatement[] = [];
    
    for (const unit of batch) {
      if (!unit.productId) {
        skipped++;
        continue;
      }

      // Check if already seeded for this unit (including soft-deleted, for true idempotency)
      const existing = await repos.contributionLogs.search(userId, {
        unitId: unit.id,
        source: "import",
        limit: 1,
        includeDeleted: true,  // Soft-deleted import logs still count
      });
      
      if (existing.logs.length > 0) {
        skipped++;
        continue;
      }

      const operationDate = unit.startDate ?? new Date(unit.createdAt).toISOString().slice(0, 10);
      
      statements.push(
        db.prepare(
          `INSERT INTO contribution_logs 
           (id, user_id, unit_id, product_id, product_name, operation_type, amount_cents, balance_after_cents, operation_date, source, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), userId, unit.id, unit.productId, unit.product?.name ?? null,
          "invest", unit.amountCents, unit.amountCents, operationDate, "import",
          "Initial investment (data migration)",
          Date.now(), Date.now()
        )
      );
      created++;
    }
    
    // Execute batch atomically
    if (statements.length > 0) {
      await db.batch(statements);
    }
  }

  return c.json({ 
    success: true, 
    created,
    skipped,
    message: skipped > 0 
      ? `Created ${created} logs, skipped ${skipped} (already seeded or no product)`
      : `Created ${created} logs`,
  });
});
```

### Execution

```bash
# After deployment, run (can be re-run safely):
curl -X POST https://noheir.worker.hexly.ai/api/contribution-logs/seed \
  -H "Authorization: Bearer $WORKER_SHARED_SECRET" \
  -H "X-User-Id: $USER_ID"

# Response example:
# { "success": true, "created": 42, "skipped": 3, "message": "Created 42 logs, skipped 3 (already seeded or no product)" }
```

---

## Out of Scope

- capital-dashboard 集成投入汇总
