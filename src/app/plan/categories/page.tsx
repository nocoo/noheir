import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout";
import { getAuthedClient } from "@/lib/api-helpers";
import { FEATURE_PLAN_CALENDAR } from "@/lib/navigation";
import { CategoriesClient } from "./categories-client";

// /plan/categories — manages the 002-spec recurring-expense category list.
//
// Gated behind FEATURE_PLAN_CALENDAR (single source of truth in
// src/lib/navigation.ts). While the flag is false the page 404s AND
// the sidebar entry is hidden, so there is no path through the UI
// that exposes Phase 3 work in production until P3-C11 flips it.
export const dynamic = "force-dynamic";

export default async function PlanCategoriesPage() {
  if (!FEATURE_PLAN_CALENDAR) {
    notFound();
  }

  const { userId, client } = await getAuthedClient();
  const [categoriesRes, rulesRes] = await Promise.all([
    client.listExpenseCategories(userId),
    client.listRecurringExpenses(userId),
  ]);

  const categories = categoriesRes.categories.map((c) => ({
    id: c.id,
    name: c.name,
    colorToken: c.colorToken,
    sortOrder: c.sortOrder,
  }));

  // Map each categoryId to the number of rules using it. Helps the UI
  // warn before delete: deleting a category unassigns rules (set null
  // via ON DELETE SET NULL — see P1-C2 migration) rather than removing
  // them.
  const usage: Record<string, number> = {};
  for (const rule of rulesRes.rules) {
    if (rule.categoryId) {
      usage[rule.categoryId] = (usage[rule.categoryId] ?? 0) + 1;
    }
  }

  return (
    <AppShell>
      <CategoriesClient categories={categories} usage={usage} />
    </AppShell>
  );
}
