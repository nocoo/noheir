# 003 Unit Commit & Log Enrichment（资本单元提交与日志增强）

把"已实现一半"的 `contribution_logs` 补成资本单元的一等历史：日志可指定日期、可记损益；"编辑资本单位"对话框改为三栏（基础信息 / 产品与操作 / 历史时间线）；产品切换与番号对换由**下拉选择**改为**暂存式操作按钮**，与元数据修改一起原子提交，并共享一条备注。

## Context

### 为什么做

`contribution_logs` 表（`docs/17-contribution-logs.md`，migration `0002`）已经在记录资金进出，`PUT /api/units/:id` 改 `productId` 时会自动写 `withdraw` + `invest` 两条日志（`worker/src/index.ts:817-867`）。但这套能力对用户是**不可达**的：

1. `/capital-logs` 页面直到本次开发前没有任何入口（已在 `a364801` 补上侧边栏"时间视图"）。
2. 日志的 `operation_date` 恒为"编辑那天"（`worker/src/index.ts:814` 硬编码 `today`），不是资金实际移动的日期。
3. 没有损益概念 —— 只有本金流动，赚了多少无处可记。
4. 单元编辑对话框看不到该单元的任何历史；`InvestmentTimeline`（`src/components/capital/investment-timeline.tsx`）画的是**未来预测**的锁定/开放周期，不是过去。
5. 产品切换靠下拉框，语义上等同于"改了个字段"，而实际上它是一次有金额、有日期、有理由的**资金操作**。

### 预期结果

- 每条日志可指定日期、可选填损益（`pnl_cents`）。
- 编辑资本单位 = 三栏视图：左看基础信息，中看产品与操作，右看全部历史（倒序）。
- 产品切换、番号对换变成显式操作按钮 → 暂存为待生效卡片 → 底部填一条统一备注 → 一次"保存"原子落库。
- 元数据修改也留痕（`adjust` 日志）。

### 不做什么

- **存量不管**：不迁移、不回填历史数据。新列可空，旧行为 `NULL`。
- 不改 `PUT /api/units/:id` 的 `productId` 单独更新约束（理由见 [Decision I]）。
- 不做日志分页（500 条上限 + 提示，见 [Risk 5]）。

---

## 已确认的设计决策

> 以下为需求澄清阶段与用户闭环的结论，实现时不再重开讨论。

| # | 决策 | 内容 |
|---|---|---|
| D1 | 损益语义 | **新增独立列** `pnl_cents`。`amount_cents` = 本金流动，`pnl_cents` = 已实现损益。可累加为"该单元累计收益" |
| D2 | 番号对换范围 | **仅交换 `unitCode` 字符串**。金额、产品、策略、战术全部原地不动 |
| D3 | 窄屏退化 | 宽屏三栏并排，窄屏纵向堆叠（`lg:grid-cols-3`），全部内容都在 |
| D4 | 备注形态 | **对话框底部统一一个备注框**（`commitNote`，写进日志）。本次保存的所有变更共享它；元数据修改**也**写日志。与单元自身的持久备注 `unitNote` 区分，见 [Decision B] 前的说明 |
| D5 | 操作提交时机 | 操作按钮**暂存**为待生效卡片（可撤销），点底部"保存"才统一提交 |
| D6 | 元数据日志金额 | `amount_cents` **一律记 0**。日志是文字记录，不参与金额统计 |
| D7 | 损益录入口 | ① 切换产品的暂存面板内；② 单元对话框时间线里逐条可编辑 |
| D8 | 原子性 | **新建 `POST /api/units/:id/commit`**，一次接收元数据 + 操作列表 + 备注，`d1.batch` 全成或全不成 |
| D9 | 时间线数据源 | 打开对话框时**按需拉取**（不由页面预取）。同一次拉取顺带取回 `expected` 用的 raw 单元快照，见 [Decision B] |
| D10 | 对换目标范围 | **任意单元**，搜索选择 |

---

## 调查发现的既有缺陷

> 以下均已对**生产 D1** 或源码核实，不是推测。它们影响本期设计，必须一并处理。

### B1. `created_at` 在生产环境有三种编码（已核实）

```sql
SELECT source, typeof(created_at), COUNT(*) FROM contribution_logs GROUP BY 1,2;
```

| source | typeof | 行数 | 实际编码 |
|---|---|---|---|
| `auto` | integer | 66 | **毫秒**（`1784956591451`） |
| `import` | integer | 144 | **毫秒**（`1775362679500`） |
| `mcp` | text | 132 | **ISO 字符串**（`"2026-07-02T05:51:49.226Z"`） |

而 Drizzle schema 声明的是 `integer("created_at", {mode:"timestamp"})` —— **秒**（`worker/db/schema.ts:179`，`mode:"timestamp"` 解码时做 `new Date(value * 1000)`）。建表在 `0002_contribution_logs.sql:15`，是 `created_at INTEGER NOT NULL`，**无默认值**（不像 `0001_initial.sql` 其他表用 `DEFAULT (unixepoch())`），也就是说这一列的编码**完全由写入方决定**，而三个写入方各写各的。结果：`datetime(created_at,'unixepoch')` 对**每一行**都返回 `NULL`。

**三个写入方今天仍在持续制造不一致**：`repos.contributionLogs.create()` 走 Drizzle 写秒；`worker/src/index.ts:838,864` 写 `Date.now()` 毫秒；`src/lib/mcp/tools/unit.ts:577,601` 写 ISO 文本。

**45 个单元**的日志混有不同编码。`getLatestInvestLogs`（`worker/db/repositories/contribution-logs.ts:34-72`）按 `desc(operationDate), desc(createdAt)` 排序 —— 同日期时用毫秒整数和 ISO 文本比大小，结果错误。这直接影响 `/warehouse`、`/funds` 和所有 MCP 单元查询的 `availableDate`。

目前**潜伏**（没有 UI 渲染 `createdAt`），但新时间线要按时间排序，必须处理。因 D-存量不管，**方案是让排序对混合编码健壮，而不是迁移数据**。

### B2. MCP 写入路径有三重缺陷（已核实）

`src/lib/mcp/tools/unit.ts:576-620` 这条自动写日志的路径同时存在三个问题，**且今天仍在持续产生脏数据**。

**B2a — `withdraw` 金额符号写反。** MCP 的 SQL 是 `SELECT ..., 'withdraw', amount_cents, ...`（**正数**），而 Worker 写的是 `-original.amountCents`（负数）。生产验证：

```sql
SELECT source, operation_type, COUNT(*) n,
       SUM(CASE WHEN amount_cents>0 THEN 1 ELSE 0 END) AS positive_rows
FROM contribution_logs GROUP BY 1,2;
```

| source | type | 行数 | 其中正数 | 判定 |
|---|---|---|---|---|
| `auto` | withdraw | 31 | **0** | 正确（全负） |
| `mcp` | withdraw | 65 | **65** | **全错（全正）** |

`summarizeByUnit`（`worker/db/repositories/contribution-logs.ts:158-163`）按 `amountCents > 0` 判定投入 —— 这 65 条取出会被全部统计成投入。**这比时间戳问题严重得多**，它直接污染金额汇总。

**B2b — `source='mcp'` 不在枚举内。** `CONTRIBUTION_SOURCES`（`worker/db/enums.ts:63`）只有 `manual | auto | import`，但生产有 132 行 `mcp`。这些行**无法通过 `/capital-logs` 的来源筛选器**，也会让 `searchContributionLogsSchema` 的 `source` 参数永远匹配不到它们。处理方案见 [Decision K]（正式入枚举，而非改写为 `auto`）。

**B2c — ISO 时间戳写进了 `operation_date`。** `logNow`（完整 ISO 串）被绑给 `operation_date`，该列约定 `YYYY-MM-DD`。生产验证：

```sql
SELECT COUNT(*) FROM contribution_logs
WHERE operation_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]';
-- 132  ← 与 mcp 行数完全吻合
```

`operation_date` 是时间线的**主排序键**，必须修。

> **B2a 与 B2c 必须一起修**（P2-C7）—— 只修日期不足以阻止错误数据继续产生，修完加回归测试钉死符号。**B2b 走另一条路**：不改 MCP 的写入值，而是把 `mcp` 正式加进枚举（[Decision K]，P1-C14 + P2-C8）。存量行最初按"存量不管"保留，**后续已单独清理** —— 见下方"存量数据清理"。

