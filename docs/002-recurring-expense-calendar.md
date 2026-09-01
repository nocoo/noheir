# 002 Recurring Expense Calendar（资金计划）

家庭大额周期支出（保险、房租、物业费、年费、订阅等）的录入、管理、分类与日历可视化。

## Objective

### 用户故事
- 作为家庭财务记录者，我要把"保险（年缴）"、"房租（月缴）"、"物业费（季缴）"等周期支出登记一次，系统自动告诉我未来每天有多少钱要付。
- 作为分类强迫症患者，我要自定义分类（名字 + 颜色），把支出归类、在日历上一眼看出"红色 = 保险、蓝色 = 房租"。
- 作为现金流规划者，我打开日历就能在月视图里看到当月每天的应付金额，并通过汇总卡得到"未来 30 天 / 未来 12 个月 / 当月合计"三个数。
- 作为历史复盘者，我能切到任意年月的日历（包括 2024 年），看当时的规则会落到哪天。
- 作为生活变化的人，我要能**暂停**某条规则（数据保留、不再渲染）；某条规则到期后可以**结束**（保留历史、不再渲染未来）。

### 成功标准（可测条件）
1. 用户在 `/plan/categories` 创建分类「保险」配色 `chart-9`（红色 token），再在 `/plan/calendar` 创建一条"每年 1 月 5 日 8000 元、分类=保险"的规则，1 月 5 日的格子上出现红色徽章 `¥8000`，色值取 `hsl(var(--chart-9))`。
2. 切换到 2024 年 1 月，**前提 `startDate <= 2024-01-05`**（用户在表单里把起始日设到 2024 或更早），规则在该月正常显示（历史回溯）。表单允许 `startDate` 任意 ISO 日期（包括过去），默认值为今天但用户可改。
3. 暂停规则后，日历不再渲染、列表灰显且标"已暂停"；恢复后重新渲染。
4. 用户手动按"结束"后：
   - 服务端写入 `status='ended'` + `endedAt=today`（同一 Server Action 内原子完成）。
   - 列表显示"已结束 · YYYY-MM-DD"。
   - 切到**历史**月份，规则在 `[startDate, min(endedAt, endDate ?? +∞)]` 窗口内的 occurrence 仍然渲染（保留历史；与下文 Occurrence 算法的统一公式一致）。
   - 切到 `> endedAt` 的月份，不渲染。
   - `endDate`（用户设定的规则窗口，与 `endedAt` 不同）：`> endDate` 的日期始终不展开；若 `endDate < today` 且 `status='active'`，列表派生显示"已到期"提示，**`status` 不被自动改写**（所有状态变更必须经 Server Action）。
5. 汇总卡：
   - **当月合计**：随视图月切换变化（用视图月的 `monthStart..monthEnd`）。
   - **未来 30 天 / 未来 12 个月**：始终基于**真实今天**，不随视图月变化（卡上注明"自今日起"）。
6. 每个写操作通过 Server Actions 完成，返回 `ActionResult`。
7. 删除分类时，引用它的规则 `categoryId` 自动置 `null`（`ON DELETE SET NULL`），规则保留可继续渲染（无分类色显示中性灰）。worker repository 在测试中验证此外键行为（环境兼容性见"风险"段）。
8. Sidebar 显示 `资金计划` 分区，包含 `日历` + `分类` 两个子项，与现有 `存量资金管理` 等分区视觉一致。
9. 日历视图首次渲染（已认证用户）≤ 2 秒（标准网络）；切月不出现 layout shift。

## Tech Stack（与项目其他模块一致）

| 层 | 选型 | 备注 |
|----|----|----|
| 框架 | Next.js 16.2.7（App Router） | 与现有页面一致 |
| 渲染 | Server Components 拉数据，Client Components 交互 | 与 `capital-decisions`、`expense` 一致 |
| 写操作 | Server Actions（`"use server"`），返回 `ActionResult<T>` | 与 `unit-actions`、`product-actions` 一致 |
| 数据通道 | `WorkerDbClient`（`@/lib/worker-db-client`） → Worker SQL API → D1 | 不新增 `app/api/<feature>/` |
| ORM | Drizzle ORM（worker 侧） | 与 `worker/db/schema.ts` 现有表一致 |
| DB | Cloudflare D1（SQLite 语义） | `strftime('%Y', date)`，非 `EXTRACT` |
| Sidebar 分区 | 在 `src/lib/navigation.ts` 的 `NAV_GROUPS` 加一个 group | 现有 `存量资金管理` 等分区先例 |
| UI 基础 | `@/components/ui/*`（card / button / dialog / input / table / badge / popover） | 复用现有组件库 |
| 表单校验 | Zod（`zod 4.5.4`） | 与 `unit-editor.tsx` 等一致 |
| 日历视图 | 自实现（CSS Grid 7×N），不引第三方日历 | 包体可控、定制空间足 |
| 颜色选择器 | 自实现（24 个 chart token 色块），不引第三方 | 复用 `popover`，不接受任意 hex |
| 日期工具 | `date-fns@4.4.0` | 已在依赖中 |
| 测试 | Vitest（`bun run test` + `bun run test:worker`） | 与现有单测一致 |

**不引入的依赖：** `rrule`、`react-big-calendar`、`@fullcalendar/*`、`react-color`。规则简单、日历用 CSS Grid、调色板用现成 popover 即可。

## Commands

```bash
bun run dev               # 启动 Next.js dev 服务（port 7004）
bun run build             # 生产构建（含 typecheck）
bun run typecheck         # tsc --noEmit
bun run lint              # biome check --error-on-warnings
bun run test              # 主仓 Vitest 单测
bun run test:worker       # Worker 单测（含新增 repository / SQL 端点）

# DB 迁移（新增 expense_categories + recurring_expenses 两张表）
cd worker && npx wrangler d1 migrations apply noheir-db --remote
```

## Project Structure

新增文件（仅列差异）：

