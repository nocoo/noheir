import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction, MonthlyData } from "@/domain/types"
import { toDomainTransaction } from "@/lib/transaction-mappers"
import {
  buildSafeMonthlyData,
  buildSafeTotalIncome,
  buildFinancialHealthResult,
} from "@/domain/dashboard/financial-health"
import { FinancialHealthClient } from "./financial-health-client"
import { MONTH_NAMES } from "@/lib/constants"

export default async function FinancialHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  let transactions: DomainTransaction[] | undefined
  let monthlyData: MonthlyData[] = []
  let totalIncome = 0

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

    // Fetch aggregated monthly data + raw transactions in parallel
    // Monthly data from aggregation API (accurate, no truncation)
    // Raw transactions still needed for rigidity (tertiaryCategory) & quality (primaryCategory)
    const [summary, txResult] = await Promise.all([
      client.getYearlySummary(userId, selectedYear),
      client.getAllTransactionsByYear(userId, selectedYear),
    ])

    // Build monthly data from aggregation API (cents → display)
    monthlyData = summary.months.map((m) => ({
      month: MONTH_NAMES[m.month - 1] ?? `${m.month}月`,
      income: m.income / 100,
      expense: m.expense / 100,
      balance: (m.income - m.expense) / 100,
    }))

    totalIncome = summary.totals.income / 100

    transactions = txResult.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>)
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  const safeMonthly = buildSafeMonthlyData(monthlyData)
  const safeTotalIncome = buildSafeTotalIncome(totalIncome)

  // TODO: load fixedExpenseCategories from user settings
  const fixedExpenseCategories: string[] = []

  const healthResult = buildFinancialHealthResult(
    transactions,
    safeMonthly,
    safeTotalIncome,
    fixedExpenseCategories,
  )

  return (
    <AppShell>
      <FinancialHealthClient
        healthResult={healthResult}
        monthlyData={safeMonthly}
      />
    </AppShell>
  )
}
