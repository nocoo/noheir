import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { buildSavingsRate } from "@/domain/dashboard/overview"
import type { DomainTransaction, MonthlyData } from "@/domain/types"
import { OverviewClient } from "./overview-client"

/** Map raw Worker transaction to DomainTransaction */
function toDomainTransaction(raw: Record<string, unknown>): DomainTransaction {
  return {
    id: String(raw.id ?? ""),
    date: String(raw.date ?? ""),
    year: Number(raw.year ?? 0),
    month: Number(raw.month ?? 0),
    primaryCategory: String(raw.primary_category ?? ""),
    secondaryCategory:
      raw.secondary_category != null
        ? String(raw.secondary_category)
        : null,
    tertiaryCategory: String(raw.tertiary_category ?? ""),
    amount: Number(raw.amount_cents ?? 0) / 100,
    account: String(raw.account ?? ""),
    type: raw.type === "income" ? "income" : "expense",
    currency: String(raw.currency ?? "CNY"),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    note: raw.note != null ? String(raw.note) : null,
  }
}

/** Build 12-month MonthlyData array from transactions */
function buildMonthlyData(transactions: DomainTransaction[]): MonthlyData[] {
  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
  ]

  const monthly: MonthlyData[] = monthNames.map((name) => ({
    month: name,
    income: 0,
    expense: 0,
    balance: 0,
  }))

  for (const tx of transactions) {
    const idx = tx.month - 1
    const entry = monthly[idx]
    if (!entry) continue
    if (tx.type === "income") {
      entry.income += tx.amount
    } else {
      entry.expense += tx.amount
    }
    entry.balance = entry.income - entry.expense
  }

  return monthly
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  let transactions: DomainTransaction[] = []
  let availableYears: number[] = []
  let selectedYear: number | null = null

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

    availableYears = metadata.years.sort((a, b) => b - a)

    // Use year from query param if valid, otherwise latest year
    const yearParam = params.year ? Number(params.year) : null
    if (yearParam && availableYears.includes(yearParam)) {
      selectedYear = yearParam
    } else {
      selectedYear = availableYears[0] ?? new Date().getFullYear()
    }

    const result = await client.searchTransactions(userId, {
      year: selectedYear,
    })

    transactions = result.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>)
    )
  } catch {
    // Not authenticated or Worker unavailable — render empty state
  }

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)
  const balance = totalIncome - totalExpense
  const savingsRate = buildSavingsRate(totalIncome, totalExpense)
  const monthlyData = buildMonthlyData(transactions)

  return (
    <AppShell>
      <OverviewClient
        transactions={transactions}
        monthlyData={monthlyData}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        balance={balance}
        savingsRate={savingsRate}
        selectedYear={selectedYear}
        availableYears={availableYears}
      />
    </AppShell>
  )
}
