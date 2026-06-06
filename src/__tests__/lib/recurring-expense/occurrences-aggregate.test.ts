import { describe, expect, test } from "vitest";
import {
  addDaysIso,
  sumMonth,
  sumNextDays,
  sumWindow,
} from "@/lib/recurring-expense/occurrences-aggregate";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

function rule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: "r",
    userId: "u",
    name: "test",
    categoryId: null,
    amountCents: 1_000,
    currency: "CNY",
    account: null,
    frequency: "monthly",
    interval: 1,
    dayOfMonth: 1,
    monthOfYear: null,
    weekday: null,
    startDate: "2026-01-01",
    endDate: null,
    status: "active",
    endedAt: null,
    note: null,
    ...overrides,
  };
}

describe("addDaysIso", () => {
  test("zero stays put", () => {
    expect(addDaysIso("2026-01-15", 0)).toBe("2026-01-15");
  });
  test("forward across month boundary", () => {
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01");
  });
  test("forward across leap-year boundary", () => {
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysIso("2028-02-29", 1)).toBe("2028-03-01");
  });
  test("forward across year boundary", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });
  test("forward 30 days", () => {
    expect(addDaysIso("2026-01-15", 30)).toBe("2026-02-14");
  });
  test("forward 365 days", () => {
    expect(addDaysIso("2026-06-01", 365)).toBe("2027-06-01");
  });
  test("backward across month boundary", () => {
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysIso("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("sumWindow", () => {
  test("empty rules array → 0", () => {
    expect(sumWindow([], { fromDate: "2026-01-01", toDate: "2026-12-31" })).toBe(0);
  });

  test("sums a single monthly rule across 3 months", () => {
    const r = rule({ amountCents: 3_000, dayOfMonth: 15 });
    expect(
      sumWindow([r], { fromDate: "2026-01-01", toDate: "2026-03-31" }),
    ).toBe(9_000); // 3 occurrences × 3000
  });

  test("sums multiple rules", () => {
    const monthly = rule({ amountCents: 500, dayOfMonth: 1 });
    const yearly = rule({
      id: "r2",
      amountCents: 12_000,
      frequency: "yearly",
      monthOfYear: 1,
      dayOfMonth: 5,
      startDate: "2026-01-05",
    });
    // Jan window: monthly 1/1, yearly 1/5 → 500 + 12000 = 12500
    expect(
      sumWindow([monthly, yearly], {
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
      }),
    ).toBe(12_500);
  });

  test("paused rule contributes 0 even if it would have fired in window", () => {
    const active = rule({ amountCents: 1_000, dayOfMonth: 1 });
    const paused = rule({
      id: "r-paused",
      amountCents: 9_999,
      dayOfMonth: 1,
      status: "paused",
    });
    expect(
      sumWindow([active, paused], {
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
      }),
    ).toBe(1_000);
  });

  test("ended rule contributes occurrences up to min(endedAt, endDate, toDate)", () => {
    const r = rule({
      amountCents: 100,
      dayOfMonth: 1,
      status: "ended",
      endedAt: "2026-03-15",
    });
    // 1/1, 2/1, 3/1 are ≤ endedAt; 4/1 excluded
    expect(
      sumWindow([r], { fromDate: "2026-01-01", toDate: "2026-12-31" }),
    ).toBe(300);
  });

  test("window before rule's startDate → 0", () => {
    const r = rule({ startDate: "2027-01-01" });
    expect(
      sumWindow([r], { fromDate: "2026-01-01", toDate: "2026-12-31" }),
    ).toBe(0);
  });

  test("cross-month window for monthly rule respects exact bounds", () => {
    const r = rule({ amountCents: 100, dayOfMonth: 15 });
    expect(
      sumWindow([r], { fromDate: "2026-01-16", toDate: "2026-03-14" }),
    ).toBe(100); // only Feb 15
  });
});

describe("sumMonth", () => {
  test("month convenience wraps to [first, last] of viewMonth", () => {
    const r = rule({ amountCents: 100, dayOfMonth: 31 });
    // Feb 2026 (non-leap) → dayOfMonth=31 clamps to Feb 28
    expect(sumMonth([r], "2026-02-15")).toBe(100);
  });

  test("works for leap-year February", () => {
    const r = rule({
      amountCents: 100,
      dayOfMonth: 29,
      startDate: "2028-02-29",
    });
    expect(sumMonth([r], "2028-02-10")).toBe(100);
  });

  test("ignores the day component of viewMonth", () => {
    const r = rule({ amountCents: 50, dayOfMonth: 1 });
    expect(sumMonth([r], "2026-04-01")).toBe(sumMonth([r], "2026-04-30"));
  });
});

describe("sumNextDays", () => {
  test("next 30 days excludes occurrences outside the window", () => {
    const r = rule({ amountCents: 100, dayOfMonth: 15 });
    // today=2026-01-10 → window ends 2026-02-09 → just Jan 15
    expect(sumNextDays([r], "2026-01-10", 30)).toBe(100);
  });

  test("next 365 days picks up yearly occurrence", () => {
    const r = rule({
      amountCents: 8_000,
      frequency: "yearly",
      monthOfYear: 1,
      dayOfMonth: 5,
      startDate: "2026-01-05",
    });
    expect(sumNextDays([r], "2026-06-01", 365)).toBe(8_000); // 2027-01-05
  });
});
