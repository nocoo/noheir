"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Landmark,
  Search,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  Filter,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  UnitCodeBadge,
  StrategyBadge,
  TacticsBadge,
  StatusBadge,
  CurrencyBadge,
} from "@/components/ui/colored-badge"
import { UnitEditor, type SerializedUnit } from "@/components/capital/unit-editor"
import { cn } from "@/lib/utils"
import { formatCurrencyFull } from "@/lib/chart-config"
import { deleteUnit } from "@/app/actions/unit-actions"
import type { DomainProduct } from "@/domain/types"

interface FundsClientProps {
  units: SerializedUnit[]
  products: DomainProduct[]
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

type SortField = "unitCode" | "amount" | "endDate" | "status" | "strategy"
type SortDir = "asc" | "desc"

export function FundsClient({ units, products }: FundsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<SerializedUnit | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedUnit | null>(null)
  const [sortField, setSortField] = useState<SortField>("unitCode")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [isPending, startTransition] = useTransition()

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStrategy, setFilterStrategy] = useState("all")
  const [filterTactics, setFilterTactics] = useState("all")

  const activeFilterCount = [filterStatus, filterStrategy, filterTactics].filter(
    (f) => f !== "all",
  ).length

  const resetFilters = () => {
    setFilterStatus("all")
    setFilterStrategy("all")
    setFilterTactics("all")
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 inline size-3" />
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 inline size-3" />
      : <ArrowDown className="ml-1 inline size-3" />
  }

  const getAriaSort = (field: SortField): "ascending" | "descending" | "none" => {
    if (sortField !== field) return "none"
    return sortDir === "asc" ? "ascending" : "descending"
  }

  const filteredAndSorted = useMemo(() => {
    // First filter
    const result = units.filter((u) => {
      // Text search
      if (search) {
        const q = search.toLowerCase()
        const matches =
          u.unitCode.toLowerCase().includes(q) ||
          u.strategy.includes(search) ||
          u.tactics.includes(search) ||
          (u.productName ?? "").includes(search) ||
          (u.note ?? "").includes(search)
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

    // Then sort
    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortField) {
        case "amount":
          return (a.amount - b.amount) * dir
        case "endDate":
          return (
            ((a.endDate ?? "9999") > (b.endDate ?? "9999") ? 1 : -1) * dir
          )
        case "status":
          return a.status.localeCompare(b.status) * dir
        case "strategy":
          return a.strategy.localeCompare(b.strategy, "zh-CN") * dir
        default:
          return a.unitCode.localeCompare(b.unitCode) * dir
      }
    })

    return result
  }, [units, search, filterStatus, filterStrategy, filterTactics, sortField, sortDir])

  const totalAmount = filteredAndSorted.reduce((sum, u) => sum + u.amount, 0)

  const handleEdit = (unit: SerializedUnit) => {
    setEditingUnit(unit)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingUnit(null)
    setDialogOpen(true)
  }

  const handleDelete = (unit: SerializedUnit) => {
    setDeleteTarget(unit)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteUnit(deleteTarget.id)
      if (result.success) {
        toast.success("资本单位已删除")
        router.refresh()
      } else {
        toast.error(result.error)
      }
      setDeleteTarget(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Landmark className="text-primary size-6" />
            资本单位管理
          </h1>
          <p className="text-muted-foreground text-sm">
            ({filteredAndSorted.length} / {units.length} 个单位) · 总计{" "}
            {formatCurrencyFull(totalAmount)}
          </p>
        </div>
        <div className="flex gap-2">
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
          <Button onClick={handleCreate} size="sm">
            <Plus className="mr-1 size-4" />
            新增
          </Button>
        </div>
      </div>

      {/* Unit Editor Dialog */}
      <UnitEditor
        unit={editingUnit}
        products={products}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
      />

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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">状态</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
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
            </div>

            {/* Strategy Filter */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">策略</Label>
              <Select value={filterStrategy} onValueChange={setFilterStrategy}>
                <SelectTrigger>
                  <SelectValue />
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
            </div>

            {/* Tactics Filter */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">战术</Label>
              <Select value={filterTactics} onValueChange={setFilterTactics}>
                <SelectTrigger>
                  <SelectValue />
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
            </div>
          </div>
        </div>
      )}

      {/* Units Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">单位列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead aria-sort={getAriaSort("unitCode")}>
                  <button
                    onClick={() => toggleSort("unitCode")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    编号
                    {getSortIcon("unitCode")}
                  </button>
                </TableHead>
                <TableHead aria-sort={getAriaSort("amount")}>
                  <button
                    onClick={() => toggleSort("amount")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    金额
                    {getSortIcon("amount")}
                  </button>
                </TableHead>
                <TableHead aria-sort={getAriaSort("strategy")}>
                  <button
                    onClick={() => toggleSort("strategy")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    策略
                    {getSortIcon("strategy")}
                  </button>
                </TableHead>
                <TableHead>战术</TableHead>
                <TableHead>产品</TableHead>
                <TableHead aria-sort={getAriaSort("status")}>
                  <button
                    onClick={() => toggleSort("status")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    状态
                    {getSortIcon("status")}
                  </button>
                </TableHead>
                <TableHead aria-sort={getAriaSort("endDate")}>
                  <button
                    onClick={() => toggleSort("endDate")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    到期日
                    {getSortIcon("endDate")}
                  </button>
                </TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell>
                    <UnitCodeBadge unitCode={unit.unitCode} />
                  </TableCell>
                  <TableCell className="font-bold">
                    {formatCurrencyFull(unit.amount)}{" "}
                    <CurrencyBadge
                      currency={unit.currency}
                      className="ml-1 text-xs font-normal"
                    />
                  </TableCell>
                  <TableCell>
                    <StrategyBadge strategy={unit.strategy} />
                  </TableCell>
                  <TableCell>
                    <TacticsBadge tactics={unit.tactics} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {unit.productName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={unit.status} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-sm",
                        unit.daysUntilMaturity != null &&
                          unit.daysUntilMaturity <= 0
                          ? "text-destructive font-medium"
                          : unit.daysUntilMaturity != null &&
                              unit.daysUntilMaturity <= 30
                            ? "text-amber-600"
                            : "text-muted-foreground",
                      )}
                    >
                      {unit.endDate ?? "—"}
                      {unit.daysUntilMaturity != null && (
                        <span className="ml-1 text-xs">
                          ({unit.daysUntilMaturity}天)
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleEdit(unit)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-7"
                        onClick={() => handleDelete(unit)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAndSorted.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-muted-foreground py-8 text-center"
                  >
                    {search || activeFilterCount > 0
                      ? "未找到匹配的单位"
                      : "暂无资本单位"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="删除资本单位"
        description={`确定要删除单位「${deleteTarget?.unitCode ?? ""}」吗？此操作不可撤销。`}
        onConfirm={confirmDelete}
        loading={isPending}
      />
    </div>
  )
}
