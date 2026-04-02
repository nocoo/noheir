import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { YearlyComparison } from "@/domain/types"
import { buildYearComparisonChartData } from "@/domain/dashboard/year-comparison"
import { YearComparisonClient } from "./year-comparison-client"

export default async function ComparePage() {
  let yearlyComparisons: YearlyComparison[] = []
  let targetSavingsRate = 30 // default

  try {
    const { userId, client } = await getAuthedClient()

    // Fetch metadata and settings in parallel
    const [metadata, settingsResult] = await Promise.all([
      client.getMetadata(userId),
      client.getSettings(userId),
    ])

    // Parse settings for targetSavingsRate
    const settingsRow = (settingsResult.settings as Record<string, unknown>) ?? {}
    const rawJson = typeof settingsRow.settings === "string" ? settingsRow.settings : "{}"
    const settingsJson = JSON.parse(rawJson) as Record<string, unknown>
    if (typeof settingsJson.savings_rate_target === "number") {
      targetSavingsRate = settingsJson.savings_rate_target
    }

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

  return (
    <AppShell>
      <YearComparisonClient
        chartData={chartData}
        targetSavingsRate={targetSavingsRate}
      />
    </AppShell>
  )
}
