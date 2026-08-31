import { describe, expect, test } from "vitest";
import type { ExpectedUnitSnapshot, SerializedUnit } from "@/domain/types";
import {
  buildCommitPayload,
  buildUnitMetadataDiff,
  describeStagedOperation,
  eligibleSwapTargets,
  findStagedOperation,
  formSnapshotFromExpected,
  isAmountLocked,
  isUnitCodeLocked,
  resolveTimelineInvestDate,
  resolveUnlockOverride,
  type StagedOperation,
  stageOperation,
  type UnitFormSnapshot,
  unstageOperation,
} from "@/lib/unit-commit-plan";

const expected: ExpectedUnitSnapshot = {
  unitCode: "CU01-001",
  amountCents: 1000000,
  productId: "prod-a",
  currency: "CNY",
  status: "已成立",
  strategy: "长期理财",
  tactics: "债券基金",
  startDate: "2026-01-01",
  endDate: null,
  note: null,
  availableDateOverride: null,
};

const form: UnitFormSnapshot = {
  unitCode: "CU01-001",
  amount: 10000,
  currency: "CNY",
  status: "已成立",
  strategy: "长期理财",
  tactics: "债券基金",
  startDate: "2026-01-01",
  note: null,
};

const swap: StagedOperation = {
  kind: "swap_unit_code",
  targetUnitId: "unit-b",
  targetUnitCode: "CU01-002",
};

const switchOp: StagedOperation = {
  kind: "switch_product",
  fromProductId: "prod-a",
  fromProductName: "招行朝朝盈",
  toProductId: "prod-b",
  toProductName: "工行添利",
  pnl: 50,
};

describe("staging", () => {
  test("adds an operation without mutating the input", () => {
    const before: StagedOperation[] = [];
    const after = stageOperation(before, swap);
    expect(before).toHaveLength(0);
    expect(after).toEqual([swap]);
  });

  test("replaces an existing operation of the same kind", () => {
    const replaced = stageOperation([swap], {
      ...swap,
      targetUnitId: "unit-c",
      targetUnitCode: "CU01-003",
    });
    expect(replaced).toHaveLength(1);
    expect(findStagedOperation(replaced, "swap_unit_code")?.targetUnitCode).toBe("CU01-003");
  });

  test("keeps at most one operation per kind while allowing both kinds", () => {
    const both = stageOperation(stageOperation([], swap), switchOp);
    expect(both).toHaveLength(2);
    expect(new Set(both.map((o) => o.kind)).size).toBe(2);
  });

  test("unstage removes only the named kind", () => {
    const both = stageOperation(stageOperation([], swap), switchOp);
    const left = unstageOperation(both, "swap_unit_code");
    expect(left).toHaveLength(1);
    expect(left[0]?.kind).toBe("switch_product");
  });

  test("findStagedOperation returns undefined when absent", () => {
    expect(findStagedOperation([], "switch_product")).toBeUndefined();
  });
});

describe("field locks", () => {
  test("a staged swap locks unitCode", () => {
    expect(isUnitCodeLocked([swap])).toBe(true);
    expect(isUnitCodeLocked([switchOp])).toBe(false);
    expect(isUnitCodeLocked([])).toBe(false);
  });

  test("a staged product switch locks amount", () => {
    expect(isAmountLocked([switchOp])).toBe(true);
    expect(isAmountLocked([swap])).toBe(false);
    expect(isAmountLocked([])).toBe(false);
  });
});

describe("describeStagedOperation", () => {
  test("swap shows the target code", () => {
    expect(describeStagedOperation(swap)).toBe("番号对换 → CU01-002");
  });

  test("switch shows both product names", () => {
    expect(describeStagedOperation(switchOp)).toBe("切换产品 招行朝朝盈 → 工行添利");
  });

  test("available date override shows the target date", () => {
    expect(
      describeStagedOperation({ kind: "set_available_date", availableDate: "2026-09-15" }),
    ).toBe("可用日期 → 2026-09-15");
    expect(describeStagedOperation({ kind: "set_available_date", availableDate: null })).toBe(
      "可用日期 → 自动计算",
    );
  });

  test("null product names fall back to 未关联", () => {
    expect(
      describeStagedOperation({
        kind: "switch_product",
        fromProductId: null,
        fromProductName: null,
        toProductId: null,
        toProductName: null,
        pnl: null,
      }),
    ).toBe("切换产品 未关联 → 未关联");
  });
});

