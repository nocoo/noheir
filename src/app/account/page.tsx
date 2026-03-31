import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction } from "@/domain/types"
import { toDomainTransaction } from "@/lib/transaction-mappers"
import {
  buildAccountData,
  buildAccountGroups,
  buildChartData,
  buildPieData,
  buildAccountSummaryStats,
} from "@/domain/dashboard/account-analysis"
import { AccountAnalysisClient } from "./account-analysis-client"

export default async function AccountPage({
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

    const result = await client.searchAllTransactions(userId, {
      year: selectedYear,
    })
    transactions = result.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>),
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  const accountData = buildAccountData(transactions)
  const accountGroups = buildAccountGroups(accountData, "prefix")
  const chartData = buildChartData(accountData)
  const pieData = buildPieData(accountData)
  const summaryStats = buildAccountSummaryStats(accountData, transactions)

  // Serialize AccountSummary (strip Map fields for client)
  const serializedAccounts = accountData.map((a) => ({
    name: a.name,
    income: a.income,
    expense: a.expense,
    balance: a.balance,
    transactionCount: a.transactionCount,
  }))

  const serializedGroups = accountGroups.map((g) => ({
    prefix: g.prefix,
    totalIncome: g.totalIncome,
    totalExpense: g.totalExpense,
    totalBalance: g.totalBalance,
    totalTransactions: g.totalTransactions,
    accountType: g.accountType,
    accounts: g.accounts.map((a) => ({
      name: a.name,
      income: a.income,
      expense: a.expense,
      balance: a.balance,
      transactionCount: a.transactionCount,
    })),
  }))

  return (
    <AppShell>
      <AccountAnalysisClient
        accounts={serializedAccounts}
        accountGroups={serializedGroups}
        chartData={chartData}
        pieData={pieData}
        summaryStats={summaryStats}
      />
    </AppShell>
  )
}
