"use client"

import { useState, useMemo } from "react"
import { Warehouse, Search, X } from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrencyFull } from "@/lib/chart-config"
import {
  withAlpha,
  getStrategyToken,
  getTacticsToken,
  getStatusToken,
  hashToChartToken,
} from "@/lib/palette"

const STRATEGIES = ["远期理财", "美元资产", "36存单", "长期理财", "短期理财", "中期理财", "进攻计划", "麻麻理财"]
const TACTICS = ["养老年金", "个人养老金", "定期存款", "理财产品", "现金产品", "债券基金", "偏股基金", "稳健理财", "增额寿险", "货币基金"]
const STATUSES = ["已成立", "计划中", "筹集中", "已归档"]

type GroupByOption = "strategy" | "status" | "tactics"
const GROUP_BY_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "strategy", label: "按策略" },
  { value: "status", label: "按状态" },
  { value: "tactics", label: "按战术" },
]

interface SerializedUnit {
  id: string
  unitCode: string
  amount: number
  currency: string
  status: string
  strategy: string
  tactics: string
  productName: string | null
  startDate: string | null
  endDate: string | null
  daysUntilMaturity?: number | undefined
  isAvailable?: boolean | undefined
}

interface WarehouseClientProps {
  units: SerializedUnit[]
}

/** Extract series prefix from unitCode (e.g., "CU01-001" → "CU01") */
function getSeriesPrefix(unitCode: string): string {
  const match = unitCode.match(/^([A-Z]+\d+)/)
  return match?.[1] ?? unitCode
}

/** Get chart token for a group based on groupBy type */
function getGroupToken(groupName: string, groupBy: GroupByOption): string {
  switch (groupBy) {
    case "strategy":
      return getStrategyToken(groupName)
    case "tactics":
      return getTacticsToken(groupName)
    case "status":
      return getStatusToken(groupName)
    default:
      return hashToChartToken(groupName)
  }
}

/** Get group key from unit based on groupBy option */
function getGroupKey(unit: SerializedUnit, groupBy: GroupByOption): string {
  switch (groupBy) {
    case "strategy":
      return unit.strategy
    case "status":
      return unit.status
    case "tactics":
      return unit.tactics
  }
}

