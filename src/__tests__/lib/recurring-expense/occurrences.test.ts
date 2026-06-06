import { describe, expect, test } from "vitest";
import { computeOccurrences } from "@/lib/recurring-expense/occurrences";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

function rule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: "r1",
    userId: "u1",
    name: "test",
    categoryId: null,
    amountCents: 100,
    currency: "CNY",
    account: null,
    frequency: "daily",
    interval: 1,
    dayOfMonth: null,
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

describe("computeOccurrences — paused / window edges", () => {
  test("status='paused' always returns []", () => {
    expect(
      computeOccurrences(
        rule({ status: "paused" }),
        "2020-01-01",
        "2099-12-31",
      ),
    ).toEqual([]);
  });

  test("effectiveFrom > effectiveTo returns []", () => {
    // fromDate after toDate
    expect(
      computeOccurrences(rule({}), "2030-01-01", "2020-01-01"),
    ).toEqual([]);
  });

  test("window entirely before startDate returns []", () => {
    expect(
      computeOccurrences(rule({}), "2020-01-01", "2025-12-31"),
    ).toEqual([]);
  });

  test("never emits dates < startDate", () => {
    const occ = computeOccurrences(
      rule({ frequency: "monthly", dayOfMonth: 15 }),
      "2025-06-01",
      "2026-01-31",
    );
    expect(occ.every((d) => d >= "2026-01-01")).toBe(true);
  });
});

describe("computeOccurrences — daily", () => {
  test("daily interval=1 emits every day inclusive", () => {
    const occ = computeOccurrences(
      rule({ frequency: "daily", interval: 1 }),
      "2026-01-01",
      "2026-01-05",
    );
    expect(occ).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
  });

  test("daily interval=3 anchored to startDate", () => {
    const occ = computeOccurrences(
      rule({ frequency: "daily", interval: 3, startDate: "2026-01-01" }),
      "2026-01-01",
      "2026-01-15",
    );
    expect(occ).toEqual([
      "2026-01-01",
      "2026-01-04",
      "2026-01-07",
      "2026-01-10",
      "2026-01-13",
    ]);
  });

  test("daily interval=2 with window starting mid-period only emits aligned days", () => {
    const occ = computeOccurrences(
      rule({ frequency: "daily", interval: 2, startDate: "2026-01-01" }),
      "2026-01-04",
      "2026-01-09",
    );
    // anchor at 1, 3, 5, 7, 9 — window starts at 4, so first ≥ 4 is 5
    expect(occ).toEqual(["2026-01-05", "2026-01-07", "2026-01-09"]);
  });
});

describe("computeOccurrences — weekly", () => {
  test("weekly fires on the requested weekday from the start-week anchor", () => {
    // 2026-01-05 is Monday (weekday=1). startDate=2026-01-05, weekday=3 (Wednesday)
    // anchor first occurrence is 2026-01-07 (the Wed in the start week).
    const occ = computeOccurrences(
      rule({
        frequency: "weekly",
        interval: 1,
        weekday: 3,
        startDate: "2026-01-05",
      }),
      "2026-01-01",
      "2026-01-31",
    );
    expect(occ).toEqual([
      "2026-01-07",
      "2026-01-14",
      "2026-01-21",
      "2026-01-28",
    ]);
  });

  test("weekly interval=2 skips every other week", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "weekly",
        interval: 2,
        weekday: 1, // Mon
        startDate: "2026-01-05", // a Monday
      }),
      "2026-01-01",
      "2026-02-15",
    );
    expect(occ).toEqual([
      "2026-01-05",
      "2026-01-19",
      "2026-02-02",
    ]);
  });

  test("weekly weekday before startDate's weekday lands the following same-week day", () => {
    // 2026-01-07 is Wed (3). weekday=0 (Sun). Anchor week's Sun is 2026-01-11.
    const occ = computeOccurrences(
      rule({
        frequency: "weekly",
        interval: 1,
        weekday: 0,
        startDate: "2026-01-07",
      }),
      "2026-01-01",
      "2026-01-31",
    );
    expect(occ).toEqual([
      "2026-01-11",
      "2026-01-18",
      "2026-01-25",
    ]);
  });
});

