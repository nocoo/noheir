import { describe, expect, test } from "vitest";
import {
  ALLOWED_FROM,
  isRecurringStatus,
  isRecurringTransition,
  patchForTransition,
  utcTodayIso,
} from "../lib/recurring-state";

describe("recurring state machine", () => {
  test("utc today is YYYY-MM-DD", () => {
    expect(utcTodayIso(new Date("2026-09-20T15:04:05.000Z"))).toBe("2026-09-20");
  });

  test("status and transition guards", () => {
    expect(isRecurringStatus("active")).toBe(true);
    expect(isRecurringStatus("paused")).toBe(true);
    expect(isRecurringStatus("ended")).toBe(true);
    expect(isRecurringStatus("other")).toBe(false);
    expect(isRecurringTransition("pause")).toBe(true);
    expect(isRecurringTransition("resume")).toBe(true);
    expect(isRecurringTransition("end")).toBe(true);
    expect(isRecurringTransition("start")).toBe(false);
  });

  test("allowed source states", () => {
    expect(ALLOWED_FROM.pause).toEqual(["active"]);
    expect(ALLOWED_FROM.resume).toEqual(["paused"]);
    expect(ALLOWED_FROM.end).toEqual(["active", "paused"]);
  });

  test("legal patches", () => {
    expect(patchForTransition("pause", "active")).toEqual({
      ok: true,
      status: "paused",
      endedAt: null,
    });
    expect(patchForTransition("resume", "paused")).toEqual({
      ok: true,
      status: "active",
      endedAt: null,
    });
    expect(patchForTransition("end", "active", new Date("2026-01-02T00:00:00Z"))).toEqual({
      ok: true,
      status: "ended",
      endedAt: "2026-01-02",
    });
    expect(patchForTransition("end", "paused", new Date("2026-01-02T00:00:00Z")).ok).toBe(true);
  });

  test("ended is terminal and illegal transitions fail", () => {
    expect(patchForTransition("pause", "paused")).toEqual({ ok: false, reason: "illegal" });
    expect(patchForTransition("resume", "active")).toEqual({ ok: false, reason: "illegal" });
    expect(patchForTransition("pause", "ended")).toEqual({ ok: false, reason: "illegal" });
    expect(patchForTransition("resume", "ended")).toEqual({ ok: false, reason: "illegal" });
    expect(patchForTransition("end", "ended")).toEqual({ ok: false, reason: "illegal" });
  });
});
