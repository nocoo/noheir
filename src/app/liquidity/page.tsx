import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { toUnitDisplayInfo } from "@/lib/capital-mappers"
import type { UnitDisplayInfo } from "@/domain/types"
import {
  buildMonthlyAvailability,
  buildSeries,
  buildSummaryStats,
} from "@/domain/assets/liquidity-ladder"
import { LiquidityClient } from "./liquidity-client"

export default async function LiquidityPage() {
  let units: UnitDisplayInfo[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.listUnits(userId, { with_products: true })
    units = result.units
      .map((raw) => toUnitDisplayInfo(raw as Record<string, unknown>))
  } catch {
    // Not authenticated or Worker unavailable
  }

  const monthlyData = buildMonthlyAvailability(units)
  const series = buildSeries(monthlyData)
  const summaryStats = buildSummaryStats(monthlyData)

  // Transform for Recharts: each month row has a field per strategy
  const chartData = monthlyData.months.map((month, i) => {
    const monthLabel =
      monthlyData.monthlyAvailability.find((m) => m.month === month)
        ?.monthLabel ?? month
    const row: Record<string, string | number> = { month: monthLabel }
    series.forEach((s) => {
      row[s.name] = s.data[i] ?? 0
    })
    return row
  })

  return (
    <AppShell>
      <LiquidityClient
        chartData={chartData}
        strategies={monthlyData.strategies}
        total12m={summaryStats.total}
        avgMonth={summaryStats.avgMonth}
        peakMonth={summaryStats.peakMonth.month}
        peakAmount={summaryStats.peakMonth.amount}
      />
    </AppShell>
  )
}
