/**
 * Factory functions for test data.
 *
 * These return plain objects matching the Worker's Drizzle schema (camelCase).
 * They do NOT insert — the test calls the API to create.
 */

export function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    date: "2025-06-15",
    year: 2025,
    month: 6,
    day: 15,
    primaryCategory: "餐饮",
    secondaryCategory: "外卖",
    tertiaryCategory: "午餐",
    amountCents: 3500,
    type: "expense",
    account: "招商银行",
    currency: "人民币",
    tags: '["daily"]',
    note: "外卖午餐",
    ...overrides,
  };
}

export function makeTransfer(overrides: Record<string, unknown> = {}) {
  return {
    date: "2025-06-15",
    year: 2025,
    month: 6,
    day: 15,
    primaryCategory: "转账",
    secondaryCategory: "转账",
    transactionType: "转出",
    inflowAmountCents: 0,
    outflowAmountCents: 100000,
    currency: "人民币",
    account: "招商银行",
    tags: "[]",
    note: "转到储蓄账户",
    ...overrides,
  };
}

export function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    name: "招银理财月度宝",
    code: "ZY-MONTHLY-001",
    channel: "招商银行",
    category: "理财产品",
    currency: "CNY",
    lockPeriodDays: 30,
    annualReturnRate: 3.2,
    ...overrides,
  };
}

export function makeUnit(overrides: Record<string, unknown> = {}) {
  return {
    unitCode: "U-2025-001",
    amountCents: 5000000,
    currency: "CNY",
    status: "已成立",
    strategy: "短期理财",
    tactics: "理财产品",
    note: "E2E测试资金单元",
    ...overrides,
  };
}
