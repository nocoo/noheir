"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createProduct, deleteProduct, updateProduct } from "@/app/actions/product-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge, ChannelBadge, CurrencyBadge } from "@/components/ui/colored-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DEFAULT_MAX_RETURN_RATE,
  DEFAULT_MIN_RETURN_RATE,
  getReturnRateStatus,
  getReturnRateTextClass,
} from "@/domain/settings";
import type { DomainProduct } from "@/domain/types";

interface SerializedUnit {
  id: string;
  unitCode: string;
  amount: number;
  currency: string;
  status: string;
  strategy: string;
  tactics: string;
  productId: string | null;
  productName: string | null;
}

interface ProductsClientProps {
  products: DomainProduct[];
  units: SerializedUnit[];
}

type SortColumn = "name" | "channel" | "category" | "lockPeriodDays" | "annualReturnRate";
type SortDirection = "asc" | "desc";

const CHANNELS = ["招商银行", "平安银行", "微众银行", "支付宝", "招银香港", "光大永明", "中信建投"];

const CATEGORIES = [
  "养老年金",
  "储蓄保险",
  "混债基金",
  "债券基金",
  "货币基金",
  "股票基金",
  "指数基金",
  "宽基指数",
  "私募基金",
  "定期存款",
  "理财产品",
  "现金+",
];

