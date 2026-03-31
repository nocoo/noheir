import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { YearlyComparison } from "@/domain/types"
import { buildYearComparisonChartData } from "@/domain/dashboard/year-comparison"
import { YearComparisonClient } from "./year-comparison-client"

export default async function ComparePage() {
  let yearlyComparisons: YearlyComparison[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

    const availableYears = metadata.years.sort((a, b) => a - b) // ascending for chart

    // Fetch yearly summaries in parallel — one lightweight SQL per year
    const summaries = await Promise.all(
      availableYears.map(async (year) => {
        const summary = await client.getYearlySummary(userId, year)
        return { year, summary }
      })
    )

    yearlyComparisons = summaries.map(({ year, summary }) => ({
      year,
      totalIncome: summary.totals.income / 100,
      totalExpense: summary.totals.expense / 100,
      balance: (summary.totals.income - summary.totals.expense) / 100,
      categoryBreakdown: [],
    }))
  } catch {
    // Not authenticated or Worker unavailable
  }

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
