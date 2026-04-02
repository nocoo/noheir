"use client"

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts"
import { TrendingUp, TrendingDown, PiggyBank } from "lucide-react"
import type {
  SavingsRateChartPoint,
  SavingsRateSummary,
} from "@/domain/dashboard/savings-rate"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatCurrencyFull, formatCurrencyK } from "@/lib/chart-config"

interface SavingsRateClientProps {
  chartData: SavingsRateChartPoint[]
  summary: SavingsRateSummary
  targetSavingsRate: number
}

const INCOME_HEX = "#10b981"
const EXPENSE_HEX = "#f43f5e"

export function SavingsRateClient({
  chartData,
  summary,
  targetSavingsRate,
}: SavingsRateClientProps) {
  const savingsRateStatus =
    summary.annualSavingsRate >= targetSavingsRate + 5
      ? "exceeded"
      : summary.annualSavingsRate >= targetSavingsRate
        ? "met"
        : "below"

  const savingsRateColorClass =
    savingsRateStatus === "below"
      ? "text-destructive"
      : savingsRateStatus === "met"
        ? "text-primary"
        : "text-income"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <PiggyBank className="text-primary size-6" />
            储蓄率分析
          </h1>
          <p className="text-muted-foreground text-sm">
            月度储蓄率趋势和累计储蓄
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div
          className={cn(
            "rounded-lg border p-4 transition-colors",
            savingsRateStatus === "below" &&
              "border-destructive/30 bg-destructive/10",
            savingsRateStatus === "met" && "border-primary/30 bg-primary/10",
            savingsRateStatus === "exceeded" &&
              "border-income/30 bg-income/10",
          )}
        >
          <p className="text-muted-foreground text-sm">年度储蓄率</p>
          <div className="flex items-baseline gap-2">
            <p className={cn("text-2xl font-bold", savingsRateColorClass)}>
              {summary.annualSavingsRate.toFixed(1)}%
            </p>
            <Badge
              variant={
                summary.savingsRateDiff >= 0 ? "default" : "destructive"
              }
              className="text-xs"
            >
              {summary.savingsRateDiff >= 0 ? "+" : ""}
              {summary.savingsRateDiff.toFixed(1)}%
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            目标: {targetSavingsRate}%
          </p>
        </div>
        <div className="bg-accent rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">累计储蓄</p>
          <p className="text-accent-foreground text-2xl font-bold">
            {formatCurrencyFull(summary.totalSavings)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant={summary.savingsGap >= 0 ? "default" : "destructive"}
              className="text-xs"
            >
              {summary.savingsGap >= 0 ? "+" : ""}
              {formatCurrencyFull(Math.abs(summary.savingsGap))}
            </Badge>
            <p className="text-muted-foreground text-xs">
              {summary.savingsGap >= 0 ? "超额完成" : "还差"}
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            最佳月份 <TrendingUp className="text-primary size-3" />
          </p>
          <p className="text-lg font-semibold">
            {summary.bestMonth?.month ?? "—"}
          </p>
          <p className="text-primary text-sm">
            {summary.bestMonth?.savingsRate.toFixed(1) ?? "0"}%
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            待改善月份 <TrendingDown className="text-destructive size-3" />
          </p>
          <p className="text-lg font-semibold">
            {summary.worstMonth?.month ?? "—"}
          </p>
          <p className="text-destructive text-sm">
            {summary.worstMonth?.savingsRate.toFixed(1) ?? "0"}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>月度储蓄率趋势</CardTitle>
          <CardDescription>
            柱状图为储蓄额，折线为储蓄率
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/50"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value: number) => `${value}%`}
                  domain={[-50, 100]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
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
                        {payload.map((entry) => {
                          const key = String(entry.dataKey ?? "")
                          const val = Number(entry.value ?? 0)
                          if (key === "savingsRate") {
                            return (
                              <p
                                key={key}
                                style={{
                                  color: val >= 0 ? INCOME_HEX : EXPENSE_HEX,
                                }}
                              >
                                储蓄率: {val.toFixed(1)}%
                              </p>
                            )
                          }
                          if (key === "savings") {
                            return (
                              <p key={key} className="text-muted-foreground">
                                储蓄额: {formatCurrencyFull(val)}
                              </p>
                            )
                          }
                          return null
                        })}
                      </div>
                    )
                  }}
                />
                <ReferenceLine
                  yAxisId="left"
                  y={0}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="3 3"
                />
                <ReferenceLine
                  yAxisId="left"
                  y={summary.annualSavingsRate}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="5 5"
                  label={{
                    value: `年度 ${summary.annualSavingsRate.toFixed(1)}%`,
                    fill: "hsl(var(--primary))",
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  yAxisId="left"
                  y={targetSavingsRate}
                  stroke="hsl(var(--chart-3))"
                  strokeDasharray="3 3"
                  strokeWidth={2}
                  label={{
                    value: `目标 ${targetSavingsRate}%`,
                    fill: "hsl(var(--chart-3))",
                    fontSize: 11,
                    position: "insideTopRight",
                  }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="savings"
                  opacity={0.6}
                  radius={[4, 4, 0, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.savings >= 0 ? INCOME_HEX : EXPENSE_HEX}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="savingsRate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{
                    fill: "hsl(var(--primary))",
                    strokeWidth: 2,
                    r: 4,
                  }}
                  activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
