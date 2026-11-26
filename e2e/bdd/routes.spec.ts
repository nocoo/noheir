import { expect, test } from "@playwright/test";
import { ORIGIN, readBrowserToken } from "./fixture";

let token: string;

test.beforeAll(async () => {
  token = await readBrowserToken();
});

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "Cf-Access-Jwt-Assertion": token });
});

const routes = [
  "/",
  "/account",
  "/account-detail",
  "/account-types",
  "/analyses",
  "/api-keys",
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

test("all financial routes render without runtime or API failures", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(`${ORIGIN}/api/`) && response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  for (const path of routes) {
    await page.goto(`${path}?year=2025`);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "数据加载失败" })).toHaveCount(0);
    await expect(page.locator("[data-basalt-shell]")).toHaveCount(path === "/login" ? 0 : 1);
    if (path !== "/login") {
      await expect(page.locator("[data-basalt-shell] > [data-basalt-main] > header")).toHaveCount(
        1,
      );
      await expect(page.locator("[data-basalt-main] [data-basalt-island]")).toHaveCount(1);
    }
  }
  expect(failures).toEqual([]);
});

test("failed financial reads and missing routes stay inside the shell error boundary", async ({
  page,
}) => {
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
  await page.unroute("**/api/reports/yearly-summary**");

  await page.goto("/missing-financial-page");
  await expect(page.locator("[data-basalt-shell]")).toHaveCount(1);
  await expect(
    page.locator("[data-basalt-island]").getByRole("heading", { name: "数据加载失败" }),
  ).toBeVisible();
  await page
    .getByRole("complementary", { name: "主导航", exact: true })
    .getByRole("link", { name: "分析报告", exact: true })
    .click();
  await expect(page).toHaveURL("/analyses");
  await expect(page.getByRole("heading", { name: "分析报告", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "数据加载失败" })).toHaveCount(0);
});
