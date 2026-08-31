import { describe, expect, it } from "vitest";
import { computeAvailability } from "../lib/availability";

describe("computeAvailability", () => {
  const today = new Date("2026-04-05");

  describe("data insufficient cases", () => {
    it("returns null availability when no product", () => {
      const result = computeAvailability({ operationDate: "2026-04-01" }, null, today);
      expect(result.availableDate).toBeNull();
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBeNull();
      expect(result.daysUntilLocked).toBeNull();
      expect(result.latestInvestDate).toBe("2026-04-01");
    });

    it("returns null availability when no invest log", () => {
      const result = computeAvailability(
        null,
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBeNull();
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBeNull();
      expect(result.daysUntilLocked).toBeNull();
      expect(result.latestInvestDate).toBeNull();
    });

    it("returns null availability when both are null", () => {
      const result = computeAvailability(null, null, today);
      expect(result.availableDate).toBeNull();
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBeNull();
      expect(result.daysUntilLocked).toBeNull();
      expect(result.latestInvestDate).toBeNull();
    });
  });

  describe("locked unit (positive daysUntilAvailable)", () => {
    it("calculates locked state correctly", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBe("2026-05-01");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(26);
      expect(result.daysUntilLocked).toBeNull();
      expect(result.latestInvestDate).toBe("2026-04-01");
    });

    it("handles lock period of 1 day", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-05" },
        { lockPeriodDays: 1, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBe("2026-04-06");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(1);
    });
  });

  describe("available unit (zero or negative daysUntilAvailable)", () => {
    it("returns available when lock period is 0", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        { lockPeriodDays: 0, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBe("2026-04-01");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(-4);
      expect(result.daysUntilLocked).toBeNull();
    });

    it("returns available when lock period is null (treated as 0)", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        { lockPeriodDays: null, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBe("2026-04-01");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(-4);
      expect(result.daysUntilLocked).toBeNull();
    });

    it("returns available when today equals available date (0 days)", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        { lockPeriodDays: 4, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBe("2026-04-05");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(0);
    });

    it("returns available when past the available date (negative days)", () => {
      const result = computeAvailability(
        { operationDate: "2026-03-01" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBe("2026-03-31");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(-5);
    });
  });

  describe("edge cases", () => {
    it("handles year boundary correctly", () => {
      const decemberToday = new Date("2026-01-10");
      const result = computeAvailability(
        { operationDate: "2025-12-15" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        decemberToday,
      );
      expect(result.availableDate).toBe("2026-01-14");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(4);
    });

    it("handles leap year correctly", () => {
      const leapToday = new Date("2024-02-28");
      const result = computeAvailability(
        { operationDate: "2024-02-28" },
        { lockPeriodDays: 1, openDays: null, cycleDays: null },
        leapToday,
      );
      expect(result.availableDate).toBe("2024-02-29");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(1);
    });

    it("handles long lock periods", () => {
      const result = computeAvailability(
        { operationDate: "2026-01-01" },
        { lockPeriodDays: 365, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBe("2027-01-01");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(271);
    });
  });

  // ── Cyclic lock tests ──

  describe("cyclic lock — initial lock period", () => {
    it("stays locked during initial period even with cycle config", () => {
      // lockPeriodDays=365, openDays=3, cycleDays=30
      // Invested 2026-01-01, unlock 2027-01-01, today 2026-04-05 → still locked
      const result = computeAvailability(
        { operationDate: "2026-01-01" },
        { lockPeriodDays: 365, openDays: 3, cycleDays: 30 },
        today,
      );
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(271);
      expect(result.daysUntilLocked).toBeNull();
    });
  });

  describe("cyclic lock — open window", () => {
    it("is available on the first day of the first open window", () => {
      // lockPeriodDays=10, openDays=3, cycleDays=30
      // Invested 2026-03-20, unlock 2026-03-30
      // Today 2026-03-30 → day 0 since unlock → positionInCycle=0 < openDays=3 → OPEN
      // availableDate = window start = today - 0 = 2026-03-30
      const result = computeAvailability(
        { operationDate: "2026-03-20" },
        { lockPeriodDays: 10, openDays: 3, cycleDays: 30 },
        new Date("2026-03-30"),
      );
      expect(result.availableDate).toBe("2026-03-30");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(0);
      expect(result.daysUntilLocked).toBe(3);
    });

    it("is available in the middle of an open window", () => {
      // Same config, today 2026-03-31 → day 1, positionInCycle=1 < 3 → OPEN
      // availableDate = window start = today - 1 = 2026-03-30
      const result = computeAvailability(
        { operationDate: "2026-03-20" },
        { lockPeriodDays: 10, openDays: 3, cycleDays: 30 },
        new Date("2026-03-31"),
      );
      expect(result.availableDate).toBe("2026-03-30");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(0);
      expect(result.daysUntilLocked).toBe(2);
    });

    it("is available on the last day of the open window", () => {
      // Today 2026-04-01 → day 2, positionInCycle=2 < 3 → OPEN
      // availableDate = window start = today - 2 = 2026-03-30
      const result = computeAvailability(
        { operationDate: "2026-03-20" },
        { lockPeriodDays: 10, openDays: 3, cycleDays: 30 },
        new Date("2026-04-01"),
      );
      expect(result.availableDate).toBe("2026-03-30");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(0);
      expect(result.daysUntilLocked).toBe(1);
    });

    it("reports daysUntilLocked correctly in a later cycle", () => {
      // Today 2026-04-29 → day 30, positionInCycle=30%30=0 → OPEN, cycle 2
      // availableDate = window start = today - 0 = 2026-04-29
      const result = computeAvailability(
        { operationDate: "2026-03-20" },
        { lockPeriodDays: 10, openDays: 3, cycleDays: 30 },
        new Date("2026-04-29"),
      );
      expect(result.availableDate).toBe("2026-04-29");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(0);
      expect(result.daysUntilLocked).toBe(3);
    });
  });

  describe("cyclic lock — locked window", () => {
    it("is locked on the first day of the locked window", () => {
      // Today 2026-04-02 → day 3, positionInCycle=3 >= openDays=3 → LOCKED
      // daysUntilAvailable = 30 - 3 = 27, availableDate = today + 27 = 2026-04-29
      const result = computeAvailability(
        { operationDate: "2026-03-20" },
        { lockPeriodDays: 10, openDays: 3, cycleDays: 30 },
        new Date("2026-04-02"),
      );
      expect(result.availableDate).toBe("2026-04-29");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(27);
      expect(result.daysUntilLocked).toBeNull();
    });

    it("is locked in the middle of the locked window", () => {
      // Today 2026-04-15 → day 16, positionInCycle=16 >= 3 → LOCKED
      // daysUntilAvailable = 30 - 16 = 14, availableDate = today + 14 = 2026-04-29
      const result = computeAvailability(
        { operationDate: "2026-03-20" },
        { lockPeriodDays: 10, openDays: 3, cycleDays: 30 },
        new Date("2026-04-15"),
      );
      expect(result.availableDate).toBe("2026-04-29");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(14);
      expect(result.daysUntilLocked).toBeNull();
    });

    it("is locked on the last day before the next open window", () => {
      // Today 2026-04-28 → day 29, positionInCycle=29 >= 3 → LOCKED
      // daysUntilAvailable = 30 - 29 = 1, availableDate = today + 1 = 2026-04-29
      const result = computeAvailability(
        { operationDate: "2026-03-20" },
        { lockPeriodDays: 10, openDays: 3, cycleDays: 30 },
        new Date("2026-04-28"),
      );
      expect(result.availableDate).toBe("2026-04-29");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(1);
      expect(result.daysUntilLocked).toBeNull();
    });
  });

  describe("cyclic lock — backward compatibility", () => {
    it("permanently unlocked when openDays is null", () => {
      const result = computeAvailability(
        { operationDate: "2026-03-01" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        today,
      );
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(-5);
      expect(result.daysUntilLocked).toBeNull();
    });

    it("permanently unlocked when cycleDays is null", () => {
      const result = computeAvailability(
        { operationDate: "2026-03-01" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        today,
      );
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilLocked).toBeNull();
    });
  });

  // The Workers runtime is UTC while operation_date is stamped in
  // Asia/Shanghai, so between 00:00 and 08:00 CST the two disagree on what
  // "today" is. These pin the Shanghai calendar day as the only reference.
  describe("timezone boundary", () => {
    // 2026-07-28T23:52Z is already 2026-07-29 in Shanghai.
    const earlyMorningCST = new Date("2026-07-28T23:52:00Z");

    it("counts from the Shanghai day, not the UTC day", () => {
      const result = computeAvailability(
        { operationDate: "2026-07-29" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        earlyMorningCST,
      );
      expect(result.daysUntilAvailable).toBe(30);
      expect(result.availableDate).toBe("2026-08-28");
    });

    it("unlocks on the Shanghai day the lock expires", () => {
      const result = computeAvailability(
        { operationDate: "2026-07-22" },
        { lockPeriodDays: 7, openDays: null, cycleDays: null },
        earlyMorningCST,
      );
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(0);
    });

    it("agrees across the 08:00 CST boundary", () => {
      const before = computeAvailability(
        { operationDate: "2026-07-29" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        new Date("2026-07-28T23:52:00Z"),
      );
      const after = computeAvailability(
        { operationDate: "2026-07-29" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        new Date("2026-07-29T00:30:00Z"),
      );
      expect(before.daysUntilAvailable).toBe(after.daysUntilAvailable);
      expect(before.availableDate).toBe(after.availableDate);
    });
  });

  describe("availableDateOverride", () => {
    const product = { lockPeriodDays: 30, openDays: null, cycleDays: null };

    it("trims ISO timestamps in operation_date before adding lock days", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-01T05:51:49.226Z" },
        { lockPeriodDays: 30, openDays: null, cycleDays: null },
        today,
      );
      expect(result.availableDate).toBe("2026-05-01");
      expect(result.daysUntilAvailable).toBe(26);
    });

    it("uses the override as the unlock date instead of invest+lock", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        product,
        today,
        "2026-06-01",
      );
      expect(result.availableDate).toBe("2026-06-01");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(57);
      expect(result.latestInvestDate).toBe("2026-04-01");
    });

    it("does not require an invest log when an override is set", () => {
      const result = computeAvailability(null, product, today, "2026-04-05");
      expect(result.availableDate).toBe("2026-04-05");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(0);
      expect(result.latestInvestDate).toBeNull();
    });

    it("does not require a product when an override is set", () => {
      const result = computeAvailability(
        { operationDate: "2026-01-01" },
        null,
        today,
        "2026-04-01",
      );
      expect(result.availableDate).toBe("2026-04-01");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(-4);
    });

    it("still applies cyclic windows after the override unlock date", () => {
      const result = computeAvailability(
        { operationDate: "2026-03-20" },
        { lockPeriodDays: 90, openDays: 3, cycleDays: 30 },
        new Date("2026-03-30"),
        "2026-03-30",
      );
      expect(result.availableDate).toBe("2026-03-30");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilLocked).toBe(3);
    });
  });
});
