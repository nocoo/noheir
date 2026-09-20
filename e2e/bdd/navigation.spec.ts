import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:27004";
const tokenPath = new URL("../../.wrangler/browser-token.json", import.meta.url);
let token: string;

test.beforeAll(async ({ request }) => {
  await expect.poll(() => existsSync(tokenPath), { timeout: 15_000 }).toBe(true);
  token = (JSON.parse(readFileSync(tokenPath, "utf8")) as { token: string }).token;
  const headers = { "Cf-Access-Jwt-Assertion": token, Origin: origin };
  const wipeResponse = await request.post(`${origin}/api/data/import`, {
    headers,
    data: { transactions: [], transfers: [] },
  });
  expect(wipeResponse.ok()).toBe(true);

  for (const row of [
    {
      date: "2025-06-15",
      year: 2025,
      month: 6,
      day: 15,
      type: "income",
      amountCents: 50000,
      note: "salary-fixture",
    },
    {
      date: "2025-06-15",
      year: 2025,
      month: 6,
      day: 15,
      type: "expense",
      amountCents: 3500,
      note: "food-fixture",
    },
    {
      date: "2024-06-15",
      year: 2024,
      month: 6,
      day: 15,
      type: "income",
      amountCents: 25000,
      note: "prior-year-fixture",
    },
  ]) {
    const response = await request.post(`${origin}/api/transactions`, {
      headers,
      data: {
        primaryCategory: "餐饮",
        secondaryCategory: "外卖",
        tertiaryCategory: "午餐",
        account: "招商银行",
        currency: "人民币",
        tags: "[]",
        ...row,
      },
    });
    expect(response.ok()).toBe(true);
  }
});

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "Cf-Access-Jwt-Assertion": token });
});

const routes = [
  "/",
  "/account",
  "/account-detail",
  "/account-types",
  "/ai-insight",
  "/ai-settings",
  "/balance-anchors",
  "/capital-dashboard",
  "/capital-decisions",
  "/capital-logs",
  "/category-settings",
  "/compare",
  "/expense",
  "/financial-health",
  "/flow",
  "/freedom",
  "/funds",
  "/import",
  "/income",
  "/liquidity",
  "/login",
  "/manage",
  "/mcp-tokens",
  "/plan/calendar",
  "/plan/categories",
  "/privacy",
  "/products",
  "/quality",
  "/savings",
  "/settings",
  "/strategy",
  "/terms",
  "/warehouse",
];

for (const path of routes) {
  test(`financial route ${path} renders without runtime or API failures`, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(`${origin}/api/`) && response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`${path}?year=2025`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "数据加载失败" })).toHaveCount(0);
    expect(failures).toEqual([]);
  });
}

test("year navigation revalidates financial totals", async ({ page }) => {
  await page.goto("/?year=2025");
  await expect(page.getByRole("heading", { name: "财务概览" })).toBeVisible();
  const income = page.getByText("总收入", { exact: true }).locator("..");
  await expect(income).toContainText("500");
  await page.getByRole("button", { name: "上一年", exact: true }).click();
  await expect(page).toHaveURL(/year=2024/);
  await expect(income).toContainText("250");
});