### B3. `contribution-logs` 仓库 `update()` 有字段白名单

`worker/db/repositories/contribution-logs.ts:224-228` 的 `Pick<>` 只列了 5 个字段。**不加 `"pnlCents"` 则端点层无法把它传进来** —— 端点用 `stripUndefined(parsed.data)` 传参，多出的字段会被 TS 在调用点拒绝。

> **实测澄清**：这是**类型层**护栏，不是运行时行为。直接调仓库并绕过类型（如测试里）时，Drizzle 仍会把字段写入 DB；移除白名单项也**不会**让 `tsc --noEmit` 报错（调用点在端点，不在仓库）。所以针对它写"回归测试"是无效的 —— 测试只能锁住"pnl 可被更新"这一行为本身。

### B4. 自动日志用 UTC 而非本地日期

`worker/src/index.ts:814` 用 `new Date().toISOString().slice(0,10)`，而项目有 `getLocalDateString()`（`worker/src/index.ts:47`，Asia/Shanghai）。晚上操作会记成前一天。

### B5. 本地 worker 依赖未安装（环境问题，非代码缺陷）

`worker/node_modules` 为空，`better-sqlite3`（`worker/package.json:23`）缺失，`bun run test:worker` 现在 **11/16 套件加载失败**（76 个测试通过）。CI 无此问题（`extra-install-dirs: "worker"`）。**动手前先 `cd worker && bun install`**。

---

## Data Model

### 新增列：`contribution_logs.pnl_cents`

```sql
ALTER TABLE contribution_logs ADD COLUMN pnl_cents INTEGER;
```

可空、无默认值 → 存量行为 `NULL`，满足"存量不管"。

**必须三处同步**（漏一处 → 单元测试与生产行为分叉）：

| # | 文件 | 改动 |
|---|---|---|
| 1 | `worker/db/migrations/0008_contribution_log_pnl.sql` | `ALTER TABLE ... ADD COLUMN pnl_cents INTEGER;` |
| 2 | `worker/db/schema.ts` | `pnlCents: integer("pnl_cents")`，紧邻 `balanceAfterCents`（~:174） |
| 3 | `worker/tests/setup.ts` | `SCHEMA_DDL` 里 `contribution_logs` 块加 `pnl_cents INTEGER,`（~:75） |

> worker 单元测试**不读 migrations**，用的是手抄 DDL。这是本项目踩过的坑，见 `worker/tests/setup.ts:23-167`。

### 语义

| 列 | 含义 | 番号对换 | 切换产品 | 元数据修改 |
|---|---|---|---|---|
| `amount_cents` | 本金流动 | `0` | `-amt` / `+amt` | `0`（D6） |
| `pnl_cents` | 已实现损益 | `NULL` | 挂在 `withdraw` 行 | `NULL` |
| `operation_type` | 复用现有枚举 | `adjust` | `withdraw`+`invest` | `adjust` |
| `operation_date` | 用户指定，默认今天 | 用户选 | 用户选 | 用户选 |

**不新增 `swap` 枚举值**：`CONTRIBUTION_OPERATION_TYPES`（`worker/db/enums.ts`）被 `createContributionLogSchema`、`searchContributionLogsSchema`、`DomainContributionLog`（`src/domain/types.ts:141`）、`/capital-logs` 筛选器、MCP 工具共用，加值的爆炸半径远大于收益。语义写进 `note`。

---

## API Surface

### 新增 `POST /api/units/:id/commit`

```ts
// worker/db/validation.ts
const commitOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("swap_unit_code"), targetUnitId: z.string().uuid() }),
  z.object({
    kind: z.literal("switch_product"),
    toProductId: z.string().uuid().nullable(),
    pnlCents: z.number().int().optional().nullable(),
  }),
  z.object({
    kind: z.literal("set_available_date"),
    availableDate: z.string().nullable(), // real YYYY-MM-DD calendar day, or null to clear
  }),
]);

// 元数据补丁。刻意【不含 productId】（只能走 switch_product 操作），
// 且把单元的持久备注命名为 unitNote，与本次提交的审计备注 commitNote 区分。
const commitMetadataSchema = z.object({
  unitCode:  z.string().min(1).optional(),
  amountCents: z.number().int().min(0).optional(),
  currency:  z.enum(CURRENCIES).optional(),
  status:    z.enum(UNIT_STATUSES).optional(),
  strategy:  z.enum(STRATEGIES).optional(),
  tactics:   z.enum(TACTICS).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  unitNote:  z.string().optional().nullable(),   // → capital_units.note
}).refine(m => Object.keys(m).length > 0, { message: "metadata must not be empty" });

export const commitUnitSchema = z.object({
  metadata: commitMetadataSchema.optional(),
  operations: z.array(commitOperationSchema).max(3).default([]),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  commitNote: z.string().max(1000).optional().nullable(),  // → contribution_logs.note
  expected: expectedUnitSchema,                            // 见 [Decision B]
})
.refine(d => d.metadata !== undefined || d.operations.length > 0 || (d.commitNote ?? "").length > 0,
  { message: "commit must contain metadata, operations, or a note" })
.refine(d => new Set(d.operations.map(o => o.kind)).size === d.operations.length,
  { message: "at most one operation of each kind per commit" })
// [P1-5] 直接改番号与番号对换互斥，否则最终番号不确定
.refine(d => !(d.metadata?.unitCode !== undefined
               && d.operations.some(o => o.kind === "swap_unit_code")),
  { message: "unitCode cannot be edited while a code swap is staged" })
// [P0-1] 改金额与切换产品互斥，见 [Decision C]
.refine(d => !(d.metadata?.amountCents !== undefined
               && d.operations.some(o => o.kind === "switch_product")),
  { message: "amount cannot be edited while a product switch is staged" });
```

`metadata` **刻意不含 `productId`** —— 产品变更只能通过 `switch_product` 操作表达，把写日志的逻辑收敛到一处。

**[P1-5] `unitNote` 与 `commitNote` 是两个不同的东西**，原设计用同一个 `note` 字段表达，会导致"改单元备注"和"记录本次为什么这么改"互相覆盖：

| 字段 | 落库位置 | 语义 | 生命周期 |
|---|---|---|---|
| `metadata.unitNote` | `capital_units.note` | 单元的**持久**备注 | 随单元存在，每次编辑覆盖前值，只保留最新 |
| `commitNote` | `contribution_logs.note` | **本次提交**的审计备注 | 随日志行永久留存；后续再提交只会新增行，不会改动旧行 |

> `commitNote` 落库后**不会被后续提交覆盖**（每次提交写新行），但它**不是技术上不可变** —— 现有 `PUT /api/contribution-logs/:id`（`updateContributionLogSchema`）允许单独编辑某条日志的 `note`，`/capital-logs` 页面也提供了编辑入口。本期不收紧该 API：事后修正笔误是合理需求，且日志行本就带 `updatedAt`。

校验分两层：**形状**用 Zod 判别联合（`db/validation.ts` 在 worker 覆盖率 `include` 内，白拿测试覆盖）；**引用完整性**在端点内查库 —— 目标单元存在且属于本人、目标 ≠ 自己、目标产品存在、新产品 ≠ 当前产品，以及 [Decision D] 的损益前置条件。

### [Decision B] 乐观并发锚点必须覆盖全部待改字段

**原设计的 `expected` 只有 `unitCode` + `productId`，不足以保护元数据**（P0-2）：用户打开对话框后若另一请求改了金额或状态，本次提交会**静默覆盖**对方的修改，而守卫链完全不会察觉——因为守卫只比对了番号和产品。

```ts
// 严格镜像 capital_units 的可空性（worker/db/schema.ts:53-76）。
// currency/status/strategy/tactics/startDate/endDate/note 在 DB 里【全部可空】。
const expectedUnitSchema = z.object({
  unitCode:    z.string(),                    // NOT NULL
  amountCents: z.number().int(),              // NOT NULL
  productId:   z.string().uuid().nullable(),
  currency:    z.string().nullable(),
  status:      z.string().nullable(),
  strategy:    z.string().nullable(),
  tactics:     z.string().nullable(),
  startDate:   z.string().nullable(),
  endDate:     z.string().nullable(),         // ← 原设计漏掉，生产 178 行全为 NULL
  note:        z.string().nullable(),
  availableDateOverride: z.string().nullable(), // optional unlock pin; see 0010
});
```

