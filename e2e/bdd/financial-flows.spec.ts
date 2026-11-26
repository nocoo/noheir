import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ORIGIN, readBrowserToken } from "./fixture";

let token: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  token = await readBrowserToken();
  const headers = { "Cf-Access-Jwt-Assertion": token, Origin: ORIGIN };
  const wipeResponse = await request.post(`${ORIGIN}/api/data/import`, {
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
    const response = await request.post(`${ORIGIN}/api/transactions`, {
      headers,
      data: {
        primaryCategory: "餐饮",
        secondaryCategory: "外卖",
        tertiaryCategory: "午餐",
        account: "招商银行",
        currency: "CNY",
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

test("year navigation revalidates financial totals", async ({ page }) => {
  await page.goto("/?year=2025");
  await expect(page.getByRole("heading", { name: "财务概览" })).toBeVisible();
  const income = page.getByText("总收入", { exact: true }).locator("..");
  await expect(income).toContainText("500");
  await page.getByRole("button", { name: "上一年", exact: true }).click();
  await expect(page).toHaveURL(/year=2024/);
  await expect(income).toContainText("250");
});

test("creating a product and exporting backup preserve financial records", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("button", { name: "新增", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("名称", { exact: false }).fill("Browser fixture product");
  await dialog.getByRole("button", { name: "创建", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Browser fixture product", { exact: true })).toBeVisible();

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
  const response = await request.get(`${ORIGIN}/api/transactions/years/2023/count`, {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
  expect(await response.json()).toEqual({ count: 1 });
  await page
    .getByRole("complementary", { name: "主导航", exact: true })
    .getByRole("link", { name: "收入分析", exact: true })
    .click();
  await page.getByRole("combobox", { name: "财务年份" }).click();
  await expect(page.getByRole("option", { name: "2023", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "2023", exact: true }).click();
  await expect(page).toHaveURL(/year=2023/);
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
