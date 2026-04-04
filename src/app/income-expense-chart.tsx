"use client"

import {
  ComposedChart,
  Area,
  Line,
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

const SAVINGS_HEX = "#8b5cf6"
const TARGET_HEX = "#f59e0b"

interface IncomeExpenseChartProps {
  monthlyData: MonthlyData[]
  targetSavingsRate: number
}

export function IncomeExpenseChart({ monthlyData, targetSavingsRate }: IncomeExpenseChartProps) {
  const avgIncome =
    monthlyData.reduce((sum, d) => sum + d.income, 0) / (monthlyData.length || 1)
  const avgExpense =
    monthlyData.reduce((sum, d) => sum + d.expense, 0) / (monthlyData.length || 1)

  // Compute savings rate per month
  const displayData = monthlyData.map((d) => ({
    ...d,
    savingsRate: d.income > 0 ? ((d.income - d.expense) / d.income) * 100 : 0,
  }))

  return (
    <ChartCard
      title="收支趋势对比"
      icon={TrendingUp}
      className="col-span-full"
    >
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData}>
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
              yAxisId="left"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickFormatter={formatCurrencyK}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              width={50}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickFormatter={(value: number) => `${value}%`}
              domain={[-50, 100]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                    <p className="mb-1 font-medium">{label}</p>
                    {payload.map((entry) => {
                      const key = String(entry.dataKey ?? "")
                      const val = Number(entry.value ?? 0)
                      if (key === "savingsRate") {
                        return (
                          <p key={key} style={{ color: SAVINGS_HEX }}>
                            储蓄率: {val.toFixed(1)}%
                          </p>
                        )
                      }
                      return (
                        <p
                          key={key}
                          className="text-muted-foreground"
                        >
                          {entry.name}: {formatCurrencyFull(val)}
                        </p>
                      )
                    })}
                    <p className="mt-1 border-t border-border/50 pt-1" style={{ color: TARGET_HEX }}>
                      目标储蓄率: {targetSavingsRate}%
                    </p>
                  </div>
                )
              }}
            />
            <Legend
              formatter={(value: string) => {
                const map: Record<string, string> = {
                  income: "收入",
                  expense: "支出",
                  savingsRate: "储蓄率",
                }
                return map[value] ?? value
              }}
            />
            <ReferenceLine
              yAxisId="left"
              y={avgIncome}
              stroke="var(--color-income)"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: `平均收入 ${formatCurrencyK(avgIncome)}`,
                fill: "var(--color-income)",
                fontSize: 11,
                position: "insideTopLeft",
              }}
            />
            <ReferenceLine
              yAxisId="left"
              y={avgExpense}
              stroke="var(--color-expense)"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: `平均支出 ${formatCurrencyK(avgExpense)}`,
                fill: "var(--color-expense)",
                fontSize: 11,
                position: "insideBottomLeft",
              }}
            />
            <ReferenceLine
              yAxisId="right"
              y={targetSavingsRate}
              stroke={TARGET_HEX}
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `目标 ${targetSavingsRate}%`,
                fill: TARGET_HEX,
                fontSize: 11,
                position: "insideTopRight",
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="income"
              name="收入"
              stroke="var(--color-income)"
              strokeWidth={2}
              fill="url(#incomeGrad)"
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="expense"
              name="支出"
              stroke="var(--color-expense)"
              strokeWidth={2}
              fill="url(#expenseGrad)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="savingsRate"
              name="储蓄率"
              stroke={SAVINGS_HEX}
              strokeWidth={2.5}
              dot={{ fill: SAVINGS_HEX, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: SAVINGS_HEX, strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
