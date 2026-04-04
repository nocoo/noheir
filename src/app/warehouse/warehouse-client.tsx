"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Warehouse, Search, X, Layers, Flag, Compass, Target, RotateCcw, Building2, Package } from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatCurrencyFull } from "@/lib/chart-config"
import {
  withAlpha,
  getStrategyToken,
  getTacticsToken,
  getStatusToken,
  hashToChartToken,
} from "@/lib/palette"
import { UnitEditor, type SerializedUnit } from "@/components/capital/unit-editor"
import type { DomainProduct } from "@/domain/types"

const STRATEGIES = ["远期理财", "美元资产", "36存单", "长期理财", "短期理财", "中期理财", "进攻计划", "麻麻理财"]
const TACTICS = ["养老年金", "个人养老金", "定期存款", "理财产品", "现金产品", "债券基金", "偏股基金", "稳健理财", "增额寿险", "货币基金"]
const STATUSES = ["已成立", "计划中", "筹集中", "已归档"]

type GroupByOption = "strategy" | "status" | "tactics"
const GROUP_BY_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "strategy", label: "按策略" },
  { value: "status", label: "按状态" },
  { value: "tactics", label: "按战术" },
]

interface WarehouseClientProps {
  units: SerializedUnit[]
  products: DomainProduct[]
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

const STORAGE_KEY = "warehouse-filters"

interface FilterState {
  groupBy: GroupByOption
  status: string
  strategy: string
  tactics: string
  channel: string
  product: string
}

const DEFAULT_FILTERS: FilterState = {
  groupBy: "strategy",
  status: "all",
  strategy: "all",
  tactics: "all",
  channel: "all",
  product: "all",
}

function loadFilters(): FilterState {
  if (typeof window === "undefined") return DEFAULT_FILTERS
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FilterState>
      return { ...DEFAULT_FILTERS, ...parsed }
    }
  } catch {
    // ignore
  }
  return DEFAULT_FILTERS
}

function saveFilters(filters: FilterState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // ignore
  }
}

export function WarehouseClient({ units, products }: WarehouseClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Initialize filters - use lazy initializer to read from localStorage
  const [filterStatus, setFilterStatus] = useState(() => loadFilters().status)
  const [filterStrategy, setFilterStrategy] = useState(() => loadFilters().strategy)
  const [filterTactics, setFilterTactics] = useState(() => loadFilters().tactics)
  const [filterChannel, setFilterChannel] = useState(() => loadFilters().channel)
  const [filterProduct, setFilterProduct] = useState(() => loadFilters().product)
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => loadFilters().groupBy)

  // Derive unique channels and product names from data (for filter chips)
  const { channels, productNames } = useMemo(() => {
    const channelSet = new Set<string>()
    const productSet = new Set<string>()
    for (const u of units) {
      if (u.productChannel) channelSet.add(u.productChannel)
      if (u.productName) productSet.add(u.productName)
    }
    return {
      channels: Array.from(channelSet).sort(),
      productNames: Array.from(productSet).sort(),
    }
  }, [units])

  // Save filters to localStorage when they change
  useEffect(() => {
    saveFilters({
      groupBy,
      status: filterStatus,
      strategy: filterStrategy,
      tactics: filterTactics,
      channel: filterChannel,
      product: filterProduct,
    })
  }, [groupBy, filterStatus, filterStrategy, filterTactics, filterChannel, filterProduct])

  // Initialize search from URL parameter
  const initialSearch = searchParams.get("q") ?? ""
  const [search, setSearch] = useState(initialSearch)
  const [selectedUnit, setSelectedUnit] = useState<SerializedUnit | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  // "/" to focus search (vim-style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not already in an input/textarea
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
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

  const activeFilterCount = [filterStatus, filterStrategy, filterTactics, filterChannel, filterProduct].filter(f => f !== "all").length
  const hasActiveFilters = activeFilterCount > 0 || search || groupBy !== "strategy"

  const resetAllFilters = () => {
    setGroupBy(DEFAULT_FILTERS.groupBy)
    setFilterStatus(DEFAULT_FILTERS.status)
    setFilterStrategy(DEFAULT_FILTERS.strategy)
    setFilterTactics(DEFAULT_FILTERS.tactics)
    setFilterChannel(DEFAULT_FILTERS.channel)
    setFilterProduct(DEFAULT_FILTERS.product)
    setSearch("")
  }

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
          (u.productChannel ?? "").toLowerCase().includes(q) ||
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
      // Channel filter
      if (filterChannel !== "all" && u.productChannel !== filterChannel) return false
      // Product filter
      if (filterProduct !== "all" && u.productName !== filterProduct) return false
      return true
    })
  }, [units, search, filterStatus, filterStrategy, filterTactics, filterChannel, filterProduct])

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
            placeholder="筛选 /"
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
          <div className="text-muted-foreground flex w-12 shrink-0 items-center gap-1 text-[10px] sm:w-14 sm:text-xs">
            <Layers className="size-3 sm:size-3.5" />
            <span>分组</span>
          </div>
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
          {/* Reset All Button */}
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1 text-[10px] sm:text-xs"
              title="重置所有筛选"
            >
              <RotateCcw className="size-3" />
              <span className="hidden sm:inline">重置</span>
            </button>
          )}
        </div>

        {/* Row 2: Status */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="text-muted-foreground flex w-12 shrink-0 items-center gap-1 text-[10px] sm:w-14 sm:text-xs">
            <Flag className="size-3 sm:size-3.5" />
            <span>状态</span>
          </div>
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
          <div className="text-muted-foreground flex w-12 shrink-0 items-center gap-1 text-[10px] sm:w-14 sm:text-xs">
            <Compass className="size-3 sm:size-3.5" />
            <span>策略</span>
          </div>
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
          <div className="text-muted-foreground flex w-12 shrink-0 items-center gap-1 text-[10px] sm:w-14 sm:text-xs">
            <Target className="size-3 sm:size-3.5" />
            <span>战术</span>
          </div>
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

        {/* Row 5: Channel (derived from data) */}
        {channels.length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="text-muted-foreground flex w-12 shrink-0 items-center gap-1 text-[10px] sm:w-14 sm:text-xs">
              <Building2 className="size-3 sm:size-3.5" />
              <span>渠道</span>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {channels.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleFilter(filterChannel, c, setFilterChannel)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-xs",
                    filterChannel === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  {c}
                </button>
              ))}
              {filterChannel !== "all" && (
                <button
                  onClick={() => setFilterChannel("all")}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 6: Product (derived from data) */}
        {productNames.length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="text-muted-foreground flex w-12 shrink-0 items-center gap-1 text-[10px] sm:w-14 sm:text-xs">
              <Package className="size-3 sm:size-3.5" />
              <span>产品</span>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {productNames.map((p) => (
                <button
                  key={p}
                  onClick={() => toggleFilter(filterProduct, p, setFilterProduct)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-xs",
                    filterProduct === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  {p}
                </button>
              ))}
              {filterProduct !== "all" && (
                <button
                  onClick={() => setFilterProduct("all")}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>
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
                    className="relative cursor-pointer overflow-hidden border transition-shadow hover:shadow-md"
                    style={{
                      backgroundColor: withAlpha(colorToken, 0.1),
                      borderColor: withAlpha(colorToken, 0.2),
                    }}
                    onClick={() => {
                      setSelectedUnit(unit)
                      setEditorOpen(true)
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

      {/* Unit Editor Dialog */}
      <UnitEditor
        unit={selectedUnit}
        products={products}
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setSelectedUnit(null)
        }}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
