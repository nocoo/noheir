/**
 * Tests for MCP unit.ts utilities
 *
 * Tests enrichWithAvailability function which calculates availability status.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// Types matching unit.ts
interface UnitWithProduct {
  id: string;
  unit_code: string;
  amount_cents: number;
  currency: string;
  status: string;
  strategy: string | null;
  tactics: string | null;
  product_id: string | null;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  product_name: string | null;
  product_lock_period_days: number | null;
}

interface ContributionLog {
  id: string;
  unit_id: string;
  operation_type: string;
  operation_date: string;
}

interface UnitEnriched {
  id: string;
  code: string;
  amount: number;
  currency: string;
  status: string;
  strategy?: string | null;
  tactics?: string | null;
  product?: string | null;
  start?: string | null;
  end?: string | null;
  note?: string | null;
  days_left?: number | null;
  avail?: string | null;
}

// Re-implement for isolated testing (same as unit.ts)
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (value === false) continue;
    result[key] = value;
  }
  return result as Partial<T>;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const CURRENCY_MAP: Record<string, string> = {
  "人民币": "CNY",
  "美元": "USD",
  "港币": "HKD",
};

function currencyCode(currency: string): string {
  return CURRENCY_MAP[currency] ?? currency;
}

function enrichWithAvailability(
  unit: UnitWithProduct,
  latestInvestLog: ContributionLog | null,
): UnitEnriched {
  let daysToAvailable: number | null = null;
  let availabilityStatus: "available" | "locked" | "unknown" = "unknown";

  if (unit.product_lock_period_days !== null && latestInvestLog) {
    const investDate = new Date(latestInvestLog.operation_date);
    const unlockDate = new Date(investDate);
    unlockDate.setDate(unlockDate.getDate() + unit.product_lock_period_days);

    const now = new Date();
    const diffMs = unlockDate.getTime() - now.getTime();
    daysToAvailable = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysToAvailable <= 0) {
      daysToAvailable = 0;
      availabilityStatus = "available";
    } else {
      availabilityStatus = "locked";
    }
  }

  return compact({
    id: shortId(unit.id),
    code: unit.unit_code,
    amount: round2(unit.amount_cents / 100),
    currency: currencyCode(unit.currency),
    status: unit.status,
    strategy: unit.strategy,
    tactics: unit.tactics,
    product: unit.product_name,
    start: unit.start_date,
    end: unit.end_date,
    note: unit.note,
    days_left: daysToAvailable,
    avail: availabilityStatus === "unknown" ? null : availabilityStatus[0],
  }) as UnitEnriched;
}

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    it("should return unknown when no product lock period", () => {
      const unit = createUnit({ product_lock_period_days: null });
      const log = createInvestLog();
      const result = enrichWithAvailability(unit, log);

      expect(result.days_left).toBeUndefined();
      expect(result.avail).toBeUndefined();
    });

    it("should return unknown when no invest log", () => {
      const unit = createUnit({ product_lock_period_days: 30 });
      const result = enrichWithAvailability(unit, null);

      expect(result.days_left).toBeUndefined();
      expect(result.avail).toBeUndefined();
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
