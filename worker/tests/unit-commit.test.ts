import { describe, expect, test } from "vitest";
import {
  type BuildCommitInput,
  buildCommitStatements,
  describeMetadataChange,
  type ExpectedUnitSnapshot,
  resolveEndDate,
} from "../lib/unit-commit";

const NOW = 1784956591451;
const TODAY = "2026-07-27";

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
};

function makeInput(over: Partial<BuildCommitInput> = {}): BuildCommitInput {
  let n = 0;
  return {
    userId: "u1",
    unitId: "unit-a",
    expected,
    operations: [],
    operationDate: TODAY,
    today: TODAY,
    now: NOW,
    newId: () => `log-${++n}`,
    ...over,
  };
}

describe("resolveEndDate", () => {
  test("non-archived → always null", () => {
    expect(resolveEndDate("已成立", "已成立", "2026-01-01", TODAY)).toBeNull();
    expect(resolveEndDate("计划中", "已归档", "2026-01-01", TODAY)).toBeNull();
  });

  test("transition into archived → today when no prior date", () => {
    expect(resolveEndDate("已归档", "已成立", null, TODAY)).toBe(TODAY);
  });

  test("transition into archived keeps an existing date", () => {
    expect(resolveEndDate("已归档", "已成立", "2025-12-31", TODAY)).toBe("2025-12-31");
  });

  test("archived → archived preserves the original date", () => {
    expect(resolveEndDate("已归档", "已归档", "2025-06-01", TODAY)).toBe("2025-06-01");
    expect(resolveEndDate("已归档", "已归档", null, TODAY)).toBeNull();
  });

  test("null status is treated as non-archived", () => {
    expect(resolveEndDate(null, null, "2026-01-01", TODAY)).toBeNull();
    expect(resolveEndDate(null, "已归档", "2026-01-01", TODAY)).toBeNull();
    expect(resolveEndDate("已归档", null, null, TODAY)).toBe(TODAY);
  });
});

describe("describeMetadataChange", () => {
  test("lists only fields that actually change", () => {
    const parts = describeMetadataChange(expected, {
      amountCents: 2000000,
      strategy: "长期理财", // unchanged
      status: "已归档",
    });
    expect(parts).toEqual(["金额 10000→20000", "状态 已成立→已归档"]);
  });

  test("renders null as ∅ on both sides", () => {
    expect(describeMetadataChange(expected, { unitNote: "hello" })).toEqual(["备注 ∅→hello"]);
    expect(
      describeMetadataChange({ ...expected, startDate: "2026-01-01" }, { startDate: null }),
    ).toEqual(["开始日期 2026-01-01→∅"]);
  });

  test("covers every field", () => {
    const parts = describeMetadataChange(expected, {
      unitCode: "CU01-002",
      amountCents: 1,
      currency: "USD",
      status: "计划中",
      strategy: "短期理财",
      tactics: "货币基金",
      startDate: "2026-02-02",
      unitNote: "n",
    });
    expect(parts).toHaveLength(8);
  });

  test("no changes → empty", () => {
    expect(describeMetadataChange(expected, {})).toEqual([]);
    expect(describeMetadataChange(expected, { unitCode: expected.unitCode })).toEqual([]);
  });
});

