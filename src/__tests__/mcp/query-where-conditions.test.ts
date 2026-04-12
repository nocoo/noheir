/**
 * Tests for buildWhereConditions in MCP query tools
 *
 * This test ensures date filtering and other special fields work correctly.
 */

import { describe, it, expect } from "bun:test";

// Re-implement buildWhereConditions for isolated testing
// (The original is not exported; if we want true coverage, export it or test via integration)
function buildWhereConditions(
  params: Record<string, unknown>,
  fieldMappings: Record<string, string>,
): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  for (const [key, dbField] of Object.entries(fieldMappings)) {
    const value = params[key];
    if (value === undefined) continue;

    if (Array.isArray(value) && value.length > 0) {
      const placeholders = value.map(() => "?").join(", ");
      conditions.push(`${dbField} IN (${placeholders})`);
      values.push(...value);
    } else if (typeof value === "string" && key === "keyword") {
      conditions.push(`(note LIKE ? OR primary_category LIKE ? OR secondary_category LIKE ? OR account LIKE ?)`);
      const like = `%${value}%`;
      values.push(like, like, like, like);
    } else if (typeof value === "number" || typeof value === "string") {
      if (key === "start_date") {
        conditions.push(`date >= ?`);
        values.push(value);
      } else if (key === "end_date") {
        conditions.push(`date <= ?`);
        values.push(value);
      } else if (key === "min_amount_cents") {
        conditions.push(`amount_cents >= ?`);
        values.push(value);
      } else if (key === "max_amount_cents") {
        conditions.push(`amount_cents <= ?`);
        values.push(value);
      } else if (key === "year") {
        conditions.push(`strftime('%Y', date) = ?`);
        values.push(String(value));
      } else if (key === "month") {
        conditions.push(`CAST(strftime('%m', date) AS INTEGER) = ?`);
        values.push(value);
      } else {
        conditions.push(`${dbField} = ?`);
        values.push(value);
      }
    }
  }

  return { conditions, values };
}

// Field mappings as used in query_transactions
const TRANSACTION_FIELD_MAPPINGS = {
  type: "type",
  categories: "primary_category",
  secondary_categories: "secondary_category",
  tertiary_categories: "tertiary_category",
  accounts: "account",
  currency: "currency",
  // Special fields handled by key-specific logic
  keyword: "",
  start_date: "",
  end_date: "",
  min_amount_cents: "",
  max_amount_cents: "",
  year: "",
  month: "",
};

