import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { UnitOperationsPanel } from "@/components/capital/unit-operations-panel";
import type { DomainProduct, SerializedUnit } from "@/domain/types";
import type { StagedOperation } from "@/lib/unit-commit-plan";

function makeUnit(over: Partial<SerializedUnit> = {}): SerializedUnit {
  return {
    id: "unit-a",
    unitCode: "CU01-001",
    amount: 10000,
    currency: "CNY",
    status: "已成立",
    strategy: "长期理财",
    tactics: "债券基金",
    productId: "prod-a",
    productName: "招行朝朝盈",
    startDate: null,
    endDate: null,
    note: null,
    ...over,
  };
}

const products: DomainProduct[] = [
  {
    id: "prod-a",
    name: "招行朝朝盈",
    code: null,
    channel: "招商银行",
    category: null,
    currency: "CNY",
    lockPeriodDays: null,
    openDays: null,
    cycleDays: null,
    annualReturnRate: null,
    isArchived: false,
  },
  {
    id: "prod-b",
    name: "工行添利",
    code: null,
    channel: "工商银行",
    category: null,
    currency: "CNY",
    lockPeriodDays: null,
    openDays: null,
    cycleDays: null,
    annualReturnRate: null,
    isArchived: false,
  },
];

const units = [makeUnit(), makeUnit({ id: "unit-b", unitCode: "CU01-002" })];

function setup(over: Partial<React.ComponentProps<typeof UnitOperationsPanel>> = {}) {
  const onStage = vi.fn();
  const onUnstage = vi.fn();
  render(
    <UnitOperationsPanel
      unit={makeUnit()}
      units={units}
      products={products}
      operations={[]}
      onStage={onStage}
      onUnstage={onUnstage}
      {...over}
    />,
  );
  return { onStage, onUnstage };
}

describe("UnitOperationsPanel", () => {
  test("shows the current product", () => {
    setup();
    expect(screen.getByText("招行朝朝盈")).toBeInTheDocument();
    expect(screen.getByText("招商银行")).toBeInTheDocument();
  });

  test("shows a placeholder when no product is linked", () => {
    setup({ unit: makeUnit({ productId: null, productName: null }) });
    expect(screen.getByText("未关联产品")).toBeInTheDocument();
  });

  test("staging a product switch reports from/to and pnl", async () => {
    const user = userEvent.setup();
    const { onStage } = setup();

    await user.click(screen.getByRole("button", { name: /切换投入产品/ }));
    await user.click(screen.getByRole("combobox", { name: "选择新产品" }));
    await user.click(screen.getByText("工行添利"));
    await user.type(screen.getByLabelText("本次实现损益（可选）"), "500");
    await user.click(screen.getByRole("button", { name: "确认切换" }));

    expect(onStage).toHaveBeenCalledWith({
      kind: "switch_product",
      fromProductId: "prod-a",
      fromProductName: "招行朝朝盈",
      toProductId: "prod-b",
      toProductName: "工行添利",
      pnl: 500,
    });
  });

  test("confirm stays disabled until a product is picked", async () => {
    const user = userEvent.setup();
    const { onStage } = setup();

    await user.click(screen.getByRole("button", { name: "切换投入产品" }));
    // Not picking anything must not silently stage an unlink.
    expect(screen.getByRole("button", { name: "确认切换" })).toBeDisabled();
    expect(onStage).not.toHaveBeenCalled();
  });

  test("explicitly choosing 取消关联 stages a null target", async () => {
    const user = userEvent.setup();
    const { onStage } = setup();

    await user.click(screen.getByRole("button", { name: "切换投入产品" }));
    await user.click(screen.getByRole("combobox", { name: "选择新产品" }));
    await user.click(screen.getByText("取消关联"));

    // The trigger must reflect the choice, not fall back to the placeholder.
    expect(screen.getByRole("combobox", { name: "选择新产品" })).toHaveTextContent("取消关联");
    await user.click(screen.getByRole("button", { name: "确认切换" }));
    expect(onStage).toHaveBeenCalledWith(expect.objectContaining({ toProductId: null }));
  });

  test("hides 取消关联 when the unit has no product", async () => {
    const user = userEvent.setup();
    setup({ unit: makeUnit({ productId: null, productName: null }) });

    await user.click(screen.getByRole("button", { name: "切换投入产品" }));
    await user.click(screen.getByRole("combobox", { name: "选择新产品" }));
    expect(screen.queryByText("取消关联")).not.toBeInTheDocument();
  });

  test("omits the pnl field when there is no product to exit", async () => {
    const user = userEvent.setup();
    setup({ unit: makeUnit({ productId: null, productName: null }) });

    await user.click(screen.getByRole("button", { name: /切换投入产品/ }));
    expect(screen.queryByLabelText("本次实现损益（可选）")).not.toBeInTheDocument();
  });

  test("staging a swap reports the target unit", async () => {
    const user = userEvent.setup();
    const { onStage } = setup();

    await user.click(screen.getByRole("button", { name: /番号对换/ }));
    await user.click(screen.getByRole("combobox", { name: "选择对换单元" }));
    await user.click(screen.getByText("CU01-002"));

    expect(onStage).toHaveBeenCalledWith({
      kind: "swap_unit_code",
      targetUnitId: "unit-b",
      targetUnitCode: "CU01-002",
    });
  });

  test("renders staged operations as cancellable cards", async () => {
    const user = userEvent.setup();
    const staged: StagedOperation[] = [
      { kind: "swap_unit_code", targetUnitId: "unit-b", targetUnitCode: "CU01-002" },
    ];
    const { onUnstage } = setup({ operations: staged });

    expect(screen.getByText("番号对换 → CU01-002")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /撤销/ }));
    expect(onUnstage).toHaveBeenCalledWith("swap_unit_code");
  });

  test("disables an operation button once its kind is staged", () => {
    setup({
      operations: [{ kind: "swap_unit_code", targetUnitId: "unit-b", targetUnitCode: "CU01-002" }],
    });
    expect(screen.getByRole("button", { name: "资金单元番号对换" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "切换投入产品" })).toBeEnabled();
  });

  test("shows the staged pnl on the card", () => {
    setup({
      operations: [
        {
          kind: "switch_product",
          fromProductId: "prod-a",
          fromProductName: "招行朝朝盈",
          toProductId: "prod-b",
          toProductName: "工行添利",
          pnl: 500,
        },
      ],
    });
    expect(screen.getByText("切换产品 招行朝朝盈 → 工行添利")).toBeInTheDocument();
    expect(screen.getByText("损益 500")).toBeInTheDocument();
  });
});
