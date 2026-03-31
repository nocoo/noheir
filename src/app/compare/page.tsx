import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction, YearlyComparison } from "@/domain/types"
import { toDomainTransaction } from "@/lib/transaction-mappers"
import { buildYearComparisonChartData } from "@/domain/dashboard/year-comparison"
import { YearComparisonClient } from "./year-comparison-client"

function buildYearlyComparisons(
  transactions: DomainTransaction[],
  years: number[],
): YearlyComparison[] {
  return years.map((year) => {
    const yearTxs = transactions.filter((t) => t.year === year)
    const totalIncome = yearTxs
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0)
    const totalExpense = yearTxs
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)

    return {
      year,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      categoryBreakdown: [],
    }
  })
}

export default async function ComparePage() {
  let allTransactions: DomainTransaction[] = []
  let availableYears: number[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

    availableYears = metadata.years.sort((a, b) => a - b) // ascending for chart

    // Fetch transactions for all years
    const fetchPromises = availableYears.map(async (year) => {
      const result = await client.searchTransactions(userId, { year })
      return result.transactions.map((raw) =>
        toDomainTransaction(raw as Record<string, unknown>),
      )
    })

    const results = await Promise.all(fetchPromises)
    allTransactions = results.flat()
  } catch {
    // Not authenticated or Worker unavailable
  }

  const yearlyComparisons = buildYearlyComparisons(
    allTransactions,
    availableYears,
  )
  const chartData = buildYearComparisonChartData(yearlyComparisons)

  // TODO: load targetSavingsRate from user settings
  const targetSavingsRate = 30

  return (
    <AppShell>
      <YearComparisonClient
        chartData={chartData}
        targetSavingsRate={targetSavingsRate}
      />
    </AppShell>
  )
}
