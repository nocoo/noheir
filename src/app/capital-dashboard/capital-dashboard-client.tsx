"use client"

import { BarChart3, PiggyBank, Percent, Clock } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { StatCard } from "@/components/shared/stat-card"
import { formatCurrencyFull } from "@/lib/chart-config"
import { CHART_COLORS } from "@/lib/palette"

interface DistributionItem {
  name: string
  value: number
  percentage: number
}

interface CapitalDashboardClientProps {
  totalsByCurrency: Record<string, number>
  totalAll: number
  deploymentRate: number
  idleUnitsCount: number
  idleFunds: number
  currencyDistribution: DistributionItem[]
  statusDistribution: DistributionItem[]
  maturityDistribution: DistributionItem[]
}

const PIE_COLORS = [...CHART_COLORS.slice(0, 5), "#64748b"]

function DistributionPie({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: DistributionItem[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                >
                  {data.map((_, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={
                        PIE_COLORS[i % PIE_COLORS.length] ??
                        PIE_COLORS[0] ??
                        "#64748b"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload as DistributionItem | undefined
                    if (!d) return null
                    return (
                      <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-muted-foreground">
                          {formatCurrencyFull(d.value)} (
                          {d.percentage.toFixed(1)}%)
                        </p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              暂无数据
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-2">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center gap-1 text-xs">
              <div
                className="size-3 rounded-full"
                style={{
                  backgroundColor:
                    PIE_COLORS[i % PIE_COLORS.length] ??
                    PIE_COLORS[0] ??
                    "#64748b",
                }}
              />
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function CapitalDashboardClient({
  totalsByCurrency,
  totalAll,
  deploymentRate,
  idleUnitsCount,
  idleFunds,
  currencyDistribution,
  statusDistribution,
  maturityDistribution,
}: CapitalDashboardClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="text-primary size-6" />
          资本仪表盘
        </h1>
        <p className="text-muted-foreground text-sm">
          资本配置总览与分布分析
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="总资产"
          value={formatCurrencyFull(totalAll)}
          icon={BarChart3}
          variant="income"
        />
        <StatCard
          title="配置率"
          value={`${deploymentRate.toFixed(1)}%`}
          icon={Percent}
          variant="warning"
        />
        <StatCard
          title="闲置资金"
          value={formatCurrencyFull(idleFunds)}
          icon={PiggyBank}
          variant="expense"
        />
        <StatCard
          title="闲置单位"
          value={`${idleUnitsCount}个`}
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Currency breakdown */}
      {Object.keys(totalsByCurrency).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">币种明细</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Object.entries(totalsByCurrency).map(([currency, amount]) => (
                <div
                  key={currency}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="font-medium">{currency}</span>
                  <span className="text-primary font-bold">
                    {formatCurrencyFull(amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <DistributionPie
          title="币种分布"
          description="按币种的资产配置"
          data={currencyDistribution}
        />
        <DistributionPie
          title="状态分布"
          description="按单位状态的配置"
          data={statusDistribution}
        />
        <DistributionPie
          title="到期分布"
          description="按到期时间的配置"
          data={maturityDistribution}
        />
      </div>
    </div>
  )
}
