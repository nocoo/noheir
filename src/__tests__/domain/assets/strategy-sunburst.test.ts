import { describe, expect, it } from "bun:test";
import type { UnitDisplayInfo, DomainProduct } from "@/domain/types";
import {
  buildStrategyHierarchy,
  buildTotalAmount,
} from "@/domain/assets/strategy-sunburst";

const makeProduct = (
  overrides: Partial<DomainProduct> = {},
): DomainProduct => ({
  id: "p1",
  name: "招行季季宝",
  code: null,
  channel: null,
  category: "固定收益",
  currency: null,
  lockPeriodDays: 90,
  annualReturnRate: 0.03,
  isArchived: false,
  ...overrides,
});

const makeUnit = (
  overrides: Partial<UnitDisplayInfo> = {},
): UnitDisplayInfo => ({
  id: "1",
  unitCode: "A01",
  amount: 10000,
  currency: "CNY",
  status: "已成立",
  strategy: "长期理财",
  tactics: "稳健理财",
  productId: "p1",
  startDate: "2024-01-01",
  endDate: "2024-06-01",
  note: null,
  product: makeProduct(),
  ...overrides,
});

describe("strategy-sunburst domain", () => {
  it("builds empty hierarchy", () => {
    const data = buildStrategyHierarchy([], "资产");
    expect(data.name).toBe("资产");
    expect(data.children).toEqual([]);
  });

  it("builds hierarchy from units", () => {
    const units = [
      makeUnit({ amount: 5000 }),
      makeUnit({
        id: "2",
        unitCode: "A02",
        amount: 3000,
        product: makeProduct({ name: "朝朝宝" }),
      }),
      makeUnit({
        id: "3",
        unitCode: "B01",
        amount: 2000,
        currency: "USD",
        strategy: "美元资产",
        product: makeProduct({ name: "美元存款" }),
      }),
    ];
    const data = buildStrategyHierarchy(units, "资产");
    expect(data.children?.length).toBe(2); // CNY + USD

    // CNY should come first (larger total)
    const cny = data.children?.[0];
    expect(cny?.name).toBe("人民币");
    expect(cny?.children?.length).toBe(1); // "长期理财"

    const strategy = cny?.children?.[0];
    expect(strategy?.name).toBe("长期理财");
    expect(strategy?.children?.length).toBe(2); // 2 products
  });

  it("groups units without product as 未分配", () => {
    const units = [makeUnit({ product: null })];
    const data = buildStrategyHierarchy(units, "资产");
    const product = data.children?.[0]?.children?.[0]?.children?.[0];
    expect(product?.name).toBe("未分配");
  });

  it("filters to established units only", () => {
    const units = [
      makeUnit({ amount: 5000 }),
      makeUnit({ id: "2", status: "计划中", amount: 3000 }),
    ];
    const data = buildStrategyHierarchy(units, "资产");
    const total = data.children?.[0]?.children?.[0]?.children?.reduce(
      (sum, c) => sum + (c.value ?? 0),
      0,
    );
    expect(total).toBe(5000);
  });

  it("calculates total amount for established units only", () => {
    const units = [
      makeUnit({ amount: 10000 }),
      makeUnit({ id: "2", unitCode: "A02", amount: 20000, status: "计划中" }),
    ];
    expect(buildTotalAmount(units)).toBe(10000);
  });

  it("assigns hex colors to products", () => {
    const units = [makeUnit()];
    const data = buildStrategyHierarchy(units, "资产");
    const product = data.children?.[0]?.children?.[0]?.children?.[0];
    expect(product?.itemStyle?.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
