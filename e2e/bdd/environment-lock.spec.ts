import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("dedicated E2E ignores interactive preferences and enforces its server lock", async ({
  page,
  request,
}) => {
  const token = (
    JSON.parse(
      readFileSync(new URL("../../.wrangler/browser-token.json", import.meta.url), "utf8"),
    ) as { token: string }
  ).token;
  await page.setExtraHTTPHeaders({ "Cf-Access-Jwt-Assertion": token });
  await page.addInitScript(() => localStorage.setItem("noheir:environment-mode", "prod"));
  await page.goto("/");
  await expect(page.getByText("财务概览", { exact: true })).toBeVisible();
  if (process.env.CI) await expect(page.locator('[aria-label="环境"]')).toHaveCount(0);
  else {
    await expect(page.getByRole("radio", { name: "E2E", exact: true })).toHaveAttribute(
      "data-state",
      "on",
    );
    for (const name of ["Demo", "E2E", "Prod"])
      await expect(page.getByRole("radio", { name, exact: true })).toBeDisabled();
  }
  expect(await page.evaluate(() => localStorage.getItem("noheir:environment-mode"))).toBe("prod");
  expect(
    await page.evaluate(() => sessionStorage.getItem("noheir:environment-instance")),
  ).toBeNull();
  const response = await request.post("/__local/environment", {
    headers: { Origin: "http://127.0.0.1:27004" },
    data: { action: "switch", mode: "prod" },
  });
  expect(response.status()).toBe(409);
});
