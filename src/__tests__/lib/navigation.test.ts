import { describe, expect, test } from "vitest";
import { FEATURE_PLAN_CALENDAR, NAV_GROUPS } from "@/lib/navigation";

describe("navigation (P2-C10 + P3-C11)", () => {
  test("FEATURE_PLAN_CALENDAR is ON (flipped at P3-C11)", () => {
    expect(FEATURE_PLAN_CALENDAR).toBe(true);
  });

  test("flag=true → sidebar contains the 资金计划 group", () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).toContain("资金计划");
  });

  test("资金计划 group contains /plan/calendar and /plan/categories", () => {
    const planGroup = NAV_GROUPS.find((g) => g.label === "资金计划");
    expect(planGroup).toBeDefined();
    const hrefs = planGroup?.items.map((i) => i.href) ?? [];
    expect(hrefs).toEqual(
      expect.arrayContaining(["/plan/calendar", "/plan/categories"]),
    );
  });

  test("资金计划 sits between 存量资金管理 and 系统 (spec order)", () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    const planIdx = labels.indexOf("资金计划");
    const stockIdx = labels.indexOf("存量资金管理");
    const systemIdx = labels.indexOf("系统");
    expect(planIdx).toBeGreaterThan(stockIdx);
    expect(planIdx).toBeLessThan(systemIdx);
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
