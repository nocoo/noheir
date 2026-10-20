import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountTypesClient } from "@/app/account-types/account-types-client";
import {
  saveAccountTypes,
  saveBalanceAnchors,
  saveFinancialPreferences,
} from "@/app/actions/settings-actions";
import { BalanceAnchorsClient } from "@/app/balance-anchors/balance-anchors-client";
import { CategorySettingsClient } from "@/app/category-settings/category-settings-client";
import { SettingsClient } from "@/app/settings/settings-client";
import type { FinancialPreferences } from "@/domain/api-contract";

vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  useRevalidator: () => ({ revalidate: vi.fn() }),
}));
vi.mock("@/app/actions/settings-actions", () => ({
  saveAccountTypes: vi.fn(),
  saveBalanceAnchors: vi.fn(),
  saveFinancialPreferences: vi.fn(),
}));
vi.mock("@nocoo/basalt/components/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const preferences = {
  savingsRateTarget: 30,
  expectedReturnRate: 4,
  minReturnRate: 2,
  maxReturnRate: 8,
  activeIncomeCategories: [],
  fixedExpenseCategories: [],
  version: 1,
} as unknown as FinancialPreferences;
beforeEach(() => {
  vi.resetAllMocks();
  for (const save of [saveAccountTypes, saveBalanceAnchors, saveFinancialPreferences])
    vi.mocked(save).mockResolvedValue({ success: false, error: "Reload and review" });
});
describe("financial editor snapshot isolation", () => {
  it("keeps preferences draft paired with the original version on loader refresh", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <SettingsClient preferences={preferences} />
      </MemoryRouter>,
    );
    await user.clear(screen.getByLabelText("预期年化收益率 (%)"));
    await user.type(screen.getByLabelText("预期年化收益率 (%)"), "5");
    rerender(
      <MemoryRouter>
        <SettingsClient preferences={{ ...preferences, version: 2, expectedReturnRate: 6 }} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(saveFinancialPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ expectedReturnRate: 5 }),
      1,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("已变化");
    await user.click(screen.getByRole("button", { name: "载入最新数据（放弃草稿）" }));
    expect(screen.getByLabelText("预期年化收益率 (%)")).toHaveValue(6);
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(saveFinancialPreferences).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedReturnRate: 6 }),
      2,
    );
  });
  it("does not replace externally inserted account rows using the newer collection revision", async () => {
    const user = userEvent.setup();
    const grouped = { debit: [], credit: [], prepaid: [], financial: [], unclassified: [] };
    const first = [{ accountName: "A", type: "debit" as const }];
    const { rerender } = render(
      <AccountTypesClient accounts={["A"]} accountTypes={first} grouped={grouped} revision={1} />,
    );
    rerender(
      <AccountTypesClient
        accounts={["A", "B"]}
        accountTypes={[...first, { accountName: "B", type: "credit" }]}
        grouped={grouped}
        revision={2}
      />,
    );
    await user.click(screen.getByRole("button", { name: "保存配置" }));
    expect(saveAccountTypes).toHaveBeenCalledWith(first, 1);
    await user.click(screen.getByRole("button", { name: "载入最新数据（放弃草稿）" }));
    await user.click(screen.getByRole("button", { name: "保存配置" }));
    expect(saveAccountTypes).toHaveBeenLastCalledWith(
      [...first, { accountName: "B", type: "credit" }],
      2,
    );
  });
  it("does not silently delete externally inserted balance anchors", async () => {
    const user = userEvent.setup();
    const a = { accountName: "A", date: "2026-01-01", balance: 1, currency: "CNY" };
    const b = { ...a, date: "2026-02-01", balance: 2 };
    const { rerender } = render(
      <BalanceAnchorsClient accounts={["A"]} initialAnchors={[a]} revision={1} />,
    );
    await user.click(screen.getByRole("button", { name: "移除 A 2026-01-01 CNY 锚点" }));
    rerender(<BalanceAnchorsClient accounts={["A"]} initialAnchors={[a, b]} revision={2} />);
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(saveBalanceAnchors).toHaveBeenCalledWith([], 1);
    await user.click(screen.getByRole("button", { name: "载入最新数据（放弃草稿）" }));
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(saveBalanceAnchors).toHaveBeenLastCalledWith([a, b], 2);
  });
  it("keeps category selections and their version together", async () => {
    const user = userEvent.setup();
    const initial = {
      incomeCategories: ["Salary"],
      expenseCategories: ["Rent"],
      activeIncomeCategories: ["Salary"],
      fixedExpenseCategories: [],
      version: 1,
    };
    const { rerender } = render(<CategorySettingsClient {...initial} />);
    rerender(
      <CategorySettingsClient
        {...initial}
        version={2}
        activeIncomeCategories={[]}
        fixedExpenseCategories={["Rent"]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(saveFinancialPreferences).toHaveBeenCalledWith(
      { activeIncomeCategories: ["Salary"], fixedExpenseCategories: [] },
      1,
    );
  });
});