describe("buildCommitStatements — CAS guard", () => {
  test("statement [0] compares every expected field", () => {
    const [head] = buildCommitStatements(makeInput({ metadata: { amountCents: 2000000 } }));
    const sql = head?.sql ?? "";
    expect(sql).toContain("unit_code = ?");
    expect(sql).toContain("amount_cents = ?");
    expect(sql).toContain("product_id = ?");
    expect(sql).toContain("currency = ?");
    expect(sql).toContain("status = ?");
    expect(sql).toContain("strategy = ?");
    expect(sql).toContain("tactics = ?");
    expect(sql).toContain("start_date = ?");
    expect(sql).toContain("end_date IS NULL");
    expect(sql).toContain("note IS NULL");
  });

  test("null expected fields become IS NULL, not = ?", () => {
    const allNull: ExpectedUnitSnapshot = {
      unitCode: "CU01-001",
      amountCents: 500,
      productId: null,
      currency: null,
      status: null,
      strategy: null,
      tactics: null,
      startDate: null,
      endDate: null,
      note: null,
    };
    const [head] = buildCommitStatements(
      makeInput({ expected: allNull, metadata: { amountCents: 600 } }),
    );
    // Only inspect the WHERE clause; end_date also appears in SET as `= ?`.
    const whereClause = (head?.sql ?? "").split(" WHERE ")[1] ?? "";
    for (const col of [
      "product_id",
      "currency",
      "status",
      "strategy",
      "tactics",
      "start_date",
      "end_date",
      "note",
    ]) {
      expect(whereClause).toContain(`${col} IS NULL`);
      expect(whereClause).not.toContain(`${col} = ?`);
    }
  });

  test("end_date is always written even when status is untouched", () => {
    const [head] = buildCommitStatements(makeInput({ metadata: { amountCents: 2 } }));
    expect(head?.sql).toContain("end_date = ?");
  });

  // Backdating a log must not backdate the archive date: operationDate is when
  // the money moved, `today` is when the archive happened (docs/003 § Decision F).
  test("archiving uses today, not a backdated operationDate", () => {
    const [head] = buildCommitStatements(
      makeInput({
        metadata: { status: "已归档" },
        operationDate: "2020-01-01",
        today: TODAY,
      }),
    );
    expect(head?.params).toContain(TODAY);
    expect(head?.params).not.toContain("2020-01-01");
  });

  // Regression: a commit that changes neither unit_code nor product still has to
  // collapse its log INSERTs when [0] loses the CAS. updated_at is the only
  // value unique to this batch, so it is what the log guard keys off.
  test("log guard keys off updated_at, not just unit_code", () => {
    const stmts = buildCommitStatements(
      makeInput({ metadata: { strategy: "短期理财" }, commitNote: "n" }),
    );
    const log = stmts.find((s) => s.sql.includes("INSERT INTO contribution_logs"));
    expect(log?.sql).toContain("updated_at = ?");
    expect(log?.params.slice(-4)).toEqual(["unit-a", "u1", "CU01-001", NOW]);
  });
});

describe("buildCommitStatements — swap_unit_code", () => {
  const swapInput = makeInput({
    fromProduct: { id: "prod-a", name: "招行朝朝盈" },
    operations: [{ kind: "swap_unit_code", targetUnitId: "unit-b" }],
    swapTarget: {
      id: "unit-b",
      unitCode: "CU01-002",
      productId: "prod-b",
      productName: "工行添利",
    },
    commitNote: "年度调整",
  });

  test("emits two updates and two adjust logs", () => {
    const stmts = buildCommitStatements(swapInput);
    expect(stmts).toHaveLength(4);
    expect(stmts[0]?.sql).toContain("UPDATE capital_units");
    expect(stmts[1]?.sql).toContain("UPDATE capital_units");
    expect(stmts[2]?.sql).toContain("INSERT INTO contribution_logs");
    expect(stmts[3]?.sql).toContain("INSERT INTO contribution_logs");
  });

  test("[0] requires the partner to still hold its code", () => {
    const stmts = buildCommitStatements(swapInput);
    expect(stmts[0]?.sql).toContain("EXISTS (SELECT 1 FROM capital_units");
    expect(stmts[0]?.params).toContain("unit-b");
  });

  test("[1] guards on [0]'s post-state", () => {
    const stmts = buildCommitStatements(swapInput);
    // The EXISTS checks unit-a already carries the partner's code.
    expect(stmts[1]?.params.slice(-3)).toEqual(["unit-a", "u1", "CU01-002"]);
  });

  test("each unit's log keeps its own product snapshot", () => {
    const stmts = buildCommitStatements(swapInput);
    // A swap moves no money and no products — each row must still join to the
    // product its own unit sits in (docs/003 § Decision G).
    expect(stmts[2]?.params[3]).toBe("prod-a");
    expect(stmts[2]?.params[4]).toBe("招行朝朝盈");
    expect(stmts[3]?.params[3]).toBe("prod-b");
    expect(stmts[3]?.params[4]).toBe("工行添利");
  });

  test("both units get a log with amount 0 and null pnl", () => {
    const stmts = buildCommitStatements(swapInput);
    expect(stmts[2]?.params[2]).toBe("unit-a");
    expect(stmts[3]?.params[2]).toBe("unit-b");
    for (const s of [stmts[2], stmts[3]]) {
      expect(s?.params[6]).toBe(0); // amount_cents
      expect(s?.params[7]).toBeNull(); // pnl_cents
      expect(s?.params[9]).toBe("auto"); // source
      expect(s?.params[10]).toContain("番号对换: CU01-001 ⇄ CU01-002");
      expect(s?.params[10]).toContain("年度调整");
    }
  });
});