describe("computeOccurrences — monthly", () => {
  test("monthly dayOfMonth=15 every month", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 15,
        startDate: "2026-01-15",
      }),
      "2026-01-01",
      "2026-04-30",
    );
    expect(occ).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  test("monthly interval=3 every quarter", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 3,
        dayOfMonth: 1,
        startDate: "2026-01-01",
      }),
      "2026-01-01",
      "2026-12-31",
    );
    expect(occ).toEqual([
      "2026-01-01",
      "2026-04-01",
      "2026-07-01",
      "2026-10-01",
    ]);
  });

  test("monthly dayOfMonth=31 clamps to Feb 28 in non-leap year", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 31,
        startDate: "2026-01-31",
      }),
      "2026-01-01",
      "2026-04-30",
    );
    expect(occ).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  test("monthly dayOfMonth=31 in leap year Feb 29", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 31,
        startDate: "2028-01-31",
      }),
      "2028-02-01",
      "2028-02-29",
    );
    expect(occ).toEqual(["2028-02-29"]);
  });

  test("monthly never jumps months (clamp, not overflow)", () => {
    // dayOfMonth=31, Feb non-leap → 28 (not Mar 3)
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 31,
        startDate: "2026-01-31",
      }),
      "2026-02-01",
      "2026-02-28",
    );
    expect(occ).toEqual(["2026-02-28"]);
  });

  test("monthly anchor advances past startDate when interval skips into the window", () => {
    // startDate=2026-01-15, interval=6 → anchors at Jan, Jul, Jan(2027), ...
    // Window starts mid-2026, so first anchor in-window is 2026-07-15.
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 6,
        dayOfMonth: 15,
        startDate: "2026-01-15",
      }),
      "2026-04-01",
      "2027-12-31",
    );
    expect(occ).toEqual(["2026-07-15", "2027-01-15", "2027-07-15"]);
  });

  test("monthly skips k=0 candidate that lands before startDate (dayOfMonth < startDate.day)", () => {
    // startDate=2026-01-20, dayOfMonth=10. k=0 candidate = 2026-01-10 < start.
    // First real occurrence is 2026-02-10.
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 10,
        startDate: "2026-01-20",
      }),
      "2026-01-01",
      "2026-04-30",
    );
    expect(occ).toEqual(["2026-02-10", "2026-03-10", "2026-04-10"]);
  });

  test("yearly skips k=0 candidate that lands before startDate (month before startDate.month)", () => {
    // startDate=2026-07-15, monthOfYear=3, dayOfMonth=10.
    // k=0 candidate = 2026-03-10 < start → skip; first emit = 2027-03-10.
    const occ = computeOccurrences(
      rule({
        frequency: "yearly",
        interval: 1,
        monthOfYear: 3,
        dayOfMonth: 10,
        startDate: "2026-07-15",
      }),
      "2026-01-01",
      "2028-12-31",
    );
    expect(occ).toEqual(["2027-03-10", "2028-03-10"]);
  });
});

