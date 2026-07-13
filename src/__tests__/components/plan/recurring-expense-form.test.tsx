import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { createMock, updateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/actions/recurring-expense-actions", () => ({
  createRecurringExpense: createMock,
  updateRecurringExpense: updateMock,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { RecurringExpenseForm } from "@/components/plan/recurring-expense-form";

const CATEGORIES = [
  { id: "cat-a", name: "房贷" },
  { id: "cat-b", name: "保险" },
];

beforeEach(() => {
  vi.resetAllMocks();
});

const NAME = () => screen.getByLabelText("名称") as HTMLInputElement;
const AMOUNT = () => screen.getByLabelText("金额 (元)") as HTMLInputElement;
const START = () => screen.getByLabelText("开始日期") as HTMLInputElement;
const END = () => screen.getByLabelText("结束日期") as HTMLInputElement;
const NOTE = () => screen.getByLabelText("备注") as HTMLTextAreaElement;
const CATEGORY_SELECT = () => screen.getByLabelText("分类") as HTMLSelectElement;
const DAY = () => screen.getByLabelText("日") as HTMLInputElement;
const SUBMIT = (label: string) => screen.getByRole("button", { name: label });

describe("RecurringExpenseForm rendering (P3-C4)", () => {
  test("create mode: empty fields, default monthly, button '创建'", () => {
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    expect(screen.getByRole("form", { name: "新建周期支出" })).toBeInTheDocument();
    expect(NAME()).toHaveValue("");
    expect(AMOUNT()).toHaveValue(null);
    expect(START()).toHaveValue("");
    expect(END()).toHaveValue("");
    expect(CATEGORY_SELECT()).toHaveValue("");
    expect(screen.getByRole("radio", { name: "每月" })).toHaveAttribute("aria-checked", "true");
    expect(SUBMIT("创建")).toBeInTheDocument();
  });

  test("category select lists provided categories plus 未分类", () => {
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    const labels = Array.from(CATEGORY_SELECT().options).map((o) => o.text);
    expect(labels).toEqual(["未分类", "房贷", "保险"]);
  });

  test("edit mode: every field prefilled, button '保存'", () => {
    render(
      <RecurringExpenseForm
        categories={CATEGORIES}
        initial={{
          id: "rule-1",
          name: "Netflix",
          amount: 99,
          categoryId: "cat-a",
          account: "招行储蓄卡",
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 15,
          startDate: "2026-01-15",
          endDate: "2026-12-31",
          note: "家庭账号",
        }}
      />,
    );
    expect(screen.getByRole("form", { name: "编辑周期支出" })).toBeInTheDocument();
    expect(NAME()).toHaveValue("Netflix");
    expect(AMOUNT()).toHaveValue(99);
    expect(CATEGORY_SELECT()).toHaveValue("cat-a");
    expect(screen.getByLabelText("账户")).toHaveValue("招行储蓄卡");
    expect(START()).toHaveValue("2026-01-15");
    expect(END()).toHaveValue("2026-12-31");
    expect(NOTE()).toHaveValue("家庭账号");
    expect(SUBMIT("保存")).toBeInTheDocument();
  });

  test("edit mode with null endDate keeps endDate empty", () => {
    render(
      <RecurringExpenseForm
        categories={CATEGORIES}
        initial={{
          id: "r1",
          name: "x",
          amount: 1,
          frequency: "daily",
          interval: 1,
          startDate: "2026-01-01",
          endDate: null,
        }}
      />,
    );
    expect(END()).toHaveValue("");
  });
});

describe("RecurringExpenseForm validation (P3-C4)", () => {
  test("empty form → name/amount/startDate/dayOfMonth errors, no action call", async () => {
    const user = userEvent.setup();
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.click(SUBMIT("创建"));
    expect(screen.getByText("请填写名称")).toBeInTheDocument();
    expect(screen.getByText("请填写有效金额")).toBeInTheDocument();
    expect(screen.getByText("请填写开始日期")).toBeInTheDocument();
    expect(screen.getByText("请填写日")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  test("amount '0' rejected (must be > 0)", async () => {
    const user = userEvent.setup();
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "0");
    await user.type(START(), "2026-01-01");
    await user.type(DAY(), "1");
    await user.click(SUBMIT("创建"));
    expect(screen.getByText("请填写有效金额")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  test("endDate < startDate → endDate error", async () => {
    const user = userEvent.setup();
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "10");
    await user.type(START(), "2026-06-01");
    await user.type(END(), "2026-05-01");
    await user.type(DAY(), "1");
    await user.click(SUBMIT("创建"));
    expect(screen.getByText("结束日期不能早于开始日期")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  test("weekly without weekday → conditional error", async () => {
    const user = userEvent.setup();
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "1");
    await user.type(START(), "2026-01-01");
    await user.click(screen.getByRole("radio", { name: "每周" }));
    await user.click(SUBMIT("创建"));
    expect(screen.getByText("请选择周几")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  test("yearly without month/day → both errors", async () => {
    const user = userEvent.setup();
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "1");
    await user.type(START(), "2026-01-01");
    await user.click(screen.getByRole("radio", { name: "每年" }));
    await user.click(SUBMIT("创建"));
    expect(screen.getByText("请填写月份")).toBeInTheDocument();
    expect(screen.getByText("请填写日")).toBeInTheDocument();
  });
});

describe("RecurringExpenseForm submit — create (P3-C4)", () => {
  test("happy path: yuan amount, conditional dayOfMonth, nulls normalised", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    createMock.mockResolvedValueOnce({ success: true, data: { id: "rule-new" } });
    render(<RecurringExpenseForm categories={CATEGORIES} onSuccess={onSuccess} />);
    await user.type(NAME(), "房租");
    await user.type(AMOUNT(), "1500.5");
    await user.type(START(), "2026-01-15");
    await user.selectOptions(CATEGORY_SELECT(), "cat-a");
    await user.type(DAY(), "15");
    await user.click(SUBMIT("创建"));
    expect(createMock).toHaveBeenCalledTimes(1);
    const payload = createMock.mock.calls[0]?.[0] as Record<string, unknown>;
    if (!payload) throw new Error("no payload");
    expect(payload.amount).toBe(1500.5);
    expect(payload.name).toBe("房租");
    expect(payload.categoryId).toBe("cat-a");
    expect(payload.frequency).toBe("monthly");
    expect(payload.interval).toBe(1);
    expect(payload.dayOfMonth).toBe(15);
    expect(payload.startDate).toBe("2026-01-15");
    expect(payload.endDate).toBeNull();
    expect(payload.account).toBeNull();
    expect(payload.note).toBeNull();
    expect(toastSuccess).toHaveBeenCalledWith("已创建");
    expect(onSuccess).toHaveBeenCalledWith({ id: "rule-new" });
  });

  test("amount stays in yuan — no cents drift in the UI layer", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce({ success: true, data: { id: "x" } });
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "9.99");
    await user.type(START(), "2026-01-01");
    await user.type(DAY(), "1");
    await user.click(SUBMIT("创建"));
    const payload = createMock.mock.calls[0]?.[0] as Record<string, unknown>;
    if (!payload) throw new Error("no payload");
    expect(payload.amount).toBe(9.99);
    expect(payload.amountCents).toBeUndefined();
  });

  test("weekly: only `weekday` conditional field included, not dayOfMonth/monthOfYear", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce({ success: true, data: { id: "x" } });
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "1");
    await user.type(START(), "2026-01-01");
    await user.click(screen.getByRole("radio", { name: "每周" }));
    await user.click(screen.getByRole("radio", { name: "周三" }));
    await user.click(SUBMIT("创建"));
    const payload = createMock.mock.calls[0]?.[0] as Record<string, unknown>;
    if (!payload) throw new Error("no payload");
    expect(payload.frequency).toBe("weekly");
    expect(payload.weekday).toBe(3);
    expect("dayOfMonth" in payload).toBe(false);
    expect("monthOfYear" in payload).toBe(false);
  });

  test("yearly: both monthOfYear and dayOfMonth included", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce({ success: true, data: { id: "x" } });
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "1");
    await user.type(START(), "2026-01-01");
    await user.click(screen.getByRole("radio", { name: "每年" }));
    await user.type(screen.getByLabelText("月份") as HTMLInputElement, "6");
    await user.type(DAY(), "15");
    await user.click(SUBMIT("创建"));
    const payload = createMock.mock.calls[0]?.[0] as Record<string, unknown>;
    if (!payload) throw new Error("no payload");
    expect(payload.frequency).toBe("yearly");
    expect(payload.monthOfYear).toBe(6);
    expect(payload.dayOfMonth).toBe(15);
    expect("weekday" in payload).toBe(false);
  });

  test("worker failure surfaces in toast.error and inline alert", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce({ success: false, error: "Something blew up" });
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "1");
    await user.type(START(), "2026-01-01");
    await user.type(DAY(), "1");
    await user.click(SUBMIT("创建"));
    expect(toastError).toHaveBeenCalledWith("Something blew up");
    expect(screen.getByText("Something blew up")).toBeInTheDocument();
  });
});

