"use client";

// DayDetailPopover — modal panel listing every occurrence of a single
// day (P3-C7).
//
// Spec: docs/002-recurring-expense-calendar.md § Day detail
//
// Entry point from PlanCalendar (P3-C5): clicking a cell sets the
// page's `selectedDay` state which the parent then passes here. The
// popover lists ALL items for that day (not just the first 3 the
// calendar dot row could fit), each row showing:
//   - color chip (category's `chart-N` token, fallback muted)
//   - rule name
//   - frequency description (`describeFrequency` from P2-C4)
//   - amount in yuan (`formatAmountYuan`)
//
// Uses the project's Radix-backed Dialog primitive
// (src/components/ui/dialog.tsx) rather than a hand-rolled overlay so
// we get the full `aria-modal` contract — FocusScope (Tab trap),
// DismissableLayer (Escape + outside click), background `aria-hidden`,
// scroll lock — without re-implementing it.
//
// What it does NOT do:
//   - Re-walk recurrence. Caller hands in the pre-computed
//     `occurrencesByDay: Map<iso, RecurrenceRule[]>` from
//     `aggregateOccurrences` (P3-C5). The popover is a pure render.
//   - Mutate state. Pause/resume/end actions live on the rule list
//     (P3-C8), not here.

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHART_TOKENS } from "@/lib/palette";
import {
  describeFrequency,
  formatAmountYuan,
} from "@/lib/recurring-expense/format";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

export interface DayDetailCategory {
  id: string;
  name: string;
  colorToken?: string;
}

export interface DayDetailPopoverProps {
  open: boolean;
  /** ISO YYYY-MM-DD of the day being viewed. May be null when closed. */
  isoDate: string | null;
  /** Map<iso, RecurrenceRule[]>, typically the output of
   *  `aggregateOccurrences` from P3-C5. Reused so the popover never
   *  re-walks recurrence rules. */
  occurrencesByDay: Map<string, RecurrenceRule[]>;
  categoryMap: Map<string, DayDetailCategory>;
  onClose: () => void;
  /** Optional callback when the user clicks "查看" on an item. */
  onOpenRule?: (ruleId: string) => void;
  className?: string;
}

const FALLBACK_COLOR = "hsl(var(--muted-foreground))";

function tokenColor(token: string | undefined): string {
  if (!token) return FALLBACK_COLOR;
  return CHART_TOKENS.includes(token) ? `hsl(var(--${token}))` : FALLBACK_COLOR;
}

/** Shape every visible row up front so render and tests agree. */
export interface DayDetailRow {
  ruleId: string;
  name: string;
  amountYuan: string;
  frequencyText: string;
  categoryName: string | null;
  colorCss: string;
}

export function buildDayDetailRows(
  isoDate: string | null,
  occurrencesByDay: Map<string, RecurrenceRule[]>,
  categoryMap: Map<string, DayDetailCategory>,
): DayDetailRow[] {
  if (!isoDate) return [];
  const rules = occurrencesByDay.get(isoDate) ?? [];
  return rules.map((rule) => {
    const cat = rule.categoryId ? categoryMap.get(rule.categoryId) : undefined;
    return {
      ruleId: rule.id,
      name: rule.name,
      amountYuan: formatAmountYuan(rule.amountCents),
      frequencyText: describeFrequency(rule),
      categoryName: cat?.name ?? null,
      colorCss: tokenColor(cat?.colorToken),
    };
  });
}

/** Sum of all amountCents on this day. */
export function sumDay(
  isoDate: string | null,
  occurrencesByDay: Map<string, RecurrenceRule[]>,
): number {
  if (!isoDate) return 0;
  const rules = occurrencesByDay.get(isoDate) ?? [];
  return rules.reduce((acc, r) => acc + r.amountCents, 0);
}

export function DayDetailPopover({
  open,
  isoDate,
  occurrencesByDay,
  categoryMap,
  onClose,
  onOpenRule,
  className,
}: DayDetailPopoverProps): React.ReactElement {
  // When isoDate is null we never open the dialog — it has nothing to
  // describe. The parent typically only sets isoDate when opening, so
  // this is a defensive guard for transient state.
  const effectiveOpen = open && isoDate !== null;

  const rows = React.useMemo(
    () => buildDayDetailRows(isoDate, occurrencesByDay, categoryMap),
    [isoDate, occurrencesByDay, categoryMap],
  );
  const totalCents = sumDay(isoDate, occurrencesByDay);

  return (
    <Dialog
      open={effectiveOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className={cn("max-w-md p-0", className)}>
        <DialogHeader className="border-b border-border p-4 text-left">
          <DialogTitle data-testid="day-detail-title">
            {isoDate ?? ""}
          </DialogTitle>
          <DialogDescription data-testid="day-detail-description">
            {rows.length === 0
              ? "当天无周期支出"
              : `共 ${rows.length} 项 · ${formatAmountYuan(totalCents)}`}
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? null : (
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.ruleId}
                data-rule-id={row.ruleId}
                className="flex items-center gap-3 p-4"
              >
                <span
                  aria-hidden="true"
                  data-testid={`color-chip-${row.ruleId}`}
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: row.colorCss }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.frequencyText}
                    {row.categoryName ? ` · ${row.categoryName}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {row.amountYuan}
                </p>
                {onOpenRule ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenRule(row.ruleId)}
                  >
                    查看
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
