import { describe, expect, it } from "vitest";
import type { DomainProduct } from "@/domain/types";
import { computeUnlockPhase, isPastInitialUnlock } from "@/lib/unit-tooltip-phase";

function fixedDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function product(overrides: Partial<DomainProduct> = {}): DomainProduct {
  return {
    id: "p1",
    name: "prod",
    code: null,
    channel: null,
    category: null,
    currency: null,
    lockPeriodDays: null,
    openDays: null,
    cycleDays: null,
    annualReturnRate: null,
    isArchived: false,
    ...overrides,
  };
}

describe("isPastInitialUnlock", () => {
  it("returns false before the first unlock date", () => {
    expect(isPastInitialUnlock("2026-07-20", 10, fixedDate("2026-07-25"))).toBe(false);
  });

  it("returns true on and after the first unlock date", () => {
    expect(isPastInitialUnlock("2026-07-20", 10, fixedDate("2026-07-30"))).toBe(true);
    expect(isPastInitialUnlock("2026-07-20", 10, fixedDate("2026-08-15"))).toBe(true);
  });

  it("uses the override as the unlock date when set", () => {
    expect(isPastInitialUnlock("2026-07-20", 365, fixedDate("2026-07-25"), "2026-07-20")).toBe(
      true,
    );
    expect(isPastInitialUnlock("2026-07-20", 365, fixedDate("2026-07-25"), "2026-08-01")).toBe(
      false,
    );
  });

  it("returns false for missing or malformed dates", () => {
    expect(isPastInitialUnlock(null, 10, fixedDate("2026-07-30"))).toBe(false);
    expect(isPastInitialUnlock(undefined, 10, fixedDate("2026-07-30"))).toBe(false);
    expect(isPastInitialUnlock("not-a-date", 10, fixedDate("2026-07-30"))).toBe(false);
  });
});

describe("computeUnlockPhase", () => {
  it("returns archived without progress for 已归档", () => {
    expect(computeUnlockPhase({ status: "已归档" }, product())).toEqual({
      kind: "archived",
      ratio: null,
    });
  });

  it("returns planned without progress for 计划中", () => {
    expect(computeUnlockPhase({ status: "计划中" }, product())).toEqual({
      kind: "planned",
      ratio: null,
    });
  });

  it("uses lockPeriodDays denominator during initial lock (10/3/30 config)", () => {
    // latestInvestDate = today, lockPeriodDays = 10 → d starts at 10, still initial lock
    const p = product({ lockPeriodDays: 10, openDays: 3, cycleDays: 30 });
    const phase = computeUnlockPhase(
      { status: "已成立", daysUntilAvailable: 10, latestInvestDate: "2026-07-23" },
      p,
      fixedDate("2026-07-23"),
    );
    // ratio = 1 - 10/10 = 0 (start of lock), NOT 1 - 10/27 ≈ 0.63
    expect(phase.kind).toBe("locked");
    if (phase.kind !== "locked") return;
    expect(phase.ratio).toBeCloseTo(0, 5);
  });

  it("uses closed-window denominator in a cyclic closed window (10/3/30 config)", () => {
    // latestInvestDate = 13 days ago → past initial unlock (10 days ago) → cyclic
    // Now assume we've walked into a closed window with d = 27 (start of it)
    const p = product({ lockPeriodDays: 10, openDays: 3, cycleDays: 30 });
    const phase = computeUnlockPhase(
      { status: "已成立", daysUntilAvailable: 27, latestInvestDate: "2026-07-10" },
      p,
      fixedDate("2026-07-23"),
    );
    // ratio = 1 - 27/27 = 0 (fresh into closed window)
    expect(phase.kind).toBe("locked");
    if (phase.kind !== "locked") return;
    expect(phase.ratio).toBeCloseTo(0, 5);
  });

  it("stays on lockPeriodDays denominator near end of first lock (365/3/30 config)", () => {
    // Regression: previously d=27 collapsed to closed-window denominator (27),
    // making progress crash from ~93% back to 0%.
    const p = product({ lockPeriodDays: 365, openDays: 3, cycleDays: 30 });
    const phase = computeUnlockPhase(
      { status: "已成立", daysUntilAvailable: 27, latestInvestDate: "2025-07-24" },
      p,
      fixedDate("2026-06-27"), // ~338 days after invest — still in initial lock
    );
    expect(phase.kind).toBe("locked");
    if (phase.kind !== "locked") return;
    expect(phase.ratio).not.toBeNull();
    // 1 - 27/365 ≈ 0.926
    expect(phase.ratio).toBeGreaterThan(0.9);
    expect(phase.ratio).toBeLessThan(0.95);
  });

  it("uses closed-window progress when lockPeriodDays is null but override is past", () => {
    const p = product({ lockPeriodDays: null, openDays: 3, cycleDays: 30 });
    const phase = computeUnlockPhase(
      {
        status: "已成立",
        daysUntilAvailable: 14,
        latestInvestDate: "2026-06-01",
        availableDateOverride: "2026-03-30",
      },
      p,
      fixedDate("2026-04-15"),
    );
    expect(phase.kind).toBe("locked");
    if (phase.kind !== "locked") return;
    expect(phase.ratio).toBeCloseTo(1 - 14 / 27, 5);
  });

  it("uses the closed-window denominator when an override is already unlocked", () => {
    const p = product({ lockPeriodDays: 365, openDays: 3, cycleDays: 30 });
    const phase = computeUnlockPhase(
      {
        status: "已成立",
        daysUntilAvailable: 14,
        latestInvestDate: "2026-06-01",
        availableDateOverride: "2026-03-30",
      },
      p,
      fixedDate("2026-04-15"),
    );
    expect(phase.kind).toBe("locked");
    if (phase.kind !== "locked") return;
    expect(phase.ratio).toBeCloseTo(1 - 14 / 27, 5);
  });

  it("computes openWindow ratio from openDays", () => {
    const p = product({ lockPeriodDays: 10, openDays: 3, cycleDays: 30 });
    const phase = computeUnlockPhase(
      { status: "已成立", daysUntilAvailable: 0, daysUntilLocked: 1 },
      p,
    );
    expect(phase.kind).toBe("openWindow");
    if (phase.kind !== "openWindow") return;
    expect(phase.ratio).toBeCloseTo(1 - 1 / 3, 5);
  });

  it("returns null ratio when product lacks lock config", () => {
    const phase = computeUnlockPhase(
      { status: "已成立", daysUntilAvailable: 15, latestInvestDate: "2026-07-01" },
      null,
    );
    expect(phase.kind).toBe("locked");
    if (phase.kind !== "locked") return;
    expect(phase.ratio).toBeNull();
  });

  it("returns available when daysUntilAvailable is 0 or negative and no dLock", () => {
    expect(computeUnlockPhase({ status: "已成立", daysUntilAvailable: -5 }, product())).toEqual({
      kind: "available",
      ratio: null,
    });
  });

  it("returns unknown when nothing computable", () => {
    expect(computeUnlockPhase({ status: "已成立" }, product())).toEqual({
      kind: "unknown",
      ratio: null,
    });
  });
});
