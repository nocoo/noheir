import { data, useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { FEATURE_PLAN_CALENDAR } from "@/lib/navigation";
import type { RecurringExpenseRow } from "@/lib/recurring-expense/mappers";
import { toRecurrenceRule } from "@/lib/recurring-expense/mappers";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";
import { workerDbClient } from "@/lib/worker-db-client";
import { CalendarClient, type CalendarClientCategory } from "./calendar-client";

function todayIsoUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface PlanCalendarLoaderData {
  categories: CalendarClientCategory[];
  rules: RecurrenceRule[];
  today: string;
}

export async function planCalendarLoader(): Promise<PlanCalendarLoaderData> {
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

  const rules = rulesRes.rules.map((r) => toRecurrenceRule(r as RecurringExpenseRow));
  const today = todayIsoUtc();

  return { categories, rules, today };
}

export default function PlanCalendarPage() {
  const { rules, categories, today } = useLoaderData<PlanCalendarLoaderData>();

  return (
    <AppShell>
      <CalendarClient rules={rules} categories={categories} todayIso={today} />
    </AppShell>
  );
}
