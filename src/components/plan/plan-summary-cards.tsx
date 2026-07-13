"use client";

// PlanSummaryCards — three KPI cards for the recurring-expense calendar (P3-C6).
// Spec: docs/002-recurring-expense-calendar.md § 汇总
//
// Three windows side by side:
//   1. 当月 (sumMonth, viewMonth)         — the month currently open in the
//                                            calendar; updates as user navigates
//   2. 自今日起 30 天 (sumNextDays today 30)
//   3. 自今日起 12 个月 (sumNextDays today 365)
//
// All three reuse P2-C3's pure aggregates (sumWindow / sumMonth /
// sumNextDays). Display formatting goes through formatAmountYuan
// (P2-C4) so cents → "¥1,234.56" stays consistent with the list and
// detail views.
//
// Why "12 个月" maps to `sumNextDays(today, 365)`: the spec defines
// the window as "自今日起 12 个月". Using 365 days as the calendar
// window is the contract pinned by tests; a leap day at the boundary
// is handled by computeOccurrences.

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { sumMonth, sumNextDays } from "@/lib/recurring-expense/occurrences-aggregate";
import { formatAmountYuan } from "@/lib/recurring-expense/format";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

const NEXT_DAYS_WINDOW = 30;
const NEXT_YEAR_WINDOW = 365;

export interface PlanSummaryCardsProps {
  rules: RecurrenceRule[];
  /** Current view month — ISO YYYY-MM-DD; the day is ignored. */
  viewMonth: string;
  /** Today's ISO date — passed in so tests can pin a fixed value
   *  and so the calendar / summary cards stay in lock-step. */
  todayIso: string;
  className?: string;
}

interface SummaryItem {
  key: string;
  label: string;
  amount: number;
}

/** Pure helper — exported for unit tests so we can pin every window
 *  amount independently of the React render tree. */
export function buildSummaries(
  rules: RecurrenceRule[],
  viewMonth: string,
  todayIso: string,
): SummaryItem[] {
  return [
    {
      key: "month",
      label: "当月",
      amount: sumMonth(rules, viewMonth),
    },
    {
      key: "next30",
      label: "自今日起 30 天",
      amount: sumNextDays(rules, todayIso, NEXT_DAYS_WINDOW),
    },
    {
      key: "next365",
      label: "自今日起 12 个月",
      amount: sumNextDays(rules, todayIso, NEXT_YEAR_WINDOW),
    },
  ];
}

export function PlanSummaryCards({
  rules,
  viewMonth,
  todayIso,
  className,
}: PlanSummaryCardsProps): React.ReactElement {
  const items = React.useMemo(
    () => buildSummaries(rules, viewMonth, todayIso),
    [rules, viewMonth, todayIso],
  );

  return (
    <div
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-3", className)}
      role="group"
      aria-label="周期支出汇总"
    >
      {items.map((item) => (
        <Card key={item.key} data-summary-key={item.key} className="border-l-4 border-l-primary/60">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p
              className="mt-1 text-2xl font-semibold tabular-nums"
              data-amount-cents={item.amount}
              aria-label={`${item.label} ${formatAmountYuan(item.amount)}`}
            >
              {formatAmountYuan(item.amount)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