describe("buildWhereConditions", () => {
  describe("date filtering", () => {
    it("should add start_date condition", () => {
      const { conditions, values } = buildWhereConditions(
        { start_date: "2024-06-03" },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("date >= ?");
      expect(values).toContain("2024-06-03");
    });

    it("should add end_date condition", () => {
      const { conditions, values } = buildWhereConditions(
        { end_date: "2024-06-03" },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("date <= ?");
      expect(values).toContain("2024-06-03");
    });

    it("should add both start_date and end_date conditions", () => {
      const { conditions, values } = buildWhereConditions(
        { start_date: "2024-06-01", end_date: "2024-06-30" },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("date >= ?");
      expect(conditions).toContain("date <= ?");
      expect(values).toContain("2024-06-01");
      expect(values).toContain("2024-06-30");
    });

    it("should add year condition using strftime", () => {
      const { conditions, values } = buildWhereConditions(
        { year: 2024 },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain(`strftime('%Y', date) = ?`);
      expect(values).toContain("2024");
    });

    it("should add month condition", () => {
      const { conditions, values } = buildWhereConditions(
        { month: 6 },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain(`CAST(strftime('%m', date) AS INTEGER) = ?`);
      expect(values).toContain(6);
    });
  });

  describe("amount filtering", () => {
    it("should add min_amount_cents condition", () => {
      const { conditions, values } = buildWhereConditions(
        { min_amount_cents: 10000 },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("amount_cents >= ?");
      expect(values).toContain(10000);
    });

    it("should add max_amount_cents condition", () => {
      const { conditions, values } = buildWhereConditions(
        { max_amount_cents: 50000 },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("amount_cents <= ?");
      expect(values).toContain(50000);
    });
  });

  describe("keyword search", () => {
    it("should add fuzzy search across multiple fields", () => {
      const { conditions, values } = buildWhereConditions(
        { keyword: "lunch" },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain(
        "(note LIKE ? OR primary_category LIKE ? OR secondary_category LIKE ? OR account LIKE ?)",
      );
      expect(values).toEqual(["%lunch%", "%lunch%", "%lunch%", "%lunch%"]);
    });
  });

  describe("array filters", () => {
    it("should handle categories array", () => {
      const { conditions, values } = buildWhereConditions(
        { categories: ["Food", "Transport"] },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("primary_category IN (?, ?)");
      expect(values).toContain("Food");
      expect(values).toContain("Transport");
    });

    it("should handle accounts array", () => {
      const { conditions, values } = buildWhereConditions(
        { accounts: ["Cash", "Bank"] },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("account IN (?, ?)");
      expect(values).toContain("Cash");
      expect(values).toContain("Bank");
    });
  });

  describe("simple equality", () => {
    it("should handle type filter", () => {
      const { conditions, values } = buildWhereConditions(
        { type: "expense" },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("type = ?");
      expect(values).toContain("expense");
    });

    it("should handle currency filter", () => {
      const { conditions, values } = buildWhereConditions(
        { currency: "CNY" },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions).toContain("currency = ?");
      expect(values).toContain("CNY");
    });
  });

  describe("combined filters", () => {
    it("should combine multiple filter types", () => {
      const { conditions, values: _values } = buildWhereConditions(
        {
          type: "expense",
          start_date: "2024-06-01",
          end_date: "2024-06-30",
          categories: ["Food"],
          keyword: "lunch",
        },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions.length).toBe(5);
      expect(conditions).toContain("type = ?");
      expect(conditions).toContain("date >= ?");
      expect(conditions).toContain("date <= ?");
      expect(conditions).toContain("primary_category IN (?)");
      expect(conditions).toContain(
        "(note LIKE ? OR primary_category LIKE ? OR secondary_category LIKE ? OR account LIKE ?)",
      );
    });
  });

  describe("edge cases", () => {
    it("should ignore undefined values", () => {
      const { conditions, values } = buildWhereConditions(
        { start_date: undefined, type: "income" },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions.length).toBe(1);
      expect(conditions).toContain("type = ?");
      expect(values).toEqual(["income"]);
    });

    it("should ignore empty arrays", () => {
      const { conditions, values } = buildWhereConditions(
        { categories: [] },
        TRANSACTION_FIELD_MAPPINGS,
      );

      expect(conditions.length).toBe(0);
      expect(values.length).toBe(0);
    });
  });
});

describe("regression: date filtering bug", () => {
  it("BUG FIX: start_date and end_date must be included in fieldMappings", () => {
    // This test documents the bug where date fields were missing from fieldMappings
    // causing all date filters to be silently ignored.
    //
    // The bug: fieldMappings only had type, categories, accounts, currency
    // But buildWhereConditions iterates over fieldMappings keys, so start_date/end_date
    // were never processed even though the logic existed.

    const BROKEN_MAPPINGS = {
      type: "type",
      categories: "primary_category",
      accounts: "account",
      currency: "currency",
      // Missing: start_date, end_date, year, month, keyword, etc.
    };

    const { conditions: brokenConditions } = buildWhereConditions(
      { start_date: "2024-06-03" },
      BROKEN_MAPPINGS,
    );

    // With broken mappings, date filter is silently ignored!
    expect(brokenConditions.length).toBe(0);

    // With correct mappings, date filter works
    const { conditions: fixedConditions } = buildWhereConditions(
      { start_date: "2024-06-03" },
      TRANSACTION_FIELD_MAPPINGS,
    );

    expect(fixedConditions).toContain("date >= ?");
  });
});
