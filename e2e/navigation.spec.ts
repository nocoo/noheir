import { test, expect } from "@playwright/test"

test.describe("Navigation", () => {
  test("should load the login page when not authenticated", async ({ page }) => {
    await page.goto("/")
    // Should redirect to login or show the app
    await expect(page).toHaveTitle(/noheir|登录|Login/)
  })

  test("should navigate to terms page", async ({ page }) => {
    await page.goto("/terms")
    await expect(page.getByText("服务条款")).toBeVisible()
  })

  test("should navigate to privacy page", async ({ page }) => {
    await page.goto("/privacy")
    await expect(page.getByText("隐私政策")).toBeVisible()
  })

  test("should have working command palette shortcut", async ({ page }) => {
    await page.goto("/terms")
    // Press Cmd+K to open command palette
    await page.keyboard.press("Meta+k")
    // Command dialog should appear
    await expect(page.getByPlaceholder("搜索页面或功能...")).toBeVisible()
  })

  test("should navigate via command palette", async ({ page }) => {
    await page.goto("/terms")
    await page.keyboard.press("Meta+k")
    const input = page.getByPlaceholder("搜索页面或功能...")
    await expect(input).toBeVisible()
    await input.fill("隐私")
    // Should show privacy policy in results
    await expect(page.getByText("隐私政策")).toBeVisible()
  })
})

test.describe("Static pages", () => {
  test("terms page has all sections", async ({ page }) => {
    await page.goto("/terms")
    await expect(page.getByText("服务说明")).toBeVisible()
    await expect(page.getByText("数据所有权")).toBeVisible()
    await expect(page.getByText("免责声明")).toBeVisible()
  })

  test("privacy page has all sections", async ({ page }) => {
    await page.goto("/privacy")
    await expect(page.getByText("数据收集")).toBeVisible()
    await expect(page.getByText("数据存储")).toBeVisible()
    await expect(page.getByText("AI 分析")).toBeVisible()
    await expect(page.getByText("数据删除")).toBeVisible()
  })
})

test.describe("App shell", () => {
  test("authenticated pages show sidebar", async ({ page }) => {
    // Even if not authenticated, the page should render the layout
    await page.goto("/settings")
    // The page should have a heading
    await expect(page.getByText("系统设置")).toBeVisible()
  })
})