describe("computeOccurrences — yearly", () => {
  test("yearly fires on the same (M, D) anchored by startDate's year", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "yearly",
        interval: 1,
        monthOfYear: 1,
        dayOfMonth: 5,
        startDate: "2026-01-05",
      }),
      "2025-01-01",
      "2029-12-31",
    );
    expect(occ).toEqual([
      "2026-01-05",
      "2027-01-05",
      "2028-01-05",
      "2029-01-05",
    ]);
  });

  test("yearly interval=2 skips a year", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "yearly",
        interval: 2,
        monthOfYear: 6,
        dayOfMonth: 1,
        startDate: "2026-06-01",
      }),
      "2026-01-01",
      "2032-12-31",
    );
    expect(occ).toEqual([
      "2026-06-01",
      "2028-06-01",
      "2030-06-01",
      "2032-06-01",
    ]);
  });

  test("yearly Feb 29 in non-leap year falls back to Feb 28", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "yearly",
        interval: 1,
        monthOfYear: 2,
        dayOfMonth: 29,
        startDate: "2024-02-29",
      }),
      "2024-01-01",
      "2027-12-31",
    );
    expect(occ).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
    ]);
  });

  test("historic回溯: window in 2020 with start in 2018 emits the in-window years only", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "yearly",
        interval: 1,
        monthOfYear: 3,
        dayOfMonth: 15,
        startDate: "2018-03-15",
      }),
      "2020-01-01",
      "2022-12-31",
    );
    expect(occ).toEqual([
      "2020-03-15",
      "2021-03-15",
      "2022-03-15",
    ]);
  });
});

describe("computeOccurrences — endDate / ended / endedAt ceilings", () => {
  test("endDate < toDate caps the result", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 1,
        startDate: "2026-01-01",
        endDate: "2026-03-31",
      }),
      "2026-01-01",
      "2026-12-31",
    );
    expect(occ).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  test("status='ended' + endedAt caps historic; future not rendered", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 1,
        startDate: "2026-01-01",
        status: "ended",
        endedAt: "2026-03-15",
      }),
      "2026-01-01",
      "2026-12-31",
    );
    // 1/1, 2/1, 3/1 are all ≤ endedAt; 4/1 is > endedAt → excluded
    expect(occ).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  test("status='ended' with BOTH endDate and endedAt takes min", () => {
    // endDate=2026-02-15, endedAt=2026-04-10 → cap at 2026-02-15
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 1,
        startDate: "2026-01-01",
        endDate: "2026-02-15",
        status: "ended",
        endedAt: "2026-04-10",
      }),
      "2026-01-01",
      "2026-12-31",
    );
    expect(occ).toEqual([
      "2026-01-01",
      "2026-02-01",
    ]);
  });

  test("ended with endedAt that's actually after endDate: endDate wins", () => {
    const occ = computeOccurrences(
      rule({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 1,
        startDate: "2026-01-01",
        endDate: "2026-02-15",
        status: "ended",
        endedAt: "2026-05-01",
      }),
      "2026-01-01",
      "2026-12-31",
    );
    expect(occ).toEqual(["2026-01-01", "2026-02-01"]);
  });
});

describe("computeOccurrences — input validation", () => {
  test("interval < 1 throws", () => {
    expect(() =>
      computeOccurrences(rule({ interval: 0 }), "2026-01-01", "2026-12-31"),
    ).toThrow(/interval/);
  });

  test("malformed ISO date throws", () => {
    expect(() =>
      computeOccurrences(rule({}), "2026/01/01", "2026-12-31"),
    ).toThrow(/invalid ISO/);
  });

  test("weekly without weekday throws", () => {
    expect(() =>
      computeOccurrences(
        rule({ frequency: "weekly", weekday: null, startDate: "2026-01-01" }),
        "2026-01-01",
        "2026-01-31",
      ),
    ).toThrow(/weekday/);
  });

  test("monthly without dayOfMonth throws", () => {
    expect(() =>
      computeOccurrences(
        rule({ frequency: "monthly", dayOfMonth: null, startDate: "2026-01-01" }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toThrow(/dayOfMonth/);
  });

  test("yearly without monthOfYear+dayOfMonth throws", () => {
    expect(() =>
      computeOccurrences(
        rule({ frequency: "yearly", monthOfYear: null, dayOfMonth: 1 }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toThrow(/monthOfYear/);
    expect(() =>
      computeOccurrences(
        rule({ frequency: "yearly", monthOfYear: 1, dayOfMonth: null }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toThrow(/dayOfMonth/);
  });
});
