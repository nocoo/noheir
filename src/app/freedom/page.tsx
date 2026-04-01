import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction } from "@/domain/types"
import { toDomainTransaction } from "@/lib/transaction-mappers"
import {
  buildIncomeBreakdown,
  buildFreedomSummary,
} from "@/domain/dashboard/financial-freedom"
import { FinancialFreedomClient } from "./financial-freedom-client"

export default async function FreedomPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  let transactions: DomainTransaction[] = []
  let totalExpenseFromSummary = 0

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

    // Fetch aggregated totals + raw transactions in parallel
    // Raw transactions needed for income breakdown by tertiaryCategory + secondaryCategory
    const [summary, result] = await Promise.all([
      client.getYearlySummary(userId, selectedYear),
      client.getAllTransactionsByYear(userId, selectedYear),
    ])

    totalExpenseFromSummary = summary.totals.expense / 100

    transactions = result.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>),
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  // TODO: load active income categories from user settings
  const activeIncomeCategories: string[] = []

  const breakdown = buildIncomeBreakdown(transactions, activeIncomeCategories)
  // Use accurate total expense from aggregation API
  const totalExpense = totalExpenseFromSummary
  const summary = buildFreedomSummary(totalExpense, breakdown.passiveIncome)

  // Serialize Maps to arrays for client component
  const activeByCategoryList = Array.from(
    breakdown.activeByCategory.entries(),
  ).map(([name, amount]) => ({ name, amount }))
  const passiveByCategoryList = Array.from(
    breakdown.passiveByCategory.entries(),
  ).map(([name, amount]) => ({ name, amount }))

  return (
    <AppShell>
      <FinancialFreedomClient
        totalIncome={breakdown.totalIncome}
        activeIncome={breakdown.activeIncome}
        passiveIncome={breakdown.passiveIncome}
        totalExpense={totalExpense}
        summary={summary}
        activeByCategoryList={activeByCategoryList}
        passiveByCategoryList={passiveByCategoryList}
      />
    </AppShell>
  )
}
