// Page-level test: FEATURE_PLAN_CALENDAR flips to true at P3-C11.
// Both /plan/categories and /plan/calendar now serve the page; the
// sidebar group is also visible. This test was the false-flag fence
// during Phase 3 development; P3-C11 inverts it as the canonical
// signal that the feature is live.

import { describe, expect, test } from "vitest";
import { FEATURE_PLAN_CALENDAR, NAV_GROUPS } from "@/lib/navigation";

describe("FEATURE_PLAN_CALENDAR flag gate (P3-C11)", () => {
  test("flag is true → both plan pages active and sidebar group visible", () => {
    expect(FEATURE_PLAN_CALENDAR).toBe(true);
    expect(NAV_GROUPS.map((g) => g.label)).toContain("资金计划");
  });

  test("sidebar 资金计划 group contains both /plan/* routes", () => {
    const planGroup = NAV_GROUPS.find((g) => g.label === "资金计划");
    expect(planGroup).toBeDefined();
    const hrefs = planGroup?.items.map((i) => i.href) ?? [];
    expect(hrefs).toContain("/plan/calendar");
    expect(hrefs).toContain("/plan/categories");
  });
});
