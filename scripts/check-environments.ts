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
    await page.setViewportSize({ width: 390, height: 844 });
    const unexpectedConfirmations: string[] = [];
    const rejectUnexpectedConfirmation = async (dialog: import("@playwright/test").Dialog) => {
      unexpectedConfirmations.push(dialog.message());
      await dialog.dismiss();
    };
    page.on("dialog", rejectUnexpectedConfirmation);
    for (const mode of ["Demo", "E2E"]) {
      await page.getByRole("button", { name: "打开导航", exact: true }).click();
      const drawer = page.locator('[data-slot="sidebar-drawer"]');
      await expect(drawer.getByRole("radio", { name: mode, exact: true })).toBeEnabled();
      await Promise.all([
        page.waitForNavigation(),
        drawer.getByRole("radio", { name: mode, exact: true }).click(),
      ]);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("noheir:environment-mode")),
        mode.toLowerCase(),
      );
    }
    page.off("dialog", rejectUnexpectedConfirmation);
    assert.deepEqual(unexpectedConfirmations, []);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const original = await page.evaluate(() =>
      sessionStorage.getItem("noheir:environment-instance"),
    );
    await page.goto(`${origin}/api-keys`);
    const input = page.getByLabel("密钥名称", { exact: true });
    await input.fill("synthetic-unsaved-label");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("radio", { name: "Demo", exact: true }).click();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("noheir:environment-instance")),
      original,
    );
    assert.equal(await page.evaluate(() => localStorage.getItem("noheir:environment-mode")), "e2e");
    await expect(input).toHaveValue("synthetic-unsaved-label");
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
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/api-keys`);
    await page.getByLabel("密钥名称", { exact: true }).fill("mobile-unsaved-label");
    const mobileInstance = await page.evaluate(() =>
      sessionStorage.getItem("noheir:environment-instance"),
    );
    await page.getByRole("button", { name: "打开导航", exact: true }).click();
    const mobileDrawer = page.locator('[data-slot="sidebar-drawer"]');
    const declined = page.waitForEvent("dialog");
    page.once("dialog", (dialog) => dialog.dismiss());
    await mobileDrawer.getByRole("radio", { name: "E2E", exact: true }).click();
    assert.equal((await declined).message(), "丢弃未保存的修改并切换环境？");
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("noheir:environment-instance")),
      mobileInstance,
    );
    await expect(page.getByLabel("密钥名称", { exact: true })).toHaveValue("mobile-unsaved-label");
    page.once("dialog", (dialog) => dialog.accept());
    await Promise.all([
      page.waitForNavigation(),
      mobileDrawer.getByRole("radio", { name: "E2E", exact: true }).click(),
    ]);
    assert.notEqual(
      await page.evaluate(() => sessionStorage.getItem("noheir:environment-instance")),
      mobileInstance,
    );
    await page.getByRole("button", { name: "打开导航", exact: true }).click();
    await Promise.all([
      page.waitForNavigation(),
      mobileDrawer.getByRole("radio", { name: "Demo", exact: true }).click(),
    ]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log(
      "交互验证通过：移动端无草稿切换、桌面与移动端取消/确认草稿、旧实例 410、重新进入、偏好不热切换。",
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
  const notFoundPath = "/__environment-unknown-route";
  const routes = [...readFileSync("src/routes.tsx", "utf8").matchAll(/path: "([^"]+)"/g)].flatMap(
    (match) =>
      match[1] && !match[1].includes(":") ? [match[1] === "*" ? notFoundPath : match[1]] : [],
  );
  assert.ok(routes.includes("/api-keys") && routes.includes("/analyses"));
  assert.ok(
    !routes.some((route) => ["/ai-settings", "/ai-insight", "/mcp-tokens"].includes(route)),
  );
  await page.goto(`${origin}/analyses`);
  const detailPath = await page.locator('a[href^="/analyses/"]').first().getAttribute("href");
  assert.ok(detailPath, "Seeded report must have a reachable detail page");
  routes.push(detailPath);
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
    if (route === notFoundPath)
      await expect(page.getByRole("heading", { name: "数据加载失败", exact: true })).toBeVisible();
    else await expect(page.getByText("数据加载失败", { exact: true })).toHaveCount(0);
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
    await isolatedPage.getByRole("button", { name: "收起侧边栏", exact: true }).click();
    const restrictedSidebar = isolatedPage.getByRole("complementary", {
      name: "主导航",
      exact: true,
    });
    await expect(restrictedSidebar).toHaveCSS("width", "68px");
    await isolatedPage.getByRole("button", { name: "展开侧边栏", exact: true }).click();
    await expect(restrictedSidebar).toHaveCSS("width", "260px");
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
  console.log(`${routes.length} 条页面加载及媒体验证通过；证据：${directory}`);
  await context.close();
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await controller.close();
}
