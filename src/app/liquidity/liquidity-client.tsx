"use client"

import { Droplets, Calendar, TrendingUp, BarChart3 } from "lucide-react"
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
  formatCurrencyFull,
  formatCurrencyK,
  yAxisWidth,
} from "@/lib/chart-config"
import { StatCard } from "../stat-card"

interface LiquidityClientProps {
  chartData: Record<string, string | number>[]
  strategies: string[]
  total12m: number
  avgMonth: number
  peakMonth: string
  peakAmount: number
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
}: LiquidityClientProps) {
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
          <div className="h-[500px]">
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
    </div>
  )
}
