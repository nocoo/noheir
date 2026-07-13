import { beforeEach, describe, expect, test } from "vitest";
import { getTestRepos, resetTestDb, seedUser } from "./setup";

describe("units repo", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  const baseUnit = {
    unitCode: "U-2026-001",
    amountCents: 1000000,
    currency: "CNY",
    status: "已成立",
    strategy: "长期理财",
    tactics: "债券基金",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    note: "test unit",
  };

  test("create and findById", async () => {
    const repos = getTestRepos();
    const created = await repos.units.create(userId, baseUnit);
    expect(created.id).toBeDefined();
    expect(created.unitCode).toBe("U-2026-001");
    expect(created.amountCents).toBe(1000000);

    const found = await repos.units.findById(userId, created.id);
    expect(found).not.toBeNull();
    expect(found?.unitCode).toBe(created.unitCode);
  });

  test("findAll", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, unitCode: "U-2026-002" });

    const all = await repos.units.findAll(userId);
    expect(all).toHaveLength(2);
  });

  test("findAll filters by status", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, status: "已归档" });

    const result = await repos.units.findAll(userId, { status: "已归档" });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("已归档");
  });

  test("findAll filters by strategy", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, strategy: "短期理财" });

    const result = await repos.units.findAll(userId, { strategy: "短期理财" });
    expect(result).toHaveLength(1);
  });

  test("findAll filters by tactics", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, tactics: "货币基金" });

    const result = await repos.units.findAll(userId, { tactics: "货币基金" });
    expect(result).toHaveLength(1);
  });

  test("findAll filters by currency", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, currency: "USD" });

    const result = await repos.units.findAll(userId, { currency: "USD" });
    expect(result).toHaveLength(1);
  });

  test("findAllWithProducts: LEFT JOIN returns product or null", async () => {
    const repos = getTestRepos();

    // Create a product
    const product = await repos.products.create(userId, {
      name: "Test Fund",
      channel: "招商银行",
      category: "债券基金",
    });

    // Create unit with product
    await repos.units.create(userId, { ...baseUnit, productId: product.id });
    // Create unit without product
    await repos.units.create(userId, { ...baseUnit, unitCode: "U-2026-002" });

    const result = await repos.units.findAllWithProducts(userId);
    expect(result).toHaveLength(2);

    const withProduct = result.find((u) => u.productId === product.id);
    const withoutProduct = result.find((u) => u.productId === null);

    expect(withProduct?.product).not.toBeNull();
    expect(withProduct?.product?.name).toBe("Test Fund");
    expect(withoutProduct?.product).toBeNull();
  });

  test("findAllWithProducts filters by status", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, unitCode: "U-2026-002", status: "已归档" });

    const result = await repos.units.findAllWithProducts(userId, { status: "已归档" });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("已归档");
  });

  test("findAllWithProducts filters by strategy", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, unitCode: "U-2026-002", strategy: "短期理财" });

    const result = await repos.units.findAllWithProducts(userId, { strategy: "短期理财" });
    expect(result).toHaveLength(1);
    expect(result[0]?.strategy).toBe("短期理财");
  });

  test("findAllWithProducts filters by tactics", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, unitCode: "U-2026-002", tactics: "货币基金" });

    const result = await repos.units.findAllWithProducts(userId, { tactics: "货币基金" });
    expect(result).toHaveLength(1);
    expect(result[0]?.tactics).toBe("货币基金");
  });

  test("findAllWithProducts filters by currency", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, baseUnit);
    await repos.units.create(userId, { ...baseUnit, unitCode: "U-2026-002", currency: "USD" });

    const result = await repos.units.findAllWithProducts(userId, { currency: "USD" });
    expect(result).toHaveLength(1);
    expect(result[0]?.currency).toBe("USD");
  });

  test("findAllWithProducts combines multiple filters with AND logic", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, { ...baseUnit, status: "已归档", strategy: "短期理财" });
    await repos.units.create(userId, {
      ...baseUnit,
      unitCode: "U-2026-002",
      status: "已归档",
      strategy: "长期理财",
    });
    await repos.units.create(userId, {
      ...baseUnit,
      unitCode: "U-2026-003",
      status: "已成立",
      strategy: "短期理财",
    });

    const result = await repos.units.findAllWithProducts(userId, {
      status: "已归档",
      strategy: "短期理财",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("已归档");
    expect(result[0]?.strategy).toBe("短期理财");
  });

  test("findAll combines multiple filters with AND logic", async () => {
    const repos = getTestRepos();
    await repos.units.create(userId, { ...baseUnit, status: "已归档", strategy: "短期理财" });
    await repos.units.create(userId, {
      ...baseUnit,
      unitCode: "U-2026-002",
      status: "已归档",
      strategy: "长期理财",
    });
    await repos.units.create(userId, {
      ...baseUnit,
      unitCode: "U-2026-003",
      status: "已成立",
      strategy: "短期理财",
    });

    const result = await repos.units.findAll(userId, {
      status: "已归档",
      strategy: "短期理财",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("已归档");
    expect(result[0]?.strategy).toBe("短期理财");
  });

  test("update", async () => {
    const repos = getTestRepos();
    const created = await repos.units.create(userId, baseUnit);
    const updated = await repos.units.update(userId, created.id, {
      amountCents: 2000000,
      status: "已归档",
    });
    expect(updated?.amountCents).toBe(2000000);
    expect(updated?.status).toBe("已归档");
  });

  test("delete", async () => {
    const repos = getTestRepos();
    const created = await repos.units.create(userId, baseUnit);
    expect(await repos.units.delete(userId, created.id)).toBe(true);
    expect(await repos.units.findById(userId, created.id)).toBeNull();
  });

  test("user isolation: findAll", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    await repos.units.create(userId, baseUnit);
    await repos.units.create("other-user", baseUnit);

    expect(await repos.units.findAll(userId)).toHaveLength(1);
  });
});
