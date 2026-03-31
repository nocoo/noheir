import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction } from "@/domain/types"
import { toDomainTransaction, buildMonthlyData } from "@/lib/transaction-mappers"
import {
  buildSafeMonthlyData,
  buildSafeTotalIncome,
  buildFinancialHealthResult,
} from "@/domain/dashboard/financial-health"
import { FinancialHealthClient } from "./financial-health-client"

export default async function FinancialHealthPage({
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
      toDomainTransaction(raw as Record<string, unknown>)
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  const monthlyData = buildMonthlyData(transactions)
  const safeMonthly = buildSafeMonthlyData(monthlyData)
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0)
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
