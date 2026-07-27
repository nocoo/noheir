import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { getTestDb, getTestRepos, resetTestDb, seedUser } from "./setup";

describe("ContributionLogsRepo", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  const baseUnit = {
    unitCode: "U-2026-001",
    amountCents: 1000000,
    currency: "CNY",
    status: "已成立" as const,
    strategy: "长期理财" as const,
    tactics: "债券基金" as const,
  };

  const baseProduct = {
    name: "Test Fund",
    channel: "招商银行" as const,
    category: "债券基金" as const,
  };

  test("create and findById", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);
    const product = await repos.products.create(userId, baseProduct);

    const created = await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      productId: product.id,
      productName: product.name,
      operationType: "invest",
      amountCents: 500000,
      operationDate: "2026-04-01",
      source: "manual",
    });

    expect(created.id).toBeDefined();
    expect(created.unitId).toBe(unit.id);
    expect(created.amountCents).toBe(500000);
    expect(created.operationType).toBe("invest");

    const found = await repos.contributionLogs.findById(userId, created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  test("pnlCents round-trips and defaults to null", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);
    const product = await repos.products.create(userId, baseProduct);

    const withPnl = await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      productId: product.id,
      operationType: "withdraw",
      amountCents: -500000,
      pnlCents: 12345,
      operationDate: "2026-04-02",
      source: "manual",
    });
    expect(withPnl.pnlCents).toBe(12345);

    const negative = await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      productId: product.id,
      operationType: "withdraw",
      amountCents: -100000,
      pnlCents: -6789,
      operationDate: "2026-04-03",
      source: "manual",
    });
    expect(negative.pnlCents).toBe(-6789);

    const omitted = await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      productId: product.id,
      operationType: "invest",
      amountCents: 500000,
      operationDate: "2026-04-04",
      source: "manual",
    });
    expect(omitted.pnlCents).toBeNull();

    const found = await repos.contributionLogs.findById(userId, withPnl.id);
    expect(found?.pnlCents).toBe(12345);
  });

  test("getLatestInvestLogs picks newest across mixed created_at encodings", async () => {
    const repos = getTestRepos();
    const db = getTestDb();
    const unit = await repos.units.create(userId, baseUnit);
    const product = await repos.products.create(userId, baseProduct);

    // Three production encodings, same operation_date, inserted raw to bypass
    // Drizzle's timestamp codec. Newest is `auto` (see docs/003 § B1).
    const rows = [
      ["log-mcp", "2026-07-02T05:51:49.226Z"], // ISO text  → 1782971509226ms
      ["log-auto", 1784956591451], // integer ms
      ["log-drizzle", 1751435509], // integer seconds → 1751435509000ms
    ] as const;

    for (const [id, createdAt] of rows) {
      db.run(
        sql`INSERT INTO contribution_logs
          (id, user_id, unit_id, product_id, operation_type, amount_cents, operation_date, source, created_at, updated_at)
          VALUES (${id}, ${userId}, ${unit.id}, ${product.id}, 'invest', 100000, '2026-07-02', 'manual', ${createdAt}, ${createdAt})`,
      );
    }

    const latest = await repos.contributionLogs.getLatestInvestLogs(userId, [unit.id]);
    expect(latest.get(unit.id)?.id).toBe("log-auto");
  });

  test("search orders mixed created_at encodings consistently", async () => {
    const repos = getTestRepos();
    const db = getTestDb();
    const unit = await repos.units.create(userId, baseUnit);
    const product = await repos.products.create(userId, baseProduct);

    const rows = [
      ["s-mcp", "2026-07-02T05:51:49.226Z"],
      ["s-auto", 1784956591451],
      ["s-drizzle", 1751435509],
    ] as const;

    for (const [id, createdAt] of rows) {
      db.run(
        sql`INSERT INTO contribution_logs
          (id, user_id, unit_id, product_id, operation_type, amount_cents, operation_date, source, created_at, updated_at)
          VALUES (${id}, ${userId}, ${unit.id}, ${product.id}, 'invest', 100000, '2026-07-02', 'manual', ${createdAt}, ${createdAt})`,
      );
    }

    const result = await repos.contributionLogs.search(userId, { unitId: unit.id });
    // Same order the unit timeline uses — both go through compareLogsForTimeline.
    expect(result.logs.map((l) => l.id)).toEqual(["s-auto", "s-mcp", "s-drizzle"]);
  });

  test("search with filters", async () => {
    const repos = getTestRepos();
    const unit1 = await repos.units.create(userId, baseUnit);
    const unit2 = await repos.units.create(userId, { ...baseUnit, unitCode: "U-2026-002" });
    const product = await repos.products.create(userId, baseProduct);

    // Create logs with different attributes
    await repos.contributionLogs.create(userId, {
      unitId: unit1.id,
      productId: product.id,
      productName: product.name,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-01-15",
      source: "manual",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit1.id,
      productId: product.id,
      productName: product.name,
      operationType: "withdraw",
      amountCents: -50000,
      operationDate: "2026-02-20",
      source: "auto",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit2.id,
      operationType: "invest",
      amountCents: 200000,
      operationDate: "2026-03-10",
      source: "import",
    });

    // Filter by unitId
    const byUnit = await repos.contributionLogs.search(userId, { unitId: unit1.id });
    expect(byUnit.logs).toHaveLength(2);

    // Filter by operationType
    const byType = await repos.contributionLogs.search(userId, { operationType: "invest" });
    expect(byType.logs).toHaveLength(2);

    // Filter by source
    const bySource = await repos.contributionLogs.search(userId, { source: "manual" });
    expect(bySource.logs).toHaveLength(1);

    // Filter by date range
    const byDate = await repos.contributionLogs.search(userId, {
      startDate: "2026-02-01",
      endDate: "2026-03-31",
    });
    expect(byDate.logs).toHaveLength(2);

    // Filter by productId
    const byProduct = await repos.contributionLogs.search(userId, { productId: product.id });
    expect(byProduct.logs).toHaveLength(2);
  });

  test("search returns related unit and product", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);
    const product = await repos.products.create(userId, baseProduct);

    await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      productId: product.id,
      productName: product.name,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-04-01",
    });

    const result = await repos.contributionLogs.search(userId, {});
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.unit).not.toBeNull();
    expect(result.logs[0]?.unit?.unitCode).toBe("U-2026-001");
    expect(result.logs[0]?.product).not.toBeNull();
    expect(result.logs[0]?.product?.name).toBe("Test Fund");
  });

  test("summarizeByUnit calculates totals", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);

    await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-01-01",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "invest",
      amountCents: 200000,
      operationDate: "2026-02-01",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "withdraw",
      amountCents: -50000,
      operationDate: "2026-03-01",
    });

    const summary = await repos.contributionLogs.summarizeByUnit(userId, unit.id);
    expect(summary.totalInvested).toBe(300000);
    expect(summary.totalWithdrawn).toBe(50000);
    expect(summary.netAmount).toBe(250000);
    expect(summary.logCount).toBe(3);
  });

  test("summarizeByProduct with multiple units", async () => {
    const repos = getTestRepos();
    const unit1 = await repos.units.create(userId, baseUnit);
    const unit2 = await repos.units.create(userId, { ...baseUnit, unitCode: "U-2026-002" });
    const product = await repos.products.create(userId, baseProduct);

    await repos.contributionLogs.create(userId, {
      unitId: unit1.id,
      productId: product.id,
      productName: product.name,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-01-01",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit2.id,
      productId: product.id,
      productName: product.name,
      operationType: "invest",
      amountCents: 200000,
      operationDate: "2026-02-01",
    });

    const summary = await repos.contributionLogs.summarizeByProduct(userId, product.id);
    expect(summary.totalInvested).toBe(300000);
    expect(summary.totalWithdrawn).toBe(0);
    expect(summary.netAmount).toBe(300000);
    expect(summary.logCount).toBe(2);
    expect(summary.unitCount).toBe(2);
  });

  test("softDelete and restore", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);

    const created = await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-04-01",
    });

    // Soft delete
    const deleted = await repos.contributionLogs.softDelete(userId, created.id);
    expect(deleted).toBe(true);

    // Search without includeDeleted should not find it
    const notFound = await repos.contributionLogs.search(userId, {});
    expect(notFound.logs).toHaveLength(0);

    // Search with includeDeleted should find it
    const found = await repos.contributionLogs.search(userId, { includeDeleted: true });
    expect(found.logs).toHaveLength(1);
    expect(found.logs[0]?.deletedAt).not.toBeNull();

    // Restore
    const restored = await repos.contributionLogs.restore(userId, created.id);
    expect(restored).not.toBeNull();
    expect(restored?.deletedAt).toBeNull();

    // Now search should find it again
    const afterRestore = await repos.contributionLogs.search(userId, {});
    expect(afterRestore.logs).toHaveLength(1);
  });

  test("update", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);

    const created = await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-04-01",
    });

    const updated = await repos.contributionLogs.update(userId, created.id, {
      amountCents: 150000,
      note: "Updated amount",
    });

    expect(updated).not.toBeNull();
    expect(updated?.amountCents).toBe(150000);
    expect(updated?.note).toBe("Updated amount");
  });

  test("user isolation", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");

    const unit1 = await repos.units.create(userId, baseUnit);
    const unit2 = await repos.units.create("other-user", { ...baseUnit, unitCode: "U-OTHER-001" });

    await repos.contributionLogs.create(userId, {
      unitId: unit1.id,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-04-01",
    });
    await repos.contributionLogs.create("other-user", {
      unitId: unit2.id,
      operationType: "invest",
      amountCents: 200000,
      operationDate: "2026-04-01",
    });

    const user1Logs = await repos.contributionLogs.search(userId, {});
    expect(user1Logs.logs).toHaveLength(1);
    expect(user1Logs.logs[0]?.amountCents).toBe(100000);

    const user2Logs = await repos.contributionLogs.search("other-user", {});
    expect(user2Logs.logs).toHaveLength(1);
    expect(user2Logs.logs[0]?.amountCents).toBe(200000);
  });

  test("summarizeByUnit excludes soft-deleted logs", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);

    const log1 = await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-01-01",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "invest",
      amountCents: 200000,
      operationDate: "2026-02-01",
    });

    // Soft delete first log
    await repos.contributionLogs.softDelete(userId, log1.id);

    const summary = await repos.contributionLogs.summarizeByUnit(userId, unit.id);
    expect(summary.totalInvested).toBe(200000);
    expect(summary.logCount).toBe(1);
  });

  test("search with pagination", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);

    // Create 5 logs
    for (let i = 1; i <= 5; i++) {
      await repos.contributionLogs.create(userId, {
        unitId: unit.id,
        operationType: "invest",
        amountCents: i * 10000,
        operationDate: `2026-0${i}-01`,
      });
    }

    const page1 = await repos.contributionLogs.search(userId, { limit: 2, offset: 0 });
    expect(page1.logs).toHaveLength(2);

    const page2 = await repos.contributionLogs.search(userId, { limit: 2, offset: 2 });
    expect(page2.logs).toHaveLength(2);

    const page3 = await repos.contributionLogs.search(userId, { limit: 2, offset: 4 });
    expect(page3.logs).toHaveLength(1);
  });

  test("getLatestInvestLogs returns latest invest per unit", async () => {
    const repos = getTestRepos();
    const unit1 = await repos.units.create(userId, { ...baseUnit, unitCode: "U-001" });
    const unit2 = await repos.units.create(userId, { ...baseUnit, unitCode: "U-002" });
    const unit3 = await repos.units.create(userId, { ...baseUnit, unitCode: "U-003" });

    // Unit 1: multiple invest logs, latest is 2026-03-01
    await repos.contributionLogs.create(userId, {
      unitId: unit1.id,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-01-01",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit1.id,
      operationType: "invest",
      amountCents: 200000,
      operationDate: "2026-03-01",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit1.id,
      operationType: "withdraw", // Not invest, should be ignored
      amountCents: -50000,
      operationDate: "2026-04-01",
    });

    // Unit 2: single invest log
    await repos.contributionLogs.create(userId, {
      unitId: unit2.id,
      operationType: "invest",
      amountCents: 300000,
      operationDate: "2026-02-15",
    });

    // Unit 3: no invest logs (only withdraw)
    await repos.contributionLogs.create(userId, {
      unitId: unit3.id,
      operationType: "withdraw",
      amountCents: -100000,
      operationDate: "2026-02-01",
    });

    const result = await repos.contributionLogs.getLatestInvestLogs(userId, [
      unit1.id,
      unit2.id,
      unit3.id,
    ]);

    expect(result.size).toBe(2); // unit3 has no invest log

    const log1 = result.get(unit1.id);
    expect(log1).toBeDefined();
    expect(log1?.operationDate).toBe("2026-03-01"); // Latest invest
    expect(log1?.amountCents).toBe(200000);

    const log2 = result.get(unit2.id);
    expect(log2).toBeDefined();
    expect(log2?.operationDate).toBe("2026-02-15");

    expect(result.get(unit3.id)).toBeUndefined();
  });

  test("getLatestInvestLogs returns empty map for empty input", async () => {
    const repos = getTestRepos();
    const result = await repos.contributionLogs.getLatestInvestLogs(userId, []);
    expect(result.size).toBe(0);
  });

  test("getLatestInvestLogs ignores soft-deleted logs", async () => {
    const repos = getTestRepos();
    const unit = await repos.units.create(userId, baseUnit);

    const _oldLog = await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "invest",
      amountCents: 100000,
      operationDate: "2026-01-01",
    });
    await repos.contributionLogs.create(userId, {
      unitId: unit.id,
      operationType: "invest",
      amountCents: 200000,
      operationDate: "2026-03-01",
    });

    // Soft delete the newer log
    await repos.contributionLogs.softDelete(
      userId,
      (await repos.contributionLogs.search(userId, { unitId: unit.id })).logs.find(
        (l) => l.operationDate === "2026-03-01",
      )?.id,
    );

    const result = await repos.contributionLogs.getLatestInvestLogs(userId, [unit.id]);
    const log = result.get(unit.id);
    expect(log).toBeDefined();
    expect(log?.operationDate).toBe("2026-01-01"); // Falls back to older log
  });
});
