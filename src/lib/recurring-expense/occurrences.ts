// Compute the list of occurrence dates for a recurrence rule within
// a given inclusive [fromDate, toDate] window.
//
// Spec: docs/002-recurring-expense-calendar.md § Occurrence Algorithm
//
// Anchor rule: every interval is anchored to startDate. The 0-th period
// is the frequency-period that contains startDate; subsequent periods
// are exactly N intervals away (no alignment to natural weeks/months).
//
// Effective window:
//   effectiveTo   = min(toDate, endDate ?? +∞, endedAt ?? +∞)
//   effectiveFrom = max(fromDate, startDate)
// status='paused' → return [].
// Otherwise the same formula is used regardless of active vs ended.
//
// Date math is done by parsing ISO YYYY-MM-DD into integer day-counts
// without `Date` objects, so behaviour is identical regardless of the
// host process timezone. Calendar-aware steps (month / year + leap-year
// 2/29, monthly day-31 clamp) use a tiny pure helper that operates on
// (year, month, day) tuples.

import type {
  RecurrenceFrequency,
  RecurrenceRule,
} from "./rule-types";

// ── ISO date parsing / formatting (no `Date` objects) ──

interface YmdParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIso(iso: string): YmdParts {
  const m = ISO_RE.exec(iso);
  if (!m) {
    throw new Error(`invalid ISO date: ${iso}`);
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatIso(p: YmdParts): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeap(year)) {
    return 29;
  }
  return DAYS_IN_MONTH[month - 1] ?? 30;
}

