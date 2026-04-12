/**
 * Tests for MCP compact utilities
 */

import { describe, it, expect } from "bun:test";
import { round2, compact, shortId, compactArray, categoryPath, currencyCode } from "@/lib/mcp/tools/compact";

describe("round2", () => {
  it("should round to 2 decimal places", () => {
    expect(round2(92206.57999999999)).toBe(92206.58);
    expect(round2(100.555)).toBe(100.56);
    expect(round2(100.554)).toBe(100.55);
    expect(round2(100)).toBe(100);
    expect(round2(0.001)).toBe(0);
  });

  it("should handle negative numbers", () => {
    expect(round2(-100.555)).toBe(-100.55);
    expect(round2(-100.554)).toBe(-100.55);
  });

  it("should handle zero", () => {
    expect(round2(0)).toBe(0);
  });
});

describe("compact", () => {
  it("should remove null values", () => {
    const obj = { a: 1, b: null, c: "hello" };
    expect(compact(obj)).toEqual({ a: 1, c: "hello" });
  });

  it("should remove undefined values", () => {
    const obj = { a: 1, b: undefined, c: "hello" };
    expect(compact(obj)).toEqual({ a: 1, c: "hello" });
  });

  it("should remove empty arrays", () => {
    const obj = { a: 1, b: [], c: [1, 2] };
    expect(compact(obj)).toEqual({ a: 1, c: [1, 2] });
  });

  it("should remove false booleans", () => {
    const obj = { a: true, b: false, c: 1 };
    expect(compact(obj)).toEqual({ a: true, c: 1 });
  });

  it("should keep 0 (zero)", () => {
    const obj = { a: 0, b: 1, c: null };
    expect(compact(obj)).toEqual({ a: 0, b: 1 });
  });

  it("should keep empty strings", () => {
    const obj = { a: "", b: "hello", c: null };
    expect(compact(obj)).toEqual({ a: "", b: "hello" });
  });

  it("should handle nested objects (not recurse)", () => {
    const obj = { a: { nested: null }, b: null };
    expect(compact(obj)).toEqual({ a: { nested: null } });
  });
});

describe("shortId", () => {
  it("should return first 8 characters of ULID", () => {
    expect(shortId("01HXYZABCDEFGHIJK")).toBe("01HXYZAB");
  });

  it("should handle short IDs", () => {
    expect(shortId("12345")).toBe("12345");
  });

  it("should handle empty string", () => {
    expect(shortId("")).toBe("");
  });

  it("should handle exactly 8 characters", () => {
    expect(shortId("12345678")).toBe("12345678");
  });
});

describe("compactArray", () => {
  it("should apply compact to each element", () => {
    const arr = [
      { a: 1, b: null },
      { c: 2, d: undefined },
      { e: [], f: "hello" },
    ];
    expect(compactArray(arr)).toEqual([
      { a: 1 },
      { c: 2 },
      { f: "hello" },
    ]);
  });

  it("should handle empty array", () => {
    expect(compactArray([])).toEqual([]);
  });
});

describe("categoryPath", () => {
  it("should join non-null parts with /", () => {
    expect(categoryPath("a", "b", "c")).toBe("a/b/c");
  });

  it("should skip null parts", () => {
    expect(categoryPath("a", null, "c")).toBe("a/c");
  });

  it("should skip undefined parts", () => {
    expect(categoryPath("a", undefined, "c")).toBe("a/c");
  });

  it("should skip empty string parts", () => {
    expect(categoryPath("a", "", "c")).toBe("a/c");
  });

  it("should handle all null/undefined", () => {
    expect(categoryPath(null, undefined, null)).toBe("");
  });

  it("should handle single part", () => {
    expect(categoryPath("only")).toBe("only");
  });

  it("should handle typical category hierarchy", () => {
    expect(categoryPath("日常支出", "小吞金兽", null)).toBe("日常支出/小吞金兽");
  });
});

describe("currencyCode", () => {
  it("should convert Chinese currency names to ISO codes", () => {
    expect(currencyCode("人民币")).toBe("CNY");
    expect(currencyCode("美元")).toBe("USD");
    expect(currencyCode("港币")).toBe("HKD");
    expect(currencyCode("日元")).toBe("JPY");
    expect(currencyCode("欧元")).toBe("EUR");
    expect(currencyCode("英镑")).toBe("GBP");
  });

  it("should pass through unknown currencies", () => {
    expect(currencyCode("CNY")).toBe("CNY");
    expect(currencyCode("USD")).toBe("USD");
    expect(currencyCode("UNKNOWN")).toBe("UNKNOWN");
  });

  it("should handle empty string", () => {
    expect(currencyCode("")).toBe("");
  });
});
