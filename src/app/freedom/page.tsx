import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction } from "@/domain/types"
import { toDomainTransaction } from "@/lib/transaction-mappers"
import {
  buildIncomeBreakdown,
  buildTotalExpense,
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
  let availableYears: number[] = []
  let selectedYear: number | null = null

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

    availableYears = metadata.years.sort((a, b) => b - a)
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

  // TODO: load active income categories from user settings
  const activeIncomeCategories: string[] = []

  const breakdown = buildIncomeBreakdown(transactions, activeIncomeCategories)
  const totalExpense = buildTotalExpense(transactions)
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
        selectedYear={selectedYear}
        availableYears={availableYears}
      />
    </AppShell>
  )
}
