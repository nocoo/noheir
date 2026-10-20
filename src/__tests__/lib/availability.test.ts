import { describe, expect, it } from "vitest";
import { computeAvailability, type ProductLockInfo } from "@/lib/availability";

const today = new Date("2026-09-23T12:00:00+08:00");
const product: ProductLockInfo = { lockPeriodDays: 2, openDays: 3, cycleDays: 7 };
const investLog = { operationDate: "2026-09-18" };

describe("computeAvailability", () => {
  it.each([
    { log: null, product: null, latestInvestDate: null },
    { log: null, product, latestInvestDate: null },
    { log: investLog, product: null, latestInvestDate: investLog.operationDate },
  ])("keeps availability unknown without both product and investment history: %j", (input) => {
    expect(computeAvailability(input.log, input.product, today)).toEqual({
      availableDate: null,
      isAvailable: false,
      daysUntilAvailable: null,
      daysUntilLocked: null,
      latestInvestDate: input.latestInvestDate,
    });
  });

  it("uses an explicit unlock date without requiring product or investment history", () => {
    expect(computeAvailability(null, null, today, "2026-09-23")).toEqual({
      availableDate: "2026-09-23",
      isAvailable: true,
      daysUntilAvailable: 0,
      daysUntilLocked: null,
      latestInvestDate: null,
    });
  });

  it("uses the override as the cyclic window anchor instead of the investment lock period", () => {
    expect(
      computeAvailability(investLog, { ...product, lockPeriodDays: 90 }, today, "2026-09-20"),
    ).toEqual({
      availableDate: "2026-09-27",
      isAvailable: false,
      daysUntilAvailable: 4,
      daysUntilLocked: null,
      latestInvestDate: investLog.operationDate,
    });
  });

  it("keeps a future override locked even if the investment would already be unlocked", () => {
    expect(computeAvailability(investLog, product, today, "2026-09-25")).toEqual({
      availableDate: "2026-09-25",
      isAvailable: false,
      daysUntilAvailable: 2,
      daysUntilLocked: null,
      latestInvestDate: investLog.operationDate,
    });
  });

  it("adds lock days across leap day before calculating the unlock countdown", () => {
    expect(
      computeAvailability(
        { operationDate: "2024-02-28" },
        product,
        new Date("2024-02-29T12:00:00+08:00"),
      ),
    ).toEqual({
      availableDate: "2024-03-01",
      isAvailable: false,
      daysUntilAvailable: 1,
      daysUntilLocked: null,
      latestInvestDate: "2024-02-28",
    });
  });

  it.each([
    { lockPeriodDays: null, openDays: null, cycleDays: null },
    { lockPeriodDays: 0, openDays: null, cycleDays: 7 },
    { lockPeriodDays: 0, openDays: 3, cycleDays: null },
  ])("keeps funds available without a complete recurring window: %j", (nonCyclicProduct) => {
    expect(computeAvailability(investLog, nonCyclicProduct, today)).toEqual({
      availableDate: "2026-09-18",
      isAvailable: true,
      daysUntilAvailable: -5,
      daysUntilLocked: null,
      latestInvestDate: investLog.operationDate,
    });
  });

  it.each([
    ["2026-09-20", "2026-09-20", true, 0, 3],
    ["2026-09-22", "2026-09-20", true, 0, 1],
    ["2026-09-23", "2026-09-27", false, 4, null],
    ["2026-09-26", "2026-09-27", false, 1, null],
    ["2026-09-27", "2026-09-27", true, 0, 3],
    ["2026-09-30", "2026-10-04", false, 4, null],
  ] as const)(
    "calculates the recurring window on %s",
    (day, availableDate, isAvailable, daysUntilAvailable, daysUntilLocked) => {
      expect(computeAvailability(investLog, product, new Date(`${day}T12:00:00+08:00`))).toEqual({
        availableDate,
        isAvailable,
        daysUntilAvailable,
        daysUntilLocked,
        latestInvestDate: investLog.operationDate,
      });
    },
  );

  it("preserves legacy operation-date prefixes and changes availability at Shanghai midnight", () => {
    const legacyLog = { operationDate: "2026-09-20T23:30:00Z" };
    const nonCyclicProduct = { lockPeriodDays: 10, openDays: null, cycleDays: null };
    expect(
      computeAvailability(legacyLog, nonCyclicProduct, new Date("2026-09-29T15:59:59Z")),
    ).toEqual({
      availableDate: "2026-09-30",
      isAvailable: false,
      daysUntilAvailable: 1,
      daysUntilLocked: null,
      latestInvestDate: legacyLog.operationDate,
    });
    expect(
      computeAvailability(legacyLog, nonCyclicProduct, new Date("2026-09-29T16:00:00Z")),
    ).toEqual({
      availableDate: "2026-09-30",
      isAvailable: true,
      daysUntilAvailable: 0,
      daysUntilLocked: null,
      latestInvestDate: legacyLog.operationDate,
    });
  });
});
