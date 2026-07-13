import { beforeEach, describe, expect, test } from "vitest";
import { getTestRepos, resetTestDb, seedUser } from "./setup";

describe("products repo", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  const baseProduct = {
    name: "招银理财日日聚",
    code: "P001",
    channel: "招商银行",
    category: "货币基金",
    currency: "CNY",
    lockPeriodDays: 0,
    annualReturnRate: 0.025,
  };

  test("create and findById", async () => {
    const repos = getTestRepos();
    const created = await repos.products.create(userId, baseProduct);
    expect(created.id).toBeDefined();
    expect(created.name).toBe("招银理财日日聚");

    const found = await repos.products.findById(userId, created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe(created.name);
  });

  test("findAll returns all for user", async () => {
    const repos = getTestRepos();
    await repos.products.create(userId, baseProduct);
    await repos.products.create(userId, { ...baseProduct, name: "Product 2" });

    const all = await repos.products.findAll(userId);
    expect(all).toHaveLength(2);
  });

  test("findAll isolates by user", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    await repos.products.create(userId, baseProduct);
    await repos.products.create("other-user", baseProduct);

    expect(await repos.products.findAll(userId)).toHaveLength(1);
    expect(await repos.products.findAll("other-user")).toHaveLength(1);
  });

  test("findAll filters by channel", async () => {
    const repos = getTestRepos();
    await repos.products.create(userId, baseProduct);
    await repos.products.create(userId, { ...baseProduct, channel: "支付宝" });

    const result = await repos.products.findAll(userId, { channel: "支付宝" });
    expect(result).toHaveLength(1);
    expect(result[0]!.channel).toBe("支付宝");
  });

  test("findAll filters by category", async () => {
    const repos = getTestRepos();
    await repos.products.create(userId, baseProduct);
    await repos.products.create(userId, { ...baseProduct, category: "债券基金" });

    const result = await repos.products.findAll(userId, { category: "债券基金" });
    expect(result).toHaveLength(1);
  });

  test("findAll filters by currency", async () => {
    const repos = getTestRepos();
    await repos.products.create(userId, baseProduct);
    await repos.products.create(userId, { ...baseProduct, currency: "USD" });

    const result = await repos.products.findAll(userId, { currency: "USD" });
    expect(result).toHaveLength(1);
  });

  test("update", async () => {
    const repos = getTestRepos();
    const created = await repos.products.create(userId, baseProduct);
    const updated = await repos.products.update(userId, created.id, {
      name: "Updated Name",
      annualReturnRate: 0.035,
    });
    expect(updated!.name).toBe("Updated Name");
    expect(updated!.annualReturnRate).toBe(0.035);
  });

  test("update returns null for non-existent", async () => {
    const repos = getTestRepos();
    const result = await repos.products.update(userId, "nonexistent", { name: "test" });
    expect(result).toBeNull();
  });

  test("delete", async () => {
    const repos = getTestRepos();
    const created = await repos.products.create(userId, baseProduct);
    expect(await repos.products.delete(userId, created.id)).toBe(true);
    expect(await repos.products.findById(userId, created.id)).toBeNull();
  });

  test("delete returns false for non-existent", async () => {
    const repos = getTestRepos();
    expect(await repos.products.delete(userId, "nonexistent")).toBe(false);
  });
});
