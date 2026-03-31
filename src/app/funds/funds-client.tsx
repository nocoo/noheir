"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Landmark,
  Search,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { formatCurrencyFull } from "@/lib/chart-config"
import {
  createUnit,
  updateUnit,
  deleteUnit,
} from "@/app/actions/unit-actions"

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

interface FundsClientProps {
  units: SerializedUnit[]
}

const STATUS_COLORS: Record<string, string> = {
  已成立: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  计划中: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  筹集中: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  已归档: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
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

type SortField = "unitCode" | "amount" | "endDate" | "status"
type SortDir = "asc" | "desc"

export function FundsClient({ units }: FundsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<SerializedUnit | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedUnit | null>(null)
  const [sortField, setSortField] = useState<SortField>("unitCode")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [isPending, startTransition] = useTransition()

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const filtered = search
    ? units.filter(
        (u) =>
          u.unitCode.toLowerCase().includes(search.toLowerCase()) ||
          u.strategy.includes(search) ||
          u.tactics.includes(search) ||
          (u.productName ?? "").includes(search) ||
          (u.note ?? "").includes(search),
      )
    : units

  const sorted = [...filtered].sort((a, b) => {
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
      default:
        return a.unitCode.localeCompare(b.unitCode) * dir
    }
  })

  const totalAmount = filtered.reduce((sum, u) => sum + u.amount, 0)

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
            {filtered.length}个单位 · 总计{" "}
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate} size="sm">
                <Plus className="mr-1 size-4" />
                新增
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingUnit ? "编辑单位" : "新增资本单位"}
                </DialogTitle>
              </DialogHeader>
              <UnitForm
                unit={editingUnit}
                onClose={() => setDialogOpen(false)}
                onSuccess={() => {
                  setDialogOpen(false)
                  router.refresh()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Units Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">单位列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={() => toggleSort("unitCode")}
                  >
                    编号
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={() => toggleSort("amount")}
                  >
                    金额
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>策略</TableHead>
                <TableHead>战术</TableHead>
                <TableHead>产品</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={() => toggleSort("status")}
                  >
                    状态
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={() => toggleSort("endDate")}
                  >
                    到期日
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">
                    {unit.unitCode}
                  </TableCell>
                  <TableCell className="font-bold">
                    {formatCurrencyFull(unit.amount)}{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      {unit.currency}
                    </span>
                  </TableCell>
                  <TableCell>{unit.strategy}</TableCell>
                  <TableCell>{unit.tactics}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {unit.productName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        STATUS_COLORS[unit.status] ?? "",
                      )}
                    >
                      {unit.status}
                    </Badge>
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
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-muted-foreground py-8 text-center"
                  >
                    {search ? "未找到匹配的单位" : "暂无资本单位"}
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

// ── Unit Form ──

function UnitForm({
  unit,
  onClose,
  onSuccess,
}: {
  unit: SerializedUnit | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [unitCode, setUnitCode] = useState(unit?.unitCode ?? "")
  const [amount, setAmount] = useState(
    unit?.amount != null ? String(unit.amount) : "",
  )
  const [currency, setCurrency] = useState(unit?.currency ?? "CNY")
  const [strategy, setStrategy] = useState(unit?.strategy ?? "")
  const [tactics, setTactics] = useState(unit?.tactics ?? "")
  const [status, setStatus] = useState(unit?.status ?? "已成立")
  const [startDate, setStartDate] = useState(unit?.startDate ?? "")
  const [endDate, setEndDate] = useState(unit?.endDate ?? "")
  const [note, setNote] = useState(unit?.note ?? "")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      if (unit) {
        // Update existing unit
        const result = await updateUnit(unit.id, {
          unitCode,
          amount: Number(amount),
          currency,
          status,
          strategy,
          tactics,
          startDate: startDate || null,
          endDate: endDate || null,
          note: note || null,
        })
        if (result.success) {
          toast.success("单位已更新")
          onSuccess()
        } else {
          toast.error(result.error)
        }
      } else {
        // Create new unit
        const payload: Parameters<typeof createUnit>[0] = {
          unitCode,
          amount: Number(amount),
          currency,
          status,
          strategy,
          tactics,
        }
        if (startDate) payload.startDate = startDate
        if (endDate) payload.endDate = endDate
        if (note) payload.note = note

        const result = await createUnit(payload)
        if (result.success) {
          toast.success("单位已创建")
          onSuccess()
        } else {
          toast.error(result.error)
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unitCode">编号 *</Label>
          <Input
            id="unitCode"
            value={unitCode}
            onChange={(e) => setUnitCode(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">金额 *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currency">币种</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
          >
            <option value="CNY">CNY</option>
            <option value="USD">USD</option>
            <option value="HKD">HKD</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">状态</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
          >
            <option value="已成立">已成立</option>
            <option value="计划中">计划中</option>
            <option value="筹集中">筹集中</option>
            <option value="已归档">已归档</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="strategy">策略 *</Label>
          <select
            id="strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
            required
          >
            <option value="">选择策略</option>
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tactics">战术 *</Label>
          <select
            id="tactics"
            value={tactics}
            onChange={(e) => setTactics(e.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
            required
          >
            <option value="">选择战术</option>
            {TACTICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">开始日期</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">到期日期</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">备注</Label>
        <Input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : unit ? "保存" : "创建"}
        </Button>
      </div>
    </form>
  )
}
