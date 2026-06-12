import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  aggregateOccurrences,
  buildMonthGrid,
  PlanCalendar,
  type PlanCalendarCategory,
} from "@/components/plan/plan-calendar";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

function rule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: "r",
    userId: "u",
    name: "rule",
    categoryId: null,
    amountCents: 1000,
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

function catMap(
  entries: PlanCalendarCategory[],
): Map<string, PlanCalendarCategory> {
  return new Map(entries.map((c) => [c.id, c]));
}

describe("buildMonthGrid (P3-C5)", () => {
  test("February 2026 (starts Sunday) builds 42 cells, all 6 rows", () => {
    const cells = buildMonthGrid("2026-02-01");
    expect(cells).toHaveLength(42);
    // Feb 2026: Feb 1 is a Sunday → first cell IS Feb 1.
    expect(cells[0]?.iso).toBe("2026-02-01");
    expect(cells[0]?.inMonth).toBe(true);
  });

  test("January 2026 starts Thursday → pads with prior December", () => {
    const cells = buildMonthGrid("2026-01-01");
    // Jan 1 2026 = Thursday. Sunday-start grid → first cell = Dec 28 2025.
    expect(cells[0]?.iso).toBe("2025-12-28");
    expect(cells[0]?.inMonth).toBe(false);
    // Jan 1 lands at index 4 (Sun..Wed are Dec days).
    const jan1 = cells[4];
    expect(jan1?.iso).toBe("2026-01-01");
    expect(jan1?.inMonth).toBe(true);
  });

  test("inMonth flag matches the visible month", () => {
    const cells = buildMonthGrid("2026-06-01");
    const inMonthCount = cells.filter((c) => c.inMonth).length;
    expect(inMonthCount).toBe(30); // June has 30 days
  });

  test("throws when viewMonth is not the 1st", () => {
    expect(() => buildMonthGrid("2026-02-15")).toThrow();
  });
});

