"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts"
import { TrendingUp } from "lucide-react"
import type { MonthlyData } from "@/domain/types"
import { formatCurrencyFull, formatCurrencyK } from "@/lib/chart-config"
import { ChartCard } from "@/components/shared/chart-card"

interface IncomeExpenseChartProps {
  monthlyData: MonthlyData[]
}

export function IncomeExpenseChart({ monthlyData }: IncomeExpenseChartProps) {
  const avgIncome =
    monthlyData.reduce((sum, d) => sum + d.income, 0) / (monthlyData.length || 1)
  const avgExpense =
    monthlyData.reduce((sum, d) => sum + d.expense, 0) / (monthlyData.length || 1)

  return (
    <ChartCard
      title="收支趋势对比"
      description="月度收入与支出对比"
      icon={TrendingUp}
      className="col-span-full"
    >
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickFormatter={formatCurrencyK}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                    <p className="mb-1 font-medium">{label}</p>
                    {payload.map((entry) => (
                      <p
                        key={String(entry.dataKey)}
                        className="text-muted-foreground"
                      >
                        {entry.name}: {formatCurrencyFull(Number(entry.value ?? 0))}
                      </p>
                    ))}
                  </div>
                )
              }}
            />
            <Legend />
            <ReferenceLine
              y={avgIncome}
              stroke="var(--color-income)"
              strokeDasharray="5 5"
              strokeWidth={1.5}
            />
            <ReferenceLine
              y={avgExpense}
              stroke="var(--color-expense)"
              strokeDasharray="5 5"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="收入"
              stroke="var(--color-income)"
              strokeWidth={2}
              fill="url(#incomeGrad)"
            />
            <Area
              type="monotone"
              dataKey="expense"
              name="支出"
              stroke="var(--color-expense)"
              strokeWidth={2}
              fill="url(#expenseGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