export function WarehouseClient({ units }: WarehouseClientProps) {
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStrategy, setFilterStrategy] = useState("all")
  const [filterTactics, setFilterTactics] = useState("all")
  const [groupBy, setGroupBy] = useState<GroupByOption>("strategy")

  const activeFilterCount = [filterStatus, filterStrategy, filterTactics].filter(f => f !== "all").length

  const resetFilters = () => {
    setFilterStatus("all")
    setFilterStrategy("all")
    setFilterTactics("all")
  }

  // Filter units
  const filtered = useMemo(() => {
    return units.filter((u) => {
      // Text search
      if (search) {
        const q = search.toLowerCase()
        const matches = u.unitCode.toLowerCase().includes(q) ||
          u.strategy.includes(search) ||
          u.tactics.includes(search) ||
          (u.productName ?? "").includes(search)
        if (!matches) return false
      }
      // Status filter
      if (filterStatus !== "all" && u.status !== filterStatus) return false
      // Strategy filter
      if (filterStrategy !== "all" && u.strategy !== filterStrategy) return false
      // Tactics filter
      if (filterTactics !== "all" && u.tactics !== filterTactics) return false
      return true
    })
  }, [units, search, filterStatus, filterStrategy, filterTactics])

  // Group by selected option and sort
  const groupedUnits = useMemo(() => {
    const groups = new Map<string, typeof filtered>()

    // Sort units by unitCode first
    const sorted = [...filtered].sort((a, b) => a.unitCode.localeCompare(b.unitCode))

    // Group by selected option
    for (const unit of sorted) {
      const key = getGroupKey(unit, groupBy)
      const existing = groups.get(key)
      if (existing) {
        existing.push(unit)
      } else {
        groups.set(key, [unit])
      }
    }

    // Sort groups by key
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, groupBy])

  const totalAmount = filtered.reduce((sum, u) => sum + u.amount, 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Warehouse className="text-primary size-5 sm:size-6" />
            资本仓库
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {groupedUnits.length}个系列 · {filtered.length}个单位 ·{" "}
            {formatCurrencyFull(totalAmount)}
          </p>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="搜索单位..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 sm:w-[200px]"
          />
        </div>
      </div>

      {/* Filter Panel - Always visible */}
      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] sm:text-xs">分组</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
            <SelectTrigger className="h-8 w-[90px] text-xs sm:h-9 sm:w-[110px] sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="bg-border mx-0.5 hidden h-8 w-px sm:mx-1 sm:block sm:h-9" />
        <div className="space-y-1">
          <Label className="text-[10px] sm:text-xs">状态</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[85px] text-xs sm:h-9 sm:w-[120px] sm:text-sm">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] sm:text-xs">策略</Label>
          <Select value={filterStrategy} onValueChange={setFilterStrategy}>
            <SelectTrigger className="h-8 w-[85px] text-xs sm:h-9 sm:w-[120px] sm:text-sm">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部策略</SelectItem>
              {STRATEGIES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] sm:text-xs">战术</Label>
          <Select value={filterTactics} onValueChange={setFilterTactics}>
            <SelectTrigger className="h-8 w-[85px] text-xs sm:h-9 sm:w-[120px] sm:text-sm">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部战术</SelectItem>
              {TACTICS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs sm:h-9 sm:text-sm">
            <X className="mr-1 size-3 sm:size-4" />
            重置
          </Button>
        )}
      </div>

      {/* Grouped Waffle Grid */}
      {groupedUnits.map(([groupName, groupUnits]) => {
        const colorToken = getGroupToken(groupName, groupBy)
        const groupTotal = groupUnits.reduce((sum, u) => sum + u.amount, 0)

        return (
          <div key={groupName} className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className="size-2.5 rounded-sm sm:size-3"
                style={{ backgroundColor: withAlpha(colorToken, 1) }}
              />
              <h2 className="text-xs font-semibold sm:text-sm">{groupName}</h2>
              <span className="text-muted-foreground text-[10px] sm:text-xs">
                {groupUnits.length}个 · {formatCurrencyFull(groupTotal)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
              {groupUnits.map((unit) => {
                const statusToken = getStatusToken(unit.status)
                // Show different secondary info based on groupBy
                const secondaryInfo = groupBy === "tactics" ? unit.strategy : unit.tactics
                return (
                  <Card
                    key={unit.id}
                    className="relative overflow-hidden border"
                    style={{
                      backgroundColor: withAlpha(colorToken, 0.1),
                      borderColor: withAlpha(colorToken, 0.2),
                    }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full w-0.5 sm:w-1"
                      style={{ backgroundColor: withAlpha(statusToken, 1) }}
                    />
                    {/* Unit code as large watermark - full height, right aligned */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden pr-1.5 sm:pr-3">
                      <span
                        className="text-xl font-black leading-none sm:text-3xl"
                        style={{ color: withAlpha(colorToken, 0.35) }}
                      >
                        {getSeriesPrefix(unit.unitCode)}
                      </span>
                    </div>
                    <CardContent className="relative space-y-0.5 p-1.5 pl-2 sm:p-2 sm:pl-3">
                      <p className="text-foreground text-[10px] font-bold sm:text-xs">
                        {formatCurrencyFull(unit.amount)}
                      </p>
                      <p className="text-muted-foreground truncate text-[9px] sm:text-[10px]">
                        {secondaryInfo}
                      </p>
                      {unit.daysUntilMaturity != null && unit.daysUntilMaturity <= 30 && (
                        <p className={cn(
                          "text-[9px] font-medium sm:text-[10px]",
                          unit.daysUntilMaturity <= 0 ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {unit.daysUntilMaturity <= 0 ? "已到期" : `${unit.daysUntilMaturity}天`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          {search || activeFilterCount > 0 ? "未找到匹配的单位" : "暂无资本单位"}
        </div>
      )}
    </div>
  )
}