```
docs/
  002-recurring-expense-calendar.md         # 本文档

src/app/plan/
  layout.tsx                                # 资金计划分区共用 shell（如需顶部 tab）
  page.tsx                                  # 默认重定向到 /plan/calendar
  calendar/
    page.tsx                                # Server Component, 拉数据
    plan-calendar-client.tsx                # Client Component: 日历 + 列表 + 汇总
  categories/
    page.tsx                                # Server Component, 拉数据
    plan-categories-client.tsx              # Client Component: 分类 CRUD

src/app/actions/
  recurring-expense-actions.ts              # CRUD + pause/resume Server Actions
  expense-category-actions.ts               # 分类 CRUD Server Actions

src/components/plan/
  recurring-expense-form.tsx                # 创建/编辑共用表单
  recurring-expense-calendar.tsx            # 月视图日历（CSS Grid）
  recurring-expense-list.tsx                # 旁侧列表（含状态 chip）
  frequency-picker.tsx                      # 周期选择器
  category-form.tsx                         # 分类表单
  color-token-picker.tsx                    # 24 色 token 选择器（hsl(var(--chart-N))）
  summary-cards.tsx                         # 当月 / 30 天 / 12 个月 三个 KPI
  occurrence-detail-popover.tsx             # 日格点击弹层

src/lib/recurring-expense/
  rule-types.ts                             # RecurrenceRule + Zod schema
  occurrences.ts                            # 纯函数: computeOccurrences(rule, from, to)
  occurrences-aggregate.ts                  # 汇总: sumWindow / sumMonth
  format.ts                                 # "每 3 个月"等人类语描述
  mappers.ts                                # raw row ↔ domain model
src/lib/expense-category/
  mappers.ts

src/__tests__/recurring-expense/
  occurrences.test.ts                       # 周期展开（边界覆盖）
  occurrences-aggregate.test.ts             # 汇总函数
  rule-types.test.ts                        # Zod 校验
src/__tests__/actions/
  recurring-expense-actions.test.ts
  expense-category-actions.test.ts

worker/db/schema.ts                         # 加 expenseCategories + recurringExpenses 两表
worker/db/migrations/0007_recurring_expenses.sql
worker/db/repositories/expense-categories.ts
worker/db/repositories/recurring-expenses.ts
worker/src/index.ts                         # 加 8 个 SQL 端点
worker/tests/expense-categories.test.ts
worker/tests/recurring-expenses.test.ts

src/lib/worker-db-client.ts                 # 新增 8 个方法
src/lib/navigation.ts                       # 加 "资金计划" NavGroup
```

## Data Model

### 新表 1：`expense_categories`

```ts
import { uniqueIndex } from "drizzle-orm/sqlite-core";

export const expenseCategories = sqliteTable(
  "expense_categories",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    // 存 chart token 名（如 "chart-7"），不存 hex
    // 渲染时 hsl(var(--chart-7))，自动跟随项目主题
    colorToken: text("color_token").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    userNameUnique: uniqueIndex("expense_categories_user_name_uniq")
      .on(table.userId, table.name),
  }),
);
```

迁移 SQL 必须显式建索引：

```sql
CREATE UNIQUE INDEX expense_categories_user_name_uniq
  ON expense_categories (user_id, name);
```

约束：
- `(userId, name)` 唯一 —— Drizzle `uniqueIndex` + 迁移 SQL 双重落实。
- `colorToken` 必须是 `CHART_TOKENS` 之一（24 个 token 的闭集，Zod 在 Action 层校验）。
- 颜色调色板复用 `src/lib/palette.ts` 的 24 色（与"资金仓库"等页面同一套），自动支持主题切换。

### 新表 2：`recurring_expenses`

```ts
export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // 业务字段
  name: text("name").notNull(),                       // "中行车险"
  categoryId: text("category_id")
    .references(() => expenseCategories.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").default("CNY").notNull(),
  account: text("account"),                            // 可选付款账户

  // 周期规则（嵌入；一规则一行，无需额外 join）
  frequency: text("frequency").notNull(),              // 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: integer("interval").notNull().default(1),  // 每 N 个 frequency 一次
  dayOfMonth: integer("day_of_month"),                 // 1..31，monthly/yearly 取用
  monthOfYear: integer("month_of_year"),               // 1..12，yearly 取用
  weekday: integer("weekday"),                          // 0..6（0=周日），weekly 取用

  startDate: text("start_date").notNull(),             // ISO "YYYY-MM-DD"
  endDate: text("end_date"),                            // ISO；null = 永续

  // 状态机：active / paused / ended
  // - active: 渲染日历、参与汇总
  // - paused: 不渲染日历、列表灰显、汇总不计入；用户可恢复
  // - ended:  手动结束；historic occurrences (<= endedAt) 仍渲染；未来不再渲染
  status: text("status").notNull().default("active"),  // 'active' | 'paused' | 'ended'

  // 仅 status='ended' 时非 null，记录"结束日"（包含），由 endRecurringExpense 写入
  endedAt: text("ended_at"),                           // ISO "YYYY-MM-DD" | null

  note: text("note"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull().$defaultFn(() => new Date()),
});
```

**为什么用 `status` 三态而非 `isActive` boolean + endDate 双字段？** 业务上"暂停"和"结束"是不同生命周期事件，单一 `status` 字段语义清晰、状态转移更可控。

`endDate`、`endedAt`、`status` 三者职责清晰、互不重叠：

| 字段 | 语义 | 谁来改 |
|------|------|--------|
| `status` | 生命周期状态（active / paused / ended） | **仅** Server Action（`pause/resume/end`） |
| `endDate` | 规则有效期窗口（用户表达"我只想交三年"） | `create/update` 时由用户直接设置 |
| `endedAt` | 手动结束的截止日（包含），仅 `ended` 时非 null | `endRecurringExpense` 内部写入，UI 不直接编辑 |

派生显示状态（前端纯函数，不写库）：

```ts
function deriveDisplayStatus(rule, today): 'active' | 'paused' | 'ended' | 'expired' {
  if (rule.status === 'paused') return 'paused';
  if (rule.status === 'ended')  return 'ended';
  if (rule.endDate && rule.endDate < today) return 'expired'; // 派生态：UI 标"已到期"
  return 'active';
}
```

**关键不变量**：DB 中的 `status` 字段**永远不会**因 `endDate` 过期而被后台自动改写。所有 `status` 变更必须经过 Server Action。`expired` 是纯前端派生状态，列表 chip 显示"已到期 · YYYY-MM-DD"，与"已结束"视觉区分。

