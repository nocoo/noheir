import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const {
  createMock,
  updateMock,
  deleteMock,
  pauseMock,
  resumeMock,
  endMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  pauseMock: vi.fn(),
  resumeMock: vi.fn(),
  endMock: vi.fn(),
}));

vi.mock("@/app/actions/recurring-expense-actions", () => ({
  createRecurringExpense: createMock,
  updateRecurringExpense: updateMock,
  deleteRecurringExpense: deleteMock,
}));
vi.mock("@/app/actions/recurring-expense-state-actions", () => ({
  pauseRecurringExpense: pauseMock,
  resumeRecurringExpense: resumeMock,
  endRecurringExpense: endMock,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  CalendarClient,
  ruleToFormInitial,
} from "@/app/plan/calendar/calendar-client";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

function rule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: "r1",
    userId: "u",
    name: "Netflix",
    categoryId: null,
    amountCents: 9900,
    currency: "CNY",
    account: null,
    frequency: "monthly",
    interval: 1,
    dayOfMonth: 7,
    monthOfYear: null,
    weekday: null,
    startDate: "2026-01-07",
    endDate: null,
    status: "active",
    endedAt: null,
    note: null,
    ...overrides,
  };
}

const CATS = [
  { id: "cat-a", name: "订阅", colorToken: "chart-1", sortOrder: 0 },
  { id: "cat-b", name: "房贷", colorToken: "chart-9", sortOrder: 1 },
];

const TODAY = "2026-06-07";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ruleToFormInitial (P3-C10)", () => {
  test("converts amountCents to yuan and forwards every field", () => {
    const r = rule({
      id: "r9",
      name: "x",
      amountCents: 12345,
      categoryId: "cat-a",
      account: "招行",
      frequency: "weekly",
      weekday: 3,
      dayOfMonth: null,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      note: "note",
    });
    expect(ruleToFormInitial(r)).toEqual({
      id: "r9",
      name: "x",
      amount: 123.45,
      categoryId: "cat-a",
      account: "招行",
      frequency: "weekly",
      interval: 1,
      dayOfMonth: null,
      monthOfYear: null,
      weekday: 3,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      note: "note",
    });
  });
});

describe("CalendarClient render (P3-C10)", () => {
  test("heading + new-rule button + summary cards + calendar + rule list", () => {
    render(
      <CalendarClient
        rules={[rule({ id: "r1" })]}
        categories={CATS}
        todayIso={TODAY}
      />,
    );
    expect(screen.getByText("资金计划日历")).toBeInTheDocument();
    expect(screen.getByTestId("open-create-rule")).toBeInTheDocument();
    // Summary cards group label from PlanSummaryCards.
    expect(
      screen.getByRole("group", { name: "周期支出汇总" }),
    ).toBeInTheDocument();
    // Calendar grid from PlanCalendar.
    expect(screen.getByRole("grid")).toBeInTheDocument();
    // Rule list section.
    expect(screen.getByText("所有规则")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "周期支出" }),
    ).toBeInTheDocument();
  });

  test("calendar defaults to the month containing todayIso", () => {
    render(
      <CalendarClient
        rules={[]}
        categories={[]}
        todayIso="2026-06-07"
      />,
    );
    expect(screen.getByText("2026 年 6 月")).toBeInTheDocument();
  });
});

describe("CalendarClient navigation (P3-C10)", () => {
  test("下一月 advances the calendar one month", async () => {
    const user = userEvent.setup();
    render(<CalendarClient rules={[]} categories={[]} todayIso={TODAY} />);
    await user.click(screen.getByRole("button", { name: "下一月" }));
    expect(screen.getByText("2026 年 7 月")).toBeInTheDocument();
  });

  test("上一月 goes back, wrapping the year correctly", async () => {
    const user = userEvent.setup();
    render(
      <CalendarClient
        rules={[]}
        categories={[]}
        todayIso="2026-01-15"
      />,
    );
    await user.click(screen.getByRole("button", { name: "上一月" }));
    expect(screen.getByText("2025 年 12 月")).toBeInTheDocument();
  });

  test("今天 returns to today's month", async () => {
    const user = userEvent.setup();
    render(<CalendarClient rules={[]} categories={[]} todayIso={TODAY} />);
    await user.click(screen.getByRole("button", { name: "下一月" }));
    await user.click(screen.getByRole("button", { name: "下一月" }));
    expect(screen.getByText("2026 年 8 月")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "今天" }));
    expect(screen.getByText("2026 年 6 月")).toBeInTheDocument();
  });
});

