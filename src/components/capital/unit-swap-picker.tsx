"use client";

/**
 * Searchable unit picker for 番号对换. Modeled on the product combobox in
 * unit-editor.tsx; the unit being edited is never offered as a target.
 */

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="选择对换单元"
          className="h-9 w-full justify-between text-xs font-normal"
        >
          {selected ? selected.unitCode : "选择对换单元..."}
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
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
                    <span className="text-muted-foreground truncate text-xs">
                      {[unit.productName, formatCurrencyFull(unit.amount)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
