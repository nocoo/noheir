"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createContributionLog,
  updateContributionLog,
} from "@/app/actions/contribution-log-actions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
import { Textarea } from "@/components/ui/textarea";
import type {
  ContributionOperationType,
  DomainContributionLog,
  DomainProduct,
  DomainUnit,
} from "@/domain/types";
import { cn } from "@/lib/utils";

const OPERATION_TYPES = [
  { value: "invest" as const, label: "投入" },
  { value: "withdraw" as const, label: "取出" },
  { value: "adjust" as const, label: "调整" },
];

interface ContributionLogFormProps {
  log: DomainContributionLog | null;
  units: DomainUnit[];
  products: DomainProduct[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ContributionLogForm({
  log,
  units,
  products,
  open,
  onOpenChange,
  onSuccess,
}: ContributionLogFormProps) {
  const formKey = log?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <ContributionLogFormInner
          key={formKey}
          log={log}
          units={units}
          products={products}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}

function ContributionLogFormInner({
  log,
  units,
  products,
  onOpenChange,
  onSuccess,
}: {
  log: DomainContributionLog | null;
  units: DomainUnit[];
  products: DomainProduct[];
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEditing = log !== null;
  const [isPending, startTransition] = useTransition();

  // Form state
  const [unitId, setUnitId] = useState(log?.unitId ?? "");
  const [productId, setProductId] = useState(log?.productId ?? "");
  const [operationType, setOperationType] = useState<ContributionOperationType>(
    log?.operationType ?? "invest",
  );
  const [amount, setAmount] = useState(log?.amount != null ? String(Math.abs(log.amount)) : "");
  const [operationDate, setOperationDate] = useState(
    log?.operationDate ?? new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState(log?.note ?? "");

  // Combobox open states
  const [unitOpen, setUnitOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Selected items for display
  const selectedUnit = useMemo(() => units.find((u) => u.id === unitId), [units, unitId]);
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );

  const handleSubmit = () => {
    // Validate required fields
    if (!unitId) {
      toast.error("请选择资金单元");
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      toast.error("请输入有效金额");
      return;
    }
    if (!operationDate) {
      toast.error("请选择日期");
      return;
    }

    const amountValue = parseFloat(amount);
    // withdraw is negative
    const signedAmount =
      operationType === "withdraw" ? -Math.abs(amountValue) : Math.abs(amountValue);

    startTransition(async () => {
      if (isEditing) {
        const result = await updateContributionLog(log.id, {
          operationType,
          amount: signedAmount,
          operationDate,
          note: note || null,
        });
        if (result.success) {
          toast.success("更新成功");
          onSuccess();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createContributionLog({
          unitId,
          productId: productId || null,
          productName: selectedProduct?.name ?? null,
          operationType,
          amount: signedAmount,
          operationDate,
          note: note || null,
        });
        if (result.success) {
          toast.success("创建成功");
          onSuccess();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "编辑投入记录" : "新增投入记录"}</DialogTitle>
        <DialogDescription>
          {isEditing ? "修改投入记录信息" : "记录资金的投入或取出操作"}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Unit selector (required, disabled when editing) */}
        <div className="space-y-1.5">
          <Label>
            资金单元 <span className="text-destructive">*</span>
          </Label>
          <Popover open={unitOpen} onOpenChange={setUnitOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={unitOpen}
                className="w-full justify-between"
                disabled={isEditing}
              >
                {selectedUnit ? selectedUnit.unitCode : "选择资金单元..."}
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="搜索单元代码..." />
                <CommandList>
                  <CommandEmpty>未找到匹配的单元</CommandEmpty>
                  <CommandGroup>
                    {units.map((u) => (
                      <CommandItem
                        key={u.id}
                        value={u.unitCode}
                        onSelect={() => {
                          setUnitId(u.id);
                          setUnitOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            unitId === u.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{u.unitCode}</span>
                          <span className="text-muted-foreground text-xs">
                            {u.strategy} · {u.tactics}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Product selector (optional, disabled when editing) */}
        <div className="space-y-1.5">
          <Label>关联产品（可选）</Label>
          <Popover open={productOpen} onOpenChange={setProductOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={productOpen}
                className="w-full justify-between"
                disabled={isEditing}
              >
                {selectedProduct ? selectedProduct.name : "选择产品..."}
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="搜索产品..." />
                <CommandList>
                  <CommandEmpty>未找到匹配的产品</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value=""
                      onSelect={() => {
                        setProductId("");
                        setProductOpen(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 size-4", !productId ? "opacity-100" : "opacity-0")}
                      />
                      <span className="text-muted-foreground">不关联产品</span>
                    </CommandItem>
                    {products.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.name}
                        onSelect={() => {
                          setProductId(p.id);
                          setProductOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            productId === p.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{p.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {p.channel ?? ""} · {p.category ?? ""}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Operation type */}
        <div className="space-y-1.5">
          <Label>
            操作类型 <span className="text-destructive">*</span>
          </Label>
          <Select
            value={operationType}
            onValueChange={(v) => setOperationType(v as ContributionOperationType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label>
            金额（元） <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <p className="text-muted-foreground text-xs">
            {operationType === "withdraw" ? "取出金额将自动记为负数" : "投入金额记为正数"}
          </p>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label>
            操作日期 <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={operationDate}
            onChange={(e) => setOperationDate(e.target.value)}
          />
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label>备注</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可选备注..."
            rows={2}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "保存中..." : isEditing ? "更新" : "创建"}
        </Button>
      </div>
    </>
  );
}
