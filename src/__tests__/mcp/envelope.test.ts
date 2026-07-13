/**
 * Tests for MCP envelope utilities (okWithPage, okWithCompleteness)
 */

import { describe, it, expect } from "vitest";
import {
  ok,
  okWithPage,
  okWithCompleteness,
  type McpToolResult,
  type PageMeta,
  type CompletenessMeta,
  type NextHint,
} from "@/lib/mcp/tools/types";

/** Helper to parse JSON from MCP result */
function parseResult(result: McpToolResult): Record<string, unknown> {
  const first = result.content[0];
  if (!first) throw new Error("No content in result");
  return JSON.parse(first.text);
}

describe("okWithPage", () => {
  it("should merge page metadata into data", () => {
    const page: PageMeta = { returned: 50, total: 200, limit: 50, offset: 0, has_more: true };
    const result = okWithPage({ units: [1, 2, 3] }, page);
    const parsed = parseResult(result);

    expect(parsed.units).toEqual([1, 2, 3]);
    expect(parsed.page).toEqual(page);
    expect(result.isError).toBeUndefined();
  });

  it("should include next hint when provided", () => {
    const page: PageMeta = { returned: 50, total: 200, limit: 50, offset: 0, has_more: true };
    const next: NextHint = { recommended: "paginate", tool: "list_units", args: { offset: 50 } };
    const result = okWithPage({ units: [] }, page, next);
    const parsed = parseResult(result);

    expect(parsed.page).toEqual(page);
    expect(parsed.next).toEqual(next);
  });

  it("should not include next when not provided", () => {
    const page: PageMeta = { returned: 10, total: 10, limit: 50, offset: 0, has_more: false };
    const result = okWithPage({ units: [] }, page);
    const parsed = parseResult(result);

    expect(parsed.next).toBeUndefined();
  });

  it("should handle has_more=false (last page)", () => {
    const page: PageMeta = { returned: 25, total: 75, limit: 50, offset: 50, has_more: false };
    const result = okWithPage({ units: [1] }, page);
    const parsed = parseResult(result);

    expect((parsed.page as PageMeta).has_more).toBe(false);
    expect((parsed.page as PageMeta).total).toBe(75);
  });

  it("should preserve backward-compatible count/limit/offset in data", () => {
    const page: PageMeta = { returned: 50, total: 200, limit: 50, offset: 0, has_more: true };
    const result = okWithPage({ units: [], count: 50, limit: 50, offset: 0 }, page);
    const parsed = parseResult(result);

    // Old fields preserved
    expect(parsed.count).toBe(50);
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
    // New field added
    expect(parsed.page).toEqual(page);
  });
});

describe("okWithCompleteness", () => {
  it("should merge completeness metadata into data", () => {
    const completeness: CompletenessMeta = { complete: true, truncated: false };
    const result = okWithCompleteness({ product: { id: "abc" } }, completeness);
    const parsed = parseResult(result);

    expect(parsed.product).toEqual({ id: "abc" });
    expect(parsed.completeness).toEqual(completeness);
    expect(result.isError).toBeUndefined();
  });

  it("should include total and returned when provided", () => {
    const completeness: CompletenessMeta = {
      complete: true,
      truncated: false,
      total: 3,
      returned: 3,
    };
    const result = okWithCompleteness({ units: [] }, completeness);
    const parsed = parseResult(result);

    expect((parsed.completeness as CompletenessMeta).total).toBe(3);
    expect((parsed.completeness as CompletenessMeta).returned).toBe(3);
  });

  it("should indicate truncation", () => {
    const completeness: CompletenessMeta = {
      complete: false,
      truncated: true,
      total: 1500,
      returned: 1000,
    };
    const result = okWithCompleteness({ units: [] }, completeness);
    const parsed = parseResult(result);

    expect((parsed.completeness as CompletenessMeta).truncated).toBe(true);
    expect((parsed.completeness as CompletenessMeta).complete).toBe(false);
  });

  it("should include next hint for truncated results", () => {
    const completeness: CompletenessMeta = {
      complete: false,
      truncated: true,
      total: 1500,
      returned: 1000,
    };
    const next: NextHint = { recommended: "narrow" };
    const result = okWithCompleteness({ units: [] }, completeness, next);
    const parsed = parseResult(result);

    expect(parsed.next).toEqual(next);
  });

  it("should not include next when not provided", () => {
    const completeness: CompletenessMeta = { complete: true, truncated: false };
    const result = okWithCompleteness({ product: {} }, completeness);
    const parsed = parseResult(result);

    expect(parsed.next).toBeUndefined();
  });
});

describe("envelope consistency", () => {
  it("ok, okWithPage, okWithCompleteness all produce valid MCP results", () => {
    const r1 = ok({ a: 1 });
    const r2 = okWithPage(
      { a: 1 },
      { returned: 1, total: 1, limit: 1, offset: 0, has_more: false },
    );
    const r3 = okWithCompleteness({ a: 1 }, { complete: true, truncated: false });

    for (const r of [r1, r2, r3]) {
      expect(r.content).toHaveLength(1);
      const first = r.content[0];
      expect(first?.type).toBe("text");
      expect(r.isError).toBeUndefined();
      if (first) expect(() => JSON.parse(first.text)).not.toThrow();
    }
  });
});
