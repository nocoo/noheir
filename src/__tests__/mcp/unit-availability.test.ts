/**
 * Tests for MCP unit.ts utilities
 *
 * Tests enrichWithAvailability function which calculates availability status.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ContributionLog,
  enrichWithAvailability,
  investLogPredicate,
  type UnitWithProduct,
} from "@/lib/mcp/tools/unit";

// Test data factory
function createUnit(overrides: Partial<UnitWithProduct> = {}): UnitWithProduct {
  return {
    id: "01HXYZABCDEFGHIJKLMNOPQRST",
    unit_code: "C01",
    amount_cents: 1000000,
    currency: "CNY",
    status: "已成立",
    strategy: "远期理财",
    tactics: "定期存款",
    product_id: "01PRODUCT123456789012345",
    start_date: "2024-01-15",
    end_date: null,
    note: "Test unit",
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
    product_name: "Test Product",
    product_lock_period_days: 30,
    available_date_override: null,
    ...overrides,
  };
}

function createInvestLog(overrides: Partial<ContributionLog> = {}): ContributionLog {
  return {
    id: "01LOG1234567890123456789",
    unit_id: "01HXYZABCDEFGHIJKLMNOPQRST",
    operation_type: "invest",
    operation_date: "2024-01-15",
    ...overrides,
  };
}

describe("investLogPredicate", () => {
  it("always excludes soft-deleted invest rows", () => {
    expect(investLogPredicate()).toBe("operation_type = 'invest' AND deleted_at IS NULL");
    expect(investLogPredicate("cl")).toBe("cl.operation_type = 'invest' AND cl.deleted_at IS NULL");
  });

  it("is interpolated at every MCP latest-invest query site", () => {
    const unitSrc = readFileSync("src/lib/mcp/tools/unit.ts", "utf8");
    const portfolioSrc = readFileSync("src/lib/mcp/tools/portfolio.ts", "utf8");
    const call = (alias: string) => `investLogPredicate(${alias})`;
    expect(unitSrc.split(call("")).length).toBeGreaterThan(2);
    expect(unitSrc.split(call('"cl"')).length).toBeGreaterThan(1);
    expect(portfolioSrc.split(call("")).length).toBeGreaterThan(1);
    expect(portfolioSrc.split(call('"cl"')).length).toBeGreaterThan(1);
  });
});

describe("enrichWithAvailability", () => {
  // Save and restore Date constructor for deterministic tests
  let OriginalDate: DateConstructor;

  beforeEach(() => {
    OriginalDate = globalThis.Date;
  });

  afterEach(() => {
    globalThis.Date = OriginalDate;
  });

  function mockDate(isoString: string) {
    const mockNow = new OriginalDate(isoString).getTime();
    const MockDate = class extends OriginalDate {
      constructor(...args: Parameters<DateConstructor>) {
        if (args.length === 0) {
          super(mockNow);
        } else {
          super(...(args as unknown as [any]));
        }
      }
      static override now() {
        return mockNow;
      }
    } as DateConstructor;
    globalThis.Date = MockDate;
  }

  describe("basic enrichment", () => {
    it("should shorten ID to 8 characters", () => {
      const unit = createUnit();
      const result = enrichWithAvailability(unit, null);
      expect(result.id).toBe("01HXYZAB");
    });

    it("should convert amount from cents to decimal", () => {
      const unit = createUnit({ amount_cents: 1234567 });
      const result = enrichWithAvailability(unit, null);
      expect(result.amount).toBe(12345.67);
    });

    it("should convert Chinese currency to ISO code", () => {
      const unit = createUnit({ currency: "人民币" });
      const result = enrichWithAvailability(unit, null);
      expect(result.currency).toBe("CNY");
    });

    it("should pass through ISO currency codes", () => {
      const unit = createUnit({ currency: "USD" });
      const result = enrichWithAvailability(unit, null);
      expect(result.currency).toBe("USD");
    });

    it("should include product name", () => {
      const unit = createUnit({ product_name: "My Product" });
      const result = enrichWithAvailability(unit, null);
      expect(result.product).toBe("My Product");
    });

    it("should omit null fields", () => {
      const unit = createUnit({
        strategy: null,
        tactics: null,
        note: null,
        product_name: null,
      });
      const result = enrichWithAvailability(unit, null);

      expect(result.strategy).toBeUndefined();
      expect(result.tactics).toBeUndefined();
      expect(result.note).toBeUndefined();
      expect(result.product).toBeUndefined();
    });
  });

  describe("availability calculation", () => {
    it("treats a null lock period as 0 days, matching the Worker", () => {
      mockDate("2026-04-05T12:00:00Z");
      const unit = createUnit({ product_lock_period_days: null });
      const log = createInvestLog({ operation_date: "2026-04-01" });
      const result = enrichWithAvailability(unit, log);

      expect(result.days_left).toBe(0);
      expect(result.avail).toBe("a");
    });

    it("should return unknown when no invest log", () => {
      const unit = createUnit({ product_lock_period_days: 30 });
      const result = enrichWithAvailability(unit, null);

      expect(result.days_left).toBeUndefined();
      expect(result.avail).toBeUndefined();
    });

    it("should use available_date_override instead of invest+lock", () => {
      mockDate("2026-04-05T12:00:00Z");
      const unit = createUnit({
        product_lock_period_days: 30,
        available_date_override: "2026-06-01",
      });
      // Invest+lock would already be available (unlock 2026-01-31).
      const log = createInvestLog({ operation_date: "2026-01-01" });
      const result = enrichWithAvailability(unit, log);

      expect(result.avail).toBe("l");
      expect(result.days_left).toBe(57);
    });

    it("applies cyclic closed windows the same way the Worker does", () => {
      mockDate("2026-04-15T12:00:00Z");
      const unit = createUnit({
        product_lock_period_days: 10,
        product_open_days: 3,
        product_cycle_days: 30,
      });
      const log = createInvestLog({ operation_date: "2026-03-20" });
      const result = enrichWithAvailability(unit, log);

      expect(result.avail).toBe("l");
      expect(result.days_left).toBe(14);
    });

    it("should return available when lock period expired", () => {
      // Mock: now is 2024-03-01, invested on 2024-01-15, lock period 30 days
      // Unlock date: 2024-02-14, which is in the past
      mockDate("2024-03-01T12:00:00Z");

      const unit = createUnit({ product_lock_period_days: 30 });
      const log = createInvestLog({ operation_date: "2024-01-15" });
      const result = enrichWithAvailability(unit, log);

      expect(result.days_left).toBe(0);
      expect(result.avail).toBe("a");
    });

    it("should return locked with days remaining when in lock period", () => {
      // Mock: now is 2024-01-20, invested on 2024-01-15, lock period 30 days
      // Unlock date: 2024-02-14, 25 days from now
      mockDate("2024-01-20T12:00:00Z");

      const unit = createUnit({ product_lock_period_days: 30 });
      const log = createInvestLog({ operation_date: "2024-01-15" });
      const result = enrichWithAvailability(unit, log);

      expect(result.days_left).toBe(25);
      expect(result.avail).toBe("l");
    });

    it("should return available when exactly at unlock date", () => {
      // Mock: now is 2024-02-14, invested on 2024-01-15, lock period 30 days
      // Unlock date: 2024-02-14, days_left should be 0
      mockDate("2024-02-14T12:00:00Z");

      const unit = createUnit({ product_lock_period_days: 30 });
      const log = createInvestLog({ operation_date: "2024-01-15" });
      const result = enrichWithAvailability(unit, log);

      expect(result.days_left).toBe(0);
      expect(result.avail).toBe("a");
    });

    it("should handle 0 day lock period", () => {
      mockDate("2024-01-15T12:00:00Z");

      const unit = createUnit({ product_lock_period_days: 0 });
      const log = createInvestLog({ operation_date: "2024-01-15" });
      const result = enrichWithAvailability(unit, log);

      expect(result.days_left).toBe(0);
      expect(result.avail).toBe("a");
    });

    it("should handle long lock periods", () => {
      // Mock: now is 2024-01-20, invested on 2024-01-15, lock period 365 days
      mockDate("2024-01-20T12:00:00Z");

      const unit = createUnit({ product_lock_period_days: 365 });
      const log = createInvestLog({ operation_date: "2024-01-15" });
      const result = enrichWithAvailability(unit, log);

      expect(result.days_left).toBe(360);
      expect(result.avail).toBe("l");
    });
  });

  describe("edge cases", () => {
    it("should handle unit with all optional fields null", () => {
      const unit = createUnit({
        strategy: null,
        tactics: null,
        product_id: null,
        start_date: null,
        end_date: null,
        note: null,
        product_name: null,
        product_lock_period_days: null,
      });
      const result = enrichWithAvailability(unit, null);

      expect(result.id).toBeDefined();
      expect(result.code).toBe("C01");
      expect(result.amount).toBe(10000);
      expect(result.currency).toBe("CNY");
      expect(result.status).toBe("已成立");
    });

    it("should handle floating point precision in amount", () => {
      const unit = createUnit({ amount_cents: 9220657 });
      const result = enrichWithAvailability(unit, null);
      expect(result.amount).toBe(92206.57);
    });

    it("should preserve status field exactly", () => {
      const statuses = ["已成立", "已清算", "已归档"];
      for (const status of statuses) {
        const unit = createUnit({ status });
        const result = enrichWithAvailability(unit, null);
        expect(result.status).toBe(status);
      }
    });
  });
});