**为什么必须镜像可空性 —— 这是会让功能直接不可用的坑。** 生产实测（178 个单元）：

| 字段 | NULL 行数 | 影响 |
|---|---|---|
| `end_date` | **178 / 178** | 原设计**根本没把它放进 `expected`**，并发修改不受保护 |
| `note` | **84 / 178** | 若声明为非空 `string`，这 84 个单元**永远无法提交** |
| `start_date` | **26 / 178** | 同上 |
| `currency` / `status` / `strategy` / `tactics` | 0 | 当前无 NULL，但 DB 允许，schema 必须容纳 |

而 `toDomainUnit`（`src/lib/capital-mappers.ts`）会做兜底转换：`strategy`/`tactics` 用 `?? ""`，`currency`/`status` 用 `?? "CNY"` / `?? "已成立"`。**若前端把这些兜底值回传当 `expected`，与 DB 的 `NULL` 比较必然不等 → 恒 409**。

**两条硬约束**：

1. **`expected` 必须取自未经兜底的原始响应**，不能用 `toDomainUnit` / `SerializedUnit` 的产物。`GET /api/units/:id` 返回什么就原样回传什么，`null` 保持 `null`。实现上意味着 `UnitEditor` 需要单独持有一份 raw 快照，而不是复用已映射的 `SerializedUnit`。
2. **所有可空字段用空安全比较**：SQLite 里 `col = NULL` 恒为 `NULL`（不是 `TRUE`），必须展开成 `col IS NULL`（当 expected 为 null）或 `col = ?`（否则），共 8 个可空字段。这与 `worker/src/index.ts:792-794` 既有的 `product_id` 双分支写法一致，只是要写 8 遍 —— 在 `worker/lib/unit-commit.ts` 里抽个 `nullSafeEq(col, value)` 助手统一生成。

**测试必须钉死**：e2e 造一个 `note`/`startDate`/`endDate` 全为 `NULL` 的单元，断言它能正常提交（不返 409）。这条用例直接对应上面 84 行的现实数据。

客户端从 `GET /api/units/:id` 读到什么就原样回传什么，守卫链的 `[0]` 号语句把**每一个** `expected` 字段都并进 `WHERE`。任意字段被他人改动 → 匹配 0 行 → 整批塌缩 → 409。

**为什么不用 `updated_at` 做版本号**：① 它在生产是可空 `INTEGER`（`0003_add_missing_columns.sql`），在 `worker/tests/setup.ts` 却是 `INTEGER NOT NULL DEFAULT 0`，可空性不一致会让测试与生产分叉；② `repos.units.update()` 压根不写 `updatedAt`（`worker/db/repositories/units.ts:151-163`），版本号不递增就失去意义；③ 毫秒精度不足以区分并发请求。**CAS 判据用全字段值比较**（不依赖维护不全的元数据列），**日志归属判据用 `commit_token`**（`0009` 迁移新增，每请求随机）—— 两者解决的是不同问题，见 Phase 1 落地记录。

**代价**：`note` 或 `startDate` 这类字段被他人改动也会触发 409，即使本次并不打算改它们。对单人使用的个人财务系统而言，误报 409 远优于静默覆盖。

### [Decision C] 金额修改与产品切换：禁止同批次

P0-1 指出的歧义真实存在：`switch_product` 要写 `withdraw(-amt)` + `invest(+amt)`，若同一批次里 `amountCents` 也在变，`amt` 到底取旧值还是新值无法自洽——

- 取旧值：新产品的 `invest` 金额与单元当前金额不符，`availableDate` 依据的最新 invest 记录失真。
- 取新值：旧产品的 `withdraw` 金额与实际投入过的本金不符，凭空多退或少退。
- 旧出新进（`withdraw(-旧)` + `invest(+新)`）：语义上最"对"，但这其实是**两笔独立业务**（先赎回、再追加/减少投入），硬塞进一次原子提交只会让日志读起来像一笔操作。

**结论：Zod 层直接拒绝，UI 层在暂存了 `switch_product` 时禁用金额输入框并给出提示**（反之亦然）。用户要同时做，就分两次保存——这恰好在日志里留下两条语义清晰的记录。

### [Decision D] 无 `withdraw` 行时不接受损益

`switch_product` 在当前产品为 `null`（未关联）时**不会**产生 `withdraw` 行，而 `pnl_cents` 挂在 `withdraw` 上（见"语义"表）。此时若客户端仍传了 `pnlCents`，损益会被**静默丢弃**（P1-6）。

**服务端拒绝该组合**：端点在引用完整性校验阶段读到 `original.productId === null` 且 `pnlCents != null` 时返回 400 `"pnl requires an existing product to withdraw from"`。这条无法在 Zod 里表达（需要查库拿当前 productId），所以归入端点层校验，并在 e2e 里钉死。

UI 侧同步：`unit-operations-panel` 在当前无关联产品时**不渲染**损益输入框。

### [Decision E] 原子性方案：守卫链单批次，取代 CAS + 补偿

**结论：整个提交放进一个 `d1.batch()`，把 CAS 判据写进每条语句的 `WHERE`，后续语句依赖前序语句的"后置状态"，批次结束后读 `results[0].meta.changes` 判定 409。不写任何补偿代码。**

D1 的 `batch()` 是真事务（官方文档："If a statement in the sequence fails ... it aborts or rolls back the entire sequence."）。矛盾在于批次中途无法读 `meta.changes` 做 CAS 判断。解法是**让判据不需要中途读**——用 SQL 表达守卫，CAS 落空时所有语句匹配 0 行，成为一次无害的空提交，事后统一判定。

最坏情况（对换 A↔B + 切换产品 + 改元数据）的语句序与守卫：

```
[0] UPDATE capital_units
      SET unit_code='CU-B', <metadata>, product_id=?,      -- 产品切换同属本行
          end_date=<resolveEndDate(...)>,
          commit_token=<本次请求的随机 UUID>, updated_at=?
      WHERE id=A AND user_id=?
        AND unit_code=? AND amount_cents=?                      -- NOT NULL，直接等值
        AND <nullSafeEq(product_id)> AND <nullSafeEq(currency)>  -- 以下 8 个可空字段
        AND <nullSafeEq(status)>     AND <nullSafeEq(strategy)>  -- 均展开成
        AND <nullSafeEq(tactics)>    AND <nullSafeEq(start_date)>-- `IS NULL` 或 `= ?`
        AND <nullSafeEq(end_date)>   AND <nullSafeEq(note)>
        AND EXISTS (SELECT 1 FROM capital_units
                    WHERE id=B AND user_id=? AND unit_code='CU-B'
                      AND <nullSafeEq(product_id)>)              -- 伙伴的产品也守

[1] UPDATE capital_units SET unit_code='CU-A', updated_at=?
      WHERE id=B AND user_id=? AND unit_code='CU-B'
        AND EXISTS (SELECT 1 FROM capital_units
                    WHERE id=A AND user_id=? AND commit_token=?)
                                             -- ↑ 同样只认 token，不认番号

[2..n] INSERT INTO contribution_logs (...) SELECT ?,?,...
         WHERE EXISTS (SELECT 1 FROM capital_units
                       WHERE id=A AND user_id=? AND commit_token=?)
                                             -- ↑ 只有 [0] 写得出这个 token
```

**产品切换并入 `[0]`**，不再是独立语句：独立语句只能重新校验 `product_id` + `unit_code`，而 `[0]` 因**其他字段**过期失败时这两者都没变 —— 切换会照常生效，接口却返回 409。

**`[1]` 与日志守卫都用 `commit_token`，不用后置状态**：后置状态是可复现的业务值，两个请求做相同修改时无法区分谁是作者。`[1]` 尤其危险 —— `unit_code` **没有唯一索引**，别的请求完全可能把 A 改成同样的番号，于是"A 已带上 B 的番号"为真却不是本次提交造成的，输家的 `[1]` 照改伙伴（复现：`changes=[0,1,0,0]`，409 背后发生了部分写入）。详见 Phase 1 落地记录里的迭代过程。

`[0]` 号语句承担全部乐观并发判定（[Decision B]）：`expected` 的 10 个字段全部在 `WHERE` 里，其中 8 个可空字段走 `nullSafeEq`。任一字段被他人改动即匹配 0 行，后续语句因守卫落空而全部塌缩。

```ts
const results = await d1.batch(stmts);
if (!results[0]?.meta.changes) {
  return c.json({ error: "Conflict: unit was modified by another request. Please retry." }, 409);
}
```

