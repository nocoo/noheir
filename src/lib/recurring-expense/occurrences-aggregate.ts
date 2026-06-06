// Aggregate helpers for recurring expense rules.
// Spec: docs/002-recurring-expense-calendar.md § 汇总（纯函数）
//
// `sumWindow` sums the `amountCents` of every occurrence of every rule
// that falls within an inclusive [fromDate, toDate] window. Used by the
// UI summary cards.

import { computeOccurrences } from "./occurrences";
import type { RecurrenceRule } from "./rule-types";
import { daysInMonth, formatIso, parseIso } from "./occurrences";

export interface Window {
  fromDate: string;
  toDate: string;
}

/** Sum (cents) of all rule occurrences in `window`. Paused rules
 *  contribute 0 because `computeOccurrences` returns `[]` for them. */
export function sumWindow(rules: RecurrenceRule[], window: Window): number {
  let total = 0;
  for (const rule of rules) {
    const occurrences = computeOccurrences(rule, window.fromDate, window.toDate);
    total += occurrences.length * rule.amountCents;
  }
  return total;
}

/** Convenience: sum for the calendar's current view month. `viewMonth`
 *  is an ISO `YYYY-MM-DD` whose day is ignored — we span the entire
 *  calendar month containing it. */
export function sumMonth(rules: RecurrenceRule[], viewMonth: string): number {
  const { year, month } = parseIso(viewMonth);
  const from = formatIso({ year, month, day: 1 });
  const to = formatIso({ year, month, day: daysInMonth(year, month) });
  return sumWindow(rules, { fromDate: from, toDate: to });
}

/** Convenience: sum for the next `days` starting from `today`. */
export function sumNextDays(
  rules: RecurrenceRule[],
  today: string,
  days: number,
): number {
  return sumWindow(rules, {
    fromDate: today,
    toDate: addDaysIso(today, days),
  });
}

/** Pure helper exported for tests + UI: add N days to an ISO date. */
export function addDaysIso(iso: string, days: number): string {
  const { year, month, day } = parseIso(iso);
  // Walk day-by-day to avoid pulling Date math; the windows here are
  // bounded by spec (30 / 365 days).
  let y = year;
  let m = month;
  let d = day;
  let remaining = days;
  while (remaining > 0) {
    const last = daysInMonth(y, m);
    if (d + remaining <= last) {
      d += remaining;
      remaining = 0;
    } else {
      remaining -= (last - d + 1);
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  while (remaining < 0) {
    if (d + remaining >= 1) {
      d += remaining;
      remaining = 0;
    } else {
      remaining += d;
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      d = daysInMonth(y, m);
    }
  }
  return formatIso({ year: y, month: m, day: d });
}
