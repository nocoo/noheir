"use client"

import { useState, useMemo } from "react"
import { BarChart3, PiggyBank, Percent, Clock, X } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { StatCard } from "@/components/shared/stat-card"
import { formatCurrencyFull } from "@/lib/chart-config"
import { CHART_COLORS } from "@/lib/palette"
import {
  buildTotalAssetsByCurrency,
  buildTotalAssetsAll,
  buildIdleUnits,
  buildCurrencyDistribution,
  buildStatusDistribution,
  buildMaturityDistribution,
} from "@/domain/assets/capital-dashboard"
import type { UnitDisplayInfo } from "@/domain/types"

interface DistributionItem {
  name: string
  value: number
  percentage: number
}

interface CapitalDashboardClientProps {
  units: UnitDisplayInfo[]
  deploymentRate: number
}

const STRATEGIES = [
  "远期理财", "美元资产", "36存单",
  "长期理财", "短期理财", "中期理财",
  "进攻计划", "麻麻理财",
]

const TACTICS = [
  "养老年金", "个人养老金", "定期存款",
  "理财产品", "现金产品", "债券基金",
  "偏股基金", "稳健理财", "增额寿险",
  "货币基金",
]

const STATUSES = ["已成立", "计划中", "筹集中", "已归档"]
const CURRENCIES = ["CNY", "USD", "HKD"]

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
    <Card className="border-l-4 border-l-primary bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="h-[180px]">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={35}
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
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center gap-1 text-xs">
              <div
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor:
                    PIE_COLORS[i % PIE_COLORS.length] ??
                    PIE_COLORS[0] ??
                    "#64748b",
                }}
              />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium">{item.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function CapitalDashboardClient({
  units,
  deploymentRate,
}: CapitalDashboardClientProps) {
  // Filter state
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStrategy, setFilterStrategy] = useState("all")
  const [filterTactics, setFilterTactics] = useState("all")
  const [filterCurrency, setFilterCurrency] = useState("all")

  const activeFilterCount = [
    filterStatus,
    filterStrategy,
    filterTactics,
    filterCurrency,
  ].filter((f) => f !== "all").length

  const resetFilters = () => {
    setFilterStatus("all")
    setFilterStrategy("all")
    setFilterTactics("all")
    setFilterCurrency("all")
  }

  // Filtered units and computed aggregations
  const { filteredUnits, totalsByCurrency, totalAll, idleUnits, currencyDistribution, statusDistribution, maturityDistribution } = useMemo(() => {
    const filtered = units.filter((u) => {
      if (filterStatus !== "all" && u.status !== filterStatus) return false
      if (filterStrategy !== "all" && u.strategy !== filterStrategy) return false
      if (filterTactics !== "all" && u.tactics !== filterTactics) return false
      if (filterCurrency !== "all" && u.currency !== filterCurrency) return false
      return true
    })

    const totals = buildTotalAssetsByCurrency(filtered)
    const total = buildTotalAssetsAll(totals)
    const idle = buildIdleUnits(filtered)
    const currDist = buildCurrencyDistribution(filtered, total).map((d) => ({
      name: d.currency,
      value: d.amount,
      percentage: d.percentage,
    }))
    const statusDist = buildStatusDistribution(filtered, total).map((d) => ({
      name: d.status,
      value: d.amount,
      percentage: d.percentage,
    }))
    const maturityDist = buildMaturityDistribution(filtered, total).map((d) => ({
      name: d.period,
      value: d.amount,
      percentage: d.percentage,
    }))

    return {
      filteredUnits: filtered,
      totalsByCurrency: totals,
      totalAll: total,
      idleUnits: idle,
      currencyDistribution: currDist,
      statusDistribution: statusDist,
      maturityDistribution: maturityDist,
    }
  }, [units, filterStatus, filterStrategy, filterTactics, filterCurrency])

  const idleUnitsCount = idleUnits.length
  const idleFunds = idleUnits.reduce((sum, u) => sum + u.amount, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="text-primary size-6" />
            资本仪表盘
          </h1>
          <p className="text-muted-foreground text-sm">
            资本配置总览与分布分析
            {activeFilterCount > 0 && (
              <span className="ml-2">
                ({filteredUnits.length} / {units.length} 个单位)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filter Bar - Single Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStrategy} onValueChange={setFilterStrategy}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue placeholder="策略" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部策略</SelectItem>
            {STRATEGIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTactics} onValueChange={setFilterTactics}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue placeholder="战术" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部战术</SelectItem>
            {TACTICS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCurrency} onValueChange={setFilterCurrency}>
          <SelectTrigger className="h-8 w-[90px] text-xs">
            <SelectValue placeholder="币种" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部币种</SelectItem>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 text-xs"
          >
            <X className="mr-1 size-3" />
            清除 ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          title="总资产"
          value={formatCurrencyFull(totalAll)}
          icon={BarChart3}
          variant="primary"
        />
        <StatCard
          title="配置率"
          value={`${deploymentRate.toFixed(1)}%`}
          icon={Percent}
          variant="income"
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
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(totalsByCurrency).map(([currency, amount]) => (
            <Card
              key={currency}
              className="border-l-4 border-l-primary bg-card"
            >
              <CardContent className="flex items-center justify-between p-3">
                <span className="text-muted-foreground text-sm">{currency}</span>
                <span className="text-primary font-bold">
                  {formatCurrencyFull(amount)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
