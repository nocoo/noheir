"use client";

import { Check, ChevronsUpDown, ExternalLink, Package, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createProduct } from "@/app/actions/product-actions";
import { createUnit, updateUnit } from "@/app/actions/unit-actions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { DomainProduct, SerializedUnit } from "@/domain/types";
import { buildUnitUpdateDiff, type UnitFormSnapshot } from "@/lib/unit-update-diff";
import { cn } from "@/lib/utils";
import { InvestmentTimeline } from "./investment-timeline";

// ── Constants ──

const STRATEGIES = [
  "远期理财",
  "美元资产",
  "36存单",
  "长期理财",
  "短期理财",
  "中期理财",
  "进攻计划",
  "麻麻理财",
];

const TACTICS = [
  "养老年金",
  "个人养老金",
  "定期存款",
  "理财产品",
  "现金产品",
  "债券基金",
  "偏股基金",
  "稳健理财",
  "增额寿险",
  "货币基金",
];

const STATUSES = ["已成立", "计划中", "筹集中", "已归档"];

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

// ── Types ──

// Moved to src/domain/types.ts (it is a domain shape the page components build);
// re-exported here so existing imports keep working.
export type { SerializedUnit } from "@/domain/types";

interface UnitEditorProps {
  unit: SerializedUnit | null;
  products: DomainProduct[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ── Main Component ──

export function UnitEditor({ unit, products, open, onOpenChange, onSuccess }: UnitEditorProps) {
  // Use key to force re-mount inner form when unit changes
  // This ensures form state is always initialized from current unit
  const formKey = unit?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <UnitEditorForm
          key={formKey}
          unit={unit}
          products={products}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Inner Form Component ──

function UnitEditorForm({
  unit,
  products,
  onOpenChange,
  onSuccess,
}: {
  unit: SerializedUnit | null;
  products: DomainProduct[];
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEditing = unit !== null;

  // Unit form state - initialized from unit prop
  const [unitCode, setUnitCode] = useState(unit?.unitCode ?? "");
  const [amount, setAmount] = useState(unit?.amount != null ? String(unit.amount) : "");
  const [currency, setCurrency] = useState(unit?.currency ?? "CNY");
  const [strategy, setStrategy] = useState(unit?.strategy ?? "");
  const [tactics, setTactics] = useState(unit?.tactics ?? "");
  const [status, setStatus] = useState(unit?.status ?? "已成立");
  const [startDate, setStartDate] = useState(unit?.startDate ?? "");
  // endDate is managed automatically by backend based on status (归档日期)
  const [note, setNote] = useState(unit?.note ?? "");
  const [productId, setProductId] = useState<string | null>(unit?.productId ?? null);

  // Product selector state
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // Quick product create state
  const [newProductName, setNewProductName] = useState("");
  const [newProductChannel, setNewProductChannel] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");

  const [isPending, startTransition] = useTransition();
  const [isCreatingProduct, startProductTransition] = useTransition();

  // Get selected product info
  const selectedProduct = useMemo(() => {
    if (!productId) return null;
    return products.find((p) => p.id === productId) ?? null;
  }, [productId, products]);

  // Handle quick product creation
  const handleQuickCreateProduct = () => {
    if (!newProductName.trim()) {
      toast.error("请输入产品名称");
      return;
    }

    startProductTransition(async () => {
      const data: Parameters<typeof createProduct>[0] = {
        name: newProductName.trim(),
      };
      if (newProductChannel) data.channel = newProductChannel;
      if (newProductCategory) data.category = newProductCategory;

      const result = await createProduct(data);
      if (result.success) {
        toast.success("产品已创建");
        setProductId(result.data.id);
        setShowQuickCreate(false);
        setNewProductName("");
        setNewProductChannel("");
        setNewProductCategory("");
        // Note: The new product won't appear in the list until page refreshes
        // But it's already selected by ID
      } else {
        toast.error(result.error);
      }
    });
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!unitCode.trim()) {
      toast.error("请输入单位编号");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("请输入有效金额");
      return;
    }
    if (!strategy) {
      toast.error("请选择策略");
      return;
    }
    if (!tactics) {
      toast.error("请选择战术");
      return;
    }

    startTransition(async () => {
      if (isEditing && unit) {
        const initial: UnitFormSnapshot = {
          unitCode: unit.unitCode,
          amount: unit.amount,
          currency: unit.currency,
          status: unit.status,
          strategy: unit.strategy,
          tactics: unit.tactics,
          productId: unit.productId,
          startDate: unit.startDate,
          note: unit.note,
        };
        const current: UnitFormSnapshot = {
          unitCode: unitCode.trim(),
          amount: Number(amount),
          currency,
          status,
          strategy,
          tactics,
          productId: productId,
          startDate: startDate || null,
          note: note.trim() || null,
        };
        const { productIdPayload, otherPayload } = buildUnitUpdateDiff(initial, current);

        if (!productIdPayload && !otherPayload) {
          toast.success("单位已更新");
          onSuccess();
          onOpenChange(false);
          return;
        }

        if (productIdPayload) {
          const r = await updateUnit(unit.id, productIdPayload);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
        }
        if (otherPayload) {
          const r = await updateUnit(unit.id, otherPayload);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
        }
        toast.success("单位已更新");
        onSuccess();
        onOpenChange(false);
      } else {
        const payload: Parameters<typeof createUnit>[0] = {
          unitCode: unitCode.trim(),
          amount: Number(amount),
          currency,
          status,
          strategy,
          tactics,
        };
        if (productId) payload.productId = productId;
        if (startDate) payload.startDate = startDate;
        // endDate is managed automatically by backend based on status
        if (note.trim()) payload.note = note.trim();

        const result = await createUnit(payload);
        if (result.success) {
          toast.success("单位已创建");
          onSuccess();
          onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "编辑资本单位" : "新增资本单位"}</DialogTitle>
        <DialogDescription>
          {isEditing ? "修改资本单位信息和关联产品" : "创建新的资本单位并关联投资产品"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section: Basic Info */}
        <div className="space-y-3">
          <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            基本信息
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unitCode" className="text-xs">
                编号 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unitCode"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                placeholder="如 CU01-001"
                className="h-9"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs">
                金额 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                className="h-9"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">币种</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY 人民币</SelectItem>
                  <SelectItem value="USD">USD 美元</SelectItem>
                  <SelectItem value="HKD">HKD 港币</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">状态</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section: Strategy & Tactics */}
        <div className="space-y-3">
          <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            投资配置
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                策略 <span className="text-destructive">*</span>
              </Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择策略" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                战术 <span className="text-destructive">*</span>
              </Label>
              <Select value={tactics} onValueChange={setTactics}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择战术" />
                </SelectTrigger>
                <SelectContent>
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

        <Separator />

        {/* Section: Product Association */}
        <div className="space-y-3">
          <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            关联产品
          </h4>

          {/* Product Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">投资产品</Label>
            <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productSearchOpen}
                  className="h-9 w-full justify-between font-normal"
                >
                  {selectedProduct ? (
                    <span className="flex items-center gap-2">
                      <Package className="text-muted-foreground size-3.5" />
                      <span>{selectedProduct.name}</span>
                      {selectedProduct.channel && (
                        <span className="text-muted-foreground text-xs">
                          ({selectedProduct.channel})
                        </span>
                      )}
                    </span>
                  ) : productId ? (
                    <span className="text-muted-foreground">新建产品 (刷新后显示)</span>
                  ) : (
                    <span className="text-muted-foreground">选择产品...</span>
                  )}
                  <ChevronsUpDown className="text-muted-foreground ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索产品..." />
                  <CommandList>
                    <CommandEmpty>
                      <div className="py-2 text-center text-sm">未找到产品</div>
                    </CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={`${product.name} ${product.channel ?? ""} ${product.category ?? ""}`}
                          onSelect={() => {
                            setProductId(product.id);
                            setProductSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              productId === product.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{product.name}</span>
                            {(product.channel || product.category) && (
                              <span className="text-muted-foreground text-xs">
                                {[product.channel, product.category].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setShowQuickCreate(true);
                          setProductSearchOpen(false);
                        }}
                      >
                        <Plus className="mr-2 size-4" />
                        快速创建产品
                      </CommandItem>
                      {productId && (
                        <CommandItem
                          onSelect={() => {
                            setProductId(null);
                            setProductSearchOpen(false);
                          }}
                          className="text-muted-foreground"
                        >
                          <X className="mr-2 size-4" />
                          取消关联
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedProduct && (
              <Link
                href={`/products?edit=${selectedProduct.id}`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                target="_blank"
              >
                <ExternalLink className="size-3" />
                查看产品详情
              </Link>
            )}
          </div>

          {/* Quick Product Create Form */}
          {showQuickCreate && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">快速创建产品</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => setShowQuickCreate(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="产品名称 *"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="h-8 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newProductChannel} onValueChange={setNewProductChannel}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((ch) => (
                        <SelectItem key={ch} value={ch}>
                          {ch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newProductCategory} onValueChange={setNewProductCategory}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="类别" />
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
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={handleQuickCreateProduct}
                  disabled={isCreatingProduct}
                >
                  {isCreatingProduct ? "创建中..." : "创建并选择"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {selectedProduct &&
          unit?.latestInvestDate &&
          selectedProduct.lockPeriodDays != null &&
          selectedProduct.lockPeriodDays > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  投资时间线
                </h4>
                <InvestmentTimeline
                  latestInvestDate={unit.latestInvestDate}
                  lockPeriodDays={selectedProduct.lockPeriodDays}
                  openDays={selectedProduct.openDays}
                  cycleDays={selectedProduct.cycleDays}
                />
              </div>
            </>
          )}

        <Separator />

        {/* Section: Dates & Note */}
        <div className="space-y-3">
          <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            时间与备注
          </h4>
          <div className="space-y-1.5">
            <Label htmlFor="startDate" className="text-xs">
              开始日期
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9"
            />
          </div>
          {/* endDate (归档日期) is managed automatically by backend when status = 已归档 */}
          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-xs">
              备注
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="可选备注信息..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : isEditing ? "保存" : "创建"}
          </Button>
        </div>
      </form>
    </>
  );
}
