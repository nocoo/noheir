/**
 * Regression guards for the MCP auto-log writer (docs/003 § B2).
 *
 * Three defects shipped to production through this path:
 *   B2a  withdraw wrote a POSITIVE amount_cents (65 rows), so every MCP-logged
 *        exit was counted as a contribution by summarizeByUnit.
 *   B2b  source='mcp' was outside CONTRIBUTION_SOURCES (handled separately by
 *        widening the enum — see Decision K).
 *   B2c  a full ISO timestamp was bound to operation_date, a YYYY-MM-DD column
 *        (132 rows), corrupting the timeline's primary sort key.
 *
 * Asserting on the SQL text keeps this cheap; the handler itself needs a live
 * D1 binding to exercise end to end.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/mcp/tools/unit.ts"), "utf8");

describe("MCP contribution log writer", () => {
  test("withdraw negates amount_cents", () => {
    expect(source).toContain("'withdraw', -amount_cents");
    expect(source).not.toContain("'withdraw', amount_cents");
  });

  test("invest keeps amount_cents positive", () => {
    expect(source).toContain("'invest', amount_cents");
  });

  test("operation_date is bound to a date, not an ISO timestamp", () => {
    expect(source).toMatch(/const logDate = new Date\(\)\.toLocaleDateString\("en-CA"/);
    expect(source).toContain('timeZone: "Asia/Shanghai"');
  });

  test("created_at is bound to epoch ms", () => {
    expect(source).toMatch(/const logNow = Date\.now\(\)/);
  });

  test("no ISO string is reused for both date and timestamp columns", () => {
    expect(source).not.toMatch(/const logNow = new Date\(\)\.toISOString\(\)/);
  });
});
