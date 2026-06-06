import { describe, expect, test } from "vitest";
import {
  toRecurrenceRule,
  toRecurrenceRuleView,
  toCategory,
} from "@/lib/recurring-expense/mappers";

const baseRow = {
  id: "r1",
  userId: "u1",
  name: "中行车险",
  categoryId: "c1",
  amountCents: 800_000,
  currency: "CNY",
  account: null,
  frequency: "yearly",
  interval: 1,
  dayOfMonth: 5,
  monthOfYear: 1,
  weekday: null,
  startDate: "2026-01-05",
  endDate: null,
  status: "active",
  endedAt: null,
  note: null,
};

describe("toRecurrenceRule", () => {
  test("maps a happy-path row to the canonical domain shape", () => {
    const rule = toRecurrenceRule(baseRow);
    expect(rule).toEqual({
      id: "r1",
      userId: "u1",
      name: "中行车险",
      categoryId: "c1",
      amountCents: 800_000,
      currency: "CNY",
      account: null,
      frequency: "yearly",
      interval: 1,
      dayOfMonth: 5,
      monthOfYear: 1,
      weekday: null,
      startDate: "2026-01-05",
      endDate: null,
      status: "active",
      endedAt: null,
      note: null,
    });
  });

  test("drops display-only fields (categoryName, colorToken) from RecurrenceRule", () => {
    const rule = toRecurrenceRule({
      ...baseRow,
      categoryName: "保险",
      colorToken: "chart-9",
    });
    expect("categoryName" in rule).toBe(false);
    expect("colorToken" in rule).toBe(false);
  });

  test("throws on unknown frequency", () => {
    expect(() => toRecurrenceRule({ ...baseRow, frequency: "bogus" })).toThrow(
      /unknown frequency/,
    );
  });

  test("throws on unknown status", () => {
    expect(() => toRecurrenceRule({ ...baseRow, status: "draft" })).toThrow(
      /unknown status/,
    );
  });
});

describe("toRecurrenceRuleView", () => {
  test("keeps categoryName + colorToken when present", () => {
    const view = toRecurrenceRuleView({
      ...baseRow,
      categoryName: "保险",
      colorToken: "chart-9",
    });
    expect(view.categoryName).toBe("保险");
    expect(view.colorToken).toBe("chart-9");
  });

  test("nulls when absent or undefined", () => {
    const view = toRecurrenceRuleView(baseRow);
    expect(view.categoryName).toBeNull();
    expect(view.colorToken).toBeNull();
  });
});

describe("toCategory", () => {
  test("maps category row", () => {
    expect(
      toCategory({
        id: "c1",
        userId: "u1",
        name: "保险",
        colorToken: "chart-9",
        sortOrder: 3,
      }),
    ).toEqual({
      id: "c1",
      userId: "u1",
      name: "保险",
      colorToken: "chart-9",
      sortOrder: 3,
    });
  });
});
