/**
 * E2E for POST /api/units/:id/commit and GET /api/units/:id/logs.
 *
 * Atomicity is only observable here — worker unit tests run on better-sqlite3,
 * which has no d1.batch(). See docs/003 § Decision E.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { cleanupUser } from "./helpers/cleanup";
import { api, rawFetch, TEST_USER_A } from "./helpers/client";
import { makeProduct, makeUnit } from "./helpers/seed";

const userId = TEST_USER_A;

type UnitRow = Record<string, unknown>;

async function createUnit(over: Record<string, unknown> = {}): Promise<UnitRow> {
  const res = await api<{ unit: UnitRow }>({
    method: "POST",
    path: "/api/units",
    userId,
    body: makeUnit(over),
  });
  return res.unit;
}

async function createProduct(over: Record<string, unknown> = {}): Promise<UnitRow> {
  const res = await api<{ product: UnitRow }>({
    method: "POST",
    path: "/api/products",
    userId,
    body: makeProduct(over),
  });
  return res.product;
}

/** The raw snapshot the client is expected to echo back. */
function snapshot(u: UnitRow) {
  return {
    unitCode: u.unitCode,
    amountCents: u.amountCents,
    productId: u.productId ?? null,
    currency: u.currency ?? null,
    status: u.status ?? null,
    strategy: u.strategy ?? null,
    tactics: u.tactics ?? null,
    startDate: u.startDate ?? null,
    endDate: u.endDate ?? null,
    note: u.note ?? null,
  };
}

async function logsFor(unitId: string) {
  return api<{ logs: Record<string, unknown>[]; expected: Record<string, unknown> }>({
    method: "GET",
    path: `/api/units/${unitId}/logs`,
    userId,
  });
}

