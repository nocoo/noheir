"use client"

import { useState } from "react"
import { Package, Search, Plus, Pencil, Trash2 } from "lucide-react"
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
import type { DomainProduct } from "@/domain/types"

interface ProductsClientProps {
  products: DomainProduct[]
}

const CHANNELS = [
  "招商银行", "工商银行", "建设银行", "交通银行",
  "支付宝", "微信", "其他",
]

const CATEGORIES = [
  "定期存款", "大额存单", "结构性存款", "银行理财",
  "货币基金", "债券基金", "指数基金", "混合基金",
  "养老年金", "增额终身寿", "万能险", "国债",
]

export function ProductsClient({ products }: ProductsClientProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<DomainProduct | null>(
    null,
  )

  const filtered = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (p.channel ?? "").includes(search) ||
          (p.category ?? "").includes(search),
      )
    : products

  const handleEdit = (product: DomainProduct) => {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingProduct(null)
    setDialogOpen(true)
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
            金融产品目录 · {filtered.length}个产品
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
              </DialogHeader>
              <ProductForm
                product={editingProduct}
                onClose={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                      <Badge variant="outline">{product.channel}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {product.category ? (
                      <Badge variant="secondary">{product.category}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{product.currency ?? "CNY"}</TableCell>
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
    </div>
  )
}

// ── Product Form (placeholder for CRUD operations) ──

function ProductForm({
  product,
  onClose,
}: {
  product: DomainProduct | null
  onClose: () => void
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Wire to server action for create/update
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">名称 *</Label>
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
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="channel">渠道</Label>
          <select
            id="channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
          >
            <option value="">选择渠道</option>
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">类别</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
          >
            <option value="">选择类别</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
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
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="submit">{product ? "保存" : "创建"}</Button>
      </div>
    </form>
  )
}