Occurrence 展开过滤规则（详见下文 Occurrence 算法的统一公式）:
- `status === 'paused'` → 返回 `[]`。
- `status === 'active' | 'ended'` → 同一公式：实际上限 = `min(toDate, endDate ?? +∞, endedAt ?? +∞)`，三个上限取最小。`endedAt` 仅在 `ended` 时非 null，`endDate` 由用户在表单设置。

### Occurrence 算法（纯函数，可测）

```ts
// src/lib/recurring-expense/occurrences.ts
export function computeOccurrences(
  rule: RecurrenceRule,
  fromDate: string,        // ISO inclusive
  toDate: string,          // ISO inclusive
): string[]                // 升序 ISO 日期数组
```

行为（**所有规则均以 `startDate` 为 0 号锚点**，避免歧义）：
- `status === 'paused'` 直接返回 `[]`。
- 通用展开窗口公式（`active` / `ended` 共用，三上限取最小）：
  ```
  effectiveTo = min(
    toDate,
    endDate  ?? +∞,   // 用户设定的有效期
    endedAt  ?? +∞,   // 手动结束日（仅 status='ended' 非 null）
  )
  effectiveFrom = max(fromDate, startDate)
  if effectiveFrom > effectiveTo: return []
  ```
- 派生：
  - `status === 'active'`：`endedAt` 必为 null，公式退化为 `[max(fromDate, startDate), min(toDate, endDate ?? toDate)]`。
  - `status === 'ended'`：`endedAt` 非 null，公式退化为 `[max(fromDate, startDate), min(toDate, endedAt, endDate ?? toDate)]`，历史保留、未来不渲染。
- 永远不返回 `< startDate` 的日期。
- **interval 锚点定义**：第 0 个周期 = `startDate` 所在的 frequency 周期，后续命中"距离 startDate 整 N 个 interval"的周期；不对齐自然周/月/季：
  - `daily, interval=N`：日期 d 命中 ⇔ `(d - startDate).days % N === 0`。
  - `weekly, interval=N, weekday=W`：第 0 周 = `startDate` 所在 ISO 周（周一为首），命中"距 startDate 所在周整 N 周"的周内该 `weekday`。
  - `monthly, interval=N, dayOfMonth=D`：命中"距 startDate 所在月整 N 个月"的月，取该月第 D 天（不存在则取该月最后一天）。
  - `yearly, interval=N, monthOfYear=M, dayOfMonth=D`：命中"距 startDate 所在年整 N 年"的年，取 (M, D)；2 月 29 在非闰年取 2 月 28。
- `dayOfMonth=31` 在 2 月按"该月最后一天"夹（不跳月）。
- `interval ≥ 1`；非法输入抛 `Error`，由 Server Action 捕获返回 `ActionResult.error`。
- 返回区间不限（**支持历史回溯**）：用户传 `fromDate=2020-01-01` 也能正确展开（但仍不早于 `startDate`）。

### 汇总（纯函数）

```ts
// src/lib/recurring-expense/occurrences-aggregate.ts
export interface Window { fromDate: string; toDate: string }

export function sumWindow(
  rules: RecurrenceRule[],
  window: Window,
): number  // 单位 cents
```

UI 调用（视图月 = `viewMonth`，真实今天 = `today`）：
- **当月合计**：`sumWindow(rules, { fromDate: monthStart(viewMonth), toDate: monthEnd(viewMonth) })` —— 随视图月切换。
- **未来 30 天**：`sumWindow(rules, { fromDate: today, toDate: today + 30d })` —— **始终基于真实今天**，不随视图月。
- **未来 12 个月**：`sumWindow(rules, { fromDate: today, toDate: today + 365d })` —— 同上。
- 未来两卡 UI 加副标题"自今日起"消除歧义。

## API Surface

### Server Actions

```ts
// src/app/actions/recurring-expense-actions.ts
"use server"

export async function createRecurringExpense(
  data: RecurringExpenseInput,
): Promise<ActionResult<{ id: string }>>;

export async function updateRecurringExpense(
  id: string,
  data: Partial<RecurringExpenseInput>,
): Promise<ActionResult>;

export async function deleteRecurringExpense(
  id: string,
): Promise<ActionResult>;

// 状态机捷径（避免 client 误传非法值）
// 实现要点（Server Action 内一次 client.updateRecurringExpense 调用完成）：
//   pause:  status='paused', endedAt=null
//   resume: status='active', endedAt=null
//   end:    status='ended',  endedAt=todayISO()
export async function pauseRecurringExpense(id: string): Promise<ActionResult>;
export async function resumeRecurringExpense(id: string): Promise<ActionResult>;
export async function endRecurringExpense(id: string): Promise<ActionResult>;

// src/app/actions/expense-category-actions.ts
"use server"

export async function createCategory(
  data: { name: string; colorToken: string },
): Promise<ActionResult<{ id: string }>>;

export async function updateCategory(
  id: string,
  data: { name?: string; colorToken?: string; sortOrder?: number },
): Promise<ActionResult>;

export async function deleteCategory(id: string): Promise<ActionResult>;
// 删除时 DB 层 ON DELETE SET NULL，引用它的 recurring_expenses.categoryId 自动置空
```

### Worker SQL 端点（新增 8 个，**严格沿用现有 Worker 约定**）

约定（与 `worker/src/index.ts` 内 `products` / `units` 等现有资源一致）：
- 路径前缀：`/api/<resource>`、`/api/<resource>/:id`
- 用户上下文：**通过 `X-User-Id` header 传递，不用 query string**
- 鉴权：`Authorization: Bearer ${WORKER_TOKEN}`
- 目标库：单一 `DB` binding（历史上的 `X-Target-DB` 已废弃；E2E 走 `wrangler dev --local`）
- 更新动词：**`PUT`**（不引入 `PATCH`，因为 CORS `allowMethods` 不含 PATCH，引入需同步改 `worker/src/index.ts` 的 CORS、所有 client、所有测试 —— 本期不做）

