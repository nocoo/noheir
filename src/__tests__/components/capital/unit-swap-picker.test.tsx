import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { UnitSwapPicker } from "@/components/capital/unit-swap-picker";
import type { SerializedUnit } from "@/domain/types";

function makeUnit(over: Partial<SerializedUnit> = {}): SerializedUnit {
  return {
    id: "unit-a",
    unitCode: "CU01-001",
    amount: 10000,
    currency: "CNY",
    status: "已成立",
    strategy: "长期理财",
    tactics: "债券基金",
    productId: null,
    productName: null,
    startDate: null,
    endDate: null,
    note: null,
    ...over,
  };
}

const units = [
  makeUnit(),
  makeUnit({ id: "unit-b", unitCode: "CU01-002", productName: "工行添利" }),
  makeUnit({ id: "unit-c", unitCode: "A01-001" }),
];

describe("UnitSwapPicker", () => {
  test("shows a placeholder when nothing is selected", () => {
    render(
      <UnitSwapPicker
        units={units}
        currentUnitId="unit-a"
        selectedUnitId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("选择对换单元...");
  });

  test("never offers the unit being edited", async () => {
    const user = userEvent.setup();
    render(
      <UnitSwapPicker
        units={units}
        currentUnitId="unit-a"
        selectedUnitId={null}
        onSelect={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("combobox"));

    expect(screen.getByText("CU01-002")).toBeInTheDocument();
    expect(screen.getByText("A01-001")).toBeInTheDocument();
    expect(screen.queryByText("CU01-001")).not.toBeInTheDocument();
  });

  test("selecting a unit reports it upward", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <UnitSwapPicker
        units={units}
        currentUnitId="unit-a"
        selectedUnitId={null}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("CU01-002"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "unit-b" }));
  });

  test("displays the selected unit's code", () => {
    render(
      <UnitSwapPicker
        units={units}
        currentUnitId="unit-a"
        selectedUnitId="unit-b"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("CU01-002");
  });

  test("empty state when there is no other unit", async () => {
    const user = userEvent.setup();
    render(
      <UnitSwapPicker
        units={[makeUnit()]}
        currentUnitId="unit-a"
        selectedUnitId={null}
        onSelect={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("未找到可对换的单元")).toBeInTheDocument();
  });
});
