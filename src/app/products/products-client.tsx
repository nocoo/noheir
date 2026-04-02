"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Package, Search, Plus, Pencil, Trash2, Filter, X } from "lucide-react"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ChannelBadge, CategoryBadge, CurrencyBadge } from "@/components/ui/colored-badge"
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/app/actions/product-actions"
import type { DomainProduct } from "@/domain/types"

interface ProductsClientProps {
  products: DomainProduct[]
}

const CHANNELS = [
  "招商银行", "平安银行", "微众银行", "支付宝",
  "招银香港", "光大永明", "中信建投",
]

const CATEGORIES = [
  "养老年金", "储蓄保险", "混债基金", "债券基金", "货币基金",
  "股票基金", "指数基金", "宽基指数", "私募基金", "定期存款",
  "理财产品", "现金+",
]

export function ProductsClient({ products }: ProductsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<DomainProduct | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<DomainProduct | null>(null)
  const [isPending, startTransition] = useTransition()

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filterChannel, setFilterChannel] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterCurrency, setFilterCurrency] = useState("all")

  const activeFilterCount = [filterChannel, filterCategory, filterCurrency].filter(
    (f) => f !== "all",
  ).length

  const resetFilters = () => {
    setFilterChannel("all")
    setFilterCategory("all")
    setFilterCurrency("all")
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      // Text search
      if (search) {
        const q = search.toLowerCase()
        const matches =
          p.name.toLowerCase().includes(q) ||
          (p.code ?? "").toLowerCase().includes(q) ||
          (p.channel ?? "").includes(search) ||
          (p.category ?? "").includes(search)
        if (!matches) return false
      }
      // Channel filter
      if (filterChannel !== "all" && p.channel !== filterChannel) return false
      // Category filter
      if (filterCategory !== "all" && p.category !== filterCategory) return false
      // Currency filter
      if (filterCurrency !== "all" && (p.currency ?? "CNY") !== filterCurrency)
        return false
      return true
    })
  }, [products, search, filterChannel, filterCategory, filterCurrency])

  const handleEdit = (product: DomainProduct) => {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingProduct(null)
    setDialogOpen(true)
  }

  const handleDelete = (product: DomainProduct) => {
    setDeleteTarget(product)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteProduct(deleteTarget.id)
      if (result.success) {
        toast.success("产品已删除")
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
            <Package className="text-primary size-6" />
            产品管理
          </h1>
          <p className="text-muted-foreground text-sm">
            金融产品目录 · ({filtered.length} / {products.length} 个产品)
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="搜索产品..."
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate} size="sm">
                <Plus className="mr-1 size-4" />
                新增
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "编辑产品" : "新增产品"}
                </DialogTitle>
                <DialogDescription>
                  {editingProduct
                    ? "修改理财产品信息"
                    : "添加新的理财产品到产品库"}
                </DialogDescription>
              </DialogHeader>
              <ProductForm
                product={editingProduct}
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
            {/* Channel Filter */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">销售渠道</Label>
              <Select value={filterChannel} onValueChange={setFilterChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部渠道</SelectItem>
                  {CHANNELS.map((ch) => (
                    <SelectItem key={ch} value={ch}>
                      {ch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">产品类别</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类别</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency Filter */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">币种</Label>
              <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部币种</SelectItem>
                  <SelectItem value="CNY">人民币 CNY</SelectItem>
                  <SelectItem value="USD">美元 USD</SelectItem>
                  <SelectItem value="HKD">港币 HKD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">产品列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>代码</TableHead>
                <TableHead>渠道</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>锁定期</TableHead>
                <TableHead>预期收益</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {product.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {product.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    {product.channel ? (
                      <ChannelBadge channel={product.channel} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {product.category ? (
                      <CategoryBadge category={product.category} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <CurrencyBadge currency={product.currency ?? "CNY"} />
                  </TableCell>
                  <TableCell>
                    {product.lockPeriodDays != null
                      ? `${product.lockPeriodDays}天`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {product.annualReturnRate != null
                      ? `${(product.annualReturnRate * 100).toFixed(2)}%`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-7"
                        onClick={() => handleDelete(product)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-muted-foreground py-8 text-center"
                  >
                    {search ? "未找到匹配的产品" : "暂无产品数据"}
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
        title="删除产品"
        description={`确定要删除产品「${deleteTarget?.name ?? ""}」吗？此操作不可撤销。`}
        onConfirm={confirmDelete}
        loading={isPending}
      />
    </div>
  )
}

// ── Product Form ──

function ProductForm({
  product,
  onClose,
  onSuccess,
}: {
  product: DomainProduct | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(product?.name ?? "")
  const [code, setCode] = useState(product?.code ?? "")
  const [channel, setChannel] = useState(product?.channel ?? "")
  const [category, setCategory] = useState(product?.category ?? "")
  const [currency, setCurrency] = useState(product?.currency ?? "CNY")
  const [lockDays, setLockDays] = useState(
    product?.lockPeriodDays != null ? String(product.lockPeriodDays) : "",
  )
  const [rate, setRate] = useState(
    product?.annualReturnRate != null
      ? String(product.annualReturnRate * 100)
      : "",
  )
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      if (product) {
        // Update: explicitly send null to clear optional fields
        const data: Parameters<typeof updateProduct>[1] = { name }
        data.code = code || null
        data.channel = channel || null
        data.category = category || null
        data.currency = currency || "CNY"
        data.lockPeriodDays = lockDays ? Number(lockDays) : null
        data.annualReturnRate = rate ? Number(rate) / 100 : null

        const result = await updateProduct(product.id, data)
        if (result.success) {
          toast.success("产品已更新")
          onSuccess()
        } else {
          toast.error(result.error)
        }
      } else {
        // Create: only send fields that have values
        const data: Parameters<typeof createProduct>[0] = { name }
        if (code) data.code = code
        if (channel) data.channel = channel
        if (category) data.category = category
        if (currency) data.currency = currency
        if (lockDays) data.lockPeriodDays = Number(lockDays)
        if (rate) data.annualReturnRate = Number(rate) / 100

        const result = await createProduct(data)
        if (result.success) {
          toast.success("产品已创建")
          onSuccess()
        } else {
          toast.error(result.error)
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          名称 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">代码</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>币种</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue placeholder="选择币种" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CNY">CNY</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="HKD">HKD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>渠道</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger>
              <SelectValue placeholder="选择渠道" />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((ch) => (
                <SelectItem key={ch} value={ch}>
                  {ch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>类别</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="选择类别" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lockDays">锁定期 (天)</Label>
          <Input
            id="lockDays"
            type="number"
            value={lockDays}
            onChange={(e) => setLockDays(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rate">预期年化收益 (%)</Label>
          <Input
            id="rate"
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
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
          {isPending ? "保存中..." : product ? "保存" : "创建"}
        </Button>
      </div>
    </form>
  )
}
