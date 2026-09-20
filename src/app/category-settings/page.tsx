import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { workerDbClient } from "@/lib/worker-db-client";
import { CategorySettingsClient } from "./category-settings-client";

export interface CategorySettingsLoaderData {
  incomeCategories: string[];
  expenseCategories: string[];
  activeIncomeCategories: string[];
  fixedExpenseCategories: string[];
}

export async function categorySettingsLoader(): Promise<CategorySettingsLoaderData> {
  const metadata = await workerDbClient.getMetadata();
  const year = metadata.years.sort((a, b) => b - a)[0] ?? new Date().getFullYear();

  const [incomeSummary, expenseSummary, settingsResult] = await Promise.all([
    workerDbClient.getCategorySummary(year, undefined, "income"),
    workerDbClient.getCategorySummary(year, undefined, "expense"),
    workerDbClient.getSettings(),
  ]);

  const incomeSecondary = new Set<string>();
  for (const cat of incomeSummary.categories) {
    if (cat.secondary_category) {
      incomeSecondary.add(cat.secondary_category);
    }
  }
  const incomeCategories = Array.from(incomeSecondary).sort();

  const expenseSecondary = new Set<string>();
  for (const cat of expenseSummary.categories) {
    if (cat.secondary_category) {
      expenseSecondary.add(cat.secondary_category);
    }
  }
  const expenseCategories = Array.from(expenseSecondary).sort();

  const row = (settingsResult.settings as Record<string, unknown>) ?? {};
  const rawJson = typeof row.settings === "string" ? row.settings : "{}";
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;

  const activeIncomeCategories = Array.isArray(parsed.active_income_categories)
    ? parsed.active_income_categories
    : [];
  const fixedExpenseCategories = Array.isArray(parsed.fixed_expense_categories)
    ? parsed.fixed_expense_categories
    : [];

  return {
    incomeCategories,
    expenseCategories,
    activeIncomeCategories,
    fixedExpenseCategories,
  };
}

export default function CategorySettingsPage() {
  const { incomeCategories, expenseCategories, activeIncomeCategories, fixedExpenseCategories } =
    useLoaderData<CategorySettingsLoaderData>();

  return (
    <AppShell>
      <CategorySettingsClient
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        activeIncomeCategories={activeIncomeCategories}
        fixedExpenseCategories={fixedExpenseCategories}
      />
    </AppShell>
  );
}
