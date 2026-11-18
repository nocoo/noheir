/**
 * Searchable unit picker for 番号对换. Modeled on the product combobox in
 * unit-editor.tsx; the unit being edited is never offered as a target.
 */

import {
  Button,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPalette,
  CommandPaletteTrigger,
} from "@nocoo/basalt";
import { Check, ChevronsUpDown } from "@nocoo/basalt/icons";
import { useState } from "react";
import type { SerializedUnit } from "@/domain/types";
import { formatCurrencyFull } from "@/lib/chart-config";
import { eligibleSwapTargets } from "@/lib/unit-commit-plan";
import { cn } from "@/lib/utils";

interface UnitSwapPickerProps {
  units: SerializedUnit[];
  currentUnitId: string;
  selectedUnitId: string | null;
  onSelect: (unit: SerializedUnit) => void;
}

export function UnitSwapPicker({
  units,
  currentUnitId,
  selectedUnitId,
  onSelect,
}: UnitSwapPickerProps) {
  const [open, setOpen] = useState(false);
  const targets = eligibleSwapTargets(units, currentUnitId);
  const selected = targets.find((u) => u.id === selectedUnitId) ?? null;

  return (
    <CommandPalette open={open} onOpenChange={setOpen}>
      <CommandPaletteTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="选择对换单元"
          className="w-full justify-between font-normal"
        >
          {selected ? selected.unitCode : "选择对换单元..."}
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </CommandPaletteTrigger>
      <CommandInput placeholder="搜索番号..." />
      <CommandList>
        <CommandEmpty>未找到可对换的单元</CommandEmpty>
        <CommandGroup>
          {targets.map((unit) => (
            <CommandItem
              key={unit.id}
              value={`${unit.unitCode} ${unit.productName ?? ""} ${unit.strategy}`}
              onSelect={() => {
                onSelect(unit);
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "mr-2 size-4",
                  selectedUnitId === unit.id ? "opacity-100" : "opacity-0",
                )}
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{unit.unitCode}</span>
                <span className="text-basalt-muted-foreground truncate text-xs">
                  {[unit.productName, formatCurrencyFull(unit.amount)].filter(Boolean).join(" · ")}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandPalette>
  );
}