describe("buildUnitMetadataDiff", () => {
  test("no changes → null", () => {
    expect(buildUnitMetadataDiff(form, { ...form })).toBeNull();
  });

  test("converts yuan to cents with rounding", () => {
    expect(buildUnitMetadataDiff(form, { ...form, amount: 123.45 })?.amountCents).toBe(12345);
    expect(buildUnitMetadataDiff(form, { ...form, amount: 0.1 })?.amountCents).toBe(10);
    // Math.round, not truncation.
    expect(buildUnitMetadataDiff(form, { ...form, amount: 1.006 })?.amountCents).toBe(101);
  });

  test("maps note to unitNote and allows clearing", () => {
    expect(buildUnitMetadataDiff(form, { ...form, note: "hi" })?.unitNote).toBe("hi");
    expect(
      buildUnitMetadataDiff({ ...form, note: "old" }, { ...form, note: null })?.unitNote,
    ).toBeNull();
  });

  test("picks up each field independently", () => {
    const cases: Array<
      [keyof UnitFormSnapshot, unknown, keyof NonNullable<ReturnType<typeof buildUnitMetadataDiff>>]
    > = [
      ["unitCode", "CU01-999", "unitCode"],
      ["currency", "USD", "currency"],
      ["status", "已归档", "status"],
      ["strategy", "短期理财", "strategy"],
      ["tactics", "货币基金", "tactics"],
      ["startDate", "2026-02-02", "startDate"],
    ];
    for (const [field, value, patchKey] of cases) {
      const diff = buildUnitMetadataDiff(form, { ...form, [field]: value });
      expect(diff).not.toBeNull();
      expect(diff?.[patchKey]).toBe(value);
    }
  });
});

describe("formSnapshotFromExpected", () => {
  test("derives the form from the same snapshot the guard uses", () => {
    expect(formSnapshotFromExpected(expected)).toEqual(form);
  });

  test("supplies display fallbacks for nullable columns", () => {
    const allNull = {
      ...expected,
      currency: null,
      status: null,
      strategy: null,
      tactics: null,
      startDate: null,
      note: null,
    };
    const derived = formSnapshotFromExpected(allNull);
    expect(derived.currency).toBe("CNY");
    expect(derived.status).toBe("已成立");
    expect(derived.strategy).toBe("");
    expect(derived.tactics).toBe("");
    // Nullable dates/notes stay null so an untouched field diffs as unchanged.
    expect(derived.startDate).toBeNull();
    expect(derived.note).toBeNull();
  });

  test("a round trip through the form produces no diff", () => {
    const derived = formSnapshotFromExpected(expected);
    expect(buildUnitMetadataDiff(derived, { ...derived })).toBeNull();
  });

  test("cents convert to yuan", () => {
    expect(formSnapshotFromExpected({ ...expected, amountCents: 12345 }).amount).toBe(123.45);
  });
});

