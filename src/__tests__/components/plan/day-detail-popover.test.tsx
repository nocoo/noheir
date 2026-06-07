import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  buildDayDetailRows,
  DayDetailPopover,
  sumDay,
  type DayDetailCategory,
} from "@/components/plan/day-detail-popover";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

function rule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: "r",
    userId: "u",
    name: "rule",
    categoryId: null,
    amountCents: 10000,
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

function catMap(entries: DayDetailCategory[]): Map<string, DayDetailCategory> {
  return new Map(entries.map((c) => [c.id, c]));
}

function occMap(
  entries: Array<[string, RecurrenceRule[]]>,
): Map<string, RecurrenceRule[]> {
  return new Map(entries);
}

describe("buildDayDetailRows / sumDay (P3-C7)", () => {
  test("isoDate=null → empty rows, sum 0", () => {
    expect(buildDayDetailRows(null, occMap([]), catMap([]))).toEqual([]);
    expect(sumDay(null, occMap([]))).toBe(0);
  });

  test("day with no occurrences → empty rows, sum 0", () => {
    expect(
      buildDayDetailRows("2026-06-07", occMap([]), catMap([])),
    ).toEqual([]);
    expect(sumDay("2026-06-07", occMap([]))).toBe(0);
  });

  test("multiple occurrences are listed in input order", () => {
    const r1 = rule({ id: "r1", name: "Netflix", categoryId: "cat-a", amountCents: 9900 });
    const r2 = rule({ id: "r2", name: "房贷", categoryId: "cat-b", amountCents: 500000 });
    const r3 = rule({ id: "r3", name: "无分类", amountCents: 1234 });
    const rows = buildDayDetailRows(
      "2026-06-07",
      occMap([["2026-06-07", [r1, r2, r3]]]),
      catMap([
        { id: "cat-a", name: "订阅", colorToken: "chart-1" },
        { id: "cat-b", name: "房贷", colorToken: "chart-9" },
      ]),
    );
    expect(rows.map((r) => r.ruleId)).toEqual(["r1", "r2", "r3"]);
    expect(rows.map((r) => r.amountYuan)).toEqual(["¥99", "¥5,000", "¥12.34"]);
    expect(rows.map((r) => r.categoryName)).toEqual(["订阅", "房贷", null]);
  });

  test("rule referencing missing category → categoryName=null, color falls back", () => {
    const r1 = rule({ id: "r1", categoryId: "ghost", amountCents: 100 });
    const rows = buildDayDetailRows(
      "2026-06-07",
      occMap([["2026-06-07", [r1]]]),
      catMap([]),
    );
    expect(rows[0]?.categoryName).toBeNull();
    expect(rows[0]?.colorCss).toContain("muted-foreground");
  });

  test("rule referencing category whose colorToken is off-palette → fallback", () => {
    const r1 = rule({ id: "r1", categoryId: "bad", amountCents: 100 });
    const rows = buildDayDetailRows(
      "2026-06-07",
      occMap([["2026-06-07", [r1]]]),
      catMap([{ id: "bad", name: "x", colorToken: "rebeccapurple" }]),
    );
    expect(rows[0]?.colorCss).toContain("muted-foreground");
  });

  test("frequency description comes from describeFrequency", () => {
    const r = rule({
      id: "r1",
      frequency: "weekly",
      interval: 1,
      weekday: 3,
      dayOfMonth: null,
    });
    const rows = buildDayDetailRows(
      "2026-06-07",
      occMap([["2026-06-07", [r]]]),
      catMap([]),
    );
    expect(rows[0]?.frequencyText).toContain("每周");
    expect(rows[0]?.frequencyText).toContain("周三");
  });

  test("sumDay sums all amountCents for the day", () => {
    const r1 = rule({ id: "r1", amountCents: 100 });
    const r2 = rule({ id: "r2", amountCents: 250 });
    expect(
      sumDay("2026-06-07", occMap([["2026-06-07", [r1, r2]]])),
    ).toBe(350);
  });
});