**为什么不沿用 `PUT /api/units/:id` 的 CAS→batch→补偿模式**：现有补偿路径（`worker/src/index.ts:869-894`）已经有一条"补偿也失败就只 `console.error`"的不可恢复分支。扩展到"两个单元 + 最多 5 条日志"意味着要为每一种部分前缀写逆操作，组合爆炸，且逆操作自身还会失败。守卫链**没有需要补偿的失败态**。

**诚实记录代价**：① SQL 更密（每条带 `EXISTS`，且 `[0]` 带 10 字段比对）；② 409 由 `meta.changes === 0` 推断，"单元在读写之间被删除"也会归到 409 —— 对用户而言这恰好是正确答案；③ SQLite 无 `<=>`，8 个可空字段全部要展开成 `col IS NULL` / `col = ?` 两支，用 `nullSafeEq` 助手统一生成，写法沿袭 `worker/src/index.ts:792-794`。

**代码分层**：`worker/lib/unit-commit.ts` 导出**纯**构建器，返回 `{ sql, params }[]` 与生成的备注串；`worker/src/index.ts` 只做 `d1.prepare(...).bind(...)` + `d1.batch` 的管道工作。分支逻辑进 `worker/lib/**`（95% 覆盖率门控），管道留在 `src/index.ts`（不门控）。

### [Decision F] `/commit` 必须复用 `endDate` 状态不变量

现有 `PUT /api/units/:id`（`worker/src/index.ts:901-922`）在写库前强制一条不变量：

- 状态转为 `已归档` 且未显式给 `endDate` → 自动填 `getLocalDateString()`
- 状态**非**归档 → **无条件清空** `endDate = null`

新端点的 SQL 构建器如果不复用这条规则，会产生"非归档却带结束日期"或"已归档却无结束日期"的非法状态（P0-3）—— 而且因为 `/commit` 走的是手写 SQL 而非 `repos.units.update()`，它**绕过了所有既有防护**。

**做法**：把该规则提取为纯函数放进 `worker/lib/unit-commit.ts`，供构建器调用：

```ts
// status 在 DB 中可空（worker/db/schema.ts:63 是 .default("已成立") 而非 .notNull()），
// 签名必须容纳 null，否则传入 original.status 时 tsc 直接报错。
export function resolveEndDate(
  finalStatus: string | null,
  originalStatus: string | null,
  originalEndDate: string | null,
  today: string,
): string | null;
```

`metadata.status` 出现时以新值为准，否则沿用 `original.status`；返回值无条件并入 `[0]` 号语句的 `SET` 子句（**即使本次没改 status** —— 因为非归档单元的 `endDate` 必须恒为 `null`，这正是现有实现 `:919-922` 的语义）。

**`null` 按"非归档"处理**：`finalStatus !== "已归档"` 即清空 `endDate`，`null` 自然落入该分支，与现有 `PUT` 的 `else` 分支语义一致。生产实测 178 个单元的 `status` 目前均非 NULL（已成立 151 / 计划中 26 / 筹集中 1），但 DB 允许，测试必须覆盖。

`commitMetadataSchema` **不含 `endDate`**（与不含 `productId` 同理）：它是派生字段，只能由不变量决定，不接受客户端直接写入。

**测试**：`worker/tests/unit-commit.test.ts` 覆盖 5 种状态转移组合（→归档 / 归档→归档 / 归档→非归档 / 非归档→非归档 / **原状态为 `null`**）；e2e 断言"把已归档单元改回已成立后 `end_date` 为 `NULL`"。

### [Decision G] 番号对换写几条日志

**两条 `adjust`，每个单元各一条，`amount_cents = 0`，`pnl_cents = NULL`，`source = "auto"`。**

- **两个单元都写**：时间线按 `unit_id` 过滤。只写 A 的话，打开 B 的对话框会看到番号莫名变了却无迹可寻。可审计性上不可妥协。
- `product_id` / `product_name` 取该单元**当前**产品（对换不改产品），这样行在 `/capital-logs` 仍能正确 join。FK 是 `RESTRICT`，产品仍存在，安全。
- **备注拼装**：机器可读部分在前，用户备注在后 —— `番号对换: CU-A → CU-B` + `\n${note}`。拼装在 `worker/lib/unit-commit.ts` 内完成，可测。

**切换产品**沿用既有语义：对旧产品 `withdraw`（`-amountCents`），对新产品 `invest`（`+amountCents`）。`pnl_cents` 挂在 **`withdraw`** 行 —— 收益在退出时兑现，读者也会在那里找它。

**元数据修改**：一条 `adjust`，`amount_cents = 0`，备注 = 生成的字段变更摘要 + 用户备注。

### 新增 `GET /api/units/:id/logs`

**一次请求同时满足对话框的两个需求**：时间线数据 + `expected` 并发快照。

```ts
{
  logs: Array<ContributionLogRow & { createdAtMs: number | null }>,  // 上限 500，已归一化排序
  expected: ExpectedUnitSnapshot,   // 与 expectedUnitSchema 同形状的 10 个字段
}
```

`created_at` 已在**服务端归一化**为 `createdAtMs: number | null`（[Decision H]），前端不再重复实现归一化逻辑。

**`expected` 一并返回，而不是让前端另调 `GET /api/units/:id`**，有三个理由：

1. **原子性**：两次请求之间单元可能被改，快照与日志会来自不同时刻。同一次查询取出，`expected` 与 `logs` 天然一致。
2. **防误用**：前端手边已有映射过的 `SerializedUnit`，若不显式给一份 raw 快照，实现者极可能顺手拿它当 `expected` —— 而 `toDomainUnit` 的 `?? ""` / `?? "CNY"` 兜底会让守卫恒不匹配（[Decision B]）。返回专用字段是把正确用法变成默认用法。
3. **少一次往返**：对话框打开时只发一个请求。

`ExpectedUnitSnapshot` 直接取自 `repos.units.findById()` 的原始行（`null` 保持 `null`，不经任何映射），字段与 `expectedUnitSchema` 严格一一对应 —— 客户端把它**原样**放进 `/commit` 的 `expected` 即可，不做任何加工。

`src/lib/worker-db-client.ts` 的 `listUnitLogs` 返回类型必须同步声明这两个 key，否则前端拿不到 `expected` 且无类型报错（与 [Decision J] 里两个 summary 方法内联声明的坑同源）。

### [Decision H] 时间戳归一化

新建纯模块 `worker/lib/contribution-log-time.ts`（在 95% 覆盖率 `include` 内 —— 这正是目的，下表每一支都是强制测试用例）：

```ts
export function normalizeLogTimestamp(raw: unknown): number | null;
export function compareLogsForTimeline(a, b): number;
export function sortLogsForTimeline<T>(logs: T[]): T[];
```

| 输入 | 判定 | 输出 |
|---|---|---|
| `null` / `undefined` | — | `null` |
| `Date` | 上游已解码 | `.getTime()`，`NaN` → `null` |
| `number ≥ 1e12` | 毫秒 | 原值 |
| `number ∈ [1e9, 1e12)` | 秒 | `× 1000` |
| `number ∈ (0, 1e9)` | 秒（2001 前 / 测试夹具） | `× 1000` |
| `number ≤ 0` | 哨兵值 | `null` |
| 全数字 `string` | 按数字递归 | — |
| ISO-8601 `string` | `Date.parse` | `NaN` → `null` |
| 其他 | — | `null` |

`1e12` 这个分界点是无歧义的：2001–5138 年之间，秒与毫秒差三个数量级。**这是唯一不直观的地方，代码里留一行注释说明**。

排序：`operation_date` DESC（`YYYY-MM-DD` 文本字典序可靠）→ `createdAtMs` DESC（`null` 排最后）→ `id` DESC 兜底，保证两个时间戳都不可读时顺序仍确定。

**读取路径是最容易做错的一环**：Drizzle 的 `mode:"timestamp"` 会 `new Date(value * 1000)`，毫秒行解码成公元 58500 年，ISO 文本行解码成 `Invalid Date`。所以归一化**必须跑在原始列值上**，仓库方法要用原始投影绕开编解码器：

```ts
const rows = await db.select({
  ...getTableColumns(contributionLogs),
  rawCreatedAt: sql<number | string | null>`${contributionLogs.createdAt}`,
})...
```

