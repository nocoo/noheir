"use client"

import { TrendingUp, TrendingDown, Calendar, Wallet } from "lucide-react"
import type { MonthlyData } from "@/domain/types"
import type { TransactionAnalysisLabels } from "@/domain/dashboard/transaction-analysis"
import type {
  CategoryGroup,
  PrimaryCategoryGroup,
  AccountChartData,
  TopTransaction,
} from "@/components/shared"
import {
  MonthlyTrendChart,
  CategoryDistributionChart,
  AccountDistributionChart,
  CategoryDetailList,
  TopTransactionsTable,
} from "@/components/shared"
import { StatCard } from "@/components/shared/stat-card"
import { formatCurrencyFull } from "@/lib/chart-config"

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

interface TransactionAnalysisClientProps {
  type: "income" | "expense"
  totalAmount: number
  avgMonthly: number
  transactionCount: number
  monthlyData: MonthlyData[]
  chartData: CategoryGroup[]
  detailList: PrimaryCategoryGroup[]
  accountData: AccountChartData[]
  topTransactions: TopTransaction[]
  labels: TransactionAnalysisLabels
}

export function TransactionAnalysisClient({
  type,
  totalAmount,
  avgMonthly,
  transactionCount,
  monthlyData,
  chartData,
  detailList,
  accountData,
  topTransactions,
  labels,
}: TransactionAnalysisClientProps) {
  const isIncome = type === "income"
  const colorHex = isIncome ? "var(--color-income)" : "var(--color-expense)"
  const colorClass = isIncome ? "text-income" : "text-expense"
  const variant = isIncome ? "income" : "expense"
  const icon = isIncome ? TrendingUp : TrendingDown
  const dataKey: "income" | "expense" = isIncome ? "income" : "expense"

  if (transactionCount === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {isIncome ? "收入分析" : "支出分析"}
            </h1>
          </div>
        </div>
        <div className="text-muted-foreground py-8 text-center">
          暂无{isIncome ? "收入" : "支出"}数据
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isIncome ? "收入分析" : "支出分析"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isIncome ? "收入来源与趋势分析" : "支出结构与趋势分析"}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title={labels.total}
          value={formatCurrencyFull(totalAmount)}
          icon={icon}
          variant={variant}
        />
        <StatCard
          title={labels.monthly}
          value={formatCurrencyFull(Math.round(avgMonthly))}
          icon={Calendar}
          variant={variant}
        />
        <StatCard
          title={labels.count}
          value={String(transactionCount)}
          icon={Wallet}
          variant={variant}
        />
      </div>

      {/* Monthly Trend */}
      <MonthlyTrendChart
        title={labels.trend}
        description={labels.trendDesc}
        monthlyData={monthlyData}
        averageValue={avgMonthly}
        colorHex={colorHex}
        dataKey={dataKey}
        icon={icon}
      />

      {/* Category + Account Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryDistributionChart
          title={labels.category}
          description={labels.categoryDesc}
          detailList={chartData}
          colors={CHART_COLORS}
          tooltipColor={colorHex}
        />
        <AccountDistributionChart
          title={labels.account}
          description={labels.accountDesc}
          accountData={accountData}
          colorHex={colorHex}
          layout="vertical"
        />
      </div>

      {/* Category Detail List */}
      <CategoryDetailList
        title={labels.detail}
        description={labels.detailDesc}
        detailList={detailList}
        colorHex={colorHex}
        colorClass={colorClass}
        totalAmount={totalAmount}
        colors={CHART_COLORS}
      />

      {/* Top Transactions */}
      <TopTransactionsTable
        title={labels.top}
        description={labels.topDesc}
        transactions={topTransactions}
        variant={variant}
        colorClass={colorClass}
      />
    </div>
  )
}
