import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pauseMock, resumeMock, endMock, deleteMock } = vi.hoisted(() => ({
  pauseMock: vi.fn(),
  resumeMock: vi.fn(),
  endMock: vi.fn(),
  deleteMock: vi.fn(),
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/actions/recurring-expense-state-actions", () => ({
  pauseRecurringExpense: pauseMock,
  resumeRecurringExpense: resumeMock,
  endRecurringExpense: endMock,
}));

vi.mock("@/app/actions/recurring-expense-actions", () => ({
  deleteRecurringExpense: deleteMock,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import {
  menuItemsFor,
  RuleList,
  type RuleListCategory,
} from "@/components/plan/rule-list";
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

function catMap(entries: RuleListCategory[]): Map<string, RuleListCategory> {
  return new Map(entries.map((c) => [c.id, c]));
}

beforeEach(() => {
  vi.resetAllMocks();
});

const TODAY = "2026-06-07";

async function openMenu(name: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `${name} 操作菜单` }));
}

describe("menuItemsFor (P3-C8) — mirrors P2-C9 legal-transition matrix", () => {
  test("active → edit, pause, end, delete", () => {
    expect(menuItemsFor("active")).toEqual(["edit", "pause", "end", "delete"]);
  });
  test("paused → edit, resume, end, delete", () => {
    expect(menuItemsFor("paused")).toEqual(["edit", "resume", "end", "delete"]);
  });
  test("ended → edit, delete (terminal)", () => {
    expect(menuItemsFor("ended")).toEqual(["edit", "delete"]);
  });
  test("expired → edit, end, delete", () => {
    expect(menuItemsFor("expired")).toEqual(["edit", "end", "delete"]);
  });
});