function compareIso(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function minIso(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxIso(a: string, b: string): string {
  return a >= b ? a : b;
}

// Convert (year, month, day) to a Julian-style day number for fast
// difference / addition without touching Date or timezone. Source:
// Howard Hinnant's date algorithms (public domain).
function toDayNumber(p: YmdParts): number {
  const y = p.month <= 2 ? p.year - 1 : p.year;
  const era = (y >= 0 ? y : y - 399) / 400 | 0;
  const yoe = y - era * 400;
  const m = p.month;
  const doy = ((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5 | 0) + p.day - 1;
  const doe = yoe * 365 + (yoe / 4 | 0) - (yoe / 100 | 0) + doy;
  return era * 146097 + doe - 719468;
}

function fromDayNumber(n: number): YmdParts {
  const z = n + 719468;
  const era = (z >= 0 ? z : z - 146096) / 146097 | 0;
  const doe = z - era * 146097;
  const yoe = ((doe - (doe / 1460 | 0) + (doe / 36524 | 0) - (doe / 146096 | 0)) / 365) | 0;
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + (yoe / 4 | 0) - (yoe / 100 | 0));
  const mp = (5 * doy + 2) / 153 | 0;
  const d = doy - ((153 * mp + 2) / 5 | 0) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return {
    year: m <= 2 ? y + 1 : y,
    month: m,
    day: d,
  };
}

// ── Monthly / yearly step helpers ──

function addMonthsClamped(p: YmdParts, monthsDelta: number, anchorDay: number): YmdParts {
  // Move month, clamp day to the new month's last day if anchor > end of month.
  const totalMonths = (p.year * 12 + (p.month - 1)) + monthsDelta;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12 + 12) % 12 + 1;
  const lastDay = daysInMonth(year, month);
  const day = Math.min(anchorDay, lastDay);
  return { year, month, day };
}

// ── Per-frequency occurrence walker ──

function* walkDaily(
  start: YmdParts,
  step: number,
  fromIso: string,
  toIso: string,
): IterableIterator<string> {
  const startN = toDayNumber(start);
  const fromN = toDayNumber(parseIso(fromIso));
  // First occurrence ≥ fromIso that lands on (startN + k*step):
  const delta = Math.max(0, fromN - startN);
  const k = Math.ceil(delta / step);
  let cur = startN + k * step;
  while (true) {
    const iso = formatIso(fromDayNumber(cur));
    if (iso > toIso) return;
    if (iso >= fromIso) yield iso;
    cur += step;
  }
}

function* walkWeekly(
  start: YmdParts,
  step: number, // intervals in weeks
  weekday: number, // 0=Sun..6=Sat
  fromIso: string,
  toIso: string,
): IterableIterator<string> {
  // Anchor: the day in start's 7-day window that matches `weekday`.
  // dayOfWeek(n) where n = days since 1970-01-01 (Thursday=4):
  //   (n + 4) % 7  → Sun=0..Sat=6
  const startN = toDayNumber(start);
  const dow = (startN + 4) % 7;
  const offset = (weekday - dow + 7) % 7;
  const firstN = startN + offset;
  const stepDays = step * 7;

  const fromN = toDayNumber(parseIso(fromIso));
  const delta = Math.max(0, fromN - firstN);
  const k = Math.ceil(delta / stepDays);
  let cur = firstN + k * stepDays;
  while (true) {
    const iso = formatIso(fromDayNumber(cur));
    if (iso > toIso) return;
    if (iso >= fromIso) yield iso;
    cur += stepDays;
  }
}

function* walkMonthly(
  start: YmdParts,
  step: number,
  anchorDay: number,
  fromIso: string,
  toIso: string,
): IterableIterator<string> {
  // 0-th month = start.year/start.month with day=anchorDay (clamped).
  // We jump by `step` months, recomputing day each time.
  let k = 0;
  while (true) {
    const candidate = addMonthsClamped(start, k * step, anchorDay);
    // Never emit before startDate.
    const startN = toDayNumber(start);
    const candN = toDayNumber(candidate);
    if (candN < startN) {
      k++;
      continue;
    }
    const iso = formatIso(candidate);
    if (iso > toIso) return;
    if (iso >= fromIso) yield iso;
    k++;
    // Safety: clamp k upper bound to prevent runaway when toIso is far
    // (e.g. 100 years = 1200 monthly iterations max). Caller controls
    // window size; we still cap at 10k just to avoid infinite loops
    // on bad input.
    if (k > 10_000) return;
  }
}

function* walkYearly(
  start: YmdParts,
  step: number,
  month: number,
  day: number,
  fromIso: string,
  toIso: string,
): IterableIterator<string> {
  let k = 0;
  while (true) {
    const year = start.year + k * step;
    const lastDay = daysInMonth(year, month);
    const candidate: YmdParts = {
      year,
      month,
      day: Math.min(day, lastDay), // 2/29 in non-leap → 2/28
    };
    const startN = toDayNumber(start);
    if (toDayNumber(candidate) < startN) {
      k++;
      continue;
    }
    const iso = formatIso(candidate);
    if (iso > toIso) return;
    if (iso >= fromIso) yield iso;
    k++;
    if (k > 1000) return;
  }
}

// ── Public API ──

export function computeOccurrences(
  rule: RecurrenceRule,
  fromDate: string,
  toDate: string,
): string[] {
  if (rule.status === "paused") {
    return [];
  }

  // Validate ISO inputs early — throws are caught by Server Action layer.
  parseIso(fromDate);
  parseIso(toDate);
  if (rule.interval < 1) {
    throw new Error(`interval must be ≥ 1 (got ${rule.interval})`);
  }

  // Effective window: union of caller window with rule lifecycle.
  let effectiveTo = toDate;
  if (rule.endDate) effectiveTo = minIso(effectiveTo, rule.endDate);
  if (rule.endedAt) effectiveTo = minIso(effectiveTo, rule.endedAt);
  const effectiveFrom = maxIso(fromDate, rule.startDate);

  if (compareIso(effectiveFrom, effectiveTo) > 0) {
    return [];
  }

  const start = parseIso(rule.startDate);

  switch (rule.frequency) {
    case "daily":
      return Array.from(
        walkDaily(start, rule.interval, effectiveFrom, effectiveTo),
      );
    case "weekly": {
      if (rule.weekday == null) {
        throw new Error("weekday is required for weekly rules");
      }
      return Array.from(
        walkWeekly(start, rule.interval, rule.weekday, effectiveFrom, effectiveTo),
      );
    }
    case "monthly": {
      if (rule.dayOfMonth == null) {
        throw new Error("dayOfMonth is required for monthly rules");
      }
      return Array.from(
        walkMonthly(start, rule.interval, rule.dayOfMonth, effectiveFrom, effectiveTo),
      );
    }
    case "yearly": {
      if (rule.monthOfYear == null || rule.dayOfMonth == null) {
        throw new Error("monthOfYear and dayOfMonth are required for yearly rules");
      }
      return Array.from(
        walkYearly(
          start,
          rule.interval,
          rule.monthOfYear,
          rule.dayOfMonth,
          effectiveFrom,
          effectiveTo,
        ),
      );
    }
    default: {
      const _exhaustive: never = rule.frequency;
      throw new Error(`unknown frequency: ${String(_exhaustive)}`);
    }
  }
}

// Re-export for the aggregate helper / tests.
export { parseIso, formatIso, toDayNumber, fromDayNumber, daysInMonth };
export type { RecurrenceFrequency };
