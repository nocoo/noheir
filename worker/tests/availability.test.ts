import { describe, it, expect } from "bun:test";
import {
  computeAvailability,
  type LatestInvestLog,
  type ProductLockInfo,
} from "../lib/availability";

describe("computeAvailability", () => {
  const today = new Date("2026-04-05");

  describe("data insufficient cases", () => {
    it("returns null availability when no product", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        null,
        today
      );
      expect(result.availableDate).toBeNull();
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBeNull();
      expect(result.latestInvestDate).toBe("2026-04-01");
    });

    it("returns null availability when no invest log", () => {
      const result = computeAvailability(
        null,
        { lockPeriodDays: 30 },
        today
      );
      expect(result.availableDate).toBeNull();
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBeNull();
      expect(result.latestInvestDate).toBeNull();
    });

    it("returns null availability when both are null", () => {
      const result = computeAvailability(null, null, today);
      expect(result.availableDate).toBeNull();
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBeNull();
      expect(result.latestInvestDate).toBeNull();
    });
  });

  describe("locked unit (positive daysUntilAvailable)", () => {
    it("calculates locked state correctly", () => {
      // Invested on 2026-04-01, lock 30 days → available 2026-05-01
      // Today is 2026-04-05 → 26 days until available
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        { lockPeriodDays: 30 },
        today
      );
      expect(result.availableDate).toBe("2026-05-01");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(26);
      expect(result.latestInvestDate).toBe("2026-04-01");
    });

    it("handles lock period of 1 day", () => {
      // Invested on 2026-04-05, lock 1 day → available 2026-04-06
      // Today is 2026-04-05 → 1 day until available
      const result = computeAvailability(
        { operationDate: "2026-04-05" },
        { lockPeriodDays: 1 },
        today
      );
      expect(result.availableDate).toBe("2026-04-06");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(1);
    });
  });

  describe("available unit (zero or negative daysUntilAvailable)", () => {
    it("returns available when lock period is 0", () => {
      // Invested on 2026-04-01, lock 0 days → available 2026-04-01
      // Today is 2026-04-05 → -4 days (available since 4 days ago)
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        { lockPeriodDays: 0 },
        today
      );
      expect(result.availableDate).toBe("2026-04-01");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(-4);
    });

    it("returns available when lock period is null (treated as 0)", () => {
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        { lockPeriodDays: null },
        today
      );
      expect(result.availableDate).toBe("2026-04-01");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(-4);
    });

    it("returns available when today equals available date (0 days)", () => {
      // Invested on 2026-04-01, lock 4 days → available 2026-04-05
      // Today is 2026-04-05 → 0 days
      const result = computeAvailability(
        { operationDate: "2026-04-01" },
        { lockPeriodDays: 4 },
        today
      );
      expect(result.availableDate).toBe("2026-04-05");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(0);
    });

    it("returns available when past the available date (negative days)", () => {
      // Invested on 2026-03-01, lock 30 days → available 2026-03-31
      // Today is 2026-04-05 → -5 days (available since 5 days ago)
      const result = computeAvailability(
        { operationDate: "2026-03-01" },
        { lockPeriodDays: 30 },
        today
      );
      expect(result.availableDate).toBe("2026-03-31");
      expect(result.isAvailable).toBe(true);
      expect(result.daysUntilAvailable).toBe(-5);
    });
  });

  describe("edge cases", () => {
    it("handles year boundary correctly", () => {
      // Invested on 2025-12-15, lock 30 days → available 2026-01-14
      const decemberToday = new Date("2026-01-10");
      const result = computeAvailability(
        { operationDate: "2025-12-15" },
        { lockPeriodDays: 30 },
        decemberToday
      );
      expect(result.availableDate).toBe("2026-01-14");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(4);
    });

    it("handles leap year correctly", () => {
      // 2024 is a leap year
      // Invested on 2024-02-28, lock 1 day → available 2024-02-29
      const leapToday = new Date("2024-02-28");
      const result = computeAvailability(
        { operationDate: "2024-02-28" },
        { lockPeriodDays: 1 },
        leapToday
      );
      expect(result.availableDate).toBe("2024-02-29");
      expect(result.isAvailable).toBe(false);
      expect(result.daysUntilAvailable).toBe(1);
    });

    it("handles long lock periods", () => {
      // Invested on 2026-01-01, lock 365 days → available 2027-01-01
      const result = computeAvailability(
        { operationDate: "2026-01-01" },
        { lockPeriodDays: 365 },
        today
      );
      expect(result.availableDate).toBe("2027-01-01");
      expect(result.isAvailable).toBe(false);
      // 2026-04-05 to 2027-01-01 = 271 days
      expect(result.daysUntilAvailable).toBe(271);
    });
  });
});
