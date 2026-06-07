"use client";

// PlanCalendar — month view for the recurring-expense calendar (P3-C5).
// Spec: docs/002-recurring-expense-calendar.md § Calendar
//
// What this component does:
//   - Render a stable 6-row × 7-col grid for one calendar month.
//     Always 6 rows so the grid does NOT jump in height when a month
//     starts on Sunday vs Saturday.
//   - For each visible day, render up to 3 colored dots representing
//     today's occurrences of recurring rules; if the day has > 3,
//     append a "+N" badge so the cell stays compact.
//   - Delegate occurrence math to `computeOccurrences` (P2-C2). The
//     component never reimplements recurrence logic.
//   - Color dots come from the category palette via `chart-N` tokens
//     (P3-C1's closed set). If a rule's category is missing or its
//     colorToken is off-palette, fall back to `--muted-foreground` so
//     the layout stays consistent.
//
// What this component does NOT do:
//   - It does not load data. The parent server component fetches
//     rules + categories and passes them in.
//   - It does not open the occurrence detail popover — that's P3-C7.
//     Clicking a day calls `onSelectDay(iso)` so the parent can show
//     a detail panel beside or below the calendar.
//   - It does not include status/endedAt logic. `computeOccurrences`
//     already returns `[]` for paused rules and respects ended/endDate.

import * as React from "react";
import { cn } from "@/lib/utils";
import { CHART_TOKENS } from "@/lib/palette";
import {
  computeOccurrences,
  formatIso,
  fromDayNumber,
  parseIso,
  toDayNumber,
} from "@/lib/recurring-expense/occurrences";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

export interface PlanCalendarCategory {
  id: string;
  name: string;
  /** `chart-N` token (closed set). Anything off-palette falls back. */
  colorToken?: string;
}

export interface PlanCalendarProps {
  /** First day of the month to render. Must be ISO YYYY-MM-01.
   *  Caller is responsible for handling month navigation; this
   *  component only renders the month it was given. */
  viewMonth: string;
  rules: RecurrenceRule[];
  /** Categories keyed by id — used to colour dots. Rules whose
   *  category is not in this map render with the fallback colour. */
  categoryMap: Map<string, PlanCalendarCategory>;
  /** Today's ISO date for "today" highlight. Tests pin this to a
   *  fixed value; production calls usually pass `todayIso()`. */
  todayIso?: string;
  /** Currently selected day (highlighted with a ring). Optional. */
  selectedDay?: string | null;
  onSelectDay?: (iso: string) => void;
  className?: string;
}

const WEEKDAY_HEADERS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const FALLBACK_COLOR = "hsl(var(--muted-foreground))";
const MAX_DOTS = 3;

/** Coerce a token to a CSS color. Unknown tokens fall back so the
 *  layout never shows a broken/black dot if a rule was created with
 *  a stale color value (or no category at all). */
function tokenColor(token: string | undefined): string {
  if (!token) return FALLBACK_COLOR;
  return CHART_TOKENS.includes(token) ? `hsl(var(--${token}))` : FALLBACK_COLOR;
}

/** Build the 42-cell day grid for a given month, starting on Sunday.
 *  Pure function — exported for unit tests. */
export interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

export function buildMonthGrid(viewMonth: string): CalendarCell[] {
  const monthStart = parseIso(viewMonth);
  if (monthStart.day !== 1) {
    throw new Error(`viewMonth must be the 1st of a month: ${viewMonth}`);
  }
  const startDayNum = toDayNumber(monthStart);
  // JS weekday: 0..6 with Sunday=0 — same convention as the rest of the spec.
  const startWeekday = new Date(
    Date.UTC(monthStart.year, monthStart.month - 1, 1),
  ).getUTCDay();
  // First grid cell = (startDayNum - startWeekday). Always 42 cells
  // (6 weeks) so the calendar height never reflows month to month.
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const ymd = fromDayNumber(startDayNum - startWeekday + i);
    cells.push({
      iso: formatIso(ymd),
      day: ymd.day,
      inMonth: ymd.year === monthStart.year && ymd.month === monthStart.month,
    });
  }
  return cells;
}

