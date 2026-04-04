"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Warehouse, Search, X } from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
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
  productId: string | null
  productName: string | null
  startDate: string | null
  endDate: string | null
  note: string | null
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
  const searchParams = useSearchParams()
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Initialize search from URL parameter
  const initialSearch = searchParams.get("q") ?? ""
  const [search, setSearch] = useState(initialSearch)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStrategy, setFilterStrategy] = useState("all")
  const [filterTactics, setFilterTactics] = useState("all")
  const [groupBy, setGroupBy] = useState<GroupByOption>("strategy")
  const [selectedUnit, setSelectedUnit] = useState<SerializedUnit | null>(null)

  // ⌘K / Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch("")
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Sync URL when search changes
  useEffect(() => {
    const currentQ = searchParams.get("q") ?? ""
    // Only update URL if the search value actually differs from URL
    if (search === currentQ) return

    const params = new URLSearchParams(searchParams.toString())
    if (search) {
      params.set("q", search)
    } else {
      params.delete("q")
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl, { scroll: false })
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps -- intentionally sync only on search change

  const activeFilterCount = [filterStatus, filterStrategy, filterTactics].filter(f => f !== "all").length

  // Filter units
  const filtered = useMemo(() => {
    return units.filter((u) => {
      // Text search - support multiple fields
      if (search) {
        const q = search.toLowerCase()
        const matches = u.unitCode.toLowerCase().includes(q) ||
          u.strategy.toLowerCase().includes(q) ||
          u.tactics.toLowerCase().includes(q) ||
          (u.productName ?? "").toLowerCase().includes(q) ||
          u.status.toLowerCase().includes(q) ||
          u.currency.toLowerCase().includes(q)
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

  // Toggle filter helper
  const toggleFilter = (
    current: string,
    value: string,
    setter: (v: string) => void
  ) => {
    setter(current === value ? "all" : value)
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header Row: Title left, Search right */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Warehouse className="text-primary size-5 shrink-0 sm:size-6" />
            资本仓库
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {groupedUnits.length}个分组 · {filtered.length}个单位 · {formatCurrencyFull(totalAmount)}
          </p>
        </div>

        {/* Search - right aligned, always visible */}
        <div className="relative shrink-0">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            ref={searchInputRef}
            placeholder="搜索 ⌘K"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-[120px] pl-8 pr-7 text-xs sm:h-9 sm:w-[160px] sm:text-sm"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); searchInputRef.current?.focus() }}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Rows */}
      <div className="space-y-1.5 sm:space-y-2">
        {/* Row 1: Group By */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-muted-foreground w-8 shrink-0 text-[10px] sm:w-10 sm:text-xs">分组</span>
          {GROUP_BY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGroupBy(opt.value)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-xs",
                groupBy === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Row 2: Status */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-muted-foreground w-8 shrink-0 text-[10px] sm:w-10 sm:text-xs">状态</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => toggleFilter(filterStatus, s, setFilterStatus)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-xs",
                filterStatus === s
                  ? "text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
              style={filterStatus === s ? {
                backgroundColor: withAlpha(getStatusToken(s), 1),
              } : undefined}
            >
              {s}
            </button>
          ))}
          {filterStatus !== "all" && (
            <button
              onClick={() => setFilterStatus("all")}
              className="text-muted-foreground hover:text-foreground ml-1"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Row 3: Strategy */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-muted-foreground w-8 shrink-0 text-[10px] sm:w-10 sm:text-xs">策略</span>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {STRATEGIES.map((s) => (
              <button
                key={s}
                onClick={() => toggleFilter(filterStrategy, s, setFilterStrategy)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-xs",
                  filterStrategy === s
                    ? "text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
                style={filterStrategy === s ? {
                  backgroundColor: withAlpha(getStrategyToken(s), 1),
                } : undefined}
              >
                {s}
              </button>
            ))}
            {filterStrategy !== "all" && (
              <button
                onClick={() => setFilterStrategy("all")}
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 4: Tactics */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-muted-foreground w-8 shrink-0 text-[10px] sm:w-10 sm:text-xs">战术</span>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {TACTICS.map((t) => (
              <button
                key={t}
                onClick={() => toggleFilter(filterTactics, t, setFilterTactics)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-xs",
                  filterTactics === t
                    ? "text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
                style={filterTactics === t ? {
                  backgroundColor: withAlpha(getTacticsToken(t), 1),
                } : undefined}
              >
                {t}
              </button>
            ))}
            {filterTactics !== "all" && (
              <button
                onClick={() => setFilterTactics("all")}
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
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
                    className="relative cursor-pointer overflow-hidden border transition-shadow hover:shadow-md"
                    style={{
                      backgroundColor: withAlpha(colorToken, 0.1),
                      borderColor: withAlpha(colorToken, 0.2),
                    }}
                    onClick={() => setSelectedUnit(unit)}
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

      {/* Unit Detail Dialog */}
      <UnitDetailDialog
        unit={selectedUnit}
        open={selectedUnit !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedUnit(null)
        }}
      />
    </div>
  )
}

// ── Unit Detail Dialog ──

function UnitDetailDialog({
  unit,
  open,
  onOpenChange,
}: {
  unit: SerializedUnit | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!unit) return null

  const statusToken = getStatusToken(unit.status)
  const strategyToken = getStrategyToken(unit.strategy)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="text-2xl font-black"
              style={{ color: withAlpha(strategyToken, 1) }}
            >
              {unit.unitCode}
            </span>
            <Badge
              variant="outline"
              style={{
                borderColor: withAlpha(statusToken, 0.5),
                backgroundColor: withAlpha(statusToken, 0.1),
                color: withAlpha(statusToken, 1),
              }}
            >
              {unit.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Amount */}
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-muted-foreground text-sm">金额</p>
            <p className="text-2xl font-bold">{formatCurrencyFull(unit.amount)}</p>
            <p className="text-muted-foreground text-xs">{unit.currency}</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">策略</p>
              <p className="font-medium">{unit.strategy}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">战术</p>
              <p className="font-medium">{unit.tactics}</p>
            </div>
            {unit.productName && (
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">关联产品</p>
                <p className="font-medium">{unit.productName}</p>
              </div>
            )}
            {unit.startDate && (
              <div>
                <p className="text-muted-foreground text-xs">开始日期</p>
                <p className="font-medium">{unit.startDate}</p>
              </div>
            )}
            {unit.endDate && (
              <div>
                <p className="text-muted-foreground text-xs">到期日期</p>
                <p className="font-medium">{unit.endDate}</p>
              </div>
            )}
            {unit.daysUntilMaturity != null && (
              <div>
                <p className="text-muted-foreground text-xs">距到期</p>
                <p className={cn(
                  "font-medium",
                  unit.daysUntilMaturity <= 0
                    ? "text-destructive"
                    : unit.daysUntilMaturity <= 30
                      ? "text-amber-600 dark:text-amber-400"
                      : ""
                )}>
                  {unit.daysUntilMaturity <= 0 ? "已到期" : `${unit.daysUntilMaturity} 天`}
                </p>
              </div>
            )}
          </div>

          {/* Note */}
          {unit.note && (
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 text-xs">备注</p>
              <p className="text-sm whitespace-pre-wrap">{unit.note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
