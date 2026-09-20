import { data, useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { FEATURE_PLAN_CALENDAR } from "@/lib/navigation";
import { workerDbClient } from "@/lib/worker-db-client";
import { CategoriesClient, type CategoryRow } from "./categories-client";

export interface PlanCategoriesLoaderData {
  categories: CategoryRow[];
  usage: Record<string, number>;
}

export async function planCategoriesLoader(): Promise<PlanCategoriesLoaderData> {
  if (!FEATURE_PLAN_CALENDAR) {
    throw data({ message: "Page not found" }, { status: 404, statusText: "Not Found" });
  }

  const [categoriesRes, rulesRes] = await Promise.all([
    workerDbClient.listExpenseCategories(),
    workerDbClient.listRecurringExpenses(),
  ]);

  const categories = categoriesRes.categories.map((c) => ({
    id: c.id,
    name: c.name,
    colorToken: c.colorToken,
    sortOrder: c.sortOrder,
  }));

  const usage: Record<string, number> = {};
  for (const rule of rulesRes.rules) {
    if (rule.categoryId) {
      usage[rule.categoryId] = (usage[rule.categoryId] ?? 0) + 1;
    }
  }

  return { categories, usage };
}

export default function PlanCategoriesPage() {
  const { categories, usage } = useLoaderData<PlanCategoriesLoaderData>();

  return (
    <AppShell>
      <CategoriesClient categories={categories} usage={usage} />
    </AppShell>
  );
}