describe("buildCommitStatements — switch_product", () => {
  test("emits withdraw + invest with mirrored amounts", () => {
    const stmts = buildCommitStatements(
      makeInput({
        operations: [{ kind: "switch_product", toProductId: "prod-b", pnlCents: 5000 }],
        fromProduct: { id: "prod-a", name: "招行朝朝盈" },
        toProduct: { id: "prod-b", name: "工行添利" },
      }),
    );
    expect(stmts).toHaveLength(4); // unit update, product update, withdraw, invest
    const withdraw = stmts[2];
    const invest = stmts[3];
    expect(withdraw?.params[5]).toBe("withdraw");
    expect(withdraw?.params[6]).toBe(-1000000);
    expect(withdraw?.params[7]).toBe(5000); // pnl rides the withdraw row
    expect(invest?.params[5]).toBe("invest");
    expect(invest?.params[6]).toBe(1000000);
    expect(invest?.params[7]).toBeNull();
  });

  test("no withdraw when the unit had no product", () => {
    const stmts = buildCommitStatements(
      makeInput({
        expected: { ...expected, productId: null },
        operations: [{ kind: "switch_product", toProductId: "prod-b" }],
        toProduct: { id: "prod-b", name: "工行添利" },
      }),
    );
    const types = stmts.filter((s) => s.sql.includes("INSERT")).map((s) => s.params[5]);
    expect(types).toEqual(["invest"]);
  });

  test("no invest when clearing the product", () => {
    const stmts = buildCommitStatements(
      makeInput({
        operations: [{ kind: "switch_product", toProductId: null }],
        fromProduct: { id: "prod-a", name: "招行朝朝盈" },
      }),
    );
    const types = stmts.filter((s) => s.sql.includes("INSERT")).map((s) => s.params[5]);
    expect(types).toEqual(["withdraw"]);
  });

  test("falls back to a placeholder when the product name is unknown", () => {
    const stmts = buildCommitStatements(
      makeInput({
        operations: [{ kind: "switch_product", toProductId: "prod-b" }],
        fromProduct: null,
        toProduct: { id: "prod-b", name: null },
      }),
    );
    const logs = stmts.filter((s) => s.sql.includes("INSERT"));
    expect(logs[0]?.params[10]).toContain("未知产品");
    expect(logs[1]?.params[10]).toContain("未知产品");
  });
});

describe("buildCommitStatements — metadata and note logs", () => {
  test("metadata edit writes one adjust log with amount 0", () => {
    const stmts = buildCommitStatements(
      makeInput({ metadata: { amountCents: 2000000 }, commitNote: "追加" }),
    );
    expect(stmts).toHaveLength(2);
    expect(stmts[1]?.params[5]).toBe("adjust");
    expect(stmts[1]?.params[6]).toBe(0);
    expect(stmts[1]?.params[10]).toContain("元数据修改: 金额 10000→20000");
    expect(stmts[1]?.params[10]).toContain("追加");
  });

  test("no-op metadata writes no log", () => {
    const stmts = buildCommitStatements(makeInput({ metadata: { strategy: expected.strategy } }));
    expect(stmts).toHaveLength(1);
  });

  test("note-only commit still writes a bare adjust log", () => {
    const stmts = buildCommitStatements(makeInput({ commitNote: "只是记一笔" }));
    expect(stmts).toHaveLength(2);
    expect(stmts[1]?.params[5]).toBe("adjust");
    expect(stmts[1]?.params[10]).toBe("只是记一笔");
  });

  test("blank note produces no log", () => {
    expect(buildCommitStatements(makeInput({ commitNote: "   " }))).toHaveLength(1);
    expect(buildCommitStatements(makeInput({ commitNote: null }))).toHaveLength(1);
  });

  test("switch + metadata share the same note", () => {
    const stmts = buildCommitStatements(
      makeInput({
        metadata: { strategy: "短期理财" },
        operations: [{ kind: "switch_product", toProductId: "prod-b" }],
        fromProduct: { id: "prod-a", name: "A" },
        toProduct: { id: "prod-b", name: "B" },
        commitNote: "共享备注",
      }),
    );
    const logs = stmts.filter((s) => s.sql.includes("INSERT"));
    expect(logs).toHaveLength(3); // withdraw, invest, adjust
    for (const l of logs) expect(l.params[10]).toContain("共享备注");
  });
});