describe("RecurringExpenseForm submit — edit (P3-C4)", () => {
  test("edit calls updateRecurringExpense with id, NOT create", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    updateMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <RecurringExpenseForm
        categories={CATEGORIES}
        initial={{
          id: "r-9",
          name: "old",
          amount: 10,
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 5,
          startDate: "2026-01-05",
        }}
        onSuccess={onSuccess}
      />,
    );
    await user.clear(NAME());
    await user.type(NAME(), "new");
    await user.click(SUBMIT("保存"));
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
    const [id, payload] = updateMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("r-9");
    expect(payload.name).toBe("new");
    expect(toastSuccess).toHaveBeenCalledWith("已更新");
    expect(onSuccess).toHaveBeenCalledWith({ id: "r-9" });
  });

  test("editing existing rule does NOT leak status/endedAt", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <RecurringExpenseForm
        categories={CATEGORIES}
        initial={{
          id: "r-9",
          name: "x",
          amount: 10,
          frequency: "daily",
          interval: 1,
          startDate: "2026-01-01",
        }}
      />,
    );
    await user.click(SUBMIT("保存"));
    const payload = updateMock.mock.calls[0]?.[1] as Record<string, unknown>;
    if (!payload) throw new Error("no payload");
    expect("status" in payload).toBe(false);
    expect("endedAt" in payload).toBe(false);
  });
});

