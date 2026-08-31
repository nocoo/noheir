"use client";

/**
 * Column 2 of the unit editor: product context, the operation buttons, and
 * the staged (not yet committed) operation cards.
 *
 * Buttons stage rather than execute — nothing is written until the dialog's
 * bottom 保存 (docs/003 § D5). All staging logic lives in unit-commit-plan.ts.
 */

import { ArrowLeftRight, Calendar, Package, Repeat, X } from "lucide-react";
import { useState } from "react";
import { SectionTitle } from "@/components/capital/unit-panel-primitives";
import { UnitSwapPicker } from "@/components/capital/unit-swap-picker";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DomainProduct, SerializedUnit } from "@/domain/types";
import {
  describeStagedOperation,
  findStagedOperation,
  type StagedOperation,
} from "@/lib/unit-commit-plan";

interface UnitOperationsPanelProps {
  unitId: string;
  /** From the CAS snapshot, never from a page-level prop: the panel must show
   *  and act on the same product the guard will compare (docs/003 § Decision B). */
  currentProductId: string | null;
  /** Fallback name for the current product. The pickable list excludes archived
   *  products, so a unit still sitting in one would otherwise read as 未关联. */
  currentProductName?: string | null;
  units: SerializedUnit[];
  products: DomainProduct[];
  operations: StagedOperation[];
  onStage: (op: StagedOperation) => void;
  onUnstage: (kind: StagedOperation["kind"]) => void;
  /** Currently computed available date, used as the date picker default. */
  currentAvailableDate?: string | null;
  /** Stored override, if any. Distinct from the computed date. */
  currentOverride?: string | null;
}

