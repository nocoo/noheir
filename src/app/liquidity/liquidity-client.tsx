"use client"

import Link from "next/link"
import { Droplets, Calendar, TrendingUp, BarChart3, ExternalLink, Warehouse } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  formatCurrencyFull,
  formatCurrencyK,
  yAxisWidth,
} from "@/lib/chart-config"
import { StatCard } from "@/components/shared/stat-card"
import { cn } from "@/lib/utils"
import type { UpcomingUnit } from "@/domain/assets/liquidity-ladder"

interface LiquidityClientProps {
  chartData: Record<string, string | number>[]
  strategies: string[]
  total12m: number
  avgMonth: number
  peakMonth: string
  peakAmount: number
  upcomingUnits: UpcomingUnit[]
}

const COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
]

export function LiquidityClient({
  chartData,
  strategies,
  total12m,
  avgMonth,
  peakMonth,
  peakAmount,
  upcomingUnits,
}: LiquidityClientProps) {
  // Group units by month
  const unitsByMonth = upcomingUnits.reduce((acc, unit) => {
    const key = unit.monthKey
    if (!acc[key]) {
      acc[key] = { monthLabel: unit.monthLabel, units: [] }
    }
    acc[key].units.push(unit)
    return acc
  }, {} as Record<string, { monthLabel: string; units: UpcomingUnit[] }>)

  // Sort months chronologically
  const sortedMonths = Object.keys(unitsByMonth).sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Droplets className="text-primary size-6" />
          流动性阶梯
        </h1>
        <p className="text-muted-foreground text-sm">
          未来24个月到期资金分布
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="12个月到期总额"
          value={formatCurrencyFull(total12m)}
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          title="月均到期"
          value={formatCurrencyFull(avgMonth)}
          icon={Calendar}
          variant="warning"
        />
        <StatCard
          title="峰值月份"
          value={peakMonth || "—"}
          icon={BarChart3}
          variant="warning"
        />
        <StatCard
          title="峰值金额"
          value={formatCurrencyFull(peakAmount)}
          icon={Droplets}
          variant="expense"
        />
      </div>

      {/* Stacked Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>到期时间分布</CardTitle>
          <CardDescription>
            按策略分组的月度到期金额堆叠图
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {chartData.length > 0 && strategies.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    fontSize={10}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    width={yAxisWidth}
                    tickFormatter={formatCurrencyK}
                    fontSize={11}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                          <p className="mb-1 font-medium">{String(label ?? "")}</p>
                          {payload.map((entry) => (
                            <p key={String(entry.name ?? "")} className="text-muted-foreground">
                              <span
                                className="mr-1 inline-block size-2 rounded-full"
                                style={{ backgroundColor: String(entry.color ?? "#888") }}
                              />
                              {String(entry.name ?? "")}: {formatCurrencyFull(Number(entry.value ?? 0))}
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend />
                  {strategies.map((strategy, i) => (
                    <Bar
                      key={strategy}
                      dataKey={strategy}
                      stackId="total"
                      fill={COLORS[i % COLORS.length] ?? COLORS[0] ?? "#8b5cf6"}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                暂无到期数据
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Units Table - Grouped by Month */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>即将解禁明细</CardTitle>
              <CardDescription>
                未来24个月内到期的资金单元，共 {upcomingUnits.length} 个
              </CardDescription>
            </div>
            <Link
              href="/warehouse?availability=soon"
              className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm"
            >
              <Warehouse className="size-4" />
              在仓库查看
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {sortedMonths.length > 0 ? (
            <div className="space-y-6">
              {sortedMonths.map((monthKey) => {
                const monthData = unitsByMonth[monthKey]
                if (!monthData) return null
                const monthTotal = monthData.units.reduce((sum, u) => sum + u.amount, 0)

                return (
                  <div key={monthKey} className="space-y-2">
                    {/* Month Header */}
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="font-semibold">{monthData.monthLabel}</h3>
                      <span className="text-muted-foreground text-sm">
                        {monthData.units.length} 个单元 · {formatCurrencyFull(monthTotal)}
                      </span>
                    </div>

                    {/* Units Table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">编号</TableHead>
                          <TableHead>策略</TableHead>
                          <TableHead>战术</TableHead>
                          <TableHead>产品</TableHead>
                          <TableHead className="text-right">金额</TableHead>
                          <TableHead className="text-right">解禁日</TableHead>
                          <TableHead className="text-right">倒计时</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthData.units.map((unit) => (
                          <TableRow key={unit.id}>
                            <TableCell>
                              <Link
                                href={`/warehouse?q=${unit.unitCode}`}
                                className="text-primary hover:underline font-mono text-sm"
                              >
                                {unit.unitCode}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{unit.strategy}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {unit.tactics}
                            </TableCell>
                            <TableCell>
                              {unit.productName ? (
                                <Link
                                  href={`/products?q=${encodeURIComponent(unit.productName)}`}
                                  className="hover:text-primary text-sm hover:underline"
                                >
                                  {unit.productName}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrencyFull(unit.amount)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-right text-sm">
                              {unit.availableDate}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  unit.daysUntilAvailable <= 0
                                    ? "text-green-600 dark:text-green-400"
                                    : unit.daysUntilAvailable <= 30
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-muted-foreground"
                                )}
                              >
                                {unit.daysUntilAvailable <= 0
                                  ? "已可用"
                                  : `${unit.daysUntilAvailable}天`}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              暂无即将解禁的资金单元
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
