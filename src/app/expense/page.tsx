import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction } from "@/domain/types"
import { toDomainTransaction, buildMonthlyData } from "@/lib/transaction-mappers"
import {
  buildFilteredTransactions,
  buildTotalAmount,
  buildTopTransactions,
  buildMonthlyFiltered,
  buildAverageMonthly,
  buildTransactionLabels,
} from "@/domain/dashboard/transaction-analysis"
import { buildCategoryData, buildAccountData } from "@/lib/category-builders"
import { TransactionAnalysisClient } from "../transaction-analysis-client"

export default async function ExpensePage({
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

  const type = "expense" as const
  const filtered = buildFilteredTransactions(transactions, type)
  const totalAmount = buildTotalAmount(filtered)
  const monthlyData = buildMonthlyData(transactions)
  const monthlyFiltered = buildMonthlyFiltered(monthlyData, type)
  const avgMonthly = buildAverageMonthly(monthlyFiltered, type)
  const topTransactions = buildTopTransactions(filtered, 50)
  const labels = buildTransactionLabels(type)
  const { chartData, detailList } = buildCategoryData(filtered, totalAmount)
  const accountData = buildAccountData(filtered, totalAmount, 10)

  return (
    <AppShell>
      <TransactionAnalysisClient
        type={type}
        totalAmount={totalAmount}
        avgMonthly={avgMonthly}
        transactionCount={filtered.length}
        monthlyData={monthlyData}
        chartData={chartData}
        detailList={detailList}
        accountData={accountData}
        topTransactions={topTransactions.map((t) => ({
          id: t.id,
          date: t.date,
          primaryCategory: t.primaryCategory,
          secondaryCategory: t.secondaryCategory,
          tertiaryCategory: t.tertiaryCategory,
          account: t.account,
          description: t.note,
          amount: t.amount,
        }))}
        labels={labels}
        selectedYear={selectedYear}
        availableYears={availableYears}
      />
    </AppShell>
  )
}