describe("aggregateOccurrences (P3-C5)", () => {
  test("collects all rules' occurrences by ISO key", () => {
    const r1 = rule({ id: "r1", dayOfMonth: 5 });
    const r2 = rule({ id: "r2", dayOfMonth: 5 }); // same day
    const r3 = rule({ id: "r3", dayOfMonth: 10 });
    const map = aggregateOccurrences([r1, r2, r3], "2026-02-01", "2026-02-28");
    expect(map.get("2026-02-05")?.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(map.get("2026-02-10")?.map((r) => r.id)).toEqual(["r3"]);
    expect(map.get("2026-02-15")).toBeUndefined();
  });

  test("paused rule contributes nothing (computeOccurrences returns [])", () => {
    const r1 = rule({ id: "r1", dayOfMonth: 5, status: "paused" });
    const map = aggregateOccurrences([r1], "2026-02-01", "2026-02-28");
    expect(map.size).toBe(0);
  });

  test("ended rule with endedAt before window contributes nothing", () => {
    const r1 = rule({
      id: "r1",
      dayOfMonth: 5,
      status: "ended",
      endedAt: "2025-12-31",
    });
    const map = aggregateOccurrences([r1], "2026-02-01", "2026-02-28");
    expect(map.size).toBe(0);
  });
});

describe("PlanCalendar render (P3-C5)", () => {
  test("renders heading, 7 weekday headers, 42 day cells", () => {
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[]}
        categoryMap={catMap([])}
      />,
    );
    expect(screen.getByText("2026 年 2 月")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
  });

  test("layout stays 6×7 (42 cells) for months that start on any day", () => {
    for (const v of ["2026-01-01", "2026-02-01", "2026-04-01", "2026-08-01"]) {
      const { unmount } = render(
        <PlanCalendar viewMonth={v} rules={[]} categoryMap={catMap([])} />,
      );
      expect(screen.getAllByRole("gridcell")).toHaveLength(42);
      unmount();
    }
  });

  test("adjacent-month cells render with data-in-month='false'", () => {
    render(
      <PlanCalendar
        viewMonth="2026-01-01"
        rules={[]}
        categoryMap={catMap([])}
      />,
    );
    // The first cell is Dec 28 2025.
    const cells = screen.getAllByRole("gridcell");
    expect(cells[0]?.getAttribute("data-iso")).toBe("2025-12-28");
    expect(cells[0]?.getAttribute("data-in-month")).toBe("false");
  });

  test("today gets aria-current='date' and primary background on the day number", () => {
    render(
      <PlanCalendar
        viewMonth="2026-06-01"
        rules={[]}
        categoryMap={catMap([])}
        todayIso="2026-06-07"
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const today = cells.find((c) => c.getAttribute("data-iso") === "2026-06-07");
    expect(today).toBeDefined();
    expect(today).toHaveAttribute("aria-current", "date");
  });
});

describe("PlanCalendar occurrence dots (P3-C5)", () => {
  test("each occurrence renders a colored dot using its category token", () => {
    const r1 = rule({ id: "r1", categoryId: "cat-a", dayOfMonth: 10 });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[r1]}
        categoryMap={catMap([{ id: "cat-a", name: "房贷", colorToken: "chart-9" }])}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb10 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-10");
    if (!feb10) throw new Error("missing feb 10");
    const dot = feb10.querySelector("[data-rule-id='r1']");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("data-color")).toBe("chart-9");
  });

  test("rule without category falls back to muted color, no crash", () => {
    const r1 = rule({ id: "r1", categoryId: null, dayOfMonth: 5 });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[r1]}
        categoryMap={catMap([])}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb5 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-05");
    const dot = feb5?.querySelector("[data-rule-id='r1']");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("data-color")).toBe("fallback");
  });

  test("rule with category whose colorToken is off-palette falls back", () => {
    const r1 = rule({ id: "r1", categoryId: "cat-bad", dayOfMonth: 5 });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[r1]}
        categoryMap={catMap([{ id: "cat-bad", name: "x", colorToken: "rebeccapurple" }])}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb5 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-05");
    const dot = feb5?.querySelector("[data-rule-id='r1']") as HTMLElement | null;
    expect(dot).not.toBeNull();
    // Banner uses the category color as a left accent stripe; the
    // fallback path must still apply a color so the banner doesn't
    // render with a transparent edge.
    expect(dot?.style.borderLeftColor.length).toBeGreaterThan(0);
    expect(dot?.getAttribute("data-color")).toBe("fallback");
  });

  test("day with > 3 occurrences shows only 3 dots + '+N' overflow", () => {
    const rules = Array.from({ length: 5 }, (_, i) =>
      rule({ id: `r${i}`, categoryId: `c${i}`, dayOfMonth: 12 }),
    );
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={rules}
        categoryMap={catMap(
          Array.from({ length: 5 }, (_, i) => ({
            id: `c${i}`,
            name: `n${i}`,
            colorToken: `chart-${i + 1}`,
          })),
        )}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb12 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-12");
    if (!feb12) throw new Error("missing feb 12");
    const dots = feb12.querySelectorAll("[data-rule-id]");
    expect(dots).toHaveLength(3);
    expect(within(feb12).getByText("+2")).toBeInTheDocument();
  });

  test("day with exactly 3 occurrences has no +N badge", () => {
    const rules = Array.from({ length: 3 }, (_, i) =>
      rule({ id: `r${i}`, categoryId: null, dayOfMonth: 12 }),
    );
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={rules}
        categoryMap={catMap([])}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb12 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-12");
    if (!feb12) throw new Error("missing feb 12");
    expect(feb12.querySelectorAll("[data-rule-id]")).toHaveLength(3);
    expect(within(feb12).queryByText(/^\+/)).toBeNull();
  });

  test("paused rule contributes no dots", () => {
    const active = rule({ id: "r-active", dayOfMonth: 5 });
    const paused = rule({ id: "r-paused", dayOfMonth: 5, status: "paused" });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[active, paused]}
        categoryMap={catMap([])}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb5 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-05");
    expect(feb5?.querySelectorAll("[data-rule-id]")).toHaveLength(1);
    expect(feb5?.querySelector("[data-rule-id='r-paused']")).toBeNull();
  });
});

describe("PlanCalendar interaction (P3-C5)", () => {
  test("clicking a day calls onSelectDay with the ISO date", async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[]}
        categoryMap={catMap([])}
        onSelectDay={onSelectDay}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb14 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-14");
    if (!feb14) throw new Error("missing feb 14");
    await user.click(feb14);
    expect(onSelectDay).toHaveBeenCalledWith("2026-02-14");
  });

  test("selected day gets aria-selected='true'", () => {
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[]}
        categoryMap={catMap([])}
        selectedDay="2026-02-09"
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb9 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-09");
    expect(feb9).toHaveAttribute("aria-selected", "true");
  });

  test("missing onSelectDay does not crash", async () => {
    const user = userEvent.setup();
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[]}
        categoryMap={catMap([])}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb14 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-14");
    if (!feb14) throw new Error("missing feb 14");
    await user.click(feb14);
  });
});