describe("RuleList render (P3-C8)", () => {
  test("empty state shown when no rules", () => {
    render(<RuleList rules={[]} categoryMap={catMap([])} todayIso={TODAY} />);
    expect(screen.getByTestId("rule-list-empty")).toBeInTheDocument();
  });

  test("row shows name, status chip, amount, frequency+category", () => {
    const r = rule({
      id: "r1",
      name: "Netflix",
      categoryId: "cat-a",
      amountCents: 9900,
      frequency: "monthly",
      dayOfMonth: 7,
    });
    render(
      <RuleList
        rules={[r]}
        categoryMap={catMap([{ id: "cat-a", name: "订阅", colorToken: "chart-1" }])}
        todayIso={TODAY}
      />,
    );
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("¥99")).toBeInTheDocument();
    expect(screen.getByTestId("status-r1")).toHaveTextContent("进行中");
    const li = screen.getByText("Netflix").closest("li") as HTMLElement;
    expect(li.textContent).toMatch(/每个月/);
    expect(li.textContent).toMatch(/7 日/);
    expect(li.textContent).toMatch(/订阅/);
    expect(screen.getByTestId("rule-color-r1")).toHaveStyle({
      backgroundColor: "hsl(var(--chart-1))",
    });
  });

  test("missing category → muted color fallback", () => {
    const r = rule({ id: "r1", categoryId: "ghost", amountCents: 100 });
    render(<RuleList rules={[r]} categoryMap={catMap([])} todayIso={TODAY} />);
    expect(
      screen.getByTestId("rule-color-r1").style.backgroundColor,
    ).toContain("muted-foreground");
  });

  test("status chip: paused", () => {
    render(
      <RuleList
        rules={[rule({ id: "r1", status: "paused" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
      />,
    );
    expect(screen.getByTestId("status-r1")).toHaveTextContent("已暂停");
  });

  test("status chip: ended", () => {
    render(
      <RuleList
        rules={[rule({ id: "r1", status: "ended", endedAt: "2026-05-01" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
      />,
    );
    expect(screen.getByTestId("status-r1")).toHaveTextContent("已结束");
  });

  test("status chip: active rule with endDate < today → 已过期", () => {
    render(
      <RuleList
        rules={[rule({ id: "r1", endDate: "2026-05-01" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
      />,
    );
    expect(screen.getByTestId("status-r1")).toHaveTextContent("已过期");
  });
});

describe("RuleList menu items per status (P3-C8)", () => {
  test("active row menu has 暂停 + 结束 + 删除, no 恢复", async () => {
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    const items = await screen.findAllByRole("menuitem");
    const labels = items.map((i) => i.textContent);
    expect(labels).toContain("编辑");
    expect(labels).toContain("暂停");
    expect(labels).toContain("结束");
    expect(labels).toContain("删除");
    expect(labels).not.toContain("恢复");
  });

  test("paused row menu has 恢复 + 结束 + 删除, no 暂停", async () => {
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A", status: "paused" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    const items = await screen.findAllByRole("menuitem");
    const labels = items.map((i) => i.textContent);
    expect(labels).toContain("恢复");
    expect(labels).toContain("结束");
    expect(labels).toContain("删除");
    expect(labels).not.toContain("暂停");
  });

  test("ended row menu has only 编辑 + 删除", async () => {
    render(
      <RuleList
        rules={[
          rule({ id: "r1", name: "A", status: "ended", endedAt: "2026-05-01" }),
        ]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    const items = await screen.findAllByRole("menuitem");
    const labels = items.map((i) => i.textContent);
    expect(labels).toEqual(["编辑", "删除"]);
  });

  test("expired row menu: 编辑 + 结束 + 删除, no 暂停/恢复", async () => {
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A", endDate: "2026-05-01" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    const items = await screen.findAllByRole("menuitem");
    const labels = items.map((i) => i.textContent);
    expect(labels).toEqual(["编辑", "结束", "删除"]);
  });

  test("编辑 menuitem disabled when onEditRule not provided", async () => {
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
      />,
    );
    await openMenu("A");
    const edit = await screen.findByRole("menuitem", { name: "编辑" });
    expect(edit).toHaveAttribute("aria-disabled", "true");
  });
});

describe("RuleList action invocations (P3-C8)", () => {
  test("暂停 calls pauseRecurringExpense and toasts success", async () => {
    const user = userEvent.setup();
    pauseMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    await user.click(await screen.findByRole("menuitem", { name: "暂停" }));
    expect(pauseMock).toHaveBeenCalledWith("r1");
    expect(toastSuccess).toHaveBeenCalledWith("已暂停");
  });

  test("恢复 calls resumeRecurringExpense and toasts success", async () => {
    const user = userEvent.setup();
    resumeMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A", status: "paused" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    await user.click(await screen.findByRole("menuitem", { name: "恢复" }));
    expect(resumeMock).toHaveBeenCalledWith("r1");
    expect(toastSuccess).toHaveBeenCalledWith("已恢复");
  });

  test("结束 calls endRecurringExpense and toasts success", async () => {
    const user = userEvent.setup();
    endMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    await user.click(await screen.findByRole("menuitem", { name: "结束" }));
    expect(endMock).toHaveBeenCalledWith("r1");
    expect(toastSuccess).toHaveBeenCalledWith("已结束");
  });

  test("删除 calls deleteRecurringExpense and toasts success", async () => {
    const user = userEvent.setup();
    deleteMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    await user.click(await screen.findByRole("menuitem", { name: "删除" }));
    expect(deleteMock).toHaveBeenCalledWith("r1");
    expect(toastSuccess).toHaveBeenCalledWith("已删除");
  });

  test("编辑 calls onEditRule and does NOT touch worker actions", async () => {
    const user = userEvent.setup();
    const onEditRule = vi.fn();
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={onEditRule}
      />,
    );
    await openMenu("A");
    await user.click(await screen.findByRole("menuitem", { name: "编辑" }));
    expect(onEditRule).toHaveBeenCalledWith("r1");
    expect(pauseMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  test("action error surfaces in toast.error", async () => {
    const user = userEvent.setup();
    pauseMock.mockResolvedValueOnce({ success: false, error: "可恶" });
    render(
      <RuleList
        rules={[rule({ id: "r1", name: "A" })]}
        categoryMap={catMap([])}
        todayIso={TODAY}
        onEditRule={() => {}}
      />,
    );
    await openMenu("A");
    await user.click(await screen.findByRole("menuitem", { name: "暂停" }));
    expect(toastError).toHaveBeenCalledWith("可恶");
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
