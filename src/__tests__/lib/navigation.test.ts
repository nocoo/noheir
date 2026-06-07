import { describe, expect, test } from "vitest";
import { FEATURE_PLAN_CALENDAR, NAV_GROUPS } from "@/lib/navigation";

describe("navigation (P2-C10)", () => {
  test("FEATURE_PLAN_CALENDAR is initially OFF", () => {
    // P3-C11 flips this to true; until then no user-visible entry.
    expect(FEATURE_PLAN_CALENDAR).toBe(false);
  });

  test("flag=false → sidebar does NOT contain '资金计划' group", () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).not.toContain("资金计划");
  });

  test("flag=false → sidebar does NOT contain /plan/* hrefs", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs.some((h) => h.startsWith("/plan/"))).toBe(false);
  });

  test("existing groups still present (regression)", () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "总览",
        "现金流分析",
        "账户管理",
        "存量资金管理",
        "系统",
      ]),
    );
  });
});
