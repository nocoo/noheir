import { describe, expect, test } from "vitest";
import { getLocalDateString } from "@/lib/local-date";

describe("getLocalDateString", () => {
  test("formats as YYYY-MM-DD", () => {
    expect(getLocalDateString(new Date("2026-07-27T04:00:00Z"))).toBe("2026-07-27");
  });

  test("uses Asia/Shanghai, not UTC", () => {
    // 22:30 UTC on the 26th is already 06:30 on the 27th in Shanghai — the exact
    // window where toISOString() would record the previous day (docs/003 § B4).
    expect(getLocalDateString(new Date("2026-07-26T22:30:00Z"))).toBe("2026-07-27");
  });

  test("does not roll forward late in the local day", () => {
    // 15:59 UTC is 23:59 in Shanghai — still the same date.
    expect(getLocalDateString(new Date("2026-07-27T15:59:00Z"))).toBe("2026-07-27");
    // One minute later crosses midnight locally.
    expect(getLocalDateString(new Date("2026-07-27T16:00:00Z"))).toBe("2026-07-28");
  });

  test("pads single-digit months and days", () => {
    expect(getLocalDateString(new Date("2026-01-05T04:00:00Z"))).toBe("2026-01-05");
  });
});
