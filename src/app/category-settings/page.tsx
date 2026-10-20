import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { financeApi } from "@/lib/finance-api";
import { workerDbClient } from "@/lib/worker-db-client";
import { CategorySettingsClient } from "./category-settings-client";

export interface CategorySettingsLoaderData {
  incomeCategories: string[];
  version: number;
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
    financeApi.getFinancialPreferences(),
  ]);

  const incomeLeaves = new Set<string>();
  for (const cat of incomeSummary.categories) {
    if (cat.tertiary_category) {
      incomeLeaves.add(cat.tertiary_category);
    }
  }
  const incomeCategories = Array.from(incomeLeaves).sort();

  const expenseLeaves = new Set<string>();
  for (const cat of expenseSummary.categories) {
    if (cat.tertiary_category) {
      expenseLeaves.add(cat.tertiary_category);
    }
  }
  const expenseCategories = Array.from(expenseLeaves).sort();

  const { activeIncomeCategories, fixedExpenseCategories, version } = settingsResult.data;

  return {
    version,
    incomeCategories,
    expenseCategories,
    activeIncomeCategories,
    fixedExpenseCategories,
  };
}

export default function CategorySettingsPage() {
  const {
    incomeCategories,
    expenseCategories,
    activeIncomeCategories,
    fixedExpenseCategories,
    version,
  } = useLoaderData<CategorySettingsLoaderData>();

  return (
    <AppShell>
      <CategorySettingsClient
        version={version}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        activeIncomeCategories={activeIncomeCategories}
        fixedExpenseCategories={fixedExpenseCategories}
      />
    </AppShell>
  );
}
