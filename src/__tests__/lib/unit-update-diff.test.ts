import { describe, expect, test } from "vitest";
import { buildUnitUpdateDiff, type UnitFormSnapshot } from "@/lib/unit-update-diff";

const baseSnapshot: UnitFormSnapshot = {
  unitCode: "C10-001",
  amount: 10000,
  currency: "CNY",
  status: "已成立",
  strategy: "远期理财",
  tactics: "定期存款",
  productId: "p-uuid-1",
  startDate: "2024-01-01",
  note: "init",
};

describe("buildUnitUpdateDiff", () => {
  test("identical snapshots → both payloads null (no-op)", () => {
    const r = buildUnitUpdateDiff(baseSnapshot, { ...baseSnapshot });
    expect(r.productIdPayload).toBeNull();
    expect(r.otherPayload).toBeNull();
  });

  test("only startDate changed → otherPayload contains startDate, no productId payload", () => {
    const r = buildUnitUpdateDiff(baseSnapshot, {
      ...baseSnapshot,
      startDate: "2024-02-01",
    });
    expect(r.productIdPayload).toBeNull();
    expect(r.otherPayload).toEqual({ startDate: "2024-02-01" });
  });

  test("only productId changed → productIdPayload only, otherPayload null", () => {
    const r = buildUnitUpdateDiff(baseSnapshot, {
      ...baseSnapshot,
      productId: "p-uuid-2",
    });
    expect(r.productIdPayload).toEqual({ productId: "p-uuid-2" });
    expect(r.otherPayload).toBeNull();
  });

  test("productId cleared (string → null) → productIdPayload with null", () => {
    const r = buildUnitUpdateDiff(baseSnapshot, {
      ...baseSnapshot,
      productId: null,
    });
    expect(r.productIdPayload).toEqual({ productId: null });
    expect(r.otherPayload).toBeNull();
  });

  test("productId AND other fields changed → BOTH payloads populated (split)", () => {
    const r = buildUnitUpdateDiff(baseSnapshot, {
      ...baseSnapshot,
      productId: "p-uuid-2",
      startDate: "2024-02-01",
      note: "updated",
    });
    expect(r.productIdPayload).toEqual({ productId: "p-uuid-2" });
    expect(r.otherPayload).toEqual({
      startDate: "2024-02-01",
      note: "updated",
    });
  });

  test("each non-productId field is independently picked up", () => {
    const cases: Array<[keyof UnitFormSnapshot, UnitFormSnapshot[keyof UnitFormSnapshot]]> = [
      ["unitCode", "C10-002"],
      ["amount", 20000],
      ["currency", "USD"],
      ["status", "已归档"],
      ["strategy", "短期理财"],
      ["tactics", "理财产品"],
      ["startDate", "2025-12-31"],
      ["note", "changed"],
    ];
    for (const [key, val] of cases) {
      const r = buildUnitUpdateDiff(baseSnapshot, { ...baseSnapshot, [key]: val });
      expect(r.productIdPayload).toBeNull();
      expect(r.otherPayload).toEqual({ [key]: val });
    }
  });

  test("note → null (clearing) is a real change", () => {
    const r = buildUnitUpdateDiff(baseSnapshot, { ...baseSnapshot, note: null });
    expect(r.productIdPayload).toBeNull();
    expect(r.otherPayload).toEqual({ note: null });
  });

  test("startDate → null (clearing) is a real change", () => {
    const r = buildUnitUpdateDiff(baseSnapshot, { ...baseSnapshot, startDate: null });
    expect(r.productIdPayload).toBeNull();
    expect(r.otherPayload).toEqual({ startDate: null });
  });

  test("multiple non-productId fields changed → all bundled in otherPayload", () => {
    const r = buildUnitUpdateDiff(baseSnapshot, {
      ...baseSnapshot,
      unitCode: "C10-X",
      amount: 99,
      currency: "USD",
      status: "计划中",
      strategy: "进攻计划",
      tactics: "偏股基金",
      startDate: "2030-01-01",
      note: "x",
    });
    expect(r.productIdPayload).toBeNull();
    expect(r.otherPayload).toEqual({
      unitCode: "C10-X",
      amount: 99,
      currency: "USD",
      status: "计划中",
      strategy: "进攻计划",
      tactics: "偏股基金",
      startDate: "2030-01-01",
      note: "x",
    });
  });
});