SQL 只按 `operation_date DESC` 排，次级排序在 JS 里做（单元维度只有几十行，SQL 排序无收益，且 `CASE` 表达式还得往 `worker/tests/setup.ts` 里抄一份）。

**顺带修两个共用同一坏排序的读取路径**：

1. `getLatestInvestLogs`（`worker/db/repositories/contribution-logs.ts:34-72`）—— 用同样有问题的 `desc(createdAt)` 做次级排序，喂给 `/warehouse`、`/funds` 和 MCP 的 `availableDate`。同一 `operation_date` 上有两条不同编码的 invest 日志时会选错。
2. `search()`（同文件 `:124`）—— `/capital-logs` 主列表的排序，同样是 `desc(operationDate), desc(createdAt)`。**只修单元时间线不够**：主日志页是用户看历史的主入口，两处必须用同一个比较器，否则同一批数据在两个页面顺序不一致。

两处都改为「SQL 只按 `operation_date DESC` 排 → JS 侧用 `sortLogsForTimeline` 做次级排序」。`search()` 因为有 `limit/offset` 分页，需注意归一化排序发生在**分页之后**（页内重排），这对 500 条上限内的单元时间线无影响，对主列表则意味着跨页边界的同日期记录顺序仍可能不理想 —— 记入 [Risk 8]，本期不做跨页全量排序。

### [Decision I] 不动 "productId 必须单独更新" 约束

`worker/db/validation.ts:164-174` 的约束不是领域规则，而是 `PUT /api/units/:id` 双分支实现的护栏 —— productId 分支在 `:898` 提前返回，会静默丢弃其他字段。放宽它意味着合并双分支，改变 MCP 工具及其他 `PUT` 调用方的行为，并作废 `worker/tests/validation.test.ts:399` 与 `worker/tests/e2e/units.e2e.test.ts:243`。那是一次独立的重构，有自己的风险面。

对本期 UI **零成本**：编辑器此后不再通过 `PUT` 发 `productId`，产品切换走 `/commit` 的 `switch_product` 操作，`commitUnitSchema.metadata` 也刻意排除了 `productId`。绕行代码自然停止被调用，约束原地不动。

**`src/lib/unit-update-diff.ts` 的去向：改造，不删除。** 编辑器改走 `/commit` 后 `productIdPayload` 成为死代码，但 `otherPayload` 正是 `metadata` 想要的：

- 模块更名 `src/lib/unit-commit-plan.ts`，`buildUnitUpdateDiff` → `buildUnitMetadataDiff(initial, current): UnitMetadataPatch | null`（单一返回值，不再分裂）。
- 删掉 `src/__tests__/lib/unit-update-diff.test.ts` 中 productId 专属的 4 个用例（:32-62），保留并改造其余 7 个 —— 逐字段拾取与置空的覆盖才是有价值的部分。
- 独立成一个 `refactor(...)` commit，可单独回滚。该文件**不在** `vitest.config.ts` 的 `coverageExclude` 里，全局 95% 门控，替代品必须保持覆盖。

### [Decision J] `totalPnl` 的类型契约

`ContributionSummary`（`worker/db/types.ts:53`）是**手写 interface**，不是 Drizzle 推断类型 —— 加 `pnl_cents` 列不会让它自动带出 `totalPnl`。P1-C13 必须显式改它，否则端点返回的字段与类型不符，`tsc` 直接报错。

三个子问题一次定死：

| 问题 | 结论 | 理由 |
|---|---|---|
| **必填还是可选** | **必填** `totalPnl: number` | 与同结构的 `totalInvested` / `totalWithdrawn` / `netAmount` 一致。无 pnl 数据时聚合为 `0`，不是 `undefined` —— 可选会逼所有消费方写 `?? 0` |
| **`summarizeByProduct` 是否也返回** | **是** | 两个方法共用同一个 `ContributionSummary` 返回类型（`contribution-logs.ts:174`），加了字段就是两边都有。刻意让 product 侧返回 `0` 反而要写额外分支 |
| **`WorkerDbClient` 是否同步** | **必须** | `getContributionLogsSummaryByUnit`（`src/lib/worker-db-client.ts:286`）和 `...ByProduct`（`:297`）各自内联声明了返回结构，**不引用** `ContributionSummary`。两处都要手动加 `totalPnl: number`，漏一处则前端拿不到该字段且无类型报错 |

聚合口径：`SUM(COALESCE(pnl_cents, 0))`，跳过软删除行（与现有 `summarizeByUnit` 的 `deletedAt IS NULL` 条件一致）。`unitCount?: number` 那种"仅 product 侧有"的可选字段模式**不复用** —— 它已经是既有设计里的一处别扭，不该再加一个。

### [Decision K] `source='mcp'` 正式入枚举，而非改写为 `auto`

B2b 指出生产有 132 行 `source='mcp'`，而 `CONTRIBUTION_SOURCES`（`worker/db/enums.ts:63`）只有 `manual | auto | import`。两条路可走：

| 方案 | 做法 | 问题 |
|---|---|---|
| ① 未来写 `auto` | MCP 改成写已有的 `auto` | **存量 132 行不迁移**（存量不管），它们会永远卡在枚举外：`/capital-logs` 的来源筛选器筛不出、`searchContributionLogsSchema` 的 `source` 参数匹配不到。等于把已知脏数据永久藏起来 |
| ② **正式加 `mcp`**（采纳） | 枚举、领域类型、UI 筛选器同步加 | 改动面跨 worker/web，需拆两个 commit |

**选 ②**。理由是存量既然不迁移，枚举就必须**如实反映库里真实存在的值**，否则筛选器对用户撒谎。而且 `mcp` 与 `auto` 语义本就不同 —— 一个是 AI 助手代操作，一个是系统在用户改产品时自动补记，混为一谈会丢失可追溯性。

**必须拆三个 commit**（文档自身规则：任何 commit 不得同时改 `worker/` 与 `src/`；且 Phase 2 不碰 UI）：

- **P1-C14** `feat(worker): add mcp to contribution sources` —— `worker/db/enums.ts:63` 加 `"mcp"`；`createContributionLogSchema` / `searchContributionLogsSchema` 自动跟随（它们引用同一常量）。测试：`worker/tests/validation.test.ts` 断言 `source: "mcp"` 通过校验。
- **P2-C8** `feat(types): add mcp to contribution source union` —— 仅改 `src/domain/types.ts:142` 的 union 加 `"mcp"`。**不含 UI**。
- **P3-C7**（并入既有的 `/capital-logs` 改动）—— `src/app/capital-logs/capital-logs-client.tsx:62` 的 `SOURCES` 数组加 `{ value: "mcp", label: "AI 助手" }`。

> **部署顺序**：P1-C14 先上（worker 放宽校验），P2-C8 / P3-C7 后上（web 展示）。反过来会出现 web 发 `source=mcp` 查询而 worker 校验拒绝的窗口。

> 注意 P2-C7 修的是**未来**的 MCP 写入（符号/日期），P1-C14 + P2-C8 + P3-C7 解决的是**存量** 132 行的可见性。两者互补，都要做。

---

## UI

### 三栏布局

`DialogContent` 本身已是 `grid gap-4`（`src/components/ui/dialog.tsx:52`），**不能**直接加 `grid-cols-3` —— 会把 `DialogHeader` 和关闭按钮也排进列。必须用内层容器：

```tsx
<DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
  <DialogHeader>…</DialogHeader>
  <div className="grid gap-6 lg:grid-cols-3">
    {/* 栏1 基础信息 · 栏2 产品信息 + 常见操作 · 栏3 历史时间线 */}
  </div>
  <Separator />
  {/* 统一备注框（commitNote，审计用）+ 取消 / 保存 */}
</DialogContent>
```

响应式白拿：默认单列，≥1024px 三列（D3）。`max-w-6xl` 是本仓库第一个超过 `sm:max-w-2xl` 的对话框 —— 作为**有意的、限定范围的例外**记录在此。

**新建模式保持单栏 `max-w-lg`，并保留产品下拉框。** 没有单元就没有时间线、没有操作、没有日志。"不再用下拉切换产品"只适用于**修改已存在单元**的产品。这是最容易被无声破坏的点，列为验收标准。

### 新增组件（`src/components/capital/`）

