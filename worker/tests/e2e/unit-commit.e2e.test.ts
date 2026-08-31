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
    availableDateOverride: u.availableDateOverride ?? null,
  };
}

async function logsFor(unitId: string) {
  return api<{
    logs: Record<string, unknown>[];
    expected: Record<string, unknown>;
    currentProductName: string | null;
    availableDate: string | null;
  }>({
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

  test("a stale expected blocks a staged product switch too", async () => {
    const from = await createProduct({ name: "ATOM-A", code: "AA-1" });
    const to = await createProduct({ name: "ATOM-B", code: "AB-1" });
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

    // Someone changes the amount; the product is untouched, so a guard that
    // only checks product_id + unit_code would still match.
    await api({
      method: "PUT",
      path: `/api/units/${unit.id}`,
      userId,
      body: { amountCents: 7777777 },
    });

    const res = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(current.unit),
        operations: [{ kind: "switch_product", toProductId: to.id }],
      },
    });
    expect(res.status).toBe(409);

    // All-or-nothing: the product must not have moved, and no log written.
    const after = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}`,
      userId,
    });
    expect(after.unit.productId).toBe(from.id);

    // The earlier PUT that linked the product wrote its own invest log, so
    // count only what a switch would have added: a withdraw, or an invest
    // pointing at the target product.
    const { logs } = await logsFor(String(unit.id));
    expect(logs.filter((l) => l.operationType === "withdraw")).toHaveLength(0);
    expect(logs.filter((l) => l.productId === to.id)).toHaveLength(0);
  });

  test("a stale note-only commit writes no log", async () => {
    const unit = await createUnit();
    const stale = snapshot(unit);

    // Another request moves the amount. A note-only commit sets almost nothing,
    // so its log guard must still notice the row no longer matches.
    await api({
      method: "PUT",
      path: `/api/units/${unit.id}`,
      userId,
      body: { amountCents: 4242424 },
    });

    const res = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: stale, commitNote: "should not be written" },
    });
    expect(res.status).toBe(409);

    const { logs } = await logsFor(String(unit.id));
    expect(logs).toHaveLength(0);
  });

  // Note: this covers the API contract (stale expected → 409, no extra log), not
  // the same-millisecond race. Two HTTP calls land on different timestamps, so
  // this passes against the old timestamp guard too — the race itself is pinned
  // in worker/tests/unit-commit-execution.test.ts, which controls `now`.
  test("a losing commit writes no log even when it wanted the same result", async () => {
    const unit = await createUnit({ amountCents: 100000 });
    const stale = snapshot(unit);

    // Another request makes the exact edit this one intends.
    await api({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: stale, metadata: { amountCents: 200000 }, commitNote: "winner" },
    });

    const res = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: { expected: stale, metadata: { amountCents: 200000 }, commitNote: "loser" },
    });
    expect(res.status).toBe(409);

    const { logs } = await logsFor(String(unit.id));
    expect(logs).toHaveLength(1);
    expect(String(logs[0]?.note)).toContain("winner");
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

  test("swap logs the partner's product as of commit time", async () => {
    const pa = await createProduct({ name: "CC-A", code: "CCA-1" });
    const pb = await createProduct({ name: "CC-B", code: "CCB-1" });
    const a = await createUnit({ unitCode: "CC-001" });
    const b = await createUnit({ unitCode: "CC-002" });

    await api({ method: "PUT", path: `/api/units/${b.id}`, userId, body: { productId: pa.id } });

    const current = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${a.id}`,
      userId,
    });

    // The partner moves to another product before the commit is issued.
    await api({ method: "PUT", path: `/api/units/${b.id}`, userId, body: { productId: pb.id } });

    await api({
      method: "POST",
      path: `/api/units/${a.id}/commit`,
      userId,
      body: {
        expected: snapshot(current.unit),
        operations: [{ kind: "swap_unit_code", targetUnitId: b.id }],
      },
    });

    // The endpoint reads the partner inside the request, so the log carries the
    // product the partner is in NOW (pb), never the one it had earlier (pa).
    // The batch guard additionally pins that read against the write.
    const logsB = await logsFor(String(b.id));
    const adjustB = logsB.logs.find((l) => l.operationType === "adjust");
    expect(adjustB?.productId).toBe(pb.id);
    expect(adjustB?.productName).toBe("CC-B");
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

  test("set_available_date pins unlock without rewriting invest logs", async () => {
    const product = await createProduct({ name: "锁定期产品", lockPeriodDays: 30 });
    const unit = await createUnit({ productId: product.id, status: "已成立" });
    const current = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}`,
      userId,
    });
    const beforeLogs = await logsFor(String(unit.id));
    const investDatesBefore = beforeLogs.logs
      .filter((l) => l.operationType === "invest")
      .map((l) => l.operationDate);

    await api({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(current.unit),
        operations: [{ kind: "set_available_date", availableDate: "2026-09-15" }],
        commitNote: "校正解锁日",
      },
    });

    const after = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}?with_products=true`,
      userId,
    });
    expect(after.unit.availableDateOverride).toBe("2026-09-15");
    expect(after.unit.availableDate).toBe("2026-09-15");

    const afterLogs = await logsFor(String(unit.id));
    expect(afterLogs.availableDate).toBe("2026-09-15");
    const investDatesAfter = afterLogs.logs
      .filter((l) => l.operationType === "invest")
      .map((l) => l.operationDate);
    expect(investDatesAfter).toEqual(investDatesBefore);
    expect(afterLogs.logs.some((l) => String(l.note).includes("可用日期覆盖"))).toBe(true);

    const noop = await rawFetch({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(after.unit),
        operations: [{ kind: "set_available_date", availableDate: "2026-09-15" }],
      },
    });
    expect(noop.status).toBe(400);

    await api({
      method: "POST",
      path: `/api/units/${unit.id}/commit`,
      userId,
      body: {
        expected: snapshot(after.unit),
        operations: [{ kind: "set_available_date", availableDate: null }],
      },
    });
    const cleared = await api<{ unit: UnitRow }>({
      method: "GET",
      path: `/api/units/${unit.id}?with_products=true`,
      userId,
    });
    expect(cleared.unit.availableDateOverride).toBeNull();
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

  test("resolves the current product name from the same read as expected", async () => {
    const product = await createProduct({ name: "SNAP-A", code: "SA-1" });
    const unit = await createUnit();

    const before = await logsFor(String(unit.id));
    expect(before.currentProductName).toBeNull();

    await api({
      method: "PUT",
      path: `/api/units/${unit.id}`,
      userId,
      body: { productId: product.id },
    });

    // The name must accompany the id in `expected`, not be looked up client-side
    // from a list that omits archived products.
    const after = await logsFor(String(unit.id));
    expect(after.expected.productId).toBe(product.id);
    expect(after.currentProductName).toBe("SNAP-A");
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
