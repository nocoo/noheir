"use client";

// PlanCalendar — month view for the recurring-expense calendar (P3-C5).
// Spec: docs/002-recurring-expense-calendar.md § Calendar
//
// What this component does:
//   - Render a stable 6-row × 7-col grid for one calendar month.
//     Always 6 rows so the grid does NOT jump in height when a month
//     starts on Sunday vs Saturday.
//   - For each visible day, render up to MAX_BANNERS colored banners
//     for today's occurrences of recurring rules. Each banner shows
//     the rule name and a compact amount (e.g. "¥2,500" / "¥1.2万"),
//     tinted with the category's chart-N token so a glance at the
//     grid tells the user what kind of expense lands when.
//   - When a day has more occurrences than fit, surface a "+N 更多"
//     row that opens the existing DayDetailPopover via onSelectDay.
//   - Delegate occurrence math to `computeOccurrences` (P2-C2). The
//     component never reimplements recurrence logic.
//   - Colors come from the category palette via `chart-N` tokens
//     (P3-C1's closed set). Off-palette / missing categories fall
//     back to a muted neutral so the layout stays consistent.
//
// What this component does NOT do:
//   - It does not load data. The parent server component fetches
//     rules + categories and passes them in.
//   - It does not open the existing edit dialog itself — clicking a
//     banner calls `onOpenRule(ruleId)` and the parent decides what
//     to do. The parent already wires the same callback for the
//     DayDetailPopover's "查看" button, so the two entry points share
//     a single edit-flow implementation.

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
import { formatAmountCompact } from "@/lib/recurring-expense/format";
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
  /** Categories keyed by id — used to colour banners. Rules whose
   *  category is not in this map render with the fallback colour. */
  categoryMap: Map<string, PlanCalendarCategory>;
  /** Today's ISO date for "today" highlight. Tests pin this to a
   *  fixed value; production calls usually pass `todayIso()`. */
  todayIso?: string;
  /** Currently selected day (highlighted with a ring). Optional. */
  selectedDay?: string | null;
  onSelectDay?: (iso: string) => void;
  /** Fires when the user clicks a single banner — typically opens
   *  the rule's edit dialog. Day-level clicks still go through
   *  onSelectDay (which opens the day detail popover). */
  onOpenRule?: (ruleId: string) => void;
  className?: string;
}

const WEEKDAY_HEADERS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const FALLBACK_COLOR = "hsl(var(--muted-foreground))";
const MAX_BANNERS = 3;

/** Coerce a token to a CSS color. Unknown tokens fall back so the
 *  layout never shows a broken/black colour if a rule was created with
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
  onOpenRule,
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

      {/* 6 × 7 grid — banners auto-expand each cell vertically; min-height
          keeps empty months looking balanced. */}
      <div role="grid" aria-label={monthHeading} className="grid grid-cols-7">
        {cells.map((cell) => {
          const occs = occurrenceMap.get(cell.iso) ?? [];
          const isToday = todayIso != null && cell.iso === todayIso;
          const isSelected = selectedDay != null && cell.iso === selectedDay;
          const visibleBanners = occs.slice(0, MAX_BANNERS);
          const overflow = Math.max(0, occs.length - MAX_BANNERS);

          return (
            <div
              key={cell.iso}
              role="gridcell"
              tabIndex={0}
              data-iso={cell.iso}
              data-in-month={cell.inMonth ? "true" : "false"}
              aria-label={`${cell.iso}${occs.length > 0 ? ` ${occs.length} 项` : ""}`}
              aria-current={isToday ? "date" : undefined}
              aria-selected={isSelected || undefined}
              onClick={() => onSelectDay?.(cell.iso)}
              onKeyDown={(e) => {
                // Only treat key events that originated on the cell
                // itself as the "open day detail" affordance. Enter /
                // Space on a focused banner (or +N button) must NOT
                // also fire this handler — otherwise the popover
                // would open every time a keyboard user activates a
                // banner. The child buttons' own onClick handlers
                // already stopPropagation for mouse clicks, but for
                // keydown the synthetic event still bubbles here.
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay?.(cell.iso);
                }
              }}
              className={cn(
                "relative flex min-h-[7rem] cursor-pointer flex-col gap-1 border-b border-r border-border p-1.5 text-left outline-none transition-colors",
                "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
                cell.inMonth
                  ? "bg-background hover:bg-accent/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                isSelected && "ring-2 ring-foreground ring-inset",
              )}
            >
              {/* Day-number chip — purely decorative; the entire cell is
                  already the "open day detail" target. */}
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1 rounded-full px-1.5 text-xs font-medium",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {cell.day}
              </span>

              {/* Banner stack — every visible occurrence gets its own
                  click target so the user can jump straight to edit
                  without a popover hop. */}
              {visibleBanners.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {visibleBanners.map((rule, idx) => {
                    const cat = rule.categoryId
                      ? categoryMap.get(rule.categoryId)
                      : undefined;
                    const colorToken = cat?.colorToken;
                    const isPaletteToken =
                      typeof colorToken === "string" &&
                      CHART_TOKENS.includes(colorToken);
                    const color = tokenColor(colorToken);
                    return (
                      <button
                        key={`${rule.id}-${idx}`}
                        type="button"
                        data-rule-id={rule.id}
                        data-color={isPaletteToken ? colorToken : "fallback"}
                        data-testid={`banner-${cell.iso}-${rule.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenRule) onOpenRule(rule.id);
                          else onSelectDay?.(cell.iso);
                        }}
                        title={`${rule.name} · ${formatAmountCompact(rule.amountCents)}`}
                        aria-label={`${rule.name} ${formatAmountCompact(rule.amountCents)}`}
                        style={{
                          // Render the category color as a left accent
                          // stripe instead of the banner background.
                          // White-on-chart-N was failing WCAG AA at
                          // 10px (chart-6 ~ 1.98, chart-20 ~ 2.01 in
                          // light theme; even worse in dark). The
                          // neutral muted background + foreground text
                          // both come from theme tokens and inherit
                          // the project's verified contrast.
                          borderLeftColor: color,
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-1 rounded-sm py-0.5 pl-1.5 pr-1.5",
                          "border-l-[3px] bg-muted/70 text-foreground",
                          "text-[10px] font-medium leading-tight",
                          "outline-none ring-offset-background transition-colors",
                          "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                          // Dim the entire banner on out-of-month cells
                          // so the in-month entries stay the focal point.
                          !cell.inMonth && "opacity-60",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-left">
                          {rule.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatAmountCompact(rule.amountCents)}
                        </span>
                      </button>
                    );
                  })}
                  {overflow > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDay?.(cell.iso);
                      }}
                      data-testid={`overflow-${cell.iso}`}
                      className={cn(
                        "rounded-sm px-1.5 py-0.5 text-left text-[10px] font-medium text-muted-foreground",
                        "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none",
                      )}
                      aria-label={`查看 ${cell.iso} 全部 ${occs.length} 项周期支出`}
                    >
                      +{overflow}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