describe("buildCommitPayload", () => {
  const base = { expected, initial: form, current: form, operations: [] as StagedOperation[] };

  test("returns null when nothing changed", () => {
    expect(buildCommitPayload(base)).toBeNull();
    expect(buildCommitPayload({ ...base, commitNote: "   " })).toBeNull();
    expect(buildCommitPayload({ ...base, commitNote: null })).toBeNull();
  });

  // The dialog now pre-fills operationDate with today, so it is always present.
  // It must not count as a change on its own, or an untouched dialog would
  // submit an empty commit.
  test("a date alone is not a change", () => {
    expect(buildCommitPayload({ ...base, operationDate: "2026-07-28" })).toBeNull();
  });

  test("a note alone is enough to commit", () => {
    const payload = buildCommitPayload({ ...base, commitNote: " 记一笔 " });
    expect(payload?.commitNote).toBe("记一笔");
    expect(payload?.metadata).toBeUndefined();
    expect(payload?.operations).toEqual([]);
  });

  test("serializes swap to just the target id", () => {
    const payload = buildCommitPayload({ ...base, operations: [swap] });
    expect(payload?.operations).toEqual([{ kind: "swap_unit_code", targetUnitId: "unit-b" }]);
  });

  test("serializes switch with pnl converted to cents", () => {
    const payload = buildCommitPayload({ ...base, operations: [switchOp] });
    expect(payload?.operations).toEqual([
      { kind: "switch_product", toProductId: "prod-b", pnlCents: 5000 },
    ]);
  });

  test("serializes available date override including a clear", () => {
    expect(
      buildCommitPayload({
        ...base,
        operations: [{ kind: "set_available_date", availableDate: "2026-09-15" }],
      })?.operations,
    ).toEqual([{ kind: "set_available_date", availableDate: "2026-09-15" }]);
    expect(
      buildCommitPayload({
        ...base,
        operations: [{ kind: "set_available_date", availableDate: null }],
      })?.operations,
    ).toEqual([{ kind: "set_available_date", availableDate: null }]);
  });

  test("omits pnlCents when pnl is null", () => {
    const payload = buildCommitPayload({
      ...base,
      operations: [{ ...switchOp, pnl: null }],
    });
    expect(payload?.operations[0]).toEqual({ kind: "switch_product", toProductId: "prod-b" });
  });

  test("negative pnl survives conversion", () => {
    const payload = buildCommitPayload({ ...base, operations: [{ ...switchOp, pnl: -12.34 }] });
    expect(payload?.operations[0]).toMatchObject({ pnlCents: -1234 });
  });

  test("always carries the raw expected snapshot verbatim", () => {
    const payload = buildCommitPayload({ ...base, commitNote: "x" });
    expect(payload?.expected).toBe(expected);
    expect(payload?.expected.note).toBeNull();
    expect(payload?.expected.endDate).toBeNull();
  });

  test("includes operationDate only when provided", () => {
    expect(buildCommitPayload({ ...base, commitNote: "x" })?.operationDate).toBeUndefined();
    expect(
      buildCommitPayload({ ...base, commitNote: "x", operationDate: "2026-07-20" })?.operationDate,
    ).toBe("2026-07-20");
  });
});

describe("resolveTimelineInvestDate", () => {
  test("override wins and inverts lock days", () => {
    expect(
      resolveTimelineInvestDate({
        unlockOverride: "2026-09-15",
        lockPeriodDays: 30,
        stagedSwitch: true,
        operationDate: "2026-08-01",
        latestInvestDate: "2026-01-01",
      }),
    ).toBe("2026-08-16");
  });

  test("a staged switch without override uses the commit operation date", () => {
    expect(
      resolveTimelineInvestDate({
        unlockOverride: null,
        lockPeriodDays: 90,
        stagedSwitch: true,
        operationDate: "2026-08-20",
        latestInvestDate: "2026-01-01",
      }),
    ).toBe("2026-08-20");
  });

  test("a staged switch with a blank date falls back to Shanghai today", () => {
    expect(
      resolveTimelineInvestDate({
        unlockOverride: null,
        lockPeriodDays: 90,
        stagedSwitch: true,
        operationDate: "",
        latestInvestDate: "2026-01-01",
      }),
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      resolveTimelineInvestDate({
        unlockOverride: null,
        lockPeriodDays: 90,
        stagedSwitch: true,
        operationDate: "",
        latestInvestDate: "2026-01-01",
      }),
    ).not.toBe("2026-01-01");
  });
});

describe("resolveUnlockOverride", () => {
  test("a staged clear wins over the stored override", () => {
    expect(
      resolveUnlockOverride({ kind: "set_available_date", availableDate: null }, "2026-09-15"),
    ).toBeNull();
  });

  test("uses the stored override when nothing is staged", () => {
    expect(resolveUnlockOverride(undefined, "2026-09-15")).toBe("2026-09-15");
  });
});

describe("eligibleSwapTargets", () => {
  const units = [
    { id: "unit-a", unitCode: "CU01-001" },
    { id: "unit-b", unitCode: "CU01-002" },
  ] as SerializedUnit[];

  test("excludes the unit being edited", () => {
    expect(eligibleSwapTargets(units, "unit-a").map((u) => u.id)).toEqual(["unit-b"]);
  });

  test("empty list stays empty", () => {
    expect(eligibleSwapTargets([], "unit-a")).toEqual([]);
  });
});
