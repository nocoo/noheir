import { describe, test, expect } from "vitest"
import {
  buildYearlyStats,
  buildDataHealthMetrics,
  buildDataSummary,
  getHealthScore,
  getHealthLabel,
  formatCurrency,
} from "@/domain/data-management"
import type { DomainTransaction, DomainTransfer } from "@/domain/types"

const makeTransaction = (overrides: Partial<DomainTransaction> = {}): DomainTransaction => ({
  id: "test-id",
  date: "2026-03-15",
  year: 2026,
  month: 3,
  primaryCategory: "餐饮",
  secondaryCategory: "外卖",
  tertiaryCategory: "午餐",
  amount: 35.00,
  account: "招商银行",
  type: "expense",
  currency: "CNY",
  tags: [],
  note: null,
  ...overrides,
})

const makeTransfer = (overrides: Partial<DomainTransfer> = {}): DomainTransfer => ({
  id: "test-id",
  date: "2026-03-15",
  year: 2026,
  month: 3,
  day: 15,
  primaryCategory: "转账",
  secondaryCategory: null,
  transactionType: "transfer-out",
  inflowAmount: 0,
  outflowAmount: 1000,
  account: "招商银行",
  currency: "CNY",
  tags: [],
  note: null,
  ...overrides,
})

describe("data-management domain", () => {
  describe("formatCurrency", () => {
    test("formats cents to currency string", () => {
      expect(formatCurrency(350000)).toBe("¥3,500.00")
      expect(formatCurrency(100)).toBe("¥1.00")
      expect(formatCurrency(0)).toBe("¥0.00")
    })
  })

  describe("buildYearlyStats", () => {
    test("calculates yearly stats correctly", () => {
      const transactions: DomainTransaction[] = [
        makeTransaction({ type: "income", amount: 10000 }),
        makeTransaction({ type: "expense", amount: 3500 }),
        makeTransaction({ type: "expense", amount: 1500, month: 4 }),
      ]
      const transfers: DomainTransfer[] = [
        makeTransfer({ account: "支付宝" }),
      ]

      const stats = buildYearlyStats(transactions, transfers, 2026)

      expect(stats.year).toBe(2026)
      expect(stats.transactionCount).toBe(3)
      expect(stats.transferCount).toBe(1)
      expect(stats.incomeCount).toBe(1)
      expect(stats.expenseCount).toBe(2)
      expect(stats.totalIncome).toBe(1000000) // 10000 * 100
      expect(stats.totalExpense).toBe(500000) // (3500 + 1500) * 100
      expect(stats.netAmount).toBe(500000)
      expect(stats.accounts).toContain("招商银行")
      expect(stats.accounts).toContain("支付宝")
      expect(stats.monthsCovered).toEqual([3, 4])
    })

    test("returns empty stats for year with no data", () => {
      const stats = buildYearlyStats([], [], 2025)

      expect(stats.year).toBe(2025)
      expect(stats.transactionCount).toBe(0)
      expect(stats.totalIncome).toBe(0)
      expect(stats.dateRange).toBeNull()
    })
  })

  describe("buildDataHealthMetrics", () => {
    test("returns 100% completeness for empty data", () => {
      const metrics = buildDataHealthMetrics([])

      expect(metrics.totalRecords).toBe(0)
      expect(metrics.dateCompleteness).toBe(100)
      expect(metrics.categoryCompleteness).toBe(100)
    })

    test("calculates completeness for valid data", () => {
      const transactions = [
        makeTransaction(),
        makeTransaction({ id: "2" }),
        makeTransaction({ id: "3" }),
      ]

      const metrics = buildDataHealthMetrics(transactions)

      expect(metrics.totalRecords).toBe(3)
      expect(metrics.dateCompleteness).toBe(100)
      expect(metrics.categoryCompleteness).toBe(100)
      expect(metrics.amountCompleteness).toBe(100)
      expect(metrics.accountCompleteness).toBe(100)
      expect(metrics.missingDates).toBe(0)
      expect(metrics.zeroAmounts).toBe(0)
    })

    test("detects zero amount issues", () => {
      const transactions = [
        makeTransaction({ amount: 0 }),
        makeTransaction({ id: "2", amount: 100 }),
      ]

      const metrics = buildDataHealthMetrics(transactions)

      expect(metrics.zeroAmounts).toBe(1)
      expect(metrics.amountCompleteness).toBe(50)
    })

    test("detects missing secondary category mappings", () => {
      const transactions = [
        makeTransaction({ secondaryCategory: "其他", tertiaryCategory: "未知分类" }),
        makeTransaction({ id: "2" }),
      ]

      const metrics = buildDataHealthMetrics(transactions)

      expect(metrics.missingSecondaryMappings).toBe(1)
      expect(metrics.unmappedTertiaryCategories).toContain("未知分类")
    })

    test("calculates date range", () => {
      const transactions = [
        makeTransaction({ date: "2026-01-15" }),
        makeTransaction({ id: "2", date: "2026-06-20" }),
        makeTransaction({ id: "3", date: "2026-03-10" }),
      ]

      const metrics = buildDataHealthMetrics(transactions)

      expect(metrics.dateRange).toEqual({ start: "2026-01-15", end: "2026-06-20" })
    })
  })

  describe("buildDataSummary", () => {
    test("aggregates data across multiple years", () => {
      const transactions: DomainTransaction[] = [
        makeTransaction({ year: 2026, type: "income", amount: 5000 }),
        makeTransaction({ id: "2", year: 2026, type: "expense", amount: 1000 }),
        makeTransaction({ id: "3", year: 2025, type: "income", amount: 3000, date: "2025-06-15" }),
      ]
      const transfers: DomainTransfer[] = [
        makeTransfer({ year: 2026 }),
      ]

      const summary = buildDataSummary(transactions, transfers)

      expect(summary.totalTransactions).toBe(3)
      expect(summary.totalTransfers).toBe(1)
      expect(summary.years).toEqual([2026, 2025]) // Descending order
      expect(summary.yearlyStats).toHaveLength(2)
      expect(summary.totalIncome).toBe(800000) // (5000 + 3000) * 100
      expect(summary.totalExpense).toBe(100000) // 1000 * 100
    })
  })

  describe("getHealthScore", () => {
    test("returns 100 for empty data", () => {
      const metrics = buildDataHealthMetrics([])
      expect(getHealthScore(metrics)).toBe(100)
    })

    test("returns high score for complete data", () => {
      const transactions = [
        makeTransaction(),
        makeTransaction({ id: "2" }),
      ]
      const metrics = buildDataHealthMetrics(transactions)
      const score = getHealthScore(metrics)

      expect(score).toBeGreaterThan(90)
    })

    test("returns lower score for data with issues", () => {
      const transactions = [
        makeTransaction({ amount: 0 }),
        makeTransaction({ id: "2", amount: 0 }),
        makeTransaction({ id: "3" }),
      ]
      const metrics = buildDataHealthMetrics(transactions)
      const score = getHealthScore(metrics)

      expect(score).toBeLessThan(90)
    })
  })

  describe("getHealthLabel", () => {
    test("returns correct labels for score ranges", () => {
      expect(getHealthLabel(95)).toBe("优秀")
      expect(getHealthLabel(90)).toBe("优秀")
      expect(getHealthLabel(85)).toBe("良好")
      expect(getHealthLabel(70)).toBe("良好")
      expect(getHealthLabel(60)).toBe("一般")
      expect(getHealthLabel(50)).toBe("一般")
      expect(getHealthLabel(40)).toBe("较差")
    })
  })
})
