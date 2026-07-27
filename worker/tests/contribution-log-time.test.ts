import { describe, expect, test } from "vitest";
import {
  compareLogsForTimeline,
  normalizeLogTimestamp,
  sortLogsForTimeline,
  type TimelineSortable,
} from "../lib/contribution-log-time";

describe("normalizeLogTimestamp", () => {
  test("null and undefined → null", () => {
    expect(normalizeLogTimestamp(null)).toBeNull();
    expect(normalizeLogTimestamp(undefined)).toBeNull();
  });

  test("Date → getTime, invalid Date → null", () => {
    expect(normalizeLogTimestamp(new Date(1784956591451))).toBe(1784956591451);
    expect(normalizeLogTimestamp(new Date("nope"))).toBeNull();
  });

  test("integer milliseconds pass through", () => {
    // Real production value from an `auto` row.
    expect(normalizeLogTimestamp(1784956591451)).toBe(1784956591451);
    expect(normalizeLogTimestamp(1e12)).toBe(1e12);
  });

  test("integer seconds scale to milliseconds", () => {
    expect(normalizeLogTimestamp(1784956591)).toBe(1784956591000);
    expect(normalizeLogTimestamp(1e12 - 1)).toBe((1e12 - 1) * 1000);
  });

  test("small positive seconds still scale", () => {
    expect(normalizeLogTimestamp(1)).toBe(1000);
    expect(normalizeLogTimestamp(999_999_999)).toBe(999_999_999_000);
  });

  test("zero, negative and non-finite → null", () => {
    expect(normalizeLogTimestamp(0)).toBeNull();
    expect(normalizeLogTimestamp(-5)).toBeNull();
    expect(normalizeLogTimestamp(Number.NaN)).toBeNull();
    expect(normalizeLogTimestamp(Number.POSITIVE_INFINITY)).toBeNull();
  });

  test("all-digit strings recurse as numbers", () => {
    expect(normalizeLogTimestamp("1784956591451")).toBe(1784956591451);
    expect(normalizeLogTimestamp("1784956591")).toBe(1784956591000);
    expect(normalizeLogTimestamp("0")).toBeNull();
  });

  test("ISO-8601 strings parse", () => {
    // Real production value from an `mcp` row.
    expect(normalizeLogTimestamp("2026-07-02T05:51:49.226Z")).toBe(
      Date.parse("2026-07-02T05:51:49.226Z"),
    );
  });

  test("unparseable and empty strings → null", () => {
    expect(normalizeLogTimestamp("not a date")).toBeNull();
    expect(normalizeLogTimestamp("")).toBeNull();
    expect(normalizeLogTimestamp("   ")).toBeNull();
  });

  test("other types → null", () => {
    expect(normalizeLogTimestamp({})).toBeNull();
    expect(normalizeLogTimestamp([])).toBeNull();
    expect(normalizeLogTimestamp(true)).toBeNull();
  });
});

describe("compareLogsForTimeline", () => {
  const row = (o: string, c: number | null, id = "x"): TimelineSortable => ({
    operationDate: o,
    createdAtMs: c,
    id,
  });

  test("operationDate descending wins first", () => {
    expect(compareLogsForTimeline(row("2026-01-01", 1), row("2026-02-01", 9))).toBeGreaterThan(0);
    expect(compareLogsForTimeline(row("2026-03-01", 1), row("2026-02-01", 9))).toBeLessThan(0);
  });

  test("same date → createdAtMs descending", () => {
    expect(compareLogsForTimeline(row("2026-01-01", 100), row("2026-01-01", 200))).toBeGreaterThan(
      0,
    );
    expect(compareLogsForTimeline(row("2026-01-01", 300), row("2026-01-01", 200))).toBeLessThan(0);
  });

  test("null createdAtMs sorts last", () => {
    expect(compareLogsForTimeline(row("2026-01-01", null), row("2026-01-01", 1))).toBeGreaterThan(
      0,
    );
    expect(compareLogsForTimeline(row("2026-01-01", 1), row("2026-01-01", null))).toBeLessThan(0);
  });

  test("both null → falls through to id descending", () => {
    expect(
      compareLogsForTimeline(row("2026-01-01", null, "a"), row("2026-01-01", null, "b")),
    ).toBeGreaterThan(0);
    expect(
      compareLogsForTimeline(row("2026-01-01", null, "b"), row("2026-01-01", null, "a")),
    ).toBeLessThan(0);
  });

  test("fully identical → 0", () => {
    expect(compareLogsForTimeline(row("2026-01-01", 5, "a"), row("2026-01-01", 5, "a"))).toBe(0);
  });
});

describe("sortLogsForTimeline", () => {
  test("does not mutate input", () => {
    const input: TimelineSortable[] = [
      { operationDate: "2026-01-01", createdAtMs: 1, id: "a" },
      { operationDate: "2026-02-01", createdAtMs: 2, id: "b" },
    ];
    const sorted = sortLogsForTimeline(input);
    expect(input[0]?.id).toBe("a");
    expect(sorted[0]?.id).toBe("b");
  });

  test("orders mixed encodings deterministically", () => {
    // Same operationDate, three encodings normalized to comparable ms.
    const logs: TimelineSortable[] = [
      {
        operationDate: "2026-07-02",
        createdAtMs: normalizeLogTimestamp("2026-07-02T05:51:49.226Z"),
        id: "mcp",
      },
      {
        operationDate: "2026-07-02",
        createdAtMs: normalizeLogTimestamp(1784956591451),
        id: "auto",
      },
      {
        operationDate: "2026-07-02",
        createdAtMs: normalizeLogTimestamp(1751435509),
        id: "drizzle",
      },
    ];
    const ids = sortLogsForTimeline(logs).map((l) => l.id);
    // auto 1784956591451ms > mcp 1782971509226ms > drizzle 1751435509s→ms
    expect(ids).toEqual(["auto", "mcp", "drizzle"]);
  });
});
