import type { DomainTransaction, DomainTransfer } from "./types"

// ── Format Helpers ──

export const formatImportDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(cents / 100);
};

// ── Types ──

export interface YearlyStats {
  year: number
  transactionCount: number
  transferCount: number
  incomeCount: number
  expenseCount: number
  totalIncome: number // in cents
  totalExpense: number // in cents
  netAmount: number // in cents
  accountCount: number
  categoryCount: number
  accounts: string[]
  categories: string[]
  dateRange: { start: string; end: string } | null
  monthsCovered: number[]
}

export interface DataHealthMetrics {
  totalRecords: number
  // Completeness (percentage 0-100)
  dateCompleteness: number
  categoryCompleteness: number
  amountCompleteness: number
  accountCompleteness: number
  // Integrity issues
  missingDates: number
  futureDates: number
  zeroAmounts: number
  negativeAmounts: number
  // Category mapping
  missingSecondaryMappings: number
  unmappedTertiaryCategories: string[]
  // Statistics
  dateRange: { start: string; end: string } | null
  accounts: string[]
  primaryCategories: string[]
}

export interface DataSummary {
  totalTransactions: number
  totalTransfers: number
  years: number[]
  yearlyStats: YearlyStats[]
  // Totals across all years
  totalIncome: number
  totalExpense: number
  totalNetAmount: number
  totalAccounts: string[]
  totalCategories: string[]
}

// ── Build Functions ──

/**
 * Calculate yearly statistics for transactions
 */
export function buildYearlyStats(
  transactions: DomainTransaction[],
  transfers: DomainTransfer[],
  year: number,
): YearlyStats {
  const yearTxs = transactions.filter((t) => t.year === year)
  const yearTransfers = transfers.filter((t) => t.year === year)

  const income = yearTxs.filter((t) => t.type === "income")
  const expense = yearTxs.filter((t) => t.type === "expense")

  // amount is in display units (cents/100), convert back to cents for consistency
  const totalIncome = Math.round(income.reduce((sum, t) => sum + t.amount, 0) * 100)
  const totalExpense = Math.round(expense.reduce((sum, t) => sum + t.amount, 0) * 100)

  const accounts = new Set<string>()
  const categories = new Set<string>()
  const months = new Set<number>()
  let minDate: string | null = null
  let maxDate: string | null = null

  for (const tx of yearTxs) {
    accounts.add(tx.account)
    categories.add(tx.primaryCategory)
    months.add(tx.month)
    if (!minDate || tx.date < minDate) minDate = tx.date
    if (!maxDate || tx.date > maxDate) maxDate = tx.date
  }

  // Also include transfer accounts
  for (const tr of yearTransfers) {
    accounts.add(tr.account)
  }

  return {
    year,
    transactionCount: yearTxs.length,
    transferCount: yearTransfers.length,
    incomeCount: income.length,
    expenseCount: expense.length,
    totalIncome,
    totalExpense,
    netAmount: totalIncome - totalExpense,
    accountCount: accounts.size,
    categoryCount: categories.size,
    accounts: Array.from(accounts).sort(),
    categories: Array.from(categories).sort(),
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
    monthsCovered: Array.from(months).sort((a, b) => a - b),
  }
}

/**
 * Build data health metrics for transactions
 */