describe("E2E: Unit commit", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  test("metadata edit applies and writes one adjust log", async () => {
    const unit = await createUnit();

    const res = await api<{ unit: UnitRow }>({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(unit),
        metadata: { amountCents: 8000000, strategy: "长期理财" },
        commitNote: "追加投入",
      },
    });

    expect(res.unit.amountCents).toBe(8000000);
    expect(res.unit.strategy).toBe("长期理财");

    const { logs } = await logsFor(String(unit.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.operationType).toBe("adjust");
    expect(logs[0]?.amountCents).toBe(0);
    expect(logs[0]?.pnlCents).toBeNull();
    expect(String(logs[0]?.note)).toContain("元数据修改");
    expect(String(logs[0]?.note)).toContain("追加投入");
  });

  test("stale expected → 409 and nothing is written", async () => {
    const unit = await createUnit();
    const stale = snapshot(unit);

    // Someone else changes the amount first.
    await api({
      method: "PUT",
      path: `/api/units/${unit.id}`,
      userId,
      body: { amountCents: 9999999 },
    });

    const res = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: stale, metadata: { strategy: "长期理财" }, commitNote: "x" },
    });
    expect(res.status).toBe(409);

    const after = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}`,
      userId,
    });
    expect(after.unit.amountCents).toBe(9999999);
    expect(after.unit.strategy).toBe("短期理财"); // untouched

    const { logs } = await logsFor(String(unit.id));
    expect(logs).toHaveLength(0); // all-or-nothing
  });

  test("a unit whose optional fields are all NULL can still commit", async () => {
    // 84 of 178 production units have note = NULL — see docs/003 § Decision B.
    const unit = await createUnit({ note: null, startDate: null });
    expect(unit.note).toBeNull();
    expect(unit.startDate).toBeNull();
    expect(unit.endDate).toBeNull();

    const res = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: snapshot(unit), metadata: { tactics: "货币基金" } },
    });
    expect(res.status).toBe(200);
  });

  test("swap_unit_code exchanges codes and logs both units", async () => {
    const a = await createUnit({ unitCode: "CU01-001" });
    const b = await createUnit({ unitCode: "CU01-002" });

    await api({
      method: "POST",
      path: `/api/units/${a.id}/commit`,
      userId,
      body: {
        expected: snapshot(a),
        operations: [{ kind: "swap_unit_code", targetUnitId: b.id }],
        commitNote: "对换",
      },
    });

    const afterA = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${a.id}`,
      userId,
    });
    const afterB = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${b.id}`,
      userId,
    });
    expect(afterA.unit.unitCode).toBe("CU01-002");
    expect(afterB.unit.unitCode).toBe("CU01-001");

    for (const id of [a.id, b.id]) {
      const { logs } = await logsFor(String(id));
      expect(logs).toHaveLength(1);
      expect(logs[0]?.operationType).toBe("adjust");
      expect(logs[0]?.amountCents).toBe(0);
      expect(String(logs[0]?.note)).toContain("番号对换");
    }
  });

  test("swap logs keep each unit's own product", async () => {
    const pa = await createProduct({ name: "P-A", code: "PA-1" });
    const pb = await createProduct({ name: "P-B", code: "PB-1" });
    const a = await createUnit({ unitCode: "SW-001" });
    const b = await createUnit({ unitCode: "SW-002" });

    for (const [unit, product] of [
      [a, pa],
      [b, pb],
    ] as const) {
      await api({
        method: "PUT",
        path: `/api/units/${unit.id}`,
        userId,
        body: { productId: product.id },
      });
    }

    const current = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${a.id}`,
      userId,
    });

    await api({
      method: "POST",
      path: `/api/units/${a.id}/commit`,
      userId,
      body: {
        expected: snapshot(current.unit),
        operations: [{ kind: "swap_unit_code", targetUnitId: b.id }],
      },
    });

    const logsA = await logsFor(String(a.id));
    const logsB = await logsFor(String(b.id));
    const adjustA = logsA.logs.find((l) => l.operationType === "adjust");
    const adjustB = logsB.logs.find((l) => l.operationType === "adjust");
    expect(adjustA?.productId).toBe(pa.id);
    expect(adjustB?.productId).toBe(pb.id);
    expect(adjustB?.productName).toBe("P-B");
  });

  test("backdating a commit does not backdate the archive date", async () => {
    const unit = await createUnit();
    const shanghaiToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

    await api({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(unit),
        metadata: { status: "已归档" },
        operationDate: "2020-01-01",
        commitNote: "补录",
      },
    });

    const after = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}`,
      userId,
    });
    expect(after.unit.endDate).toBe(shanghaiToday);

    const { logs } = await logsFor(String(unit.id));
    expect(logs[0]?.operationDate).toBe("2020-01-01");
  });

  test("switch_product writes withdraw + invest with pnl on the withdraw", async () => {
    const from = await createProduct({ name: "A产品", code: "A-1" });
    const to = await createProduct({ name: "B产品", code: "B-1" });
    const unit = await createUnit({ amountCents: 1000000 });

    await api({
      method: "PUT",
      path: `/api/units/${unit.id}`,
      userId,
      body: { productId: from.id },
    });
    const current = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}`,
      userId,
    });

    await api({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(current.unit),
        operations: [{ kind: "switch_product", toProductId: to.id, pnlCents: 12345 }],
        operationDate: "2026-07-20",
        commitNote: "换仓",
      },
    });

    const after = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}`,
      userId,
    });
    expect(after.unit.productId).toBe(to.id);

    const { logs } = await logsFor(String(unit.id));
    const withdraw = logs.find((l) => l.operationType === "withdraw");
    const invest = logs.find((l) => l.operationType === "invest" && l.productId === to.id);
    expect(withdraw?.amountCents).toBe(-1000000);
    expect(withdraw?.pnlCents).toBe(12345);
    expect(withdraw?.operationDate).toBe("2026-07-20"); // user-supplied, not today
    expect(invest?.amountCents).toBe(1000000);
    expect(invest?.pnlCents).toBeNull();
  });

  test("pnl without an existing product → 400", async () => {
    const to = await createProduct({ name: "B产品", code: "B-2" });
    const unit = await createUnit();

    const res = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(unit),
        operations: [{ kind: "switch_product", toProductId: to.id, pnlCents: 500 }],
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("pnl requires an existing product");
  });

  test("endDate invariant is enforced through /commit", async () => {
    const unit = await createUnit();

    await api({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: snapshot(unit), metadata: { status: "已归档" } },
    });
    const archived = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}`,
      userId,
    });
    expect(archived.unit.endDate).toBeTruthy();

    await api({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: snapshot(archived.unit), metadata: { status: "已成立" } },
    });
    const revived = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}`,
      userId,
    });
    expect(revived.unit.endDate).toBeNull();
  });

  test("note-only commit writes a bare adjust log", async () => {
    const unit = await createUnit();
    await api({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: snapshot(unit), commitNote: "只是记一笔" },
    });

    const { logs } = await logsFor(String(unit.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.note).toBe("只是记一笔");
  });

  test("rejects self-swap and unknown targets", async () => {
    const unit = await createUnit();
    const selfSwap = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(unit),
        operations: [{ kind: "swap_unit_code", targetUnitId: unit.id }],
      },
    });
    expect(selfSwap.status).toBe(400);

    const missing = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(unit),
        operations: [
          { kind: "swap_unit_code", targetUnitId: "123e4567-e89b-12d3-a456-426614174000" },
        ],
      },
    });
    expect(missing.status).toBe(404);
  });

  test("empty commit → 400", async () => {
    const unit = await createUnit();
    const res = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: snapshot(unit) },
    });
    expect(res.status).toBe(400);
  });

  test("unknown unit → 404", async () => {
    const res = await rawFetch({
      method: "POST",
      path: "/api/units/123e4567-e89b-12d3-a456-426614174000/commit",
      userId,
      body: { expected: snapshot(makeUnit()), commitNote: "x" },
    });
    expect(res.status).toBe(404);
  });
});

describe("E2E: Unit logs endpoint", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  test("returns logs plus the raw expected snapshot", async () => {
    const unit = await createUnit({ note: null, startDate: null });
    const res = await logsFor(String(unit.id));

    expect(res.logs).toEqual([]);
    // expected must mirror the DB row verbatim — nulls stay null.
    expect(res.expected).toEqual(snapshot(unit));
    expect(res.expected.note).toBeNull();
    expect(res.expected.endDate).toBeNull();
  });

  test("404 for an unknown unit", async () => {
    const res = await rawFetch({
      method: "GET",
      path: "/api/units/123e4567-e89b-12d3-a456-426614174000/logs",
      userId,
    });
    expect(res.status).toBe(404);
  });
});