export function UnitOperationsPanel({
  unitId,
  currentProductId,
  currentProductName,
  units,
  products,
  operations,
  onStage,
  onUnstage,
  currentAvailableDate = null,
  currentOverride = null,
}: UnitOperationsPanelProps) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  // undefined = nothing picked yet; null = explicitly chose 取消关联.
  const [pendingProductId, setPendingProductId] = useState<string | null | undefined>(undefined);
  const [pnlInput, setPnlInput] = useState("");
  const [pendingAvailableDate, setPendingAvailableDate] = useState(
    currentOverride ?? currentAvailableDate ?? "",
  );

  const stagedSwap = findStagedOperation(operations, "swap_unit_code");
  const stagedSwitch = findStagedOperation(operations, "switch_product");
  const stagedAvail = findStagedOperation(operations, "set_available_date");

  const currentProduct = products.find((p) => p.id === currentProductId) ?? null;
  // Archived products are absent from `products`, so fall back to the name the
  // unit carries rather than claiming the unit has no product at all.
  const currentLabel = currentProduct?.name ?? (currentProductId ? currentProductName : null);
  const pendingProduct = products.find((p) => p.id === pendingProductId) ?? null;

  const confirmSwitch = () => {
    if (pendingProductId === undefined) return;
    const pnl = pnlInput.trim();
    onStage({
      kind: "switch_product",
      fromProductId: currentProductId,
      fromProductName: currentLabel ?? null,
      toProductId: pendingProductId,
      toProductName: pendingProduct?.name ?? null,
      pnl: pnl === "" ? null : Number(pnl),
    });
    setSwitchOpen(false);
    setPendingProductId(undefined);
    setPnlInput("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SectionTitle icon={<Package className="size-3" />} label="当前产品" />
        <p className="text-sm">
          {currentProduct?.name ?? <span className="text-muted-foreground">未关联产品</span>}
        </p>
        {currentProduct?.channel && (
          <p className="text-muted-foreground text-xs">{currentProduct.channel}</p>
        )}
      </div>

      <div className="space-y-2">
        <SectionTitle icon={<Repeat className="size-3" />} label="操作" />

        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 justify-start text-xs"
            onClick={() => setSwitchOpen((v) => !v)}
            disabled={stagedSwitch !== undefined}
          >
            <Repeat className="mr-1.5 size-3.5" />
            切换投入产品
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 justify-start text-xs"
            onClick={() => setSwapOpen((v) => !v)}
            disabled={stagedSwap !== undefined}
          >
            <ArrowLeftRight className="mr-1.5 size-3.5" />
            资金单元番号对换
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 justify-start text-xs"
            onClick={() => {
              setPendingAvailableDate(currentOverride ?? currentAvailableDate ?? "");
              setAvailOpen((v) => !v);
            }}
            disabled={stagedAvail !== undefined}
          >
            <Calendar className="mr-1.5 size-3.5" />
            编辑可用日期
          </Button>
        </div>

        {switchOpen && !stagedSwitch && (
          <div className="bg-muted/30 space-y-2 rounded-lg border p-2.5">
            <Label className="text-xs">新产品</Label>
            <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-label="选择新产品"
                  className="h-9 w-full justify-between text-xs font-normal"
                >
                  {pendingProductId === undefined
                    ? "选择产品..."
                    : (pendingProduct?.name ?? "取消关联")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索产品..." />
                  <CommandList>
                    <CommandEmpty>未找到产品</CommandEmpty>
                    <CommandGroup>
                      {/* Unlinking is only meaningful when a product is linked;
                          offering it otherwise would stage a null → null no-op
                          that the server rejects with 400. */}
                      {currentProductId && (
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            setPendingProductId(null);
                            setProductPickerOpen(false);
                          }}
                        >
                          <span className="text-muted-foreground">取消关联</span>
                        </CommandItem>
                      )}
                      {products
                        .filter((p) => p.id !== currentProductId)
                        .map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.channel ?? ""}`}
                            onSelect={() => {
                              setPendingProductId(p.id);
                              setProductPickerOpen(false);
                            }}
                          >
                            {p.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* pnl rides the withdraw row, which only exists if there is a
                product to exit — the server rejects the combination otherwise. */}
            {currentProductId && (
              <div className="space-y-1">
                <Label htmlFor="switch-pnl" className="text-xs">
                  本次实现损益（可选）
                </Label>
                <Input
                  id="switch-pnl"
                  type="number"
                  step="0.01"
                  value={pnlInput}
                  onChange={(e) => setPnlInput(e.target.value)}
                  placeholder="如 500 或 -200"
                  className="h-9 text-xs"
                />
              </div>
            )}

            <Button
              type="button"
              size="sm"
              className="h-9 w-full text-xs"
              onClick={confirmSwitch}
              disabled={pendingProductId === undefined}
            >
              确认切换
            </Button>
          </div>
        )}

        {swapOpen && !stagedSwap && (
          <div className="bg-muted/30 space-y-2 rounded-lg border p-2.5">
            <Label className="text-xs">与哪个单元对换</Label>
            <UnitSwapPicker
              units={units}
              currentUnitId={unitId}
              selectedUnitId={null}
              onSelect={(target) => {
                onStage({
                  kind: "swap_unit_code",
                  targetUnitId: target.id,
                  targetUnitCode: target.unitCode,
                });
                setSwapOpen(false);
              }}
            />
          </div>
        )}

        {availOpen && !stagedAvail && (
          <div className="bg-muted/30 space-y-2 rounded-lg border p-2.5">
            <p className="text-muted-foreground text-[10px]">
              覆盖自动计算的解锁日，投入流水不变。
              {currentOverride
                ? ` 当前手动：${currentOverride}`
                : currentAvailableDate
                  ? ` 当前自动：${currentAvailableDate}`
                  : " 当前无法自动计算。"}
            </p>
            <Label htmlFor="available-date" className="text-xs">
              可用日期
            </Label>
            <Input
              id="available-date"
              type="date"
              value={pendingAvailableDate}
              onChange={(e) => setPendingAvailableDate(e.target.value)}
              className="h-9 text-xs"
            />
            <Button
              type="button"
              size="sm"
              className="h-9 w-full text-xs"
              onClick={() => {
                if (!pendingAvailableDate) return;
                onStage({ kind: "set_available_date", availableDate: pendingAvailableDate });
                setAvailOpen(false);
              }}
              disabled={!pendingAvailableDate || pendingAvailableDate === (currentOverride ?? "")}
            >
              确认覆盖
            </Button>
            {currentOverride && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full text-xs"
                onClick={() => {
                  onStage({ kind: "set_available_date", availableDate: null });
                  setAvailOpen(false);
                }}
              >
                恢复自动计算
              </Button>
            )}
          </div>
        )}
      </div>

      {operations.length > 0 && (
        <div className="space-y-2">
          <SectionTitle icon={<Repeat className="size-3" />} label="待生效" />
          <ul className="space-y-1.5">
            {operations.map((op) => (
              <li
                key={op.kind}
                className="border-primary/30 bg-primary/10 flex items-start gap-2 rounded-md border p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{describeStagedOperation(op)}</p>
                  {op.kind === "switch_product" && op.pnl != null && (
                    <p className="text-muted-foreground text-[10px]">损益 {op.pnl}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0"
                  aria-label={`撤销${describeStagedOperation(op)}`}
                  onClick={() => onUnstage(op.kind)}
                >
                  <X className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