| 文件 | 职责 |
|---|---|
| `unit-panel-primitives.tsx` | 从 `unit-tooltip.tsx:33-71` 提取 `SectionTitle` + `DataRow`，原文件逐字改为 import |
| `unit-log-timeline.tsx` | 栏3 纵向历史列表 + 逐行损益内联编辑 |
| `unit-operations-panel.tsx` | 栏2 操作按钮 + 待生效卡片（逐张可撤销） |
| `unit-swap-picker.tsx` | 可搜索单元选择器，仿 `unit-editor.tsx:447-534` 的产品选择器 |

栏1、栏2 的纯展示标记留在 `unit-editor.tsx` 内 —— 抽离无逻辑的容器只会增加 prop 钻取而不增加可测性。**只抽有逻辑的部分**。

`unit-log-timeline.tsx` 参照 `src/components/plan/day-detail-popover.tsx:150-183`：`<ul className="divide-y divide-border">` + 前置彩色圆点 + `min-w-0 flex-1` 中段 + 右对齐 `tabular-nums`。

`investment-timeline.tsx` 是**未来预测**的横向甘特条（按产品参数推演锁定/开放周期），与历史无关，**不复用**，原地留在栏2。

操作类型与来源标签必须走 `src/components/ui/colored-badge.tsx`（`CLAUDE.md` 徽章规范）。

**把 `SerializedUnit` 从 `unit-editor.tsx:90` 移到 `src/domain/types.ts`**（它是 `src/app/warehouse/page.tsx:25-44` 和 `funds/page.tsx` 都在构造的领域形状），在 `unit-editor.tsx` 保留 re-export 兼容，避免 `unit-tooltip.tsx:4` 和 4 个新组件都从组件文件 import 类型。

### 暂存状态建模

```ts
// src/lib/unit-commit-plan.ts（纯函数，覆盖率门控）
export type StagedOperation =
  | { kind: "swap_unit_code"; targetUnitId: string; targetUnitCode: string }
  | { kind: "switch_product";
      fromProductId: string | null; fromProductName: string | null;
      toProductId:   string | null; toProductName:   string | null;
      pnl: number | null;                    // UI 层用元
    };
```

每个变体自带卡片渲染所需的展示字段，渲染时无需回查；序列化时剥离并做元→分换算。

同模块的纯函数 API（组件只持有 `useState<StagedOperation[]>`）：

```ts
stageOperation(current, next): StagedOperation[]     // 同 kind 替换，不可变
unstageOperation(current, kind): StagedOperation[]
describeStagedOperation(op): string                   // 卡片标题
buildUnitMetadataDiff(initial, current): UnitMetadataPatch | null
buildCommitPayload({ unit, form, operations, commitNote, operationDate }): CommitUnitInput | null
```

需在 `src/__tests__/lib/unit-commit-plan.test.ts` 钉死的不变量：每种 `kind` 至多一个；`swap_unit_code` 的 `targetUnitId === unit.id` 被拒；`switch_product` 的 `toProductId === fromProductId` 被拒；元数据无变更 **且** 无操作 **且** `commitNote` 为空时 `buildCommitPayload` 返回 `null`；元→分用 `Math.round(x * 100)`；**暂存 `swap_unit_code` 时 `unitCode` 输入被禁用**（[P1-5]）；**暂存 `switch_product` 时金额输入被禁用**（[Decision C]）；`expected` 快照取自打开对话框时 `GET /api/units/:id` 的**原始响应**（10 个字段，`null` 保持 `null`，**不得**用 `toDomainUnit`/`SerializedUnit` 的兜底产物，[Decision B]）。

> 底部备注框绑定的是 `commitNote`（审计备注，写进日志）；单元的持久备注 `unitNote` 仍是栏1 的普通表单字段，走 `metadata`。两者在 UI 上要有明确区分的 label，避免用户混淆。

这与既有的 `unit-update-diff.ts` 模式一致 —— 逻辑放进受测纯模块，`unit-editor.tsx`（681 行，无组件测试）保持薄壳。

### `pnl_cents` 全部触点

| 文件 | 改动 |
|---|---|
| `worker/db/validation.ts` | `create` **和** `update` 两个 schema 都加 `pnlCents`（后者是时间线内联编辑的通路） |
| `worker/db/repositories/contribution-logs.ts` | **`update()` 的 `Pick<>` 加 `"pnlCents"`**（B3，否则静默丢弃）；`summarizeByUnit` 加 `totalPnl` |
| `worker/db/types.ts` | `ContributionLog` 无需改动（`$inferSelect` 自动带出 `pnlCents`）；但 **`ContributionSummary`（`:53`）是手写 interface，必须显式加 `totalPnl: number`** —— 见 [Decision J] |
| `worker/src/index.ts` | 仅 `/commit` 的 INSERT 列表；`POST /api/contribution-logs` 展开 `parsed.data`，验证放行即可用 |
| `src/lib/worker-db-client.ts` | 两个日志方法加 `pnlCents?`；新增 `commitUnit` / `listUnitLogs`；**两个 summary 方法（`:286` / `:297`）的内联返回类型各加 `totalPnl: number`**（[Decision J]） |
| `src/lib/capital-mappers.ts` | `toDomainContributionLog`（:69-90）加 `pnl`；`createdAt`（:87）改为优先取 `createdAtMs` |
| `src/domain/types.ts` | `DomainContributionLog` 加 `pnl`；`ContributionSummary` 加 `totalPnl` |
| `src/app/actions/contribution-log-actions.ts` | create/update 加 `pnl?`，`Math.round(pnl * 100)` |
| `src/app/capital-logs/capital-logs-client.tsx` | 加"收益"列（否则损益在主日志页不可见）；`SOURCES` 数组加 `mcp`（[Decision K]，P3-C7） |
| `src/lib/mcp/tools/unit.ts:576,600` | **不需要**改 pnl（显式列表 + 可空列）；但要修 B2a（金额符号）与 B2c（`operation_date` 格式）。`source` 保持写 `'mcp'`，改的是枚举而非写入值（[Decision K]） |

备份/恢复与 MCP 查询不枚举 `contribution_logs` 列 —— 已核实，无影响。

---

## Testing Strategy（6DQ）

| 维度 | 内容 |
|---|---|
| **L1 Unit** | `worker/tests/contribution-log-time.test.ts`（归一化每一支，≥95%）、`worker/tests/unit-commit.test.ts`（语句构建器，≥95%）、`worker/tests/validation.test.ts`（`commitUnitSchema` + `pnlCents`）、`worker/tests/contribution-logs.test.ts`（pnl 往返、混合编码夹具经原始 sqlite 插入）、`src/__tests__/lib/unit-commit-plan.test.ts`（暂存不变量） |
| **L1 Component** | RTL：`unit-log-timeline` / `unit-swap-picker` / `unit-operations-panel`，参照 `src/__tests__/components/plan/*.test.tsx` |
| **L2 API** | `worker/tests/e2e/unit-commit.e2e.test.ts`：全成/全不成断言、409 走 `rawFetch`（`api()` 遇非 2xx 抛错）、番号对换后两个单元各有一条日志、`operation_date` 用本地日期 |
| **G1 静态** | `bun run typecheck && bun run lint`（biome `--error-on-warnings`） |
| **G2 安全** | pre-push 的 osv-scanner（已在用） |
| **D1 隔离** | L2 跑本地 `wrangler dev --local`，不连生产 D1 |

**混合编码夹具怎么造**：`worker/tests/setup.ts` 用真实 `better-sqlite3`，可绕过 Drizzle 直接 `INSERT` 出毫秒整数行、秒整数行、ISO 文本行，正是复现 B1 所需。

---

## Implementation Phases

每个步骤是一个**原子 commit**，编号 `P{phase}-C{n}`。每个 commit 后 `bun run test && bun run test:worker && bun run typecheck && bun run lint` 必须全绿。**任何 commit 不得同时改 `worker/` 与 `src/`。**

**Phase 0（前置，非 commit）**：`cd worker && bun install`（B5）。

### Phase 1 — Worker + DB ✅ 已完成

