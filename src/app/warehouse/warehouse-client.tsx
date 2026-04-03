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
import { CHART_COLORS } from "@/lib/palette"

const STRATEGIES = ["远期理财", "美元资产", "36存单", "长期理财", "短期理财", "中期理财", "进攻计划", "麻麻理财"]
const TACTICS = ["养老年金", "个人养老金", "定期存款", "理财产品", "现金产品", "债券基金", "偏股基金", "稳健理财", "增额寿险", "货币基金"]
const STATUSES = ["已成立", "计划中", "筹集中", "已归档"]

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

const STATUS_COLORS: Record<string, string> = {
  已成立: "bg-emerald-500",
  计划中: "bg-blue-500",
  筹集中: "bg-amber-500",
  已归档: "bg-gray-400",
}

/** Extract series prefix from unitCode (e.g., "CU01-001" → "CU01") */
function getSeriesPrefix(unitCode: string): string {
  const match = unitCode.match(/^([A-Z]+\d+)/)
  return match?.[1] ?? unitCode
}

/** Get a consistent color for a series based on hash of prefix */
function getSeriesColorIndex(prefix: string): number {
  let hash = 0
  for (let i = 0; i < prefix.length; i++) {
    hash = (hash * 31 + prefix.charCodeAt(i)) % CHART_COLORS.length
  }
  return hash
}

export function WarehouseClient({ units }: WarehouseClientProps) {
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStrategy, setFilterStrategy] = useState("all")
  const [filterTactics, setFilterTactics] = useState("all")

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

  // Group by series and sort
  const groupedUnits = useMemo(() => {
    const groups = new Map<string, typeof filtered>()

    // Sort units by unitCode first
    const sorted = [...filtered].sort((a, b) => a.unitCode.localeCompare(b.unitCode))

    // Group by series prefix
    for (const unit of sorted) {
      const prefix = getSeriesPrefix(unit.unitCode)
      const existing = groups.get(prefix)
      if (existing) {
        existing.push(unit)
      } else {
        groups.set(prefix, [unit])
      }
    }

    // Sort groups by prefix
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const totalAmount = filtered.reduce((sum, u) => sum + u.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Warehouse className="text-primary size-6" />
            资本仓库
          </h1>
          <p className="text-muted-foreground text-sm">
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
            className="w-[200px] pl-9"
          />
        </div>
      </div>

      {/* Filter Panel - Always visible */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">状态</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">策略</Label>
          <Select value={filterStrategy} onValueChange={setFilterStrategy}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="全部策略" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部策略</SelectItem>
              {STRATEGIES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">战术</Label>
          <Select value={filterTactics} onValueChange={setFilterTactics}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="全部战术" />
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
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
            <X className="mr-1 size-4" />
            重置
          </Button>
        )}
      </div>

      {/* Grouped Waffle Grid */}
      {groupedUnits.map(([prefix, groupUnits]) => {
        const colorIndex = getSeriesColorIndex(prefix)
        const groupTotal = groupUnits.reduce((sum, u) => sum + u.amount, 0)

        return (
          <div key={prefix} className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="size-3 rounded-sm"
                style={{ backgroundColor: CHART_COLORS[colorIndex] }}
              />
              <h2 className="text-sm font-semibold">{prefix}</h2>
              <span className="text-muted-foreground text-xs">
                {groupUnits.length}个 · {formatCurrencyFull(groupTotal)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10">
              {groupUnits.map((unit) => {
                const statusColor = STATUS_COLORS[unit.status] ?? "bg-gray-400"
                return (
                  <Card
                    key={unit.id}
                    className="relative overflow-hidden border-0"
                    style={{ backgroundColor: CHART_COLORS[colorIndex] }}
                  >
                    <div className={cn("absolute right-0 top-0 h-full w-1", statusColor)} />
                    <CardContent className="space-y-0.5 p-2 text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold opacity-90">
                          {unit.unitCode.replace(`${prefix}-`, "")}
                        </span>
                      </div>
                      <p className="text-xs font-bold">
                        {formatCurrencyFull(unit.amount)}
                      </p>
                      <p className="truncate text-[10px] opacity-80">
                        {unit.tactics}
                      </p>
                      {unit.daysUntilMaturity != null && unit.daysUntilMaturity <= 30 && (
                        <p className={cn(
                          "text-[10px] font-medium",
                          unit.daysUntilMaturity <= 0 ? "text-red-200" : "text-yellow-200"
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