describe("PlanCalendar banner display (improvement)", () => {
  test("banner shows rule name and compact amount", () => {
    const r = rule({
      id: "r1",
      name: "房贷",
      categoryId: "c1",
      amountCents: 250000, // ¥2,500
      dayOfMonth: 10,
    });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[r]}
        categoryMap={catMap([{ id: "c1", name: "房贷", colorToken: "chart-9" }])}
      />,
    );
    const banner = screen.getByTestId("banner-2026-02-10-r1");
    expect(within(banner).getByText("房贷")).toBeInTheDocument();
    expect(within(banner).getByText("¥2,500")).toBeInTheDocument();
  });

  test("banner shows '万' suffix for amounts ≥ 10000 yuan", () => {
    const r = rule({
      id: "r1",
      name: "保险",
      amountCents: 1234500, // 12,345 yuan → ¥1.2万
      dayOfMonth: 5,
    });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[r]}
        categoryMap={catMap([])}
      />,
    );
    const banner = screen.getByTestId("banner-2026-02-05-r1");
    expect(within(banner).getByText("¥1.2万")).toBeInTheDocument();
  });

  test("clicking a banner calls onOpenRule and does NOT call onSelectDay", async () => {
    const user = userEvent.setup();
    const onOpenRule = vi.fn();
    const onSelectDay = vi.fn();
    const r = rule({ id: "r1", name: "Netflix", amountCents: 9900, dayOfMonth: 12 });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[r]}
        categoryMap={catMap([])}
        onOpenRule={onOpenRule}
        onSelectDay={onSelectDay}
      />,
    );
    await user.click(screen.getByTestId("banner-2026-02-12-r1"));
    expect(onOpenRule).toHaveBeenCalledWith("r1");
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  test("clicking the +N overflow opens the day detail (onSelectDay)", async () => {
    const user = userEvent.setup();
    const onOpenRule = vi.fn();
    const onSelectDay = vi.fn();
    const rules = Array.from({ length: 5 }, (_, i) =>
      rule({ id: `r${i}`, dayOfMonth: 8 }),
    );
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={rules}
        categoryMap={catMap([])}
        onOpenRule={onOpenRule}
        onSelectDay={onSelectDay}
      />,
    );
    await user.click(screen.getByTestId("overflow-2026-02-08"));
    expect(onSelectDay).toHaveBeenCalledWith("2026-02-08");
    expect(onOpenRule).not.toHaveBeenCalled();
  });

  test("keyboard-activating a banner calls onOpenRule and NOT onSelectDay", async () => {
    const user = userEvent.setup();
    const onOpenRule = vi.fn();
    const onSelectDay = vi.fn();
    const r = rule({ id: "r1", name: "Netflix", amountCents: 9900, dayOfMonth: 12 });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[r]}
        categoryMap={catMap([])}
        onOpenRule={onOpenRule}
        onSelectDay={onSelectDay}
      />,
    );
    const banner = screen.getByTestId("banner-2026-02-12-r1");
    banner.focus();
    expect(banner).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onOpenRule).toHaveBeenCalledWith("r1");
    expect(onSelectDay).not.toHaveBeenCalled();

    onOpenRule.mockClear();
    banner.focus();
    await user.keyboard(" ");
    expect(onOpenRule).toHaveBeenCalledWith("r1");
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  test("keyboard Enter on the cell itself calls onSelectDay", async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[]}
        categoryMap={catMap([])}
        onSelectDay={onSelectDay}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb14 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-14");
    if (!feb14) throw new Error("missing feb 14");
    (feb14 as HTMLElement).focus();
    await user.keyboard("{Enter}");
    expect(onSelectDay).toHaveBeenCalledWith("2026-02-14");
  });

  test("clicking empty area of a day still opens day detail (onSelectDay)", async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[]}
        categoryMap={catMap([])}
        onSelectDay={onSelectDay}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb14 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-14");
    if (!feb14) throw new Error("missing feb 14");
    await user.click(feb14);
    expect(onSelectDay).toHaveBeenCalledWith("2026-02-14");
  });
});

describe("PlanCalendar cross-month occurrences (P3-C5)", () => {
  test("monthly rule starting in Jan shows up in February too", () => {
    const r = rule({
      id: "r1",
      categoryId: "c1",
      frequency: "monthly",
      dayOfMonth: 7,
      startDate: "2026-01-07",
    });
    render(
      <PlanCalendar
        viewMonth="2026-02-01"
        rules={[r]}
        categoryMap={catMap([{ id: "c1", name: "x", colorToken: "chart-1" }])}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const feb7 = cells.find((c) => c.getAttribute("data-iso") === "2026-02-07");
    expect(feb7?.querySelector("[data-rule-id='r1']")).not.toBeNull();
  });

  test("rule's occurrence on adjacent-month days (Jan in Feb view) renders", () => {
    // Feb 2026 starts on a Sunday so there are no Jan-padding cells in
    // a Sunday-start grid; switch to a month where padding appears.
    const r = rule({
      id: "r1",
      frequency: "daily",
      interval: 1,
      dayOfMonth: null,
      startDate: "2025-12-28",
    });
    render(
      <PlanCalendar
        viewMonth="2026-01-01"
        rules={[r]}
        categoryMap={catMap([])}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    // Dec 28 2025 is the first padding cell.
    expect(cells[0]?.getAttribute("data-iso")).toBe("2025-12-28");
    expect(cells[0]?.querySelector("[data-rule-id='r1']")).not.toBeNull();
  });
});
