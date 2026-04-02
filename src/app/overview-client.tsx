"use client"

import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  List,
} from "lucide-react"
import type { DomainTransaction, MonthlyData } from "@/domain/types"
import { formatCurrencyFull } from "@/lib/chart-config"
import { StatCard } from "@/components/shared/stat-card"
import { IncomeExpenseChart } from "./income-expense-chart"
import { RecentTransactionsTable } from "./recent-transactions-table"
interface OverviewClientProps {
  transactions: DomainTransaction[]
  monthlyData: MonthlyData[]
  totalIncome: number
  totalExpense: number
  balance: number
  savingsRate: number
}

export function OverviewClient({
  transactions,
  monthlyData,
  totalIncome,
  totalExpense,
  balance,
  savingsRate,
}: OverviewClientProps) {
  // Filter to last month's transactions
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  const oneMonthAgoStr = oneMonthAgo.toISOString().slice(0, 10)

  const recentTransactions = [...transactions]
    .filter((t) => t.date >= oneMonthAgoStr)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">财务概览</h1>
          <p className="text-muted-foreground text-sm">
            查看您的财务状况和趋势
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总收入"
          value={formatCurrencyFull(totalIncome)}
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          title="总支出"
          value={formatCurrencyFull(totalExpense)}
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard
          title="结余"
          value={formatCurrencyFull(balance)}
          icon={PiggyBank}
          variant={balance >= 0 ? "income" : "expense"}
        />
        <StatCard
          title="储蓄率"
          value={`${savingsRate.toFixed(1)}%`}
          icon={Percent}
          variant={savingsRate >= 30 ? "income" : savingsRate >= 10 ? "warning" : "expense"}
        />
      </div>

      {/* Income vs Expense Trend Chart */}
      <IncomeExpenseChart monthlyData={monthlyData} />

      {/* Recent Transactions */}
      <RecentTransactionsTable
        transactions={recentTransactions}
        icon={List}
      />
    </div>
  )
}