| Method | Path | 说明 |
|--------|------|------|
| GET    | `/api/expense-categories`       | 列表 |
| POST   | `/api/expense-categories`       | 创建 |
| PUT    | `/api/expense-categories/:id`   | 全量/部分更新（payload 仅含要变更的字段） |
| DELETE | `/api/expense-categories/:id`   | 删除（DB 层 `ON DELETE SET NULL` 自动置空 `categoryId`） |
| GET    | `/api/recurring-expenses`       | 列表（join 分类信息一并返回） |
| POST   | `/api/recurring-expenses`       | 创建 |
| PUT    | `/api/recurring-expenses/:id`   | 更新；**`status` 字段仅 `pause/resume/end` Action 写入** |
| DELETE | `/api/recurring-expenses/:id`   | 删除（硬删）|

### `WorkerDbClient` 新增方法

```ts
// 分类
listCategories(userId: string): Promise<{ items: RawCategory[] }>;
createCategory(userId, payload): Promise<{ item: RawCategory }>;
updateCategory(userId, id, payload): Promise<void>;
deleteCategory(userId, id): Promise<void>;

// 周期支出
listRecurringExpenses(userId: string): Promise<{ items: RawRecurringExpense[] }>;
createRecurringExpense(userId, payload): Promise<{ item: RawRecurringExpense }>;
updateRecurringExpense(userId, id, payload): Promise<void>;
deleteRecurringExpense(userId, id): Promise<void>;
```

## Sidebar 分区

在 `src/lib/navigation.ts` 加新 group（位置：`存量资金管理` 之后、`数据管理` 之前；与现有顺序保持金融领域聚拢）：

```ts
{
  label: "资金计划",
  defaultOpen: true,
  items: [
    { href: "/plan/calendar",   label: "日历",   icon: CalendarClock },
    { href: "/plan/categories", label: "分类",   icon: Tags },
  ],
},
```

`Tags` 已在 navigation.ts 的 lucide-react 导入中（用于现有"分类设置"），`CalendarClock` 需新增导入。

## UI / Pages

### `/plan/calendar`

```
┌──────────────────────────────────────────────────────────────────┐
│ Sidebar │  AppShell content                                      │
│         │  ┌───────────────────────────────┐ ┌──────────────┐   │
│         │  │ 汇总卡（3 个 KPI）             │ │ 周期支出列表 │   │
│         │  │ ┌─────┐┌─────┐┌─────┐         │ │ + 新建       │   │
│         │  │ │当月 ││30天 ││12月 │         │ │ ──────────── │   │
│         │  │ └─────┘└─────┘└─────┘         │ │ ● 房租 ¥3k/月│   │
│         │  ├───────────────────────────────┤ │ ● 车险 ¥8k/年│   │
│         │  │ 月视图日历                     │ │ ◯ 物业 (暂停)│   │
│         │  │ ◀ 2026-06 ▶ [今天]              │ │ ⊝ 旧保险(结束)│   │
│         │  │  日 一 二 三 四 五 六           │ │              │   │
│         │  │  [● ¥8k]                       │ │              │   │
│         │  └───────────────────────────────┘ └──────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

行为：
- 顶部 `◀ ▶` 任意月份导航；`今天` 跳回当月。（年视图本期不做，详见 Out of Scope。）
- 日格里多笔时叠加多个圆点（限 3 个，第 4+ 显示 `+N`），颜色取分类色。
- 日格点击 → `popover` 列出当日所有项（名字 + 金额 + 分类徽章）。
- 列表项点击 → 编辑 dialog；右键/三点菜单 → 暂停 / 恢复 / 结束 / 删除。
- 列表状态 chip 颜色：active 默认色、paused 灰、ended 边框灰。
- 汇总卡数值 = `formatCurrencyFull(sumWindow(...) / 100)`。

### `/plan/categories`

简单 CRUD 列表页：
- 表格列：颜色色块 / 名称 / 引用规则数 / 创建时间 / 操作（编辑、删除）。
- 新建按钮 → dialog（`category-form` 组件）。
- 删除带二次确认，提示"将取消 N 条规则的分类（不删除规则）"。
- 颜色选择器：从 `CHART_TOKENS` 渲染 24 个 token 色块，受控，Zod 校验枚举值。

## Code Style（与项目一致）

```ts
// src/app/actions/recurring-expense-actions.ts
"use server"

import { getAuthedClient } from "@/lib/api-helpers"
import type { ActionResult } from "@/lib/action-result"
import { recurringExpenseInputSchema } from "@/lib/recurring-expense/rule-types"

