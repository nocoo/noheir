"use client"

import { useState, useMemo } from "react"
import { Warehouse, Search, Filter, X } from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

export function WarehouseClient({ units }: WarehouseClientProps) {
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStrategy, setFilterStrategy] = useState("all")
  const [filterTactics, setFilterTactics] = useState("all")

  const activeFilterCount = [filterStatus, filterStrategy, filterTactics].filter(f => f !== "all").length

  const resetFilters = () => {
    setFilterStatus("all")
    setFilterStrategy("all")
    setFilterTactics("all")
  }

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
            所有资本单位一览 · {filtered.length}个 ·{" "}
            {formatCurrencyFull(totalAmount)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="搜索单位..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[200px] pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={activeFilterCount > 0 ? "border-primary" : ""}
          >
            <Filter className="mr-1 size-4" />
            筛选
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">筛选条件</h3>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 size-4" />
              重置
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">状态</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9">
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
                <SelectTrigger className="h-9">
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
                <SelectTrigger className="h-9">
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
          </div>
        </div>
      )}

      {/* Waffle Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((unit) => {
          const statusColor = STATUS_COLORS[unit.status] ?? "bg-gray-400"
          return (
            <Card
              key={unit.id}
              className="relative overflow-hidden"
            >
              <div className={cn("absolute left-0 top-0 h-full w-1", statusColor)} />
              <CardContent className="space-y-1 p-3 pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    {unit.unitCode}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {unit.status}
                  </Badge>
                </div>
                <p className="text-primary text-sm font-bold">
                  {formatCurrencyFull(unit.amount)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {unit.strategy} · {unit.tactics}
                </p>
                {unit.productName && (
                  <p className="text-muted-foreground truncate text-xs">
                    {unit.productName}
                  </p>
                )}
                {unit.endDate && (
                  <p
                    className={cn(
                      "text-xs",
                      unit.daysUntilMaturity != null && unit.daysUntilMaturity <= 0
                        ? "text-destructive font-medium"
                        : unit.daysUntilMaturity != null && unit.daysUntilMaturity <= 30
                          ? "text-amber-600"
                          : "text-muted-foreground",
                    )}
                  >
                    到期: {unit.endDate}
                    {unit.daysUntilMaturity != null && ` (${unit.daysUntilMaturity}天)`}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          {search || activeFilterCount > 0 ? "未找到匹配的单位" : "暂无资本单位"}
        </div>
      )}
    </div>
  )
}
