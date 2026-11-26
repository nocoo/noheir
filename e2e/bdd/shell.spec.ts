import { expect, test } from "@playwright/test";
import { readBrowserToken } from "./fixture";

let token: string;

test.beforeAll(async () => {
  token = await readBrowserToken();
});

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "Cf-Access-Jwt-Assertion": token });
});

test("shared shell retains sidebar collapse state and browser history across routes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/api-keys");
  const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
  const original = await sidebar.evaluateHandle((node) => node);
  await sidebar.getByRole("button", { name: "收起侧边栏", exact: true }).click();
  await expect(sidebar.getByRole("button", { name: "展开侧边栏", exact: true })).toBeVisible();

  await sidebar.getByRole("link", { name: "分析报告", exact: true }).click();
  await expect(page).toHaveURL("/analyses");
  await expect(page.getByRole("heading", { name: "分析报告", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "展开侧边栏", exact: true })).toBeVisible();
  await expect
    .poll(() => sidebar.evaluate((node, previous) => node === previous, original))
    .toBe(true);

  await page.goBack();
  await expect(page).toHaveURL("/api-keys");
  await page.goForward();
  await expect(page).toHaveURL("/analyses");

  const toggle = page.getByRole("button", { name: "切换主题", exact: true });
  await toggle.click();
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
