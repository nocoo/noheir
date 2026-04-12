/**
 * Tests for MCP types utilities (ok, error helpers)
 */

import { describe, it, expect } from "bun:test";
import { ok, error, type McpToolResult } from "@/lib/mcp/tools/types";

/** Helper to extract text from MCP result */
function getText(result: McpToolResult): string {
  const first = result.content[0];
  if (!first) throw new Error("No content in result");
  return first.text;
}

describe("ok", () => {
  it("should return text content with JSON data", () => {
    const result = ok({ foo: "bar", count: 42 });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe("text");
    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(getText(result));
    expect(parsed).toEqual({ foo: "bar", count: 42 });
  });

  it("should format JSON with indentation", () => {
    const result = ok({ a: 1 });
    expect(getText(result)).toContain("\n");
  });

  it("should handle arrays", () => {
    const result = ok([1, 2, 3]);
    const parsed = JSON.parse(getText(result));
    expect(parsed).toEqual([1, 2, 3]);
  });

  it("should handle nested objects", () => {
    const result = ok({
      level1: {
        level2: {
          value: "deep",
        },
      },
    });
    const parsed = JSON.parse(getText(result));
    expect(parsed.level1.level2.value).toBe("deep");
  });

  it("should handle null", () => {
    const result = ok(null);
    const parsed = JSON.parse(getText(result));
    expect(parsed).toBeNull();
  });

  it("should handle primitives", () => {
    expect(JSON.parse(getText(ok(42)))).toBe(42);
    expect(JSON.parse(getText(ok("hello")))).toBe("hello");
    expect(JSON.parse(getText(ok(true)))).toBe(true);
  });
});

describe("error", () => {
  it("should return error result with message", () => {
    const result = error("Something went wrong");

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe("text");
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(getText(result));
    expect(parsed).toEqual({ error: "Something went wrong" });
  });

  it("should handle empty message", () => {
    const result = error("");
    const parsed = JSON.parse(getText(result));
    expect(parsed).toEqual({ error: "" });
  });

  it("should handle message with special characters", () => {
    const result = error('Error: "quote" and backslash \\');
    const parsed = JSON.parse(getText(result));
    expect(parsed.error).toBe('Error: "quote" and backslash \\');
  });
});
