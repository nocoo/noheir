import { existsSync, readFileSync } from "node:fs";
import { expect, type Locator, test } from "@playwright/test";

/** Wait until the scrollable nav column stops reflowing (collapse transition, fonts, etc.). */
async function waitForSidebarNavLayoutStable(nav: Locator) {
  await expect
    .poll(async () => {
      const first = await nav.evaluate((node) => ({
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      }));
      await nav.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      const second = await nav.evaluate((node) => ({
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      }));
      return (
        first.scrollHeight === second.scrollHeight && first.clientHeight === second.clientHeight
      );
    })
    .toBe(true);
}

async function expectSidebarNavScrolledToBottom(nav: Locator) {
  await expect
    .poll(() =>
      nav.evaluate((node) => {
        const max = Math.max(0, node.scrollHeight - node.clientHeight);
        return node.scrollTop === max;
      }),
    )
    .toBe(true);
}

/** Scroll to the settled bottom edge; max scrollTop can change when the rail relayouts. */
async function scrollSidebarNavToSettledBottom(nav: Locator) {
  await waitForSidebarNavLayoutStable(nav);
  await nav.evaluate((node) => {
    const max = Math.max(0, node.scrollHeight - node.clientHeight);
    node.scrollTop = max;
  });
  await expectSidebarNavScrolledToBottom(nav);
  return await nav.evaluate((node) => node.scrollTop);
}

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
    await expect(page.locator("[data-basalt-shell]")).toHaveCount(path === "/login" ? 0 : 1);
    if (path !== "/login") {
      await expect(page.locator("[data-basalt-shell] > [data-basalt-main] > header")).toHaveCount(
        1,
      );
      await expect(page.locator("[data-basalt-main] [data-basalt-island]")).toHaveCount(1);
    }
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
  const shell = await page.locator("[data-basalt-shell]").evaluateHandle((node) => node);
  await page
    .getByRole("complementary", { name: "主导航", exact: true })
    .getByRole("link", { name: "收入分析", exact: true })
    .click();
  await page.getByRole("combobox", { name: "财务年份" }).click();
  await expect(page.getByRole("option", { name: "2023", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "2023", exact: true }).click();
  await expect(page).toHaveURL(/year=2023/);
  await expect
    .poll(() =>
      page.locator("[data-basalt-shell]").evaluate((node, previous) => node === previous, shell),
    )
    .toBe(true);
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

test("mobile navigation restores focus and unlocks scrolling after dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/api-keys");
  const opener = page.getByRole("button", { name: "打开导航", exact: true });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.getByRole("dialog").getByRole("link", { name: "分析报告", exact: true }).click();
  await expect(page).toHaveURL("/analyses");
  await expect(page.getByRole("heading", { name: "分析报告", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("shared shell retains sidebar scroll and groups across routes and history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 640 });
  await page.goto("/income?year=2025");
  const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
  const group = sidebar.getByRole("button", { name: "总览", exact: true });
  const contentId = await group.getAttribute("aria-controls");
  expect(contentId).toBeTruthy();
  const groupContent = page.locator(`[id="${contentId}"]`);
  await group.click();
  await expect
    .poll(() => groupContent.evaluate((node) => node.getBoundingClientRect().height))
    .toBe(0);
  const nav = sidebar.locator('[data-slot="sidebar-nav"]');
  await waitForSidebarNavLayoutStable(nav);
  const original = await nav.evaluateHandle((node) => node);
  const top = await scrollSidebarNavToSettledBottom(nav);
  expect(top).toBeGreaterThan(0);
  const island = page.locator("[data-basalt-island]");
  expect(
    await island.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
      return node.scrollTop;
    }),
  ).toBeGreaterThan(0);

  await sidebar.getByRole("link", { name: "API 密钥", exact: true }).click();
  await expect(page).toHaveURL("/api-keys");
  await expect(page.getByRole("heading", { name: "API 密钥", exact: true })).toBeVisible();
  await waitForSidebarNavLayoutStable(nav);
  await expect.poll(() => nav.evaluate((node, previous) => node === previous, original)).toBe(true);
  await expectSidebarNavScrolledToBottom(nav);
  await expect(group).toHaveAttribute("data-state", "closed");
  await expect.poll(() => island.evaluate((node) => node.scrollTop)).toBe(0);

  await sidebar.getByRole("link", { name: "账户设置", exact: true }).click();
  await expect(page).toHaveURL("/account-types");
  await expect(page.getByRole("heading", { name: "账户类型管理", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/api-keys");
  await expect(page.getByRole("heading", { name: "API 密钥", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL("/account-types");
  await expect(page.getByRole("heading", { name: "账户类型管理", exact: true })).toBeVisible();
  await waitForSidebarNavLayoutStable(nav);
  await expect.poll(() => nav.evaluate((node, previous) => node === previous, original)).toBe(true);
  await expectSidebarNavScrolledToBottom(nav);
  await expect(group).toHaveAttribute("data-state", "closed");
});

test("shared shell retains collapsed rail and scroll after navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 640 });
  await page.goto("/api-keys");
  const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
  await sidebar.getByRole("button", { name: "收起侧边栏" }).click();
  await expect(sidebar.getByRole("button", { name: "展开侧边栏" })).toBeVisible();
  const nav = sidebar.locator("nav");
  await nav.evaluate(async (node) => {
    const shell = node.closest("[data-basalt-sidebar]");
    if (shell instanceof HTMLElement) {
      await Promise.all(
        shell.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
      );
    }
  });
  const original = await nav.evaluateHandle((node) => node);
  const top = await scrollSidebarNavToSettledBottom(nav);
  expect(top).toBeGreaterThan(0);
  await sidebar.getByRole("link", { name: "数据导入", exact: true }).click();
  await expect(page).toHaveURL("/import");
  await expect(page.getByRole("heading", { name: "数据导入", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "展开侧边栏" })).toBeVisible();
  await waitForSidebarNavLayoutStable(nav);
  await expect.poll(() => nav.evaluate((node, previous) => node === previous, original)).toBe(true);
  await expectSidebarNavScrolledToBottom(nav);
});

test("shared shell survives a child loader failure and recovers through navigation", async ({
  page,
}) => {
  await page.goto("/api-keys");
  const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
  const original = await sidebar.evaluateHandle((node) => node);
  await sidebar.getByRole("button", { name: "收起侧边栏" }).click();
  await page.route("**/api/account-classifications", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Test read failure" }),
    }),
  );
  await sidebar.getByRole("link", { name: "账户设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "数据加载失败" })).toBeVisible();
  await expect
    .poll(() => sidebar.evaluate((node, previous) => node === previous, original))
    .toBe(true);
  await expect(sidebar.getByRole("button", { name: "展开侧边栏" })).toBeVisible();
  await sidebar.getByRole("link", { name: "数据导入", exact: true }).click();
  await expect(page).toHaveURL("/import");
  await expect(page.getByRole("heading", { name: "数据导入", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "数据加载失败" })).toHaveCount(0);
  await expect
    .poll(() => sidebar.evaluate((node, previous) => node === previous, original))
    .toBe(true);
});

test("shared shell contains the not-found boundary", async ({ page }) => {
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

test("mobile capital labels remain single-line within a horizontally scrollable table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/funds");
  const row = page.getByRole("row", { name: /U-BROWSER-01/ });
  await expect(row.getByText("U-BROWSER-01", { exact: true })).toHaveCSS("white-space", "nowrap");
  await expect(row.getByText("短期理财", { exact: true })).toHaveCSS("white-space", "nowrap");
  const scroller = page.locator("table").locator("..");
  await expect(scroller).toHaveCSS("overflow-x", "auto");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("leaving the mobile breakpoint dismisses the drawer and releases its scroll lock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/api-keys");
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const theme of ["light", "dark"]) {
  test(`sidebar keeps native selection during hover in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript((value) => {
      localStorage.setItem("theme", value);
      localStorage.setItem("basalt-accent", "rose");
    }, theme);
    await page.goto("/income?year=2025");
    const sidebar = page.getByRole("complementary", { name: "主导航", exact: true });
    const logo = sidebar.getByRole("img", { name: "noheir", exact: true });
    const expandedLogo = await logo.boundingBox();
    if (!expandedLogo) throw new Error("Sidebar logo missing");
    for (const collapsed of [false, true]) {
      if (collapsed) await page.getByRole("button", { name: "收起侧边栏" }).click();
      const current = sidebar.locator('a[aria-current="page"]');
      await expect(current).toHaveAttribute("href", "/income?year=2025");
      const row = current.locator("xpath=ancestor-or-self::*[@data-basalt-hover-item][1]");
      const expected = await row.evaluate((element) => {
        const probe = document.createElement("div");
        element.append(probe);
        probe.style.backgroundColor = "hsl(var(--basalt-selected))";
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      });
      await expect
        .poll(() => row.evaluate((el) => getComputedStyle(el).backgroundColor))
        .toBe(expected);
      const neighbor = sidebar.getByRole("link", { name: "分析报告", exact: true });
      await neighbor.hover();
      await expect
        .poll(() =>
          neighbor.evaluate(
            (el) => el.closest<HTMLElement>(".basalt-hover-list")?.dataset.hoverVisible,
          ),
        )
        .toBe("true");
      await expect
        .poll(() => row.evaluate((el) => getComputedStyle(el).backgroundColor))
        .toBe(expected);
      await expect
        .poll(async () => Math.abs((await logo.boundingBox())!.x - expandedLogo.x))
        .toBeLessThan(1);
    }
  });
}

test("mobile financial header keeps navigation, year and theme controls inside the viewport", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/income?year=2025");
    const controls = ["打开导航", "财务年份", "切换主题"];
    for (const label of controls) {
      const control = page.getByLabel(label, { exact: true });
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      if (!bounds) throw new Error(`Missing ${label}`);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await page.getByRole("combobox", { name: "财务年份" }).click();
    await page.getByRole("option", { name: "2024", exact: true }).click();
    await expect(page).toHaveURL(/year=2024/);
  }
});

test("permission groups have a visible desktop divider and stack without mobile overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/api-keys");
  const permissions = page.getByRole("group", { name: /明确授权/ });
  const financial = page.getByRole("group", { name: "财务记录", exact: true });
  const planning = page.getByRole("group", { name: "规划与分析", exact: true });
  const divider = permissions.locator('[data-orientation="vertical"]');
  await expect(financial).toBeVisible();
  await expect(planning).toBeVisible();
  await expect(divider).toBeVisible();
  const left = await financial.boundingBox();
  const right = await planning.boundingBox();
  if (!left || !right) throw new Error("Permission groups are missing");
  expect(Math.abs(left.y - right.y)).toBeLessThan(2);
  expect(right.x - left.x - left.width).toBeGreaterThanOrEqual(24);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(divider).toBeHidden();
  await expect
    .poll(() =>
      permissions.evaluate((element) => {
        const upper = element.querySelector('[aria-label="财务记录"]')?.getBoundingClientRect();
        const lower = element.querySelector('[aria-label="规划与分析"]')?.getBoundingClientRect();
        return !!upper && !!lower && lower.y >= upper.bottom;
      }),
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("a scoped key writes an external report, safe UI edits it, and revocation takes effect", async ({
  page,
  playwright,
}) => {
  await page.goto("/api-keys");
  await page.getByRole("button", { name: "报告撰写", exact: true }).click();
  await page.getByLabel("密钥名称", { exact: true }).fill("Browser analysis key");
  await page.getByRole("button", { name: "创建密钥", exact: true }).click();
  const secret = await page
    .locator("code")
    .filter({ hasText: /^nhk_[A-Za-z0-9_-]{43}$/ })
    .textContent();
  if (!secret) throw new Error("One-time token missing");
  const machine = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Authorization: `Bearer ${secret}` },
  });
  try {
    const preferences = await machine.get("/api/v1/financial-preferences");
    expect(preferences.status()).toBe(200);
    const { meta } = await preferences.json();
    const response = await machine.post("/api/v1/analyses", {
      headers: { "Idempotency-Key": "browser-external-report" },
      data: {
        title: "External browser report",
        markdown:
          "# Safe report\n\n**Verified renderer**\n\n<script>window.injected = true</script>\n\n![remote](https://invalid.example/tracker.png)\n\n[unsafe](javascript:alert(1))",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        currencies: ["CNY"],
        dataRevision: meta.dataRevision,
        evidence: [],
        author: "External test",
        model: "Unverified model label",
      },
    });
    expect(response.status()).toBe(201);
    const { data: created } = await response.json();
    await page.getByRole("button", { name: "我已保存，关闭密钥", exact: true }).click();
    await expect(page.locator("body")).not.toContainText(secret);
    await page.goto(`/analyses/${created.id}`);
    await expect(
      page.getByRole("heading", { name: "External browser report", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Verified renderer", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => Object.hasOwn(window, "injected"))).toBe(false);
    await expect(page.locator('img[src*="invalid.example"],a[href^="javascript:"]')).toHaveCount(0);
    await page.getByRole("button", { name: "编辑报告", exact: true }).click();
    await page.getByLabel("报告标题", { exact: true }).fill("Reviewed external report");
    await page.getByRole("button", { name: "保存报告", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Reviewed external report", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.goto("/api-keys");
    await expect(page.locator("body")).not.toContainText(secret);
    await page.getByRole("button", { name: "撤销 Browser analysis key", exact: true }).click();
    await page.getByRole("button", { name: "确认撤销", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "撤销 Browser analysis key", exact: true }),
    ).toHaveCount(0);
    expect((await machine.get("/api/v1/me")).status()).toBe(401);
  } finally {
    await machine.dispose();
  }
});
