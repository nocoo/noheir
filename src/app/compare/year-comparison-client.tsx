"use client"

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { GitCompare } from "lucide-react"
import type { YearComparisonChartPoint } from "@/domain/dashboard/year-comparison"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { formatCurrencyK, formatCurrencyFull } from "@/lib/chart-config"

interface YearComparisonClientProps {
  chartData: YearComparisonChartPoint[]
  targetSavingsRate: number
}

const INCOME_HEX = "#10b981"
const EXPENSE_HEX = "#f43f5e"
const BALANCE_HEX = "#3b82f6"
const SAVINGS_HEX = "#8b5cf6"
const TARGET_HEX = "#f59e0b"

export function YearComparisonClient({
  chartData,
  targetSavingsRate,
}: YearComparisonClientProps) {
  // Map fields for chart display
  const displayData = chartData.map((d) => ({
    ...d,
    收入: d.income,
    支出: d.expense,
    结余: d.balance,
    储蓄率: d.savingsRate,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitCompare className="text-primary size-6" />
          年度对比分析
        </h1>
        <p className="text-muted-foreground text-sm">
          多年度收支趋势与储蓄率对比
        </p>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>收支与储蓄率</CardTitle>
          <CardDescription>
            柱状图为收入/支出/结余，折线为储蓄率
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={displayData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/50"
                />
                <XAxis
                  dataKey="year"
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
                  domain={[0, 100]}
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
                          if (key === "储蓄率") {
                            return (
                              <p
                                key={key}
                                style={{ color: SAVINGS_HEX }}
                              >
                                储蓄率: {val.toFixed(1)}%
                              </p>
                            )
                          }
                          return (
                            <p
                              key={key}
                              style={{ color: String(entry.color ?? "") }}
                            >
                              {entry.name}: {formatCurrencyFull(val)}
                            </p>
                          )
                        })}
                      </div>
                    )
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="收入"
                  fill={INCOME_HEX}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="支出"
                  fill={EXPENSE_HEX}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="结余"
                  fill={BALANCE_HEX}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="储蓄率"
                  stroke={SAVINGS_HEX}
                  strokeWidth={3}
                  dot={{ fill: SAVINGS_HEX, r: 5, strokeWidth: 2 }}
                  activeDot={{
                    r: 7,
                    stroke: SAVINGS_HEX,
                    strokeWidth: 2,
                  }}
                  connectNulls={true}
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
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
