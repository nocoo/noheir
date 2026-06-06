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
| 表单校验 | Zod（`zod ^4.3.6`） | 与 `unit-editor.tsx` 等一致 |
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
bun run lint              # eslint, max-warnings=0
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
- 目标库：`X-Target-DB` header（`production` / `test`）
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

## Implementation Phases（送入 plan 阶段时再细化）

```
Phase 1 (DB + Worker)
├── schema 加两表（categories, recurring_expenses）
├── 0007 迁移
├── repositories（含级联 SET NULL）
├── 8 个 Worker SQL 端点
└── worker 测试

Phase 2 (Domain + Actions)
├── rule-types.ts (Zod, colorToken 枚举校验)
├── occurrences.ts + 测试
├── occurrences-aggregate.ts + 测试
├── 9 个 Server Actions（recurring-expense × 6 + category × 3）
├── WorkerDbClient 8 方法
└── action 测试

Phase 3 (UI)
├── color-token-picker
├── frequency-picker
├── recurring-expense-form
├── category-form
├── recurring-expense-calendar
├── summary-cards
├── plan/calendar 页面
├── plan/categories 页面
├── sidebar 加 NavGroup
└── 视觉冒烟
```

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
