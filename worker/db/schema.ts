import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ============================================================================
// 1. users — Identity (AD-1: Canonical Principal)
// ============================================================================

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  providerAccountId: text("provider_account_id").notNull().unique(), // Google sub
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// 2. financial_products — Investment products
// ============================================================================

export const financialProducts = sqliteTable("financial_products", {
  version: integer("version").notNull().default(1),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code"),
  channel: text("channel"),
  category: text("category"),
  currency: text("currency").default("CNY"),
  lockPeriodDays: integer("lock_period_days").default(0),
  openDays: integer("open_days"),
  cycleDays: integer("cycle_days"),
  annualReturnRate: real("annual_return_rate"),
  isArchived: integer("is_archived", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// 3. capital_units — Individual capital allocations
// ============================================================================

export const capitalUnits = sqliteTable("capital_units", {
  version: integer("version").notNull().default(1),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  unitCode: text("unit_code").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").default("CNY"),
  status: text("status").default("已成立"),
  strategy: text("strategy"),
  tactics: text("tactics"),
  productId: text("product_id").references(() => financialProducts.id, { onDelete: "set null" }),
  startDate: text("start_date"),
  endDate: text("end_date"),
  note: text("note"),
  /** Manual unlock date; computeAvailability prefers this over invest+lock. */
  availableDateOverride: text("available_date_override"),
  /** Random per-commit marker; see 0009 migration and worker/lib/unit-commit.ts. */
  commitToken: text("commit_token"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// 4. transactions — Income/expense records
// ============================================================================

export const transactions = sqliteTable("transactions", {
  version: integer("version").notNull().default(1),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  primaryCategory: text("primary_category").notNull(),
  secondaryCategory: text("secondary_category"),
  tertiaryCategory: text("tertiary_category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  type: text("type").notNull(), // "income" | "expense"
  account: text("account").notNull(),
  currency: text("currency").default("CNY").notNull(),
  tags: text("tags").default("[]"), // JSON string: '["tag1","tag2"]'
  note: text("note"),
  rawIndex: integer("raw_index"),
  hasSecondaryMapping: integer("has_secondary_mapping", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// 5. transfers — Inter-account transfers
// ============================================================================

export const transfers = sqliteTable("transfers", {
  version: integer("version").notNull().default(1),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  primaryCategory: text("primary_category"),
  secondaryCategory: text("secondary_category").default("转账"),
  transactionType: text("transaction_type"),
  inflowAmountCents: integer("inflow_amount_cents").default(0),
  outflowAmountCents: integer("outflow_amount_cents").default(0),
  currency: text("currency").default("CNY").notNull(),
  account: text("account").notNull(),
  tags: text("tags").default("[]"), // JSON string: '["tag1","tag2"]'
  note: text("note"),
  rawIndex: integer("raw_index"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// 6. settings — Per-user application settings (AD-4)
// ============================================================================

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  siteName: text("site_name").default(""),
  settings: text("settings").default("{}"), // JSON string
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// 7. contribution_logs — Capital contribution history
// ============================================================================

export const contributionLogs = sqliteTable("contribution_logs", {
  version: integer("version").notNull().default(1),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => capitalUnits.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => financialProducts.id, { onDelete: "restrict" }),
  productName: text("product_name"), // Snapshot for audit trail
  operationType: text("operation_type").notNull(), // "invest" | "withdraw" | "adjust"
  amountCents: integer("amount_cents").notNull(), // Positive = invest, negative = withdraw
  balanceAfterCents: integer("balance_after_cents"), // Balance snapshot after operation
  pnlCents: integer("pnl_cents"), // Realized gain/loss, independent of amountCents
  operationDate: text("operation_date").notNull(), // YYYY-MM-DD
  source: text("source").default("manual"), // "manual" | "auto" | "import"
  note: text("note"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }), // Soft delete
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// expense_categories — user-defined spending categories for recurring rules
// 002-recurring-expense-calendar.md § Data Model
// ============================================================================

export const expenseCategories = sqliteTable(
  "expense_categories",
  {
    version: integer("version").notNull().default(1),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // chart token name (e.g. "chart-7"); rendered as hsl(var(--chart-7))
    // so categories follow the active theme without per-user hex storage.
    colorToken: text("color_token").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userNameUnique: uniqueIndex("expense_categories_user_name_uniq").on(table.userId, table.name),
  }),
);

// ============================================================================
// recurring_expenses — periodic spending rules expanded by computeOccurrences
// 002-recurring-expense-calendar.md § Data Model
// ============================================================================

export const recurringExpenses = sqliteTable("recurring_expenses", {
  version: integer("version").notNull().default(1),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  categoryId: text("category_id").references(() => expenseCategories.id, {
    onDelete: "set null",
  }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").default("CNY").notNull(),
  account: text("account"),
  // Recurrence rule embedded inline (one row per rule, no join needed).
  // frequency ∈ {'daily','weekly','monthly','yearly'}; interval ≥ 1;
  // dayOfMonth 1..31 (monthly/yearly); monthOfYear 1..12 (yearly);
  // weekday 0..6, Sunday=0 (weekly).
  frequency: text("frequency").notNull(),
  interval: integer("interval").notNull().default(1),
  dayOfMonth: integer("day_of_month"),
  monthOfYear: integer("month_of_year"),
  weekday: integer("weekday"),
  startDate: text("start_date").notNull(), // ISO "YYYY-MM-DD"
  endDate: text("end_date"), // ISO; null = open-ended
  // Lifecycle state machine.
  //   active  — render on calendar, count in summary
  //   paused  — hidden everywhere, retained for resume
  //   ended   — historic occurrences (≤ endedAt) keep rendering; future hidden
  status: text("status").notNull().default("active"),
  // Manual end-date (inclusive). Non-null only when status='ended';
  // written by the endRecurringExpense Server Action via the
  // X-Internal-Action header guard. UI never edits directly.
  endedAt: text("ended_at"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
