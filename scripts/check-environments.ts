import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium, expect } from "@playwright/test";
import { CATALOG_VERSION, DEMO_ANCHOR } from "./demo-catalog.ts";
import { createEnvironmentController, localMiddleware } from "./local-environments.ts";
import { createNativeFixture, TEST_USERS } from "./test-fixture.ts";

const origin = "http://127.0.0.1:27004";
const capture = process.argv.includes("--capture");
const fixture = await createNativeFixture({ siteOrigin: origin, presentationDate: DEMO_ANCHOR });
const browser = await chromium.launch({ channel: "chrome" });
const controller = await createEnvironmentController({
  origin,
  demoFixture: fixture,
  production: false,
  ...(capture ? { automated: true, dataset: "demo", ci: true } : {}),
});
const middleware = localMiddleware(controller, origin);
let hosted = false;
const server = createServer((req, res) => {
  const serveAssets = () => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const response = await fixture.mf.dispatchFetch(new URL(req.url ?? "/", origin), {
        method: req.method ?? "GET",
        headers: {
          "Cf-Access-Jwt-Assertion": fixture.tokens[TEST_USERS[0] ?? ""] ?? "",
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: chunks.length ? Buffer.concat(chunks) : null,
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    })().catch(() => res.writeHead(500).end());
  };
  if (hosted) serveAssets();
  else void middleware(req, res, serveAssets);
});
try {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(27004, "127.0.0.1", resolve);
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    ...(capture
      ? {
          extraHTTPHeaders: {
            "Cf-Access-Jwt-Assertion": controller.lockedFixture?.tokens[TEST_USERS[0] ?? ""] ?? "",
          },
        }
      : {}),
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(DEMO_ANCHOR));
  if (!capture) {
    await page.addInitScript(() => {
      if (!localStorage.getItem("noheir:environment-mode"))
        localStorage.setItem("noheir:environment-mode", "e2e");
    });
    await page.goto(origin);
    await expect(page.getByRole("radio", { name: "E2E", exact: true })).toHaveAttribute(
      "data-state",
      "on",
    );
    const original = await page.evaluate(() =>
      sessionStorage.getItem("noheir:environment-instance"),
    );
    await page.goto(`${origin}/ai-settings`);
    const input = page.getByLabel("API 密钥");
    await input.fill("synthetic-unsaved-key");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("radio", { name: "Demo", exact: true }).click();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("noheir:environment-instance")),
      original,
    );
    assert.equal(await page.evaluate(() => localStorage.getItem("noheir:environment-mode")), "e2e");
    await expect(input).toHaveValue("synthetic-unsaved-key");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("radio", { name: "Demo", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Demo", exact: true })).toHaveAttribute(
      "data-state",
      "on",
    );
    await expect(page).toHaveURL(`${origin}/`);
    assert.equal(
      (
        await page.request.get(`${origin}/api/products`, {
          headers: { "x-noheir-instance": original ?? "" },
        })
      ).status(),
      410,
    );
    const demoId = await page.evaluate(() => sessionStorage.getItem("noheir:environment-instance"));
    await page.evaluate(() => localStorage.setItem("noheir:environment-mode", "prod"));
    await expect(page.getByRole("radio", { name: "Demo", exact: true })).toHaveAttribute(
      "data-state",
      "on",
    );
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("noheir:environment-instance")),
      demoId,
    );
    await page.getByRole("radio", { name: "E2E", exact: true }).click();
    await expect(page.getByRole("radio", { name: "E2E", exact: true })).toHaveAttribute(
      "data-state",
      "on",
    );
    assert.notEqual(
      await page.evaluate(() => sessionStorage.getItem("noheir:environment-instance")),
      original,
    );
    await page.getByRole("radio", { name: "Demo", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Demo", exact: true })).toHaveAttribute(
      "data-state",
      "on",
    );
    console.log(
      "交互验证通过：保存的 E2E、取消草稿、接受切换、旧实例 410、重新进入、偏好不热切换。",
    );
  } else {
    await page.addInitScript(() => localStorage.setItem("noheir:environment-mode", "prod"));
    await page.goto(origin);
    await expect(page.locator('[aria-label="环境"]')).toHaveCount(0);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("noheir:environment-mode")),
      "prod",
    );
  }
  const routes = [...readFileSync("src/routes.tsx", "utf8").matchAll(/path: "([^"]+)"/g)].flatMap(
    (match) => (match[1] ? [match[1]] : []),
  );
  assert.equal(routes.length, 33);
  const directory = `test-results/environments-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  mkdirSync(directory, { recursive: true });
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400)
      failed.push(`${response.status()} ${response.url()}`);
  });
  for (const route of routes) {
    await page.goto(`${origin}${route}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("数据加载失败", { exact: true })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Unauthorized");
    await page.waitForTimeout(1100);
    if (capture || ["/", "/warehouse", "/plan/calendar", "/strategy", "/products"].includes(route))
      await page.screenshot({
        path: `${directory}/${route === "/" ? "overview" : route.slice(1).replaceAll("/", "-")}.png`,
      });
  }
  assert.deepEqual(failed, []);
  await page.goto(origin);
  await page.waitForLoadState("networkidle");
  const brokenImages = await page
    .locator("img")
    .evaluateAll((images: HTMLImageElement[]) =>
      images
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.src),
    );
  assert.deepEqual(brokenImages, []);
  if (!capture) {
    const restricted = await browser.newContext();
    await restricted.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("Storage unavailable");
      };
      Storage.prototype.setItem = () => {
        throw new Error("Storage unavailable");
      };
    });
    const isolatedPage = await restricted.newPage();
    await isolatedPage.goto(origin);
    await expect(isolatedPage.getByRole("radio", { name: "Demo", exact: true })).toHaveAttribute(
      "data-state",
      "on",
    );
    await isolatedPage.getByRole("radio", { name: "E2E", exact: true }).click();
    await expect(isolatedPage.getByRole("radio", { name: "E2E", exact: true })).toHaveAttribute(
      "data-state",
      "on",
    );
    await expect(isolatedPage).toHaveURL(`${origin}/`);
    await restricted.close();
    hosted = true;
    const deployedPage = await context.newPage();
    await deployedPage.addInitScript(() => localStorage.setItem("noheir:environment-mode", "prod"));
    await deployedPage.goto(origin);
    await expect(deployedPage.getByText("财务概览", { exact: true })).toBeVisible();
    await expect(deployedPage.locator('[aria-label="环境"]')).toHaveCount(0);
    assert.equal(
      await deployedPage.evaluate(() => localStorage.getItem("noheir:environment-mode")),
      "prod",
    );
    await deployedPage.close();
    console.log("存储禁用切换和无本地能力的 hosted 页面验证通过。");
  }
  writeFileSync(
    `${directory}/manifest.json`,
    JSON.stringify(
      {
        revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        fixtureVersion: CATALOG_VERSION,
        anchor: DEMO_ANCHOR,
        viewport: { width: 1440, height: 1000 },
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
        mode: capture ? "automated-e2e" : "manual-demo",
        routes,
        apiFailures: failed,
        brokenImages,
      },
      null,
      2,
    ),
  );
  console.log(`33 条页面加载及媒体验证通过；证据：${directory}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await controller.close();
}
