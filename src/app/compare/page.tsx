import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { MonthlyData } from "@/domain/types"
import { MONTH_NAMES } from "@/lib/constants"
import { YearComparisonClient } from "./year-comparison-client"

export default async function ComparePage() {
  const yearlyMonthlyData: Record<number, MonthlyData[]> = {}
  let availableYears: number[] = []
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

    availableYears = metadata.years.sort((a, b) => a - b) // ascending

    // Fetch all yearly summaries with monthly breakdown in parallel
    const summaries = await Promise.all(
      availableYears.map(async (year) => {
        const summary = await client.getYearlySummary(userId, year)
        return { year, summary }
      })
    )

    // Build a map: { 2024: MonthlyData[], 2025: MonthlyData[], ... }
    for (const { year, summary } of summaries) {
      yearlyMonthlyData[year] = summary.months.map((m) => ({
        month: MONTH_NAMES[m.month - 1] ?? `${m.month}月`,
        income: m.income / 100,
        expense: m.expense / 100,
        balance: (m.income - m.expense) / 100,
      }))
    }
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <YearComparisonClient
        yearlyMonthlyData={yearlyMonthlyData}
        availableYears={availableYears}
        targetSavingsRate={targetSavingsRate}
      />
    </AppShell>
  )
}
