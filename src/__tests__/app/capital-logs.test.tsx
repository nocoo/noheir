import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CapitalLogsClient } from "@/app/capital-logs/capital-logs-client";
import type { DomainContributionLog } from "@/domain/types";

const { remove, restore, revalidate } = vi.hoisted(() => ({
  remove: vi.fn(),
  restore: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/app/actions/contribution-log-actions", () => ({
  deleteContributionLog: remove,
  restoreContributionLog: restore,
}));
vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  useRevalidator: () => ({ revalidate }),
}));
vi.mock("@nocoo/basalt/components/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
describe("capital log post-mutation snapshots", () => {
  it("revalidates server snapshots instead of guessing version increments", async () => {
    const user = userEvent.setup();
    remove.mockResolvedValue({ success: true });
    restore.mockResolvedValue({ success: true });
    const log = {
      id: "log1",
      version: 3,
      unitId: "u1",
      amount: 1,
      operationType: "invest",
      source: "manual",
      operationDate: "2026-10-20",
      unit: null,
      product: null,
      isDeleted: false,
      createdAt: new Date(),
      note: "Snapshot",
    } as DomainContributionLog;
    const { rerender } = render(<CapitalLogsClient logs={[log]} units={[]} products={[]} />);
    const row = screen.getByText("Snapshot").closest("tr");
    if (!row) throw new Error("Missing log row");
    await user.click(within(row).getAllByRole("button")[1]!);
    expect(remove).toHaveBeenCalledWith("log1", 3);
    expect(revalidate).toHaveBeenCalledTimes(1);
    rerender(
      <CapitalLogsClient
        logs={[{ ...log, version: 8, isDeleted: true }]}
        units={[]}
        products={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "显示已删除" }));
    const updatedRow = screen.getByText("Snapshot").closest("tr");
    if (!updatedRow) throw new Error("Missing deleted log row");
    await user.click(within(updatedRow).getByRole("button"));
    expect(restore).toHaveBeenCalledWith("log1", 8);
    expect(revalidate).toHaveBeenCalledTimes(2);
  });
});