test("creating a product revalidates the visible table", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("button", { name: "新增", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("名称", { exact: false }).fill("Browser fixture product");
  await dialog.getByRole("button", { name: "创建", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Browser fixture product", { exact: true })).toBeVisible();
});

test("recurring expense creation updates the planning view", async ({ page }) => {
  await page.goto("/plan/calendar");
  await page.getByTestId("open-create-rule").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("名称", { exact: true }).fill("Browser recurring fixture");
  await dialog.getByLabel("金额 (元)", { exact: true }).fill("25");
  await dialog.getByLabel("日", { exact: true }).fill("15");
  await dialog.getByLabel("开始日期", { exact: true }).fill("2026-01-01");
  await dialog.getByRole("button", { name: "创建", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Browser recurring fixture", { exact: true }).first()).toBeVisible();
});

test("CSV preview and commit persist the selected year", async ({ page, request }) => {
  await page.goto("/import");
  const csv =
    "日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注\n2023-06-15,餐饮,支出,0,12.34,人民币,招商银行,,browser-import\n";
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "transactions.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("解析成功", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "确认上传", exact: true }).click();
  await expect(page.getByText("导入成功！", { exact: true })).toBeVisible();
  const response = await request.get(`${origin}/api/transactions/years/2023/count`, {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
  expect(await response.json()).toEqual({ count: 1 });
});

test("backup download contains financial records and preserves declared scope", async ({
  page,
}) => {
  await page.goto("/manage");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份", exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path();
  if (!file) throw new Error("Backup download missing");
  const data = JSON.parse(readFileSync(file, "utf8"));
  expect(data.transactions.length).toBeGreaterThanOrEqual(3);
  expect(data.products.some((p: { name: string }) => p.name === "Browser fixture product")).toBe(
    true,
  );
});

test("failed financial reads show an error instead of zero balances", async ({ page }) => {
  await page.route("**/api/reports/yearly-summary**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Test read failure" }),
    }),
  );
  await page.goto("/?year=2025");
  await expect(page.getByRole("heading", { name: "数据加载失败" })).toBeVisible();
  await expect(page.getByText("总收入", { exact: true })).toHaveCount(0);
});

test("capital unit commit persists updated fields and writes contribution log", async ({
  page,
  request,
}) => {
  const headers = { "Cf-Access-Jwt-Assertion": token, Origin: origin };
  const setupRes = await request.post(`${origin}/api/units`, {
    headers,
    data: {
      unitCode: "U-BROWSER-01",
      amountCents: 1000000,
      currency: "CNY",
      status: "已成立",
      strategy: "短期理财",
      tactics: "定期存款",
      startDate: "2025-01-01",
      note: "setup-unit",
    },
  });
  expect(setupRes.ok()).toBe(true);
  const created = (await setupRes.json()) as { unit: { id: string; unitCode: string } };
  const unitId = created.unit.id;

  await page.goto("/funds");
  await expect(page.getByText("U-BROWSER-01", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Open edit dialog for this unit
  const row = page.getByRole("row", { name: /U-BROWSER-01/ });
  await row.getByRole("button").first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("编辑资本单位 · U-BROWSER-01")).toBeVisible();

  // Edit amount, unit note, and commit note
  const amountInput = dialog.getByLabel("金额", { exact: true });
  await amountInput.fill("15000");

  const unitNoteInput = dialog.getByLabel("单元备注", { exact: true });
  await unitNoteInput.fill("browser-unit-updated-note");

  const commitNoteInput = dialog.getByLabel("本次变更备注", { exact: true });
  await commitNoteInput.fill("browser-commit-test-note");

  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  // Assert persisted unit data via local API
  const unitRes = await request.get(`${origin}/api/units/${unitId}`, { headers });
  expect(unitRes.ok()).toBe(true);
  const unitData = (await unitRes.json()) as {
    unit: { id: string; amountCents: number; note: string | null };
  };
  expect(unitData.unit.amountCents).toBe(1500000);
  expect(unitData.unit.note).toBe("browser-unit-updated-note");

  // Assert persisted contribution log written
  const logsRes = await request.get(`${origin}/api/units/${unitId}/logs`, { headers });
  expect(logsRes.ok()).toBe(true);
  const logsData = (await logsRes.json()) as {
    logs: Array<{ operationType: string; note: string | null }>;
  };
  expect(logsData.logs.length).toBeGreaterThanOrEqual(1);
  const commitLog = logsData.logs.find(
    (log) => log.note?.includes("browser-commit-test-note") && log.note?.includes("元数据修改"),
  );
  expect(commitLog).toBeDefined();
  expect(commitLog?.operationType).toBe("adjust");
});