describe("CalendarClient day → popover wiring (P3-C10)", () => {
  test("clicking a calendar day opens the DayDetailPopover for that ISO", async () => {
    const user = userEvent.setup();
    render(
      <CalendarClient
        rules={[rule({ id: "r1", name: "Netflix", dayOfMonth: 10 })]}
        categories={CATS}
        todayIso={TODAY}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const june10 = cells.find(
      (c) => c.getAttribute("data-iso") === "2026-06-10",
    );
    if (!june10) throw new Error("missing June 10");
    await user.click(june10);
    const dialog = await screen.findByRole("dialog");
    // Title is the ISO date.
    expect(dialog).toHaveAccessibleName("2026-06-10");
    // The rule is listed inside.
    expect(within(dialog).getByText("Netflix")).toBeInTheDocument();
  });
});

describe("CalendarClient create/edit dialogs (P3-C10)", () => {
  test("新建周期支出 button opens the create dialog with empty form", async () => {
    const user = userEvent.setup();
    render(
      <CalendarClient rules={[]} categories={CATS} todayIso={TODAY} />,
    );
    await user.click(screen.getByTestId("open-create-rule"));
    expect(
      await screen.findByRole("dialog", { name: "新建周期支出" }),
    ).toBeInTheDocument();
    // Form aria-label confirms it's the create form.
    expect(
      screen.getByRole("form", { name: "新建周期支出" }),
    ).toBeInTheDocument();
  });

  test("rule list 编辑 menu opens the edit dialog with the rule prefilled", async () => {
    const user = userEvent.setup();
    render(
      <CalendarClient
        rules={[rule({ id: "r1", name: "房贷", amountCents: 250000 })]}
        categories={CATS}
        todayIso={TODAY}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "房贷 操作菜单" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "编辑" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑周期支出" });
    expect(
      within(dialog).getByLabelText("名称"),
    ).toHaveValue("房贷");
    expect(within(dialog).getByLabelText("金额 (元)")).toHaveValue(2500);
  });

  test("popover 查看 opens the edit dialog and closes the popover", async () => {
    const user = userEvent.setup();
    render(
      <CalendarClient
        rules={[rule({ id: "r1", name: "Netflix", dayOfMonth: 10 })]}
        categories={CATS}
        todayIso={TODAY}
      />,
    );
    const cells = screen.getAllByRole("gridcell");
    const june10 = cells.find(
      (c) => c.getAttribute("data-iso") === "2026-06-10",
    );
    if (!june10) throw new Error("missing");
    await user.click(june10);
    const popover = await screen.findByRole("dialog");
    expect(popover).toHaveAccessibleName("2026-06-10");
    await user.click(within(popover).getByRole("button", { name: "查看" }));
    // After clicking 查看 the day popover closes, the edit dialog opens.
    const edit = await screen.findByRole("dialog", { name: "编辑周期支出" });
    expect(edit).toBeInTheDocument();
  });
});

describe("CalendarClient rule list ordering (P3-C10)", () => {
  test("rules are sorted by name (zh locale)", () => {
    render(
      <CalendarClient
        rules={[
          rule({ id: "r1", name: "Netflix" }),
          rule({ id: "r2", name: "房贷" }),
          rule({ id: "r3", name: "保险" }),
        ]}
        categories={CATS}
        todayIso={TODAY}
      />,
    );
    const list = screen.getByRole("list", { name: "周期支出" });
    const items = within(list).getAllByRole("listitem");
    const names = items.map((li) => {
      const el = li.querySelector("p.truncate");
      return el?.textContent ?? "";
    });
    // localeCompare zh sort.
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "zh")));
  });
});

describe("CalendarClient router.refresh on mutation success (P3-C10 fix)", () => {
  test("create rule success → refresh()", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce({ success: true, data: { id: "new" } });
    render(<CalendarClient rules={[]} categories={CATS} todayIso={TODAY} />);
    await user.click(screen.getByTestId("open-create-rule"));
    const dialog = await screen.findByRole("dialog", { name: "新建周期支出" });
    await user.type(within(dialog).getByLabelText("名称"), "新");
    await user.type(within(dialog).getByLabelText("金额 (元)"), "100");
    await user.type(within(dialog).getByLabelText("开始日期"), "2026-01-01");
    await user.type(within(dialog).getByLabelText("日"), "1");
    await user.click(within(dialog).getByRole("button", { name: "创建" }));
    expect(createMock).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  test("edit rule success → refresh()", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <CalendarClient
        rules={[rule({ id: "r1", name: "old" })]}
        categories={CATS}
        todayIso={TODAY}
      />,
    );
    await user.click(screen.getByRole("button", { name: "old 操作菜单" }));
    await user.click(await screen.findByRole("menuitem", { name: "编辑" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑周期支出" });
    await user.click(within(dialog).getByRole("button", { name: "保存" }));
    expect(updateMock).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  test("RuleList pause success → refresh(); failure does NOT refresh", async () => {
    const user = userEvent.setup();
    pauseMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <CalendarClient
        rules={[rule({ id: "r1", name: "A" })]}
        categories={CATS}
        todayIso={TODAY}
      />,
    );
    await user.click(screen.getByRole("button", { name: "A 操作菜单" }));
    await user.click(await screen.findByRole("menuitem", { name: "暂停" }));
    expect(pauseMock).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // Failure path: action returns success: false → no refresh
    refreshMock.mockClear();
    pauseMock.mockResolvedValueOnce({ success: false, error: "no" });
    await user.click(screen.getByRole("button", { name: "A 操作菜单" }));
    await user.click(await screen.findByRole("menuitem", { name: "暂停" }));
    expect(refreshMock).not.toHaveBeenCalled();
  });

  test("RuleList delete success → refresh()", async () => {
    const user = userEvent.setup();
    deleteMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <CalendarClient
        rules={[rule({ id: "r1", name: "A" })]}
        categories={CATS}
        todayIso={TODAY}
      />,
    );
    await user.click(screen.getByRole("button", { name: "A 操作菜单" }));
    await user.click(await screen.findByRole("menuitem", { name: "删除" }));
    expect(deleteMock).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });
});