describe("DayDetailPopover render (P3-C7)", () => {
  test("open=false renders nothing", () => {
    render(
      <DayDetailPopover
        open={false}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([])}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("open=true with isoDate=null renders nothing", () => {
    render(
      <DayDetailPopover
        open={true}
        isoDate={null}
        occurrencesByDay={occMap([])}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("open dialog uses DialogTitle as its accessible name (the date)", () => {
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([])}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    // Radix Dialog wires aria-labelledby → DialogTitle. The accessible
    // name is the title text.
    expect(
      screen.getByRole("dialog", { name: "2026-06-07" }),
    ).toBeInTheDocument();
  });

  test("empty day shows 当天无周期支出 message", () => {
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([])}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("当天无周期支出")).toBeInTheDocument();
  });

  test("non-empty day lists every occurrence (not capped at 3)", () => {
    const rules = Array.from({ length: 5 }, (_, i) =>
      rule({ id: `r${i}`, name: `Item ${i}`, amountCents: 100 * (i + 1) }),
    );
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([["2026-06-07", rules]])}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(within(dialog).getByText("共 5 项 · ¥15")).toBeInTheDocument();
  });

  test("each item shows name, frequency, category, amount, color chip", () => {
    const r = rule({
      id: "r1",
      name: "Netflix",
      categoryId: "c1",
      amountCents: 9900,
      frequency: "monthly",
      dayOfMonth: 7,
      interval: 1,
    });
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([["2026-06-07", [r]]])}
        categoryMap={catMap([{ id: "c1", name: "订阅", colorToken: "chart-1" }])}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("¥99")).toBeInTheDocument();
    // Frequency + category share a paragraph with mixed text nodes —
    // pull out the row and check its textContent.
    const row = screen.getByText("Netflix").closest("li") as HTMLElement;
    expect(row.textContent).toMatch(/每个月/);
    expect(row.textContent).toMatch(/7 日/);
    expect(row.textContent).toMatch(/订阅/);
    expect(screen.getByTestId("color-chip-r1")).toHaveStyle({
      backgroundColor: "hsl(var(--chart-1))",
    });
  });
});

describe("DayDetailPopover interaction (P3-C7)", () => {
  test("clicking close button calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([])}
        categoryMap={catMap([])}
        onClose={onClose}
      />,
    );
    // Radix Dialog renders the close X with sr-only "Close" text.
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Escape key dismisses the dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([])}
        categoryMap={catMap([])}
        onClose={onClose}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("dialog renders a Radix Overlay (DismissableLayer machinery is wired up)", () => {
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([])}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    // The presence of the overlay node is the load-bearing structural
    // proof that we're using the Radix Dialog primitive rather than a
    // hand-rolled overlay; outside-click dismissal is then covered by
    // Radix's own tests in @radix-ui/react-dialog.
    expect(
      document.querySelector("[data-slot='dialog-overlay']"),
    ).not.toBeNull();
  });

  test("clicking inside the inner panel does NOT close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([
          ["2026-06-07", [rule({ id: "r1", name: "x" })]],
        ])}
        categoryMap={catMap([])}
        onClose={onClose}
      />,
    );
    const item = screen.getByText("x");
    await user.click(item);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("focus is trapped inside the dialog (Tab does not escape to outside buttons)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button" data-testid="before">
          before
        </button>
        <DayDetailPopover
          open={true}
          isoDate="2026-06-07"
          occurrencesByDay={occMap([
            [
              "2026-06-07",
              [rule({ id: "r1", name: "A" }), rule({ id: "r2", name: "B" })],
            ],
          ])}
          categoryMap={catMap([])}
          onClose={() => {}}
          onOpenRule={() => {}}
        />
        <button type="button" data-testid="after">
          after
        </button>
      </>,
    );
    // Tab a number of times; focus must NEVER land on the outside
    // buttons because Radix FocusScope holds it inside the dialog.
    for (let i = 0; i < 10; i++) {
      await user.tab();
      expect(document.activeElement).not.toBe(
        screen.getByTestId("before"),
      );
      expect(document.activeElement).not.toBe(
        screen.getByTestId("after"),
      );
    }
  });

  test("'查看' button calls onOpenRule with the rule id", async () => {
    const user = userEvent.setup();
    const onOpenRule = vi.fn();
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([
          ["2026-06-07", [rule({ id: "r1", name: "x" })]],
        ])}
        categoryMap={catMap([])}
        onClose={() => {}}
        onOpenRule={onOpenRule}
      />,
    );
    await user.click(screen.getByRole("button", { name: "查看" }));
    expect(onOpenRule).toHaveBeenCalledWith("r1");
  });

  test("no '查看' button when onOpenRule is not provided", () => {
    render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occMap([
          ["2026-06-07", [rule({ id: "r1", name: "x" })]],
        ])}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "查看" })).toBeNull();
  });
});

describe("DayDetailPopover selectedDay change (P3-C7)", () => {
  test("isoDate change while open shows the new day's items", () => {
    const r1 = rule({ id: "r1", name: "Day1" });
    const r2 = rule({ id: "r2", name: "Day2" });
    const occ = occMap([
      ["2026-06-07", [r1]],
      ["2026-06-08", [r2]],
    ]);
    const { rerender } = render(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-07"
        occurrencesByDay={occ}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Day1")).toBeInTheDocument();
    rerender(
      <DayDetailPopover
        open={true}
        isoDate="2026-06-08"
        occurrencesByDay={occ}
        categoryMap={catMap([])}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText("Day1")).toBeNull();
    expect(screen.getByText("Day2")).toBeInTheDocument();
  });
});
