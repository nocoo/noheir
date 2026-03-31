import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { AccountSummary } from "@/domain/dashboard/account-analysis"
import {
  buildAccountGroups,
  buildChartData,
  buildPieData,
} from "@/domain/dashboard/account-analysis"
import { AccountAnalysisClient } from "./account-analysis-client"

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  let accountData: AccountSummary[] = []
  let totalTransactions = 0
  let totalFlow = 0

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

    const accountSummary = await client.getAccountSummary(userId, selectedYear)

    // Build AccountSummary[] from server-side aggregation
    const accountMap = new Map<string, AccountSummary>()

    for (const row of accountSummary.accounts) {
      if (!accountMap.has(row.account)) {
        accountMap.set(row.account, {
          name: row.account,
          income: 0,
          expense: 0,
          balance: 0,
          transactionCount: 0,
          categories: new Map(),
        })
      }
      const acc = accountMap.get(row.account)
      if (!acc) continue
      const amount = row.total / 100

      if (row.type === "income") {
        acc.income += amount
      } else {
        acc.expense += amount
      }
      acc.balance = acc.income - acc.expense
      acc.transactionCount += row.count

      totalTransactions += row.count
      totalFlow += amount
    }

    accountData = Array.from(accountMap.values()).sort(
      (a, b) => b.income + b.expense - (a.income + a.expense),
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  const accountGroups = buildAccountGroups(accountData, "prefix")
  const chartData = buildChartData(accountData)
  const pieData = buildPieData(accountData)

  const totalIncome = accountData.reduce((sum, acc) => sum + acc.income, 0)
  const totalExpense = accountData.reduce((sum, acc) => sum + acc.expense, 0)

  const summaryStats = {
    accountCount: accountData.length,
    totalTransactions,
    totalFlow,
    totalIncome,
    totalExpense,
  }

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