export function buildDataHealthMetrics(
  transactions: DomainTransaction[],
): DataHealthMetrics {
  const total = transactions.length
  if (total === 0) {
    return {
      totalRecords: 0,
      dateCompleteness: 100,
      categoryCompleteness: 100,
      amountCompleteness: 100,
      accountCompleteness: 100,
      missingDates: 0,
      futureDates: 0,
      zeroAmounts: 0,
      negativeAmounts: 0,
      missingSecondaryMappings: 0,
      unmappedTertiaryCategories: [],
      dateRange: null,
      accounts: [],
      primaryCategories: [],
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  let missingDates = 0
  let futureDates = 0
  let zeroAmounts = 0
  let negativeAmounts = 0
  let missingSecondary = 0
  const unmappedTertiary = new Set<string>()

  let validDates = 0
  let validCategories = 0
  let validAmounts = 0
  let validAccounts = 0

  const accounts = new Set<string>()
  const primaryCategories = new Set<string>()
  let minDate: string | null = null
  let maxDate: string | null = null

  for (const tx of transactions) {
    // Date validation
    if (!tx.date || tx.date.trim() === "") {
      missingDates++
    } else {
      validDates++
      if (tx.date > today) {
        futureDates++
      }
      if (!minDate || tx.date < minDate) minDate = tx.date
      if (!maxDate || tx.date > maxDate) maxDate = tx.date
    }

    // Category validation
    if (tx.primaryCategory && tx.primaryCategory.trim() !== "") {
      validCategories++
      primaryCategories.add(tx.primaryCategory)
    }

    // Check if secondary category is missing when tertiary exists
    if (tx.tertiaryCategory && (!tx.secondaryCategory || tx.secondaryCategory === "其他")) {
      missingSecondary++
      unmappedTertiary.add(tx.tertiaryCategory)
    }

    // Amount validation (amount is in display units, not cents)
    if (tx.amount === 0) {
      zeroAmounts++
    } else if (tx.amount < 0) {
      negativeAmounts++
    } else {
      validAmounts++
    }

    // Account validation
    if (tx.account && tx.account.trim() !== "") {
      validAccounts++
      accounts.add(tx.account)
    }
  }

  return {
    totalRecords: total,
    dateCompleteness: (validDates / total) * 100,
    categoryCompleteness: (validCategories / total) * 100,
    amountCompleteness: (validAmounts / total) * 100,
    accountCompleteness: (validAccounts / total) * 100,
    missingDates,
    futureDates,
    zeroAmounts,
    negativeAmounts,
    missingSecondaryMappings: missingSecondary,
    unmappedTertiaryCategories: Array.from(unmappedTertiary).sort(),
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
    accounts: Array.from(accounts).sort(),
    primaryCategories: Array.from(primaryCategories).sort(),
  }
}

/**
 * Build complete data summary with all years
 */
export function buildDataSummary(
  transactions: DomainTransaction[],
  transfers: DomainTransfer[],
): DataSummary {
  // Get unique years from both transactions and transfers
  const yearSet = new Set<number>()
  for (const tx of transactions) {
    yearSet.add(tx.year)
  }
  for (const tr of transfers) {
    yearSet.add(tr.year)
  }
  const years = Array.from(yearSet).sort((a, b) => b - a) // Descending

  // Build stats for each year
  const yearlyStats = years.map((year) =>
    buildYearlyStats(transactions, transfers, year),
  )

  // Calculate totals
  const totalAccounts = new Set<string>()
  const totalCategories = new Set<string>()
  let totalIncome = 0
  let totalExpense = 0

  for (const stats of yearlyStats) {
    totalIncome += stats.totalIncome
    totalExpense += stats.totalExpense
    for (const acc of stats.accounts) totalAccounts.add(acc)
    for (const cat of stats.categories) totalCategories.add(cat)
  }

  return {
    totalTransactions: transactions.length,
    totalTransfers: transfers.length,
    years,
    yearlyStats,
    totalIncome,
    totalExpense,
    totalNetAmount: totalIncome - totalExpense,
    totalAccounts: Array.from(totalAccounts).sort(),
    totalCategories: Array.from(totalCategories).sort(),
  }
}

/**
 * Get overall health score (0-100)
 */
export function getHealthScore(metrics: DataHealthMetrics): number {
  if (metrics.totalRecords === 0) return 100

  const completenessScore =
    (metrics.dateCompleteness +
      metrics.categoryCompleteness +
      metrics.amountCompleteness +
      metrics.accountCompleteness) /
    4

  const issueCount =
    metrics.missingDates +
    metrics.futureDates +
    metrics.zeroAmounts +
    metrics.negativeAmounts

  const integrityScore =
    ((metrics.totalRecords - issueCount) / metrics.totalRecords) * 100

  // 60% weight on completeness, 40% on integrity
  return completenessScore * 0.6 + integrityScore * 0.4
}

/**
 * Get health status label
 */
export function getHealthLabel(score: number): string {
  if (score >= 90) return "优秀"
  if (score >= 70) return "良好"
  if (score >= 50) return "一般"
  return "较差"
}

/**
 * Get health status color class
 * Uses fixed green/yellow/red colors (not semantic income/expense)
 * because health score meaning shouldn't swap with color scheme
 */
export function getHealthColorClass(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400"
  if (score >= 70) return "text-yellow-600 dark:text-yellow-400"
  return "text-red-600 dark:text-red-400"
}
