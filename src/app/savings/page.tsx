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

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

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

  // TODO: load targetSavingsRate from user settings
  const targetSavingsRate = 30
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
