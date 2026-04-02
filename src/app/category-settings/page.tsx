import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { CategorySettingsClient } from "./category-settings-client"

export default async function CategorySettingsPage() {
  let incomeCategories: string[] = []
  let expenseCategories: string[] = []
  let activeIncomeCategories: string[] = []
  let fixedExpenseCategories: string[] = []

  try {
    const { userId, client } = await getAuthedClient()

    // Get category summary for most recent year
    const metadata = await client.getMetadata(userId)
    const year = metadata.years.sort((a, b) => b - a)[0] ?? new Date().getFullYear()

    const [incomeSummary, expenseSummary, settingsResult] = await Promise.all([
      client.getCategorySummary(userId, year, undefined, "income"),
      client.getCategorySummary(userId, year, undefined, "expense"),
      client.getSettings(userId),
    ])

    // Extract unique secondary categories
    const incomeSecondary = new Set<string>()
    for (const cat of incomeSummary.categories) {
      if (cat.secondary_category) {
        incomeSecondary.add(cat.secondary_category)
      }
    }
    incomeCategories = Array.from(incomeSecondary).sort()

    const expenseSecondary = new Set<string>()
    for (const cat of expenseSummary.categories) {
      if (cat.secondary_category) {
        expenseSecondary.add(cat.secondary_category)
      }
    }
    expenseCategories = Array.from(expenseSecondary).sort()

    // Get saved settings
    const row = (settingsResult.settings as Record<string, unknown>) ?? {}
    const rawJson = typeof row.settings === "string" ? row.settings : "{}"
    const parsed = JSON.parse(rawJson) as Record<string, unknown>

    activeIncomeCategories = Array.isArray(parsed.active_income_categories)
      ? parsed.active_income_categories
      : []
    fixedExpenseCategories = Array.isArray(parsed.fixed_expense_categories)
      ? parsed.fixed_expense_categories
      : []
  } catch {
    // Not authenticated or error — render empty state
  }

  return (
    <AppShell>
      <CategorySettingsClient
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        activeIncomeCategories={activeIncomeCategories}
        fixedExpenseCategories={fixedExpenseCategories}
      />
    </AppShell>
  )
}
