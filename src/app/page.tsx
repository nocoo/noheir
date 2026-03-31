import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { buildSavingsRate } from "@/domain/dashboard/overview"
import type { DomainTransaction } from "@/domain/types"
import { toDomainTransaction, buildMonthlyData } from "@/lib/transaction-mappers"
import { OverviewClient } from "./overview-client"

export default async function OverviewPage({
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

    // Use year from query param if valid, otherwise latest year
    const yearParam = params.year ? Number(params.year) : null
    if (yearParam && availableYears.includes(yearParam)) {
      selectedYear = yearParam
    } else {
      selectedYear = availableYears[0] ?? new Date().getFullYear()
    }

    const result = await client.searchAllTransactions(userId, {
      year: selectedYear,
    })

    transactions = result.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>)
    )
  } catch {
    // Not authenticated or Worker unavailable — render empty state
  }

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)
  const balance = totalIncome - totalExpense
  const savingsRate = buildSavingsRate(totalIncome, totalExpense)
  const monthlyData = buildMonthlyData(transactions)

  return (
    <AppShell>
      <OverviewClient
        transactions={transactions}
        monthlyData={monthlyData}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        balance={balance}
        savingsRate={savingsRate}
      />
    </AppShell>
  )
}