> **落地记录**：14 个 commit 全部完成，生产 migration 已应用并验证（`pnl_cents INTEGER`，可空、无默认值）。worker 测试 **247 → 321**，e2e **154 全过**，覆盖率 **92.06%/78.66%（原未达标）→ 97.49%/94.91%**。
>
> **实施中发现并修正的方案缺陷**：日志 INSERT 的守卫经过三轮才做对，过程值得记录 ——
>
> 1. **只比对 `unit_code`** → "既不改番号也不换产品"的提交在 CAS 落空后守卫恒真，日志照写。
> 2. **改用 `updated_at = now`** → 两个请求可能落在同一毫秒，输家的守卫会匹配赢家写下的时间戳。
> 3. **改用完整后置状态** → 看似严密，但两个请求做**相同修改**时后置状态一致，输家仍会匹配（用 SQLite 复现：`updateChanges=0, logInsertChanges=1`）。
>
> 最终方案是 `0009` 迁移新增的 `capital_units.commit_token`：每次请求生成随机 token，由 `[0]` 写入、由 `[1]` 与每条日志 INSERT 比对。**只有它能证明"这行是我改的"，而非"这行长得像我要的样子"**。
>
> 4. **补漏**：token 最初只用在日志守卫上，`[1]`（改对换伙伴的番号）仍在比对 `unit_code`。而 `unit_code` **没有唯一索引** —— 别的请求可以把 A 改成同样的番号，于是输家的 `[1]` 照样改了伙伴 B（复现：`changes=[0,1,0,0]`，接口返回 409 但数据库已部分写入）。`[1]` 也改用 token 后闭合。
>
> 教训：业务字段的后置状态可以重复，不能用作身份凭证 —— 而且一旦引入身份凭证，**每一条依赖"前序是否成功"的语句都要用它**，漏一条就留一个洞。


| # | Commit | 文件 | 门控 |
|---|---|---|---|
| P1-C1 | `feat(db): add 0008 pnl_cents migration` | `worker/db/migrations/0008_contribution_log_pnl.sql` | 本地 `wrangler d1 migrations apply noheir-db --local`；**部署门：本 commit 合并后立即 `--remote` 应用到生产，确认 `PRAGMA table_info(contribution_logs)` 含 `pnl_cents` 后，才继续合入 P1-C2** |
| P1-C2 | `feat(schema): add pnl_cents to contribution_logs` | `worker/db/schema.ts`, `worker/tests/setup.ts` | 仓库测试加 pnl 用例；typecheck |
| P1-C3 | `feat(worker): normalize mixed created_at encodings` | `worker/lib/contribution-log-time.ts` | 新建测试，每一支覆盖，≥95% |
| P1-C4 | `fix(worker): tiebreak latest invest log by normalized time` | `worker/db/repositories/contribution-logs.ts` | 混合编码夹具测试 |
| P1-C5 | `fix(worker): apply normalized sort to log search` | 同仓库文件 `search()` | 仓库测试：同 `operation_date` 下三种编码混排结果稳定 |
| P1-C6 | `feat(worker): list unit logs with normalized timestamps` | 同仓库文件（原始 `sql<>` 投影） | 仓库测试 |
| P1-C7 | `feat(worker): accept pnlCents in log validation` | `worker/db/validation.ts` + 仓库 `Pick<>` | validation 测试 + 仓库 pnl 更新行为测试（B3 澄清见上） |
| P1-C8 | `feat(worker): unit commit statement builder` | `worker/lib/unit-commit.ts`（纯，含 `resolveEndDate`） | 新建测试，≥95%，覆盖 5 种归档状态转移（[Decision F]） —— **本期承重 commit** |
| P1-C9 | `feat(worker): add commitUnitSchema` | `worker/db/validation.ts` | validation 测试 |
| P1-C10 | `feat(worker): POST /api/units/:id/commit` | `worker/src/index.ts`（仅管道） | 新建 e2e：409（全字段锚点）、全成/全不成、`endDate` 不变量、无产品时带 pnl 返 400、**全 NULL 可选字段的单元能正常提交**（[Decision B]） |
| P1-C11 | `feat(worker): GET /api/units/:id/logs` | `worker/src/index.ts` | e2e：`logs` 已归一化排序 + **`expected` 的 10 个字段与 DB 原始值逐一相等（`null` 不被兜底）** |
| P1-C12 | `fix(worker): use local date for auto-log operation_date` | `worker/src/index.ts:814` | e2e 断言本地日期（B4） |
| P1-C13 | `feat(worker): include totalPnl in summaries` | 仓库 + `worker/db/types.ts` + 端点 | 仓库测试 + e2e（见 [Decision J]） |
| P1-C14 | `feat(worker): add mcp to contribution sources` | `worker/db/enums.ts` + validation | validation 测试（见 [Decision K]） |

> **P1-C1 / P1-C2 顺序不可颠倒**：先 migration、再 schema/代码。反过来会出现"已部署的 Worker 引用了远端尚不存在的列"的窗口，`pnl_cents` 相关查询会直接 500。这也是为什么两个 commit 之间夹了一道**人工部署门**而不是连续合并。

### Phase 2 — Domain + Actions（不碰 UI）✅ 已完成

> **落地记录**：web 测试 **975 → 1009**，typecheck / lint 全绿。新增 `src/__tests__/lib/capital-mappers.test.ts`（此前无测试）与 `src/__tests__/mcp/unit-log-writer.test.ts`（对 SQL 文本做回归断言，锁住 B2a/B2c）。


P2-C1 类型（`DomainContributionLog.pnl`、`ContributionSummary.totalPnl`、`SerializedUnit` 迁至 `src/domain/types.ts` 并 re-export）· P2-C2 `capital-mappers.ts`（pnl + `createdAtMs`）· P2-C3 `worker-db-client.ts`（`commitUnit`、`listUnitLogs` 含 `expected`、pnl 参数、两个 summary 加 `totalPnl`）· P2-C4 `src/lib/unit-commit-plan.ts` + 测试 · ~~P2-C5 `refactor: fold unit-update-diff into unit-commit-plan`~~ **→ 顺序调整为 P3-C6**（删除 `unit-update-diff.ts` 必须在 unit-editor 改用 `/commit` 之后，否则破坏编译）· P2-C6 Server Actions · **P2-C7 `fix(mcp): correct withdraw sign and date format`（B2a + B2c + 回归测试；B2b 走 [Decision K] 另行处理）** · **P2-C8 `feat(types): add mcp to contribution source union`（仅 `src/domain/types.ts` 的 union，UI 筛选器留到 P3-C7；须在 P1-C14 之后部署）**

### Phase 3 — UI ✅ 已完成

> **落地记录**：web 测试 **1009 → 1024**（净值含删除 9 个已废弃的 `unit-update-diff` 用例），新增 3 个组件测试文件。`bun run build` 通过。
>
> **实施中的两处调整**：
> 1. **P2-C5 顺延为 P3-C6** —— 删除 `unit-update-diff.ts` 必须在 unit-editor 改用 `/commit` 之后，否则破坏编译。
> 2. **编辑模式抽为独立组件** `unit-commit-dialog.tsx` —— 三栏布局与单栏创建表单的状态模型差异过大（前者有暂存操作、时间线、raw 快照），塞进同一个组件会让 `isEditing` 分支遍布全文件。抽离后 `UnitEditor` 只做路由，创建模式的产品下拉与单栏布局原样保留（文档验收标准）。顺带删除了 `UnitEditorForm` 中因此变成死代码的整个编辑分支。
> 3. **jsdom 环境补 polyfill** —— cmdk 依赖 `ResizeObserver` 与 `Element.prototype.scrollIntoView`，jsdom 均不提供。加在 `src/__tests__/setup/jsdom.ts`（环境 polyfill，非业务 mock）。


P3-C1 提取 `unit-panel-primitives.tsx` · P3-C2 `unit-log-timeline.tsx` + RTL · P3-C3 `unit-swap-picker.tsx` + RTL · P3-C4 `unit-operations-panel.tsx` + RTL · P3-C5 三栏布局 + 备注框 + 接 `/commit`（**仅编辑模式**）· P3-C6 时间线逐行 pnl 内联编辑 · P3-C7 `/capital-logs` 收益列 + 独立日志表单 pnl 字段 + **来源筛选器加 `mcp`（[Decision K]）** · P3-C8 文档收尾 + release

---

## 设计空白的处置（已实现，按倾向落地）

以下是设计意图里的**空白或张力**。实现时按每条注明的倾向执行，未再回头确认；如与预期不符，改动成本都很低。

1. **只填备注就保存 → 允许**，写一条裸 `adjust` 日志（`amount_cents = 0`）。备注本身就是一条历史记录。Zod refine 放行，`buildCommitPayload` 在"无元数据 + 无操作 + 空备注"时才返回 `null`。

