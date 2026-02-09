/**
 * Reusable factory functions for creating test data.
 *
 * All factories return plain objects matching the Supabase table schema.
 * They do NOT insert anything — callers use them with `.insert()`.
 */

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
export function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-01-15",
    year: 2026,
    month: 1,
    day: 15,
    primary_category: "餐饮",
    secondary_category: "外卖",
    tertiary_category: "午餐",
    amount: 35.5,
    type: "expense",
    account: "招商银行",
    currency: "人民币",
    tags: ["日常"],
    note: "e2e test transaction",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------
export function makeTransfer(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-01-15",
    year: 2026,
    month: 1,
    day: 15,
    primary_category: "内部转账",
    secondary_category: "转账",
    transaction_type: "转出",
    outflow_amount: 1000,
    inflow_amount: 0,
    currency: "人民币",
    account: "招商银行",
    tags: [],
    note: "e2e test transfer",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Financial Products
// ---------------------------------------------------------------------------
export function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    name: "E2E 测试基金",
    code: "E2E001",
    channel: "招商银行",
    category: "债券基金",
    currency: "CNY",
    lock_period_days: 0,
    annual_return_rate: 3.5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Capital Units
// ---------------------------------------------------------------------------
export function makeUnit(overrides: Record<string, unknown> = {}) {
  return {
    unit_code: "E2E-UNIT-001",
    amount: 10000,
    currency: "CNY",
    status: "已成立",
    strategy: "短期理财",
    tactics: "债券基金",
    start_date: "2026-01-01",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    site_name: "e2e-test",
    settings: { theme: "dark", locale: "zh-CN" },
    ...overrides,
  };
}
