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
// What it does NOT do:
//   - Re-walk recurrence. Caller hands in the pre-computed
//     `occurrencesByDay: Map<iso, RecurrenceRule[]>` from
//     `aggregateOccurrences` (P3-C5). The popover is a pure render.
//   - Mutate state. Pause/resume/end actions live on the rule list
//     (P3-C8), not here.
//   - Open itself. The parent decides when it's open via the `open`
//     prop, mirroring the pattern of shadcn/ui Dialog primitives.
//
// A11y: implemented as a `role="dialog"` with `aria-modal="true"`.
// Escape closes; focus moves to the close button on open and back to
// the document on close (the calendar gridcell is not re-focused
// here — the parent's focus management owns that).

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  /** Optional callback when the user clicks "查看规则" on an item.
   *  Lets the parent navigate to the rule list / open the edit form. */
  onOpenRule?: (ruleId: string) => void;
  className?: string;
}

const FALLBACK_COLOR = "hsl(var(--muted-foreground))";

function tokenColor(token: string | undefined): string {
  if (!token) return FALLBACK_COLOR;
  return CHART_TOKENS.includes(token) ? `hsl(var(--${token}))` : FALLBACK_COLOR;
}

/** Shape every visible row in the popover so render and tests can
 *  agree on what's been computed up front. Exported as a pure function. */
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

/** Sum of all amounts on this day (cents). Pure helper. */
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
}: DayDetailPopoverProps): React.ReactElement | null {
  const closeRef = React.useRef<HTMLButtonElement | null>(null);

  // Focus the close button when the popover opens, so a keyboard user
  // immediately has a focusable element inside the dialog.
  React.useEffect(() => {
    if (open && closeRef.current) {
      closeRef.current.focus();
    }
  }, [open, isoDate]);

  // Escape dismiss — registered only while open to avoid stealing
  // Escape from other modals on the page.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !isoDate) return null;

  const rows = buildDayDetailRows(isoDate, occurrencesByDay, categoryMap);
  const totalCents = sumDay(isoDate, occurrencesByDay);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${isoDate} 周期支出`}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-black/30 backdrop-blur-sm",
        className,
      )}
      onClick={(e) => {
        // Click outside the inner panel closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="text-xs text-muted-foreground">{isoDate}</p>
            <p className="text-base font-semibold">
              {rows.length === 0
                ? "当天无周期支出"
                : `共 ${rows.length} 项 · ${formatAmountYuan(totalCents)}`}
            </p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

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
      </div>
    </div>
  );
}
