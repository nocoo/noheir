import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { updateMock } = vi.hoisted(() => ({ updateMock: vi.fn() }));
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/actions/contribution-log-actions", () => ({
  updateContributionLog: updateMock,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { UnitLogTimeline } from "@/components/capital/unit-log-timeline";
import type { DomainContributionLog } from "@/domain/types";

function makeLog(over: Partial<DomainContributionLog> = {}): DomainContributionLog {
  return {
    id: "log-1",
    unitId: "unit-1",
    productId: "prod-1",
    productName: "招行朝朝盈",
    operationType: "invest",
    amount: 10000,
    balanceAfter: null,
    pnl: null,
    operationDate: "2026-07-02",
    source: "manual",
    note: null,
    unit: null,
    product: null,
    isDeleted: false,
    createdAt: new Date(1784956591451),
    ...over,
  };
}

describe("UnitLogTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({ success: true, data: undefined });
  });

  test("renders a skeleton while loading", () => {
    const { container } = render(<UnitLogTimeline logs={[]} loading onRefresh={vi.fn()} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  test("renders an empty state", () => {
    render(<UnitLogTimeline logs={[]} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByText("暂无历史记录")).toBeInTheDocument();
  });

  test("shows operation label, date and signed amount", () => {
    render(
      <UnitLogTimeline
        logs={[makeLog(), makeLog({ id: "log-2", operationType: "withdraw", amount: -5000 })]}
        loading={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("投入")).toBeInTheDocument();
    expect(screen.getByText("取出")).toBeInTheDocument();
    expect(screen.getAllByText("2026-07-02")).toHaveLength(2);
  });

  test("renders the note and source label", () => {
    render(
      <UnitLogTimeline
        logs={[makeLog({ note: "番号对换: A ⇄ B", source: "mcp" })]}
        loading={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("番号对换: A ⇄ B")).toBeInTheDocument();
    expect(screen.getByText("AI 助手")).toBeInTheDocument();
  });

  test("aggregates total pnl across rows", () => {
    render(
      <UnitLogTimeline
        logs={[makeLog({ pnl: 50 }), makeLog({ id: "log-2", pnl: -20 })]}
        loading={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText(/累计损益/)).toBeInTheDocument();
  });

  test("editing pnl calls the action immediately and refreshes", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(<UnitLogTimeline logs={[makeLog()]} loading={false} onRefresh={onRefresh} />);

    await user.click(screen.getByRole("button", { name: "记录损益" }));
    await user.type(screen.getByLabelText("损益"), "42.5");
    await user.click(screen.getByRole("button", { name: "保存损益" }));

    expect(updateMock).toHaveBeenCalledWith("log-1", { pnl: 42.5 });
    expect(toastSuccess).toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();
  });

  test("clearing the field sends null", async () => {
    const user = userEvent.setup();
    render(<UnitLogTimeline logs={[makeLog({ pnl: 12 })]} loading={false} onRefresh={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /损益/ }));
    await user.clear(screen.getByLabelText("损益"));
    await user.click(screen.getByRole("button", { name: "保存损益" }));

    expect(updateMock).toHaveBeenCalledWith("log-1", { pnl: null });
  });

  test("a number input discards non-numeric text, so it reads as a clear", async () => {
    const user = userEvent.setup();
    render(<UnitLogTimeline logs={[makeLog({ pnl: 9 })]} loading={false} onRefresh={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /损益/ }));
    const input = screen.getByLabelText("损益");
    await user.clear(input);
    await user.click(input);
    await user.paste("abc");
    await user.click(screen.getByRole("button", { name: "保存损益" }));

    // type="number" leaves the value empty rather than "abc" — clearing the pnl
    // is the honest interpretation, not an error.
    expect(updateMock).toHaveBeenCalledWith("log-1", { pnl: null });
  });

  test("cancel leaves the value untouched", async () => {
    const user = userEvent.setup();
    render(<UnitLogTimeline logs={[makeLog()]} loading={false} onRefresh={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "记录损益" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "记录损益" })).toBeInTheDocument();
  });

  test("surfaces a failed update", async () => {
    updateMock.mockResolvedValue({ success: false, error: "boom" });
    const user = userEvent.setup();
    render(<UnitLogTimeline logs={[makeLog()]} loading={false} onRefresh={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "记录损益" }));
    await user.type(screen.getByLabelText("损益"), "1");
    await user.click(screen.getByRole("button", { name: "保存损益" }));

    expect(toastError).toHaveBeenCalledWith("boom");
  });

  test("notes truncation when the cap is reached", () => {
    render(
      <UnitLogTimeline
        logs={[makeLog(), makeLog({ id: "log-2" })]}
        loading={false}
        onRefresh={vi.fn()}
        limit={2}
      />,
    );
    expect(screen.getByText("仅显示最近 2 条")).toBeInTheDocument();
  });
});
