// Human-readable descriptions for recurrence rules.
// Spec: docs/002-recurring-expense-calendar.md
//
// Used by the rule list + popover; uses Chinese strings to match the
// rest of the app's UI copy.

import type { RecurrenceFrequency, RecurrenceRule } from "./rule-types";

const WEEKDAY_LABELS = [
  "周日",
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
] as const;

function intervalLabel(interval: number, unit: string): string {
  if (interval === 1) {
    return `每${unit}`;
  }
  return `每 ${interval} ${unit}`;
}

export function describeFrequency(
  rule: Pick<RecurrenceRule, "frequency" | "interval" | "dayOfMonth" | "monthOfYear" | "weekday">,
): string {
  const { frequency, interval, dayOfMonth, monthOfYear, weekday } = rule;
  switch (frequency) {
    case "daily":
      return intervalLabel(interval, "天");
    case "weekly": {
      const day = weekday != null ? WEEKDAY_LABELS[weekday] ?? "" : "";
      return `${intervalLabel(interval, "周")}${day ? ` · ${day}` : ""}`;
    }
    case "monthly": {
      const day = dayOfMonth != null ? `${dayOfMonth} 日` : "";
      return `${intervalLabel(interval, "个月")}${day ? ` · ${day}` : ""}`;
    }
    case "yearly": {
      const date = monthOfYear != null && dayOfMonth != null
        ? `${monthOfYear} 月 ${dayOfMonth} 日`
        : "";
      return `${intervalLabel(interval, "年")}${date ? ` · ${date}` : ""}`;
    }
  }
}

export function formatAmountYuan(cents: number): string {
  const yuan = cents / 100;
  // Show 2 decimals only when needed (e.g. 8000 → "¥8,000"; 3500.5 → "¥3,500.50")
  const hasFraction = yuan % 1 !== 0;
  const formatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `¥${formatter.format(yuan)}`;
}

/** Compact yuan formatting for the calendar banner — keeps each cell
 *  legible even when several rules pile up on one day. Uses Chinese
 *  "万" past 10,000, falls back to full numbers below 1,000.
 *
 *  Examples:
 *    9900     → "¥99"
 *    250000   → "¥2,500"
 *    1000000  → "¥1万"
 *    1234500  → "¥1.2万"
 *    100000000 → "¥1000万"
 */
export function formatAmountCompact(cents: number): string {
  const yuan = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (yuan >= 10000) {
    const wan = yuan / 10000;
    const text = wan >= 100 ? wan.toFixed(0) : wan.toFixed(1).replace(/\.0$/, "");
    return `${sign}¥${text}万`;
  }
  const rounded = Math.round(yuan);
  return `${sign}¥${new Intl.NumberFormat("zh-CN").format(rounded)}`;
}

/** Pure: derive the UI display status. `expired` is computed from
 *  endDate < today for active rules and never persisted. */
export function deriveDisplayStatus(
  rule: Pick<RecurrenceRule, "status" | "endDate">,
  today: string,
): "active" | "paused" | "ended" | "expired" {
  if (rule.status === "paused") return "paused";
  if (rule.status === "ended") return "ended";
  if (rule.endDate && rule.endDate < today) return "expired";
  return "active";
}

/** Re-export for symmetry with other domain helpers. */
export type { RecurrenceFrequency };
