import { afterEach, expect, test, vi } from "vitest";
import { computeAvailability } from "@/lib/availability";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test("fixture presentation clock affects availability without changing auth time", () => {
  vi.stubGlobal("__PRESENTATION_DATE__", "2026-09-28T12:00:00+08:00");
  const now = Date.now();
  expect(computeAvailability(null, null, undefined, "2026-09-30").daysUntilAvailable).toBe(2);
  expect(Date.now()).toBeGreaterThanOrEqual(now);
  expect(
    computeAvailability(null, null, new Date("2026-09-29T12:00:00+08:00"), "2026-09-30")
      .daysUntilAvailable,
  ).toBe(1);
});
test("production clock uses actual time", () => {
  vi.stubGlobal("__PRESENTATION_DATE__", null);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T12:00:00+08:00"));
  expect(computeAvailability(null, null, undefined, "2026-09-30").isAvailable).toBe(true);
});