export function ProductsClient({ products, units }: ProductsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  const editFromParam = useMemo(() => {
    const editId = searchParams.get("edit");
    if (!editId) return null;
    return products.find((p) => p.id === editId) ?? null;
  }, [searchParams, products]);

  const [dialogOpen, setDialogOpen] = useState(() => editFromParam !== null);
  const [editingProduct, setEditingProduct] = useState<DomainProduct | null>(editFromParam);
  const [deleteTarget, setDeleteTarget] = useState<DomainProduct | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Calculate product associations with units
  const productUnitStats = useMemo(() => {
    const stats = new Map<string, { count: number; totalAmount: number }>();
    for (const unit of units) {
      if (!unit.productId) continue;
      const existing = stats.get(unit.productId);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += unit.amount;
      } else {
        stats.set(unit.productId, { count: 1, totalAmount: unit.amount });
      }
    }
    return stats;
  }, [units]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 inline size-3" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline size-3" />
    ) : (
      <ArrowDown className="ml-1 inline size-3" />
    );
  };

  const getAriaSort = (column: SortColumn): "ascending" | "descending" | "none" => {
    if (sortColumn !== column) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  const activeFilterCount =
    [filterChannel, filterCategory, filterCurrency].filter((f) => f !== "all").length +
    (showArchived ? 1 : 0);

  const resetFilters = () => {
    setFilterChannel("all");
    setFilterCategory("all");
    setFilterCurrency("all");
    setShowArchived(false);
  };

  const filteredAndSorted = useMemo(() => {
    // First filter
    const result = products.filter((p) => {
      // Archive filter - by default, hide archived products
      if (!showArchived && p.isArchived) return false;
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const matches =
          p.name.toLowerCase().includes(q) ||
          (p.code ?? "").toLowerCase().includes(q) ||
          (p.channel ?? "").includes(search) ||
          (p.category ?? "").includes(search);
        if (!matches) return false;
      }
      // Channel filter
      if (filterChannel !== "all" && p.channel !== filterChannel) return false;
      // Category filter
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      // Currency filter
      if (filterCurrency !== "all" && (p.currency ?? "CNY") !== filterCurrency) return false;
      return true;
    });

    // Then sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "name":
          cmp = a.name.localeCompare(b.name, "zh-CN");
          break;
        case "channel":
          cmp = (a.channel ?? "").localeCompare(b.channel ?? "", "zh-CN");
          break;
        case "category":
          cmp = (a.category ?? "").localeCompare(b.category ?? "", "zh-CN");
          break;
        case "lockPeriodDays":
          cmp = (a.lockPeriodDays ?? 0) - (b.lockPeriodDays ?? 0);
          break;
        case "annualReturnRate":
          cmp = (a.annualReturnRate ?? 0) - (b.annualReturnRate ?? 0);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    products,
    search,
    filterChannel,
    filterCategory,
    filterCurrency,
    showArchived,
    sortColumn,
    sortDirection,
  ]);

  const handleEdit = (product: DomainProduct) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  const handleDelete = (product: DomainProduct) => {
    setDeleteTarget(product);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteProduct(deleteTarget.id);
      if (result.success) {
        toast.success("产品已删除");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setDeleteTarget(null);
    });
  };

  const handleToggleArchive = (product: DomainProduct) => {
    startTransition(async () => {
      const result = await updateProduct(product.id, { isArchived: !product.isArchived });
      if (result.success) {
        toast.success(product.isArchived ? "已取消存档" : "已存档");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // Count active (non-archived) products
  const activeProductCount = products.filter((p) => !p.isArchived).length;

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
            金融产品目录 · ({filteredAndSorted.length} / {activeProductCount} 个产品)
            {showArchived && <span className="ml-1 text-amber-600">(含已存档)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="搜索产品..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-[200px] pl-9"
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
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (searchParams.has("edit")) router.replace("/products");
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={handleCreate} size="sm">
                <Plus className="mr-1 size-4" />
                新增
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? "编辑产品" : "新增产品"}</DialogTitle>
                <DialogDescription>
                  {editingProduct ? "修改理财产品信息" : "添加新的理财产品到产品库"}
                </DialogDescription>
              </DialogHeader>
              <ProductForm
                product={editingProduct}
                onClose={() => setDialogOpen(false)}
                onSuccess={() => {
                  setDialogOpen(false);
                  router.refresh();
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

            {/* Archived Filter */}
            <div className="flex items-end">
              <Button
                variant={showArchived ? "secondary" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive className="mr-1 size-4" />
                {showArchived ? "隐藏已存档" : "显示已存档"}
              </Button>
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
                <TableHead aria-sort={getAriaSort("name")}>
                  <button
                    type="button"
                    onClick={() => handleSort("name")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    名称
                    {getSortIcon("name")}
                  </button>
                </TableHead>
                <TableHead>代码</TableHead>
                <TableHead aria-sort={getAriaSort("channel")}>
                  <button
                    type="button"
                    onClick={() => handleSort("channel")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    渠道
                    {getSortIcon("channel")}
                  </button>
                </TableHead>
                <TableHead aria-sort={getAriaSort("category")}>
                  <button
                    type="button"
                    onClick={() => handleSort("category")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    类别
                    {getSortIcon("category")}
                  </button>
                </TableHead>
                <TableHead>币种</TableHead>
                <TableHead aria-sort={getAriaSort("lockPeriodDays")}>
                  <button
                    type="button"
                    onClick={() => handleSort("lockPeriodDays")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    锁定期
                    {getSortIcon("lockPeriodDays")}
                  </button>
                </TableHead>
                <TableHead aria-sort={getAriaSort("annualReturnRate")}>
                  <button
                    type="button"
                    onClick={() => handleSort("annualReturnRate")}
                    className="hover:text-foreground flex items-center text-sm transition-colors"
                  >
                    预期收益
                    {getSortIcon("annualReturnRate")}
                  </button>
                </TableHead>
                <TableHead className="w-20 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((product) => (
                <TableRow key={product.id} className={product.isArchived ? "opacity-60" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {product.name}
                      {product.isArchived && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          已存档
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {product.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    {product.channel ? <ChannelBadge channel={product.channel} /> : "—"}
                  </TableCell>
                  <TableCell>
                    {product.category ? <CategoryBadge category={product.category} /> : "—"}
                  </TableCell>
                  <TableCell>
                    <CurrencyBadge currency={product.currency ?? "CNY"} />
                  </TableCell>
                  <TableCell>
                    {product.lockPeriodDays != null ? (
                      <div>
                        <span>{product.lockPeriodDays}天</span>
                        {product.openDays != null && product.cycleDays != null && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({product.openDays}/{product.cycleDays})
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {product.annualReturnRate != null ? (
                      <ReturnRateCell rate={product.annualReturnRate} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {productUnitStats.has(product.id) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7" asChild>
                                <Link href={`/warehouse?q=${encodeURIComponent(product.name)}`}>
                                  <Warehouse className="size-3.5" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                查看关联的 {productUnitStats.get(product.id)?.count ?? 0} 个资本单位
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleToggleArchive(product)}
                              disabled={isPending}
                            >
                              {product.isArchived ? (
                                <ArchiveRestore className="size-3.5" />
                              ) : (
                                <Archive className="size-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{product.isArchived ? "取消存档" : "存档"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
              {filteredAndSorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
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
          if (!open) setDeleteTarget(null);
        }}
        title="删除产品"
        description={`确定要删除产品「${deleteTarget?.name ?? ""}」吗？此操作不可撤销。`}
        onConfirm={confirmDelete}
        loading={isPending}
      />
    </div>
  );
}

// ── Product Form ──

function ProductForm({
  product,
  onClose,
  onSuccess,
}: {
  product: DomainProduct | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [channel, setChannel] = useState(product?.channel ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [currency, setCurrency] = useState(product?.currency ?? "CNY");
  const [lockDays, setLockDays] = useState(
    product?.lockPeriodDays != null ? String(product.lockPeriodDays) : "",
  );
  const [openDays, setOpenDays] = useState(
    product?.openDays != null ? String(product.openDays) : "",
  );
  const [cycleDays, setCycleDays] = useState(
    product?.cycleDays != null ? String(product.cycleDays) : "",
  );
  const [rate, setRate] = useState(
    product?.annualReturnRate != null ? String(product.annualReturnRate * 100) : "",
  );
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      if (product) {
        // Update: explicitly send null to clear optional fields
        const data: Parameters<typeof updateProduct>[1] = { name };
        data.code = code || null;
        data.channel = channel || null;
        data.category = category || null;
        data.currency = currency || "CNY";
        data.lockPeriodDays = lockDays ? Number(lockDays) : null;
        data.openDays = openDays ? Number(openDays) : null;
        data.cycleDays = cycleDays ? Number(cycleDays) : null;
        data.annualReturnRate = rate ? Number(rate) / 100 : null;

        const result = await updateProduct(product.id, data);
        if (result.success) {
          toast.success("产品已更新");
          onSuccess();
        } else {
          toast.error(result.error);
        }
      } else {
        // Create: only send fields that have values
        const data: Parameters<typeof createProduct>[0] = { name };
        if (code) data.code = code;
        if (channel) data.channel = channel;
        if (category) data.category = category;
        if (currency) data.currency = currency;
        if (lockDays) data.lockPeriodDays = Number(lockDays);
        if (openDays) data.openDays = Number(openDays);
        if (cycleDays) data.cycleDays = Number(cycleDays);
        if (rate) data.annualReturnRate = Number(rate) / 100;

        const result = await createProduct(data);
        if (result.success) {
          toast.success("产品已创建");
          onSuccess();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          名称 <span className="text-destructive">*</span>
        </Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">代码</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} />
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
      {lockDays && Number(lockDays) > 0 && (
        <div className="grid grid-cols-2 gap-4 rounded-md border border-dashed p-3">
          <div className="col-span-2">
            <Label className="text-muted-foreground text-xs">
              周期性锁定（可选）：初始锁定到期后，循环开放/锁定
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openDays">开放天数</Label>
            <Input
              id="openDays"
              type="number"
              min="1"
              placeholder="如 3"
              value={openDays}
              onChange={(e) => setOpenDays(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cycleDays">周期天数</Label>
            <Input
              id="cycleDays"
              type="number"
              min="1"
              placeholder="如 30"
              value={cycleDays}
              onChange={(e) => setCycleDays(e.target.value)}
            />
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : product ? "保存" : "创建"}
        </Button>
      </div>
    </form>
  );
}

// ── Return Rate Cell ──

function ReturnRateCell({ rate }: { rate: number }) {
  const ratePercent = rate * 100;
  const status = getReturnRateStatus(ratePercent, DEFAULT_MIN_RETURN_RATE, DEFAULT_MAX_RETURN_RATE);
  const textClass = getReturnRateTextClass(status);
  const dailyRate = (ratePercent / 365).toFixed(4);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help font-medium ${textClass}`}>{ratePercent.toFixed(2)}%</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>日收益率约 {dailyRate}%</p>
          <p className="text-muted-foreground text-xs">
            即每万元日收益约 ¥{((10000 * rate) / 365).toFixed(2)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
