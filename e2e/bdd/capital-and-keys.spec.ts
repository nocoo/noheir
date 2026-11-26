import { expect, test } from "@playwright/test";
import { ORIGIN, readBrowserToken } from "./fixture";

let token: string;

test.beforeAll(async () => {
  token = await readBrowserToken();
});

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "Cf-Access-Jwt-Assertion": token });
});

test("capital unit commit persists updated fields and writes contribution log", async ({
  page,
  request,
}) => {
  const unitCode = `U-BR-${crypto.randomUUID().slice(0, 6)}`;
  const headers = { "Cf-Access-Jwt-Assertion": token, Origin: ORIGIN };
  const setupRes = await request.post(`${ORIGIN}/api/units`, {
    headers,
    data: {
      unitCode,
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
  await expect(page.getByText(unitCode, { exact: true })).toBeVisible({ timeout: 15_000 });

  const row = page.getByRole("row", { name: new RegExp(unitCode) });
  await row.getByRole("button").first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(`编辑资本单位 · ${unitCode}`)).toBeVisible();

  await dialog.getByLabel("金额", { exact: true }).fill("15000");
  await dialog.getByLabel("单元备注", { exact: true }).fill("browser-unit-updated-note");
  await dialog.getByLabel("本次变更备注", { exact: true }).fill("browser-commit-test-note");

  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  const unitRes = await request.get(`${ORIGIN}/api/units/${unitId}`, { headers });
  expect(unitRes.ok()).toBe(true);
  const unitData = (await unitRes.json()) as {
    unit: { id: string; amountCents: number; note: string | null };
  };
  expect(unitData.unit.amountCents).toBe(1500000);
  expect(unitData.unit.note).toBe("browser-unit-updated-note");

  const logsRes = await request.get(`${ORIGIN}/api/units/${unitId}/logs`, { headers });
  expect(logsRes.ok()).toBe(true);
  const logsData = (await logsRes.json()) as {
    logs: Array<{ operationType: string; note: string | null }>;
  };
  const commitLog = logsData.logs.find(
    (log) => log.note?.includes("browser-commit-test-note") && log.note?.includes("元数据修改"),
  );
  expect(commitLog).toBeDefined();
  expect(commitLog?.operationType).toBe("adjust");
});

test("a scoped key writes an external report, safe UI edits it, and revocation takes effect", async ({
  page,
  playwright,
}) => {
  const suffix = crypto.randomUUID().slice(0, 6);
  const keyName = `Browser key ${suffix}`;
  await page.goto("/api-keys");
  await page.getByRole("button", { name: "报告撰写", exact: true }).click();
  await page.getByLabel("密钥名称", { exact: true }).fill(keyName);
  await page.getByRole("button", { name: "创建密钥", exact: true }).click();
  const secret = await page
    .locator("code")
    .filter({ hasText: /^nhk_[A-Za-z0-9_-]{43}$/ })
    .textContent();
  if (!secret) throw new Error("One-time token missing");
  const machine = await playwright.request.newContext({
    baseURL: ORIGIN,
    extraHTTPHeaders: { Authorization: `Bearer ${secret}` },
  });
  try {
    const preferences = await machine.get("/api/v1/financial-preferences");
    expect(preferences.status()).toBe(200);
    const { meta } = await preferences.json();
    const response = await machine.post("/api/v1/analyses", {
      headers: { "Idempotency-Key": `browser-report-${suffix}` },
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
    await page.goto("/api-keys");
    await expect(page.locator("body")).not.toContainText(secret);
    await page.getByRole("button", { name: `撤销 ${keyName}`, exact: true }).click();
    await page.getByRole("button", { name: "确认撤销", exact: true }).click();
    await expect(page.getByRole("button", { name: `撤销 ${keyName}`, exact: true })).toHaveCount(0);
    expect((await machine.get("/api/v1/me")).status()).toBe(401);
  } finally {
    await machine.dispose();
  }
});
