import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction } from "@/domain/types"
import { toDomainTransaction, buildMonthlyData } from "@/lib/transaction-mappers"
import {
  buildSavingsRateChartData,
  buildSavingsRateSummary,
} from "@/domain/dashboard/savings-rate"
import { SavingsRateClient } from "./savings-rate-client"

export default async function SavingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  let transactions: DomainTransaction[] = []
  let selectedYear: number | null = null

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

    const availableYears = metadata.years.sort((a, b) => b - a)
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
      toDomainTransaction(raw as Record<string, unknown>),
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  const monthlyData = buildMonthlyData(transactions)
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