2. **`commitNote` 每行都带**。一次保存同时做"对换 + 切换产品"会产生 4 条带相同备注的日志（对换 2 条 `adjust` + 切换 1 条 `withdraw` + 1 条 `invest`）。选择让每行自包含，审计时不必回溯同批次的其他行 —— 代价是 `/capital-logs` 上看着重复。

3. **时间线的 pnl 编辑即时生效**，不进 `/commit` 的暂存集合：它修改的是**已有历史**，而暂存表达的是"对当前单元的待生效变更"，两者语义不同。走独立的 `PUT /api/contribution-logs/:id` + 自己的 toast。因此 `refreshLogs()` 刻意不重取 `expected`（编辑日志不动 `capital_units`）。

4. **`summarizeByUnit` 的 0 金额行保持现状**：`amountCents > 0` 记为投入、`else` 记为取出，于是 0 金额的 `adjust` 行落进"取出"分支（加 0）并让 `logCount` 计入。金额统计不受影响，改判定反而要动一个被多处依赖的函数。已加测试钉住该行为，见 `summarizeByUnit counts zero-amount adjust rows in logCount`。

---

## Risks & Mitigations

1. **守卫链 SQL 写错 → 静默空提交**。缓解：构建器是纯函数且 95% 门控；e2e 必须包含"并发修改导致 409"与"全成/全不成"两类断言。回退：`/commit` 是新端点，旧 `PUT` 路径未动，revert P1-C10 即可。
2. **`worker/tests/setup.ts` 的 DDL 与 migration 分叉**。缓解：P1-C1（migration）与 P1-C2（schema + 测试 DDL）相邻落地，且 P1-C2 的测试会因缺列而失败，形成天然门控。
3. **Drizzle 时间戳编解码器吃掉原始值**。缓解：仓库用 `sql<>` 原始投影；测试用原始 sqlite 插入三种编码夹具。
4. **`max-w-6xl` 在 1024–1280px 之间过挤**。缓解：`lg:` 断点为 1024px，先在 1280px 与 1024px 两档手测；必要时提到 `xl:grid-cols-3`。
5. **时间线无分页**：`searchContributionLogs` 上限 500。缓解：取 500 上限并在列表底部标注"仅显示最近 500 条"。
6. **提交后对话框数据陈旧**：`router.refresh()` 重渲页面但不刷新对话框内**自行拉取**的时间线。缓解：提交成功后对话框自己重拉日志，并清空暂存操作与备注框。
7. ~~**存量 65 条 MCP withdraw 符号错误污染汇总**（B2a）~~ **已清理**，见下方"存量数据清理"。
8. **主日志列表跨页排序**：`search()` 的归一化次级排序发生在 SQL 分页之后，跨页边界上同 `operation_date` 的记录顺序仍可能不理想。缓解：本期只保证页内正确；单元时间线（500 条上限、无分页）不受影响。

## 落地后审查修复（R4）

实现完成后的代码审查发现 6 个问题，均已修复：

| 级别 | 问题 | 修复 |
|---|---|---|
| P1 | **表单与 CAS 锚点不同源** —— 表单从 `unit` prop 初始化，`expected` 来自另一次请求。两者版本不同则用户基于旧数据编辑却用新快照过 CAS，**静默覆盖并发修改** | 新增 `formSnapshotFromExpected()`，表单在快照到达后从**同一份** raw 数据派生。另拆出 `refreshLogs()`：内联 pnl 编辑只动 `contribution_logs`，**不重新锚定** `expected` |
| P1 | **对换目标日志丢失产品快照** —— `productId`/`productName` 写死 `null`，违反 Decision G "取该单元当前产品" | `SwapTarget` 增加产品字段，端点查询目标单元的产品一并传入 |
| P2 | **归档日期误用操作日期** —— 补录历史日志并同时归档时，`end_date` 被回填成历史日期 | `BuildCommitInput` 拆出独立的 `today` 参数；`operationDate` 是资金移动时间，`today` 是归档时间 |
| P2 | **产品选择未区分"未选择"与"取消关联"** —— 两者都用 `null`，且确认按钮始终可用 | `undefined` = 未选择（确认按钮禁用），`null` = 显式取消关联；单元本就无产品时隐藏"取消关联"选项（避免 `null → null` 被后端 400） |
| P3 | 独立日志表单用 UTC 默认日期 | 新增 `src/lib/local-date.ts`，与 worker 的 `getLocalDateString` 对齐 |
| P3 | `search()` 用 `createdAtMs` 排序却不返回该字段 | 随行返回，前端 mapper 不再回退解析混合编码 |

> **验证方式**：P1-2 与 P2-3 的修复都先临时回退代码，确认新增测试能精准捕获，再还原。测试 web **1024 → 1035**、worker **321 → 323**、e2e **154 → 156**，覆盖率 97.84% / 94.91% / 100%。

### 第二轮审查修复（R5）

R4 关闭 5 项后，复审发现 2 处遗漏：

| 级别 | 问题 | 修复 |
|---|---|---|
| P1 | **产品操作区仍未同源** —— R4 只把*基础表单*改成从 `expected` 派生，产品面板和锁定期时间线仍读旧的 `unit` prop。页面显示产品 A 而快照已是 B 时，用户点"取消关联"会成功解除 **B**，但他以为在操作 A | `UnitOperationsPanel` **移除 `unit` prop**，改收 `unitId` + `currentProductId` 两个显式字段 —— 组件拿不到整个 unit，就无从渲染旧数据。对话框传 `expected?.productId`，`selectedProduct` 同步改用快照。另用 `<fieldset disabled={loading}>` 包住编辑区，快照到达前不可操作 |
| P2 | **对换目标产品未进守卫** —— 端点读取目标产品后、批处理执行前，若目标切换了产品，对换仍成功但日志记的是旧产品 | 目标产品纳入 `[0]` 号语句的 null-safe 守卫。`[1]` 号语句依赖 `[0]` 的后置状态，自动受保护 |

> **一处如实说明**：P1 的护栏是**结构性**的（移除 prop 使误用无从发生）+ 组件测试锁住"渲染被告知的产品"，而非类型强制 —— 调用方若传 `unit.productId` 类型上仍合法。P2 的守卫覆盖的是"端点读取 → 批处理"窗口；"客户端读取 → 端点读取"这段由端点在请求内重新读取目标来保证，e2e 验证的是后者的契约（日志记提交时刻的产品）。
>
> 测试 web **1035 → 1036**、worker **323 → 325**、e2e **156 → 157**。

## 存量数据清理（v2.6.0 之后）

写入侧修好后，存量的三类脏数据也一并清掉了 —— 原计划"存量不管"，但 B2a 的 **65 条符号错误让 43 个单元的"累计投入"虚高 325 万元**，属于会误导判断的数字失真，不宜留着。

| 问题 | 行数 | 处置 |
|---|---|---|
| B2a `withdraw` 金额为正 | 65 | `SET amount_cents = -amount_cents` |
| B2c `operation_date` 是 ISO 串 | 132 | `SET operation_date = substr(...,1,10)` |
| B1 `created_at` 为 ISO 文本 | 132 | `CAST(strftime('%s',...) AS INTEGER)*1000` |

执行前导出了受影响的 132 行（三类有重叠）作回滚依据。清理后核对：

- 三类问题计数均归零，日志总数 **359 条不变**
- 三个来源的 `created_at` 现在都能用同一公式解析（`auto` / `import` / `mcp` 时间区间均合理）
- 符号规则全站一致：`invest` 全正、`withdraw` 全负

**代码层的归一化逻辑全部保留** —— `normalizeLogTimestamp`、`formatOperationDate`、`substr()` 排序筛选都还在。它们的价值不只是兼容存量：`created_at` 仍有秒/毫秒两种整数编码（Drizzle 写秒、Worker 写毫秒），而且备份恢复等路径仍可能引入旧格式。

## References

- `docs/17-contribution-logs.md` — `contribution_logs` 原始设计
- `docs/002-recurring-expense-calendar.md` — 本文档结构与 Phase 划分范本
- `docs/001-capital-unit-date-refactor.md` — `availableDate` 重构（`daysUntilMaturity → daysUntilAvailable`）
- `worker/src/index.ts:766-899` — CAS + batch + 补偿的既有先例
- `src/components/plan/day-detail-popover.tsx:150-183` — 纵向列表视觉范本
- `src/components/ui/colored-badge.tsx` — 徽章规范
