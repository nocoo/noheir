import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { MonthlyData } from "@/domain/types"
import {
  buildSavingsRateChartData,
  buildSavingsRateSummary,
} from "@/domain/dashboard/savings-rate"
import { SavingsRateClient } from "./savings-rate-client"

const MONTH_NAMES = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
]

export default async function SavingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  let monthlyData: MonthlyData[] = MONTH_NAMES.map((name) => ({
    month: name, income: 0, expense: 0, balance: 0,
  }))
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

    const availableYears = metadata.years.sort((a, b) => b - a)
    const yearParam = params.year ? Number(params.year) : null
    let selectedYear: number
    if (yearParam && availableYears.includes(yearParam)) {
      selectedYear = yearParam
    } else {
      selectedYear = availableYears[0] ?? new Date().getFullYear()
    }

    const summary = await client.getYearlySummary(userId, selectedYear)

    monthlyData = summary.months.map((m) => ({
      month: MONTH_NAMES[m.month - 1] ?? `${m.month}月`,
      income: m.income / 100,
      expense: m.expense / 100,
      balance: (m.income - m.expense) / 100,
    }))
  } catch {
    // Not authenticated or Worker unavailable
  }

  const { chartData, totals } = buildSavingsRateChartData(monthlyData)
  const summary = buildSavingsRateSummary(totals, targetSavingsRate)

  return (
    <AppShell>
      <SavingsRateClient
        chartData={chartData}
        summary={summary}
        targetSavingsRate={targetSavingsRate}
      />
    </AppShell>
  )
}
