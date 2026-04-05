import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ============================================================================
// 1. users — Identity (AD-1: Canonical Principal)
// ============================================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code"),
  channel: text("channel"),
  category: text("category"),
  currency: text("currency").default("CNY"),
  lockPeriodDays: integer("lock_period_days").default(0),
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
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  currency: text("currency").default("人民币").notNull(),
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
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  primaryCategory: text("primary_category"),
  secondaryCategory: text("secondary_category").default("转账"),
  transactionType: text("transaction_type"),
  inflowAmountCents: integer("inflow_amount_cents").default(0),
  outflowAmountCents: integer("outflow_amount_cents").default(0),
  currency: text("currency").default("人民币").notNull(),
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
  ownerId: text("owner_id").notNull().unique()
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
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  unitId: text("unit_id").notNull().references(() => capitalUnits.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => financialProducts.id, { onDelete: "restrict" }),
  productName: text("product_name"), // Snapshot for audit trail
  operationType: text("operation_type").notNull(), // "invest" | "withdraw" | "adjust"
  amountCents: integer("amount_cents").notNull(), // Positive = invest, negative = withdraw
  balanceAfterCents: integer("balance_after_cents"), // Balance snapshot after operation
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
