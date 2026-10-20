import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { savePreferences, revalidate, navigate } = vi.hoisted(() => ({
  savePreferences: vi.fn(),
  revalidate: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router", () => ({
  useRevalidator: () => ({ revalidate }),
  useNavigate: () => navigate,
}));
vi.mock("@/app/actions/settings-actions", () => ({
  saveFinancialPreferences: savePreferences,
}));
vi.mock("@nocoo/basalt/components/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CategorySettingsClient } from "@/app/category-settings/category-settings-client";
import { CommandPalette } from "@/components/command-palette";
import { StrategyBadge, UnitCodeBadge } from "@/components/ui/colored-badge";
import { Progress } from "@/components/ui/progress";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  savePreferences.mockResolvedValue({ success: true });
});

describe("Basalt leaf controls", () => {
  test("financial badges keep identifiers and classifications on one line", () => {
    render(
      <>
        <StrategyBadge strategy="远期理财" />
        <UnitCodeBadge unitCode="DEMO-01" />
      </>,
    );
    expect(screen.getByText("远期理财")).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("DEMO-01")).toHaveClass("whitespace-nowrap");
  });
  test("command palette retains an explicit close action and route selection", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    await user.type(screen.getByPlaceholderText("搜索页面或功能..."), "产品管理");
    await user.click(screen.getByRole("option", { name: "产品管理" }));
    expect(navigate).toHaveBeenCalledWith("/products");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("category checkboxes expose selection and save both finance classifications", async () => {
    const user = userEvent.setup();
    render(
      <CategorySettingsClient
        version={12}
        incomeCategories={["工资", "利息"]}
        expenseCategories={["房租", "餐饮"]}
        activeIncomeCategories={["工资"]}
        fixedExpenseCategories={["房租"]}
      />,
    );
    const selectors = screen.getAllByRole("button", { name: "选择分类" });
    await user.click(selectors[0]!);
    expect(screen.getByRole("checkbox", { name: "工资" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "利息" }));
    await user.click(selectors[1]!);
    const rent = screen.getByRole("checkbox", { name: "房租" });
    expect(rent).toBeChecked();
    rent.focus();
    await user.keyboard(" ");
    expect(rent).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "保存设置" }));
    expect(savePreferences).toHaveBeenCalledWith(
      { activeIncomeCategories: ["工资", "利息"], fixedExpenseCategories: [] },
      12,
    );
    expect(revalidate).toHaveBeenCalledOnce();
  });

  test("progress exposes the actual finite value to assistive technology", () => {
    const { rerender } = render(<Progress value={37} aria-label="导入进度" />);
    expect(screen.getByRole("progressbar", { name: "导入进度" })).toHaveAttribute(
      "aria-valuenow",
      "37",
    );
    rerender(<Progress value={null} aria-label="导入进度" />);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
});