/** Aggregate occurrences for every visible day into a Map<iso, ruleIds>.
 *  Pure function — exported so callers (and tests) can reuse the
 *  output (e.g. P3-C7 detail popover). */
export function aggregateOccurrences(
  rules: RecurrenceRule[],
  fromIso: string,
  toIso: string,
): Map<string, RecurrenceRule[]> {
  const map = new Map<string, RecurrenceRule[]>();
  for (const rule of rules) {
    const dates = computeOccurrences(rule, fromIso, toIso);
    for (const iso of dates) {
      const bucket = map.get(iso);
      if (bucket) bucket.push(rule);
      else map.set(iso, [rule]);
    }
  }
  return map;
}

export function PlanCalendar({
  viewMonth,
  rules,
  categoryMap,
  todayIso,
  selectedDay,
  onSelectDay,
  className,
}: PlanCalendarProps): React.ReactElement {
  const cells = React.useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const range = React.useMemo(() => {
    if (cells.length === 0) {
      // Should be impossible from buildMonthGrid but stay defensive.
      return { fromIso: viewMonth, toIso: viewMonth };
    }
    return {
      fromIso: cells[0]?.iso ?? viewMonth,
      toIso: cells[cells.length - 1]?.iso ?? viewMonth,
    };
  }, [cells, viewMonth]);

  const occurrenceMap = React.useMemo(
    () => aggregateOccurrences(rules, range.fromIso, range.toIso),
    [rules, range.fromIso, range.toIso],
  );

  // Pretty-print the heading.
  const monthHeading = React.useMemo(() => {
    const { year, month } = parseIso(viewMonth);
    return `${year} 年 ${month} 月`;
  }, [viewMonth]);

  return (
    <div
      className={cn("w-full select-none", className)}
      data-view-month={viewMonth}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthHeading}</h2>
      </div>

      {/* Weekday header — sticky on small screens via natural flow */}
      <div
        role="row"
        className="grid grid-cols-7 border-b border-border pb-2 text-center text-xs text-muted-foreground"
      >
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} role="columnheader" aria-label={`星期${label}`}>
            {label}
          </div>
        ))}
      </div>

      {/* 6 × 7 grid — fixed cell heights keep layout stable across months */}
      <div role="grid" aria-label={monthHeading} className="grid grid-cols-7">
        {cells.map((cell) => {
          const occs = occurrenceMap.get(cell.iso) ?? [];
          const isToday = todayIso != null && cell.iso === todayIso;
          const isSelected = selectedDay != null && cell.iso === selectedDay;
          const visibleDots = occs.slice(0, MAX_DOTS);
          const overflow = Math.max(0, occs.length - MAX_DOTS);

          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              data-iso={cell.iso}
              data-in-month={cell.inMonth ? "true" : "false"}
              aria-label={`${cell.iso}${occs.length > 0 ? ` ${occs.length} 项` : ""}`}
              aria-current={isToday ? "date" : undefined}
              aria-selected={isSelected || undefined}
              onClick={() => onSelectDay?.(cell.iso)}
              className={cn(
                "relative flex h-20 flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left outline-none transition-colors",
                "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
                cell.inMonth
                  ? "bg-background hover:bg-accent/40"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                isSelected && "ring-2 ring-foreground ring-inset",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {cell.day}
              </span>

              {/* Dots row */}
              {visibleDots.length > 0 ? (
                <div className="mt-auto flex flex-wrap items-center gap-0.5">
                  {visibleDots.map((rule, idx) => {
                    const cat = rule.categoryId
                      ? categoryMap.get(rule.categoryId)
                      : undefined;
                    const color = tokenColor(cat?.colorToken);
                    return (
                      <span
                        key={`${rule.id}-${idx}`}
                        data-rule-id={rule.id}
                        data-color={cat?.colorToken ?? "fallback"}
                        aria-hidden="true"
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                  {overflow > 0 ? (
                    <span
                      data-testid={`overflow-${cell.iso}`}
                      className="ml-1 text-[10px] font-medium text-muted-foreground"
                    >
                      +{overflow}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