export async function createRecurringExpense(
  data: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringExpenseInputSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.message }
  }
  try {
    const { userId, client } = await getAuthedClient()
    const { amount, ...rest } = parsed.data
    const payload = {
      ...rest,
      amountCents: Math.round(amount * 100),
    }
    const result = await client.createRecurringExpense(userId, payload)
    return { success: true, data: { id: String(result.item.id) } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create",
    }
  }
}
```

要点：
- 金额：UI 输入 yuan（`number`），写库前 `Math.round(amount * 100)`，读出来在 mapper 中除回。
- 日期：ISO `"YYYY-MM-DD"`；不传 `Date` 对象。
- 颜色：`colorToken`（如 `"chart-7"`），渲染时用 `hsl(var(--${token}))`；调色板从 `CHART_TOKENS` 取，与现有页面一致，自动随主题切换。
- 错误：抛 `Error` → Server Action 包成 `ActionResult.error`，UI 用 `sonner` toast 展示。
- 命名：camelCase（TS）、snake_case（DB）。

## Testing Strategy

| 层 | 位置 | 必测点 |
|----|------|--------|
| 纯函数：occurrences | `src/__tests__/recurring-expense/occurrences.test.ts` | 月度 31 日跨 2 月、年度 2-29 闰年、interval=N、startDate 边界、status='paused' 返空、status='ended' + endedAt 历史保留 / 未来截断、**status='ended' 同时有 endDate（取 min(endedAt, endDate)）**、active + endDate 截顶、historic 回溯（fromDate < today 且 startDate 更早）、interval 锚点（daily/weekly/monthly/yearly 各一例） |
| 纯函数：aggregate | `src/__tests__/recurring-expense/occurrences-aggregate.test.ts` | 跨月窗口、空规则集、暂停规则不计入 |
| 纯函数：颜色 | — | 不需要：直接用 `CHART_TOKENS` 枚举校验，无对比度计算 |
| Worker repository | `worker/tests/expense-categories.test.ts` + `recurring-expenses.test.ts` | CRUD 隔离、`userId` 过滤、外键 SET NULL、unique(userId,name) |
| Server Action | `src/__tests__/actions/*.test.ts` | Zod 失败 → ActionResult.error；status 转移合法性；金额 yuan↔cents |
| 视觉冒烟（手动） | `bun run dev` | 切月不闪烁、暂停立即从日历消失、删除分类后规则继续渲染（无色） |

覆盖率目标：`src/lib/recurring-expense/` ≥ 90%。

## Boundaries

### Always
- 通过 `getAuthedClient` 取 `userId`，所有 SQL 都按 `userId` 过滤。
- 写操作返回 `ActionResult`，UI 用 `sonner` toast 处理。
- 金额一律 `amountCents`（整数）落库；显示层转 yuan。
- 日期一律 ISO `"YYYY-MM-DD"`。
- 状态机转移用专门的 Server Action（`pause/resume/end`），不让 client 直接传 `status` 字段。
- 添加 unit / worker 测试再合并。
- 修改 schema 必须配迁移 SQL（`worker/db/migrations/0007_*.sql`）。
- 颜色字段 Zod 校验为 `CHART_TOKENS` 之一（枚举闭集），前端禁止裸 `style={{background: userInput}}`，必须 `hsl(var(--${token}))`。

### Ask First
- 引入新 npm 依赖。
- 修改公共组件（`@/components/ui/*`、sidebar、navigation）的接口而非新增。
- 改动其它模块用到的 `WorkerDbClient`、`api-helpers`。
- 给周期规则加更复杂字段（如 BYMONTHDAY 列表、跳过日历表）。
- 把"实付打卡"或"自动写入 transactions"塞进本期。

### Never
- 把规则展开后的 occurrences 写入 DB。
- 越过 Server Actions 让 Client Component 直接调 Worker。
- 在 client 包里 import `@/lib/api-helpers` 或 `@/lib/db`。
- 用 `Math.floor`/`/100` 处理金额（精度坑）。
- 不带 `--remote` 跑 wrangler 操作生产 D1。
- 用 `dangerouslySetInnerHTML` 渲染颜色或分类名。

## Out of Scope（本期不做，留作后续 spec）

1. **实付打卡**：把某条 occurrence 标"已支付"并落到 `transactions` —— 003-spec。
2. **提醒/通知**：邮件、推送或站内消息 —— 平台层设计。
3. **多家庭/共享**：现仅单 user 模型。
4. **节假日顺延**：周末/节日规则。
5. **模板与导入**：保险大类模板、CSV 批量导入。
6. **货币换算**：保留 `currency` 字段但不做汇率。
7. **年视图**：12 宫格紧凑视图本期完全不做，避免 scope 漂移。本期日历只出月视图。

## Implementation Phases

每个 Phase 独立落地、独立测试、独立回滚。下述每个步骤就是一个**原子 commit**：

- 编号 `P{phase}-C{n}`，commit message 前缀 `feat(...)` / `chore(...)` / `test(...)` / `refactor(...)`
- 每个 commit 后跑 `bun run test && bun run test:worker && bun run typecheck && bun run lint` 必须全绿
- DB migration 只在 P1-C2 一次落地；后续 commit 不再改 schema，避免 drift
- 部署顺序：`worker` 先（含 migration） → `web`（Server Actions 调用 worker），任何 commit 不可破坏旧 worker / 旧 web 单边运行

### Phase 1 — DB + Worker（独立可部署）

落地后效果：worker 端能跑 8 个新 SQL 端点、新表 + 索引存在；web 端不动，行为零变化。

| Commit | 改动 | 测试文件 / Gate | Migration / Deploy |
|---|---|---|---|
| **P1-C1** `feat(schema): add expense_categories + recurring_expenses tables` | `worker/db/schema.ts` 加两个 `sqliteTable` 定义 + `uniqueIndex("expense_categories_user_name_uniq")`；不改 SQL 文件 | `worker/tests/expense-categories.test.ts` + `worker/tests/recurring-expenses.test.ts` 新建占位（仅 import schema 类型，确保编译通过）；`bun run typecheck` | 无 migration / 无 deploy（纯类型层） |
| **P1-C2** `feat(db): add 0007_recurring_expenses migration` | `worker/db/migrations/0007_recurring_expenses.sql`：建两表 + 显式 `CREATE UNIQUE INDEX` + `PRAGMA foreign_keys` 注释。SQL 与 P1-C1 schema 保持一致 | **gate**：本 commit 测试 = drizzle migration check + 本地 `wrangler d1 migrations apply noheir-db --local` 应用成功；不要求新增 .test.ts。`bun run test && bun run typecheck && bun run lint` 仍跑全。 | **deploy gate**：本 commit merge 后**先**手动 `wrangler d1 migrations apply noheir-db --remote` 应用到 production，再 merge 后续 commit |
| **P1-C3** `feat(worker): expense_categories repository` | `worker/db/repositories/expense-categories.ts`：list/getById/create/update/delete，全部按 `userId` 过滤；`(userId, name)` 唯一冲突返 `409` 友好错误 | **repo 单测**：`worker/tests/expense-categories.test.ts`：CRUD、`userId` 隔离、unique 冲突、空字段拒绝 | 无 deploy（worker 还没暴露端点） |
| **P1-C4** `feat(worker): recurring_expenses repository` | `worker/db/repositories/recurring-expenses.ts`：list（join expense_categories 一并返回 `categoryName`/`colorToken`）/getById/create/update/delete；repo 接受 `status`/`endedAt` 任意写入，端点层（P1-C6）才做契约过滤 | **repo 单测**：`worker/tests/recurring-expenses.test.ts`：CRUD、`userId` 隔离、join 后字段映射、`endedAt` 默认 null、删除 category 后 `categoryId` 自动 SET NULL（**关键：明确测此外键行为**） | 无 deploy |
| **P1-C5** `feat(worker): expense-categories SQL endpoints` | `worker/src/index.ts` 加 4 个端点（GET 列表 / POST 创建 / PUT update / DELETE）；沿用 `X-User-Id` header + `Authorization: Bearer ${WORKER_TOKEN}` + `X-Target-DB` 约定（注：`X-Target-DB` 已于 2026-06 废弃，新代码不再发送）。**项目当前没有 `errorResponse` helper**，按 `worker/src/index.ts` 现有 `c.json({ error: "..." }, 4xx)` 写法照抄即可，不抢着抽公共 helper（spec 之外的 refactor） | **e2e 端点测试**：放在 `worker/tests/e2e/expense-categories.e2e.test.ts`（与 `auth.e2e.test.ts` 同目录约定）：fetch URL、status code、payload shape、CORS preflight | **deploy gate**：merge 后 deploy worker，验证 `curl -H "Authorization: Bearer ..." -H "X-User-Id: u1" /api/expense-categories` 200 OK |
| **P1-C6** `feat(worker): recurring-expenses SQL endpoints` | `worker/src/index.ts` 加 4 个端点。**`PUT /api/recurring-expenses/:id` 在 body 里收到 `status` / `endedAt` 字段时 silently drop**（不返 4xx，让 client 不察觉；安全边界靠 `WORKER_TOKEN` + Server Action 链路），**除非 request 带 `X-Internal-Action: 1` header**。同步在 `worker/src/index.ts` 第 80~85 行 `allowHeaders` 数组加入 `"X-Internal-Action"`。具体见 [Decision A] | **e2e 端点测试**：`worker/tests/e2e/recurring-expenses.e2e.test.ts`：① 无 header + body 含 status → DB status 不变；② 有 `X-Internal-Action: 1` + body status='paused' → DB status 改；③ 有 header 但 body 含非状态机字段（如 amountCents）也照常更新；④ CORS preflight 接受 `X-Internal-Action` header | deploy worker（与 P1-C5 同一次 deploy 也可） |
| **P1-C7** `chore(worker): pin recurring-expenses status guard with regression test` | 加额外回归测试：模拟 web client（不带 internal header）通过整个 PUT 路径试图改 `status` 和 `endedAt` 各一次，验证两个字段都没变 | 仅测试，无生产代码改动 | 无 deploy |

**[Decision A] worker 层如何阻止 client 直接改 `status`/`endedAt`**：
- **方案**：`PUT /api/recurring-expenses/:id` body 中的 `status` 和 `endedAt` 字段在 endpoint 层 silently drop，除非 request 带 `X-Internal-Action: 1` header。
- **同步改动**：`worker/src/index.ts` `allowHeaders` 数组加 `"X-Internal-Action"`（CORS 必须放行，否则 browser 触发 PATCH-类受限请求会被 preflight 拦掉；web Server Actions 不走 browser CORS 但保持一致）。
- **这不是安全边界**：worker 端点已经有 `Authorization: Bearer ${WORKER_TOKEN}` + Server Action 链路在前，`X-Internal-Action` 只是**契约级 guard**：防止应用层错误地用普通 PUT 改 status 字段。攻击者已经持有 WORKER_TOKEN 时此 header 不构成额外屏障。
- **why silently drop（不 400）**：保持 endpoint shape 不变；client 端的 `updateRecurringExpense` 把 status/endedAt 不小心传过来时不应让请求整体失败 —— 把这种 client 错误降级为"未生效字段"，符合 D1/REST 端点的健壮性原则。
- **备选与拒绝**：单独加 `POST /api/recurring-expenses/:id/status` 端点 → 引入新约定违反"沿用现有"原则；返 400 → client 端面临的是 partial-input 错误，UX 难处理；放弃 guard 完全信任 Action 层 → 后续 client 工程师可能误用同一 PUT 接口。
- **回退**：若实际跑下来这种 silently drop 让 web 工程师困惑，可以在 P3 之后补一个 `worker/scripts/audit-status-mutations.ts` 周期性比对 `recurring_expenses.status` 历史值，发现非 Action 路径的 status 变化时报警。

**Phase 1 验收**：
- worker 单测全绿，覆盖率不下降
- 远端 D1 应用 0007 migration 后，`wrangler d1 execute noheir-db --remote --command "PRAGMA table_info(recurring_expenses);"` 输出 14 列
- web 端完全没动；`bun run dev` 走旧路径无 regression

---

### Phase 2 — Domain + Actions（独立可部署）

落地后效果：web 端可以创建规则、调用纯函数算 occurrences；UI 还没接，但可在 Server Action 单测里端到端跑通。

| Commit | 改动 | 测试 / Gate |
|---|---|---|
| **P2-C1** `feat(types): add RecurrenceRule and Zod schema` | `src/lib/recurring-expense/rule-types.ts`：`RecurrenceRule` interface + `recurringExpenseInputSchema` (Zod)；`colorToken` 校验为 `CHART_TOKENS` 闭集；`frequency` 枚举；`interval ≥ 1`；`startDate` ISO 校验 | `src/__tests__/recurring-expense/rule-types.test.ts`：合法 / 非法每个字段一个 case |
| **P2-C2** `feat(domain): computeOccurrences pure function` | `src/lib/recurring-expense/occurrences.ts`：实现统一公式 `effectiveTo = min(toDate, endDate??+∞, endedAt??+∞)`；4 种 frequency × interval 锚点（spec 已规约） | `occurrences.test.ts`：必测点完整覆盖（spec Testing Strategy 表）— **gate: 此文件单独 ≥ 95% 覆盖率** |
| **P2-C3** `feat(domain): sumWindow aggregate` | `src/lib/recurring-expense/occurrences-aggregate.ts`：`sumWindow(rules, window)`、`sumMonth(rules, viewMonth)`；调用 `computeOccurrences` | `occurrences-aggregate.test.ts`：跨月、空规则集、paused 不计入 |
| **P2-C4** `feat(domain): rule mappers + format helpers` | `src/lib/recurring-expense/mappers.ts`（raw row ↔ domain）+ `format.ts`（"每 3 个月"等人类语描述）；`src/lib/expense-category/mappers.ts` | mappers 测试（往返）；format 测试（snapshot 即可） |
| **P2-C5** `feat(client): WorkerDbClient methods for categories` | `src/lib/worker-db-client.ts` 加 4 个分类方法 | client 测试：mock fetch，验证 URL / headers / body shape |
| **P2-C6** `feat(client): WorkerDbClient methods for recurring expenses` | 加 4 个 recurring 方法；`updateRecurringExpense(userId, id, payload, opts?: { internal: boolean })`，`internal=true` 时附 `X-Internal-Action: 1` | client 测试：默认请求不带 internal header；`internal=true` 时带 |
| **P2-C7** `feat(actions): expense-category Server Actions` | `src/app/actions/expense-category-actions.ts`：create/update/delete；返回 `ActionResult` | `src/__tests__/actions/expense-category-actions.test.ts`：Zod 失败、auth 失败、worker 错误传播 |
| **P2-C8** `feat(actions): recurring-expense CRUD Server Actions` | `src/app/actions/recurring-expense-actions.ts`：create/update/delete（**update 不允许传 `status`/`endedAt`，Zod schema 在 input 层 strip**） | action 测试：Zod 校验、yuan↔cents 转换、worker 调用参数 |
| **P2-C9** `feat(actions): recurring-expense state machine actions` | 同一文件加 `pauseRecurringExpense` / `resumeRecurringExpense` / `endRecurringExpense`：内部调 `client.updateRecurringExpense(..., { internal: true })`，分别写 `{status, endedAt}` 三种组合 | action 测试：状态转移合法（active↔paused 双向 / *→ended 单向）；`endedAt` 在 end 时为 today、其他为 null |
| **P2-C10** `chore(navigation): add 资金计划 NavGroup (data only)` | `src/lib/navigation.ts` 加 NavGroup（指向 `/plan/calendar` 和 `/plan/categories`），但**先在 navigation.ts 用 feature flag `FEATURE_PLAN_CALENDAR=false` gate**，避免 sidebar 显示死链。flag 落代码常量，commit 时为 false | 无新测试；`bun run typecheck` 验证 import |

**Phase 2 验收**：
- 全部新增 lib/ 文件 ≥ 90% 覆盖率（`occurrences` ≥ 95%）
- Server Action 测试覆盖 ActionResult 错误路径
- `bun run dev` 不出现 sidebar 新链（feature flag 为 false）
- 旧功能完全不受影响

---

### Phase 3 — UI（独立可部署，最后一刀）

落地后效果：用户可见两个新页面，全功能跑通。

| Commit | 改动 | 测试 / Gate |
|---|---|---|
| **P3-C1** `feat(ui): color-token-picker component` | `src/components/plan/color-token-picker.tsx`：复用 popover + 24 个色块网格；受控；onChange 传 token 字符串 | 组件测试（vitest + RTL）：渲染 24 个色块、点击触发 onChange、键盘选择、a11y 焦点 |
| **P3-C2** `feat(ui): frequency-picker component` | 周期选择器（daily/weekly/monthly/yearly + interval + dayOfMonth/monthOfYear/weekday 条件渲染） | 组件测试：切换 frequency 时条件字段切换、interval 数字校验 |
| **P3-C3** `feat(ui): category-form` | `src/components/plan/category-form.tsx`：name + color-token-picker + 提交调 Server Action | 组件测试：提交成功 / 失败、color picker 集成 |
| **P3-C4** `feat(ui): recurring-expense-form` | 创建/编辑共用表单，复用 frequency-picker；金额 yuan input；categoryId select | 组件测试：所有字段、Zod 错误回显、edit mode 预填 |
| **P3-C5** `feat(ui): recurring-expense-calendar` | `src/components/plan/recurring-expense-calendar.tsx`：CSS Grid 7×N 月视图；接收 `rules` + `viewMonth`，调 `computeOccurrences` 算每格；圆点叠加（max 3 + `+N`） | 组件测试：单测纯渲染（mock rules + 固定 viewMonth），快照固定布局 |
| **P3-C6** `feat(ui): summary-cards (3 KPIs)` | 当月 / 30 天 / 12 月 三卡；前者用视图月、后两者用真实 today；副标题"自今日起" | 组件测试：调用 `sumWindow` 时传入正确 window |
| **P3-C7** `feat(ui): occurrence-detail-popover` | 日格点击弹层，列出当日所有项 + 分类徽章 | 组件测试 |
| **P3-C8** `feat(ui): recurring-expense-list with status chips` | 旁侧列表，三态 chip + `expired` 派生态；右键/三点菜单（pause/resume/end/delete） | 组件测试：派生态显示、菜单项条件可见 |
| **P3-C9** `feat(page): /plan/categories page + client component` | Server Component 拉数据；Client 用 P3-C3 的 form。**Server Component 顶部检查 `FEATURE_PLAN_CALENDAR` flag（与 P2-C10 同一常量）：flag=false 时调用 Next.js `notFound()` 返回 404**，确保用户即使知道 URL 也无法访问 | 页面集成测试（playwright 或 RTL）：增 / 改 / 删 走通；**额外 1 个 test：flag=false 时 GET `/plan/categories` 返回 404** | 无 deploy（仍未启用） |
| **P3-C10** `feat(page): /plan/calendar page + client orchestration` | Server Component 拉 rules + categories；Client 拼装 calendar + list + summary cards + form dialog。**同样 flag gate `notFound()`**；redirect from `/plan` to `/plan/calendar` 也用同一 flag | 页面集成测试：创建规则后日历出现徽章；切月不闪烁；点击日格弹 popover；**额外 1 个 test：flag=false 时 GET `/plan/calendar` 返回 404** | 无 deploy（仍未启用） |
| **P3-C11** `feat(navigation): enable plan calendar feature flag` | 把 P2-C10 的 `FEATURE_PLAN_CALENDAR` 改为 `true`，**同时打开 sidebar 显示 + 页面 route 访问**（同一 flag 控制两处）；P3-C9/C10 的 404 测试改为期望 200 | 无新代码；`bun run dev` 视觉冒烟（手动）；P3-C9/C10 测试 update | deploy（用户可见的唯一一刀）|
| **P3-C12** `chore(release): version bump + smoke test` | 按现有 release 流程，跑 `bun run test && bun run test:worker && bun run typecheck && bun run lint && bun run build` | release tag |

**Phase 3 验收**：
- 整体覆盖率不下降；`src/lib/recurring-expense/` ≥ 90%
- `bun run dev` 走 spec 9 个成功标准全部手测通过（spec § Objective 列表）
- Lighthouse / first-render ≤ 2s（spec 标准 #9）

---

### 跨 Phase 公共原则

- **不允许在一个 commit 里跨 worker / web 改写**（Phase 1 全 worker、Phase 2/3 全 web）。
- **不允许在 docs commit 里改代码**，反之亦然。
- **migration 只能在 P1-C2 落地**，后续要改 schema 必须新开 0008 migration 走单独 spec/PR。
- **feature flag 模式**：`FEATURE_PLAN_CALENDAR` 同一常量同时 gate **三处**——sidebar 链接（P2-C10）、`/plan/categories` Server Component（P3-C9）、`/plan/calendar` Server Component（P3-C10）。flag=false 时 sidebar 不显示链接 **+** 页面 `notFound()` 返回 404（用户即使猜出 URL 也访问不到）。P3-C11 一次翻为 true，三处同步打开。
- **回滚单元**：每个 commit 都能 `git revert` 单独回滚，因为：
  - Phase 1 commits 之间靠 worker test 隔离
  - Phase 2 commits 在 feature flag 后面（且 sidebar+page 都没启用）
  - Phase 3 P3-C1~C10 commits 在 feature flag 后面（route 也 404 in dead code）
  - P3-C11 是唯一对用户可见的 commit；revert 它 = 立即回到"用户感知 = 没上线"

每个 Phase 收尾跑：`bun run test && bun run test:worker && bun run typecheck && bun run lint`。

## Decisions（已闭环，原 Open Questions）

1. **分类色板**：复用 `src/lib/palette.ts` 的 24 色（`chart-1` ~ `chart-24`），与"资金仓库"等页面同源；DB 存 token 名而非 hex，自动支持主题切换。
2. **删除规则副作用**：硬删（无历史依赖；本期不做实付追踪，后续若加，再用迁移转软删）。
3. **月视图密度**：单格最多 3 个圆点，超出显示 `+N`，点击 popover 看全部。

## Risks & Mitigations

1. **D1 外键 `ON DELETE SET NULL` 行为**：D1 SQLite 默认开启 PRAGMA `foreign_keys = ON`，但 vitest workers 环境（`@cloudflare/vitest-pool-workers`）有时差异。
   - **缓解**：worker 测试用例显式验证"删除 category 后引用它的 recurring_expense.categoryId 为 null"，CI 必须通过。
   - **回退**：若外键在某些环境不生效，`deleteCategory` repository 改为事务版 —— 先 `UPDATE recurring_expenses SET category_id = NULL WHERE user_id = ? AND category_id = ?`，再 `DELETE FROM expense_categories WHERE id = ? AND user_id = ?`，保证一致性。
2. **历史回溯性能**：用户切到 2010 年理论上能展开极多 occurrence。
   - **缓解**：日历视图永远按"当前视图月窗口"调用 `computeOccurrences(rule, monthStart, monthEnd)`，单次最多 31 天 × 规则数，可控。
3. **interval 锚点歧义**：详见 Occurrence 算法段，已显式定义"所有 interval 以 startDate 所在周期为第 0 号"，测试覆盖每种 frequency。

## References

- `docs/001-capital-unit-date-refactor.md` — 文档结构先例
- `docs/03-structure.md` — 项目结构与命名约定
- `worker/db/schema.ts` — DB 风格基线
- `src/app/actions/unit-actions.ts` — Server Action 风格基线
- `src/lib/worker-db-client.ts` — Worker 调用约定
- `src/lib/navigation.ts` — Sidebar 分区先例（`存量资金管理`）
- `src/components/ui/colored-badge.tsx` — 颜色徽章规范

## Release Smoke (P3-C12)

Run on 2026-06-07 against `53883e4` (P3-C11 flag flip) on local dev.

### Automated gates
- `bun run typecheck` — pass
- `bun run lint` — pass (--max-warnings=0)
- `bun run test` — 71 files / 945 tests pass
- `bun run test:worker` — 16 files / 247 tests pass (rebuild better-sqlite3 first if ABI mismatch)
- `bun run test:coverage` — 98.95% stmts / 96.93% branches / 100% funcs / 99.61% lines (≥ 95% threshold)
- `bun run build` — succeeds; `/plan/calendar` and `/plan/categories` present as dynamic routes

### Route smoke (curl, no auth)
- `GET /plan/categories` → 307 Temporary Redirect → `/login?callbackUrl=%2Fplan%2Fcategories`
- `GET /plan/calendar` → 307 Temporary Redirect → `/login?callbackUrl=%2Fplan%2Fcalendar`
- `GET /` → 307 (same auth redirect)

The 307 (auth redirect) instead of 404 confirms FEATURE_PLAN_CALENDAR is on; otherwise notFound() would intercept before the auth layer.

### Manual smoke checklist (post-deploy)
Run through these in an authenticated browser session:

- [ ] Sidebar shows 资金计划 group between 存量资金管理 and 系统, with 日历 and 分类 items
- [ ] `/plan/categories` empty state shows "还没有任何分类" + create CTA
- [ ] Create a category — appears in list immediately (router.refresh works)
- [ ] Edit category — name + color update reflected without manual reload
- [ ] Delete category with rules — warning copy shows N rules will become 未分类, rules survive
- [ ] `/plan/calendar` opens with current month, three summary cards (¥0 / ¥0 / ¥0 initially)
- [ ] Create recurring expense — appears in calendar dots + rule list + summary
- [ ] Click a day with occurrences — popover lists every item for that day
- [ ] Day popover "查看" — closes popover, opens edit dialog prefilled
- [ ] Rule list 编辑 menu — opens edit dialog
- [ ] Pause active rule — chip flips to 已暂停, calendar dots disappear; resume restores
- [ ] End rule — chip flips to 已结束 · {today}, no further dots
- [ ] Active rule with endDate in the past — chip shows 已到期 · {endDate}
- [ ] Delete rule — disappears from list and calendar
- [ ] Mobile (≤640px) — calendar stays 7 cols without horizontal scroll; rule list rows wrap cleanly; dialogs scroll vertically
