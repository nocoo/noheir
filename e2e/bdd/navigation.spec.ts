import { expect, test } from "@playwright/test";

test.describe("App — BDD Smoke", () => {
  test("Given the app is running, When I visit the terms page, Then I see the terms content", async ({
    page,
  }) => {
    await page.goto("/terms");
    await expect(page.getByText("服务条款")).toBeVisible({ timeout: 15_000 });
  });
});
