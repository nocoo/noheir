import { describe, expect, test } from "vitest";
import {
  deriveDisplayStatus,
  describeFrequency,
  formatAmountCompact,
  formatAmountYuan,
} from "@/lib/recurring-expense/format";

describe("describeFrequency", () => {
  test("daily interval=1 → '每天'", () => {
    expect(
      describeFrequency({
        frequency: "daily",
        interval: 1,
        dayOfMonth: null,
        monthOfYear: null,
        weekday: null,
      }),
    ).toBe("每天");
  });

  test("daily interval=3 → '每 3 天'", () => {
    expect(
      describeFrequency({
        frequency: "daily",
        interval: 3,
        dayOfMonth: null,
        monthOfYear: null,
        weekday: null,
      }),
    ).toBe("每 3 天");
  });

  test("weekly with weekday", () => {
    expect(
      describeFrequency({
        frequency: "weekly",
        interval: 1,
        weekday: 1,
        dayOfMonth: null,
        monthOfYear: null,
      }),
    ).toBe("每周 · 周一");
    expect(
      describeFrequency({
        frequency: "weekly",
        interval: 2,
        weekday: 5,
        dayOfMonth: null,
        monthOfYear: null,
      }),
    ).toBe("每 2 周 · 周五");
  });

  test("monthly with dayOfMonth", () => {
    expect(
      describeFrequency({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 15,
        monthOfYear: null,
        weekday: null,
      }),
    ).toBe("每个月 · 15 日");
    expect(
      describeFrequency({
        frequency: "monthly",
        interval: 3,
        dayOfMonth: 1,
        monthOfYear: null,
        weekday: null,
      }),
    ).toBe("每 3 个月 · 1 日");
  });

  test("yearly with month + day", () => {
    expect(
      describeFrequency({
        frequency: "yearly",
        interval: 1,
        monthOfYear: 1,
        dayOfMonth: 5,
        weekday: null,
      }),
    ).toBe("每年 · 1 月 5 日");
  });

  test("weekly without weekday → '每周' only (defensive)", () => {
    expect(
      describeFrequency({
        frequency: "weekly",
        interval: 1,
        weekday: null,
        dayOfMonth: null,
        monthOfYear: null,
      }),
    ).toBe("每周");
  });

  test("monthly without dayOfMonth → '每个月' only (defensive)", () => {
    expect(
      describeFrequency({
        frequency: "monthly",
        interval: 1,
        dayOfMonth: null,
        monthOfYear: null,
        weekday: null,
      }),
    ).toBe("每个月");
  });

  test("yearly missing one of (monthOfYear, dayOfMonth) → '每年' only (defensive)", () => {
    expect(
      describeFrequency({
        frequency: "yearly",
        interval: 1,
        monthOfYear: 1,
        dayOfMonth: null,
        weekday: null,
      }),
    ).toBe("每年");
    expect(
      describeFrequency({
        frequency: "yearly",
        interval: 1,
        monthOfYear: null,
        dayOfMonth: 5,
        weekday: null,
      }),
    ).toBe("每年");
  });

  test("weekly weekday out of bounds → no day label (defensive)", () => {
    // 7 isn't valid (0..6); should produce '每周' only.
    expect(
      describeFrequency({
        frequency: "weekly",
        interval: 1,
        weekday: 7,
        dayOfMonth: null,
        monthOfYear: null,
      }),
    ).toBe("每周");
  });
});

describe("formatAmountYuan", () => {
  test("integer yuan: no decimals", () => {
    expect(formatAmountYuan(800_000)).toBe("¥8,000");
    expect(formatAmountYuan(100)).toBe("¥1");
  });

  test("fractional yuan: 2 decimals", () => {
    expect(formatAmountYuan(350_050)).toBe("¥3,500.50");
    expect(formatAmountYuan(99)).toBe("¥0.99");
  });

  test("zero", () => {
    expect(formatAmountYuan(0)).toBe("¥0");
  });

  test("very large amounts get thousand-separators", () => {
    expect(formatAmountYuan(123_456_789)).toBe("¥1,234,567.89");
  });
});

describe("formatAmountCompact", () => {
  test("under 10,000 yuan: full integer with separators, no decimals", () => {
    expect(formatAmountCompact(9900)).toBe("¥99");
    expect(formatAmountCompact(250_000)).toBe("¥2,500");
    expect(formatAmountCompact(999_999)).toBe("¥10,000");
  });

  test("≥ 10,000 yuan: '万' suffix with 1 decimal trimmed of trailing zero", () => {
    expect(formatAmountCompact(1_000_000)).toBe("¥1万");
    expect(formatAmountCompact(1_234_500)).toBe("¥1.2万");
    expect(formatAmountCompact(50_000_000)).toBe("¥50万");
  });

  test("very large amounts collapse decimals", () => {
    expect(formatAmountCompact(100_000_000)).toBe("¥100万");
    expect(formatAmountCompact(1_000_000_000)).toBe("¥1000万");
  });

  test("zero", () => {
    expect(formatAmountCompact(0)).toBe("¥0");
  });

  test("negative amounts get a leading '-'", () => {
    expect(formatAmountCompact(-9900)).toBe("-¥99");
    expect(formatAmountCompact(-1_234_500)).toBe("-¥1.2万");
  });
});

describe("deriveDisplayStatus", () => {
  test("paused → 'paused'", () => {
    expect(
      deriveDisplayStatus({ status: "paused", endDate: null }, "2026-06-07"),
    ).toBe("paused");
  });

  test("ended → 'ended'", () => {
    expect(
      deriveDisplayStatus({ status: "ended", endDate: null }, "2026-06-07"),
    ).toBe("ended");
  });

  test("active with endDate < today → 'expired' (派生态)", () => {
    expect(
      deriveDisplayStatus(
        { status: "active", endDate: "2024-12-31" },
        "2026-06-07",
      ),
    ).toBe("expired");
  });

  test("active with endDate >= today → 'active'", () => {
    expect(
      deriveDisplayStatus(
        { status: "active", endDate: "2026-06-07" },
        "2026-06-07",
      ),
    ).toBe("active");
    expect(
      deriveDisplayStatus(
        { status: "active", endDate: "2099-01-01" },
        "2026-06-07",
      ),
    ).toBe("active");
  });

  test("active without endDate → 'active'", () => {
    expect(
      deriveDisplayStatus({ status: "active", endDate: null }, "2026-06-07"),
    ).toBe("active");
  });

  test("paused takes precedence over expired", () => {
    expect(
      deriveDisplayStatus(
        { status: "paused", endDate: "2024-01-01" },
        "2026-06-07",
      ),
    ).toBe("paused");
  });
});
