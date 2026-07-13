import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { buildSummaries, PlanSummaryCards } from "@/components/plan/plan-summary-cards";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

function rule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: "r",
    userId: "u",
    name: "rule",
    categoryId: null,
    amountCents: 10000, // ¥100.00
    currency: "CNY",
    account: null,
    frequency: "monthly",
    interval: 1,
    dayOfMonth: 15,
    monthOfYear: null,
    weekday: null,
    startDate: "2026-01-01",
    endDate: null,
    status: "active",
    endedAt: null,
    note: null,
    ...overrides,
  };
}

describe("buildSummaries (P3-C6)", () => {
  test("empty rules → all three sums are 0", () => {
    const items = buildSummaries([], "2026-06-01", "2026-06-07");
    expect(items.map((i) => i.amount)).toEqual([0, 0, 0]);
    expect(items.map((i) => i.key)).toEqual(["month", "next30", "next365"]);
  });

  test("monthly rule on day 15: '当月' sums one occurrence", () => {
    // June 2026: rule fires once on June 15.
    const r = rule({ amountCents: 10000, dayOfMonth: 15, startDate: "2026-01-15" });
    const items = buildSummaries([r], "2026-06-01", "2026-06-07");
    const month = items.find((i) => i.key === "month");
    expect(month?.amount).toBe(10000);
  });

  test("next30 covers exactly 30 days inclusive of today", () => {
    // Daily rule of ¥1.00 → 31 days from 2026-06-07 to 2026-07-07 (inclusive).
    const r = rule({
      frequency: "daily",
      interval: 1,
      dayOfMonth: null,
      amountCents: 100,
      startDate: "2026-01-01",
    });
    const items = buildSummaries([r], "2026-06-01", "2026-06-07");
    const next30 = items.find((i) => i.key === "next30");
    // sumNextDays uses [today, today+30] inclusive → 31 days.
    expect(next30?.amount).toBe(100 * 31);
  });

  test("next365 covers a 366-day window (today + 365 inclusive)", () => {
    const r = rule({
      frequency: "daily",
      interval: 1,
      dayOfMonth: null,
      amountCents: 1,
      startDate: "2026-01-01",
    });
    const items = buildSummaries([r], "2026-06-01", "2026-06-07");
    const next365 = items.find((i) => i.key === "next365");
    expect(next365?.amount).toBe(366);
  });

  test("paused rule contributes 0 to every window", () => {
    const r = rule({ status: "paused", dayOfMonth: 15 });
    const items = buildSummaries([r], "2026-06-01", "2026-06-07");
    expect(items.every((i) => i.amount === 0)).toBe(true);
  });

  test("ended rule whose endedAt < window contributes 0", () => {
    const r = rule({ status: "ended", endedAt: "2025-12-31", dayOfMonth: 15 });
    const items = buildSummaries([r], "2026-06-01", "2026-06-07");
    expect(items.every((i) => i.amount === 0)).toBe(true);
  });

  test("ended rule whose endedAt is mid-window: includes occurrences up to endedAt", () => {
    // Monthly rule fires on the 15th. Ended on 2026-08-20 → June, July,
    // August occurrences count; September onwards do not.
    const r = rule({
      amountCents: 10000,
      dayOfMonth: 15,
      startDate: "2026-01-15",
      status: "ended",
      endedAt: "2026-08-20",
    });
    const items = buildSummaries([r], "2026-06-01", "2026-06-07");
    const next365 = items.find((i) => i.key === "next365");
    // From 2026-06-07: occurrences on 6/15, 7/15, 8/15 (3 events).
    expect(next365?.amount).toBe(30000);
  });
});

describe("PlanSummaryCards render (P3-C6)", () => {
  test("renders three cards with expected labels and zero amounts when no rules", () => {
    render(<PlanSummaryCards rules={[]} viewMonth="2026-06-01" todayIso="2026-06-07" />);
    const group = screen.getByRole("group", { name: "周期支出汇总" });
    const cards = within(group)
      .getAllByText(/当月|自今日起 30 天|自今日起 12 个月/)
      .map((el) => el.parentElement as HTMLElement);
    expect(cards).toHaveLength(3);
    // Zero-cents formats with no decimals (¥0 not ¥0.00) — see formatAmountYuan.
    expect(within(group).getAllByText("¥0")).toHaveLength(3);
  });

  test("each card has data-summary-key for selector targeting", () => {
    render(<PlanSummaryCards rules={[]} viewMonth="2026-06-01" todayIso="2026-06-07" />);
    const group = screen.getByRole("group");
    expect(group.querySelector("[data-summary-key='month']")).not.toBeNull();
    expect(group.querySelector("[data-summary-key='next30']")).not.toBeNull();
    expect(group.querySelector("[data-summary-key='next365']")).not.toBeNull();
  });

  test("month card amount reflects sumMonth for the visible month", () => {
    const r = rule({ amountCents: 12345, dayOfMonth: 1, startDate: "2026-01-01" });
    render(<PlanSummaryCards rules={[r]} viewMonth="2026-06-01" todayIso="2026-06-07" />);
    const month = document.querySelector(
      "[data-summary-key='month'] [data-amount-cents]",
    ) as HTMLElement | null;
    expect(month).not.toBeNull();
    expect(month?.getAttribute("data-amount-cents")).toBe("12345");
  });

  test("aria-label on the amount mentions the window label and formatted amount", () => {
    const r = rule({ amountCents: 100000, dayOfMonth: 1, startDate: "2026-01-01" });
    render(<PlanSummaryCards rules={[r]} viewMonth="2026-06-01" todayIso="2026-06-07" />);
    const monthAmount = document.querySelector("[data-summary-key='month'] [data-amount-cents]");
    expect(monthAmount?.getAttribute("aria-label")).toContain("当月");
    expect(monthAmount?.getAttribute("aria-label")).toContain("¥1,000");
  });

  test("changing viewMonth re-aggregates without remount artifacts", () => {
    const r = rule({
      amountCents: 5000,
      dayOfMonth: 5,
      startDate: "2026-01-01",
    });
    const { rerender } = render(
      <PlanSummaryCards rules={[r]} viewMonth="2026-06-01" todayIso="2026-06-07" />,
    );
    // June 5 occurrence — month sum = 5000.
    let month = document.querySelector(
      "[data-summary-key='month'] [data-amount-cents]",
    ) as HTMLElement | null;
    expect(month?.getAttribute("data-amount-cents")).toBe("5000");
    // July: same shape, but the month sum is still one occurrence (Jul 5).
    rerender(<PlanSummaryCards rules={[r]} viewMonth="2026-07-01" todayIso="2026-06-07" />);
    month = document.querySelector("[data-summary-key='month'] [data-amount-cents]");
    expect(month?.getAttribute("data-amount-cents")).toBe("5000");
  });
});