describe("RecurringExpenseForm pending + cancel (P3-C4)", () => {
  test("pending: button reads '保存中...', inputs disabled", async () => {
    const user = userEvent.setup();
    let resolve: ((v: { success: boolean; data: { id: string } }) => void) | null = null;
    const pending = new Promise<{ success: boolean; data: { id: string } }>((r) => {
      resolve = r;
    });
    createMock.mockReturnValueOnce(pending);
    render(<RecurringExpenseForm categories={CATEGORIES} />);
    await user.type(NAME(), "x");
    await user.type(AMOUNT(), "1");
    await user.type(START(), "2026-01-01");
    await user.type(DAY(), "1");
    await user.click(SUBMIT("创建"));
    expect(SUBMIT("保存中...")).toBeDisabled();
    expect(NAME()).toBeDisabled();
    expect(AMOUNT()).toBeDisabled();
    expect(CATEGORY_SELECT()).toBeDisabled();
    if (resolve)
      (resolve as (v: { success: boolean; data: { id: string } }) => void)({
        success: true,
        data: { id: "x" },
      });
    await screen.findByRole("button", { name: "创建" });
  });

  test("cancel button fires onCancel without submitting", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<RecurringExpenseForm categories={CATEGORIES} onCancel={onCancel} />);
    await user.click(SUBMIT("取消"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
  });
});
