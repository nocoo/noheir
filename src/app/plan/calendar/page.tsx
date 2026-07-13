import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout";
import { getAuthedClient } from "@/lib/api-helpers";
import { FEATURE_PLAN_CALENDAR } from "@/lib/navigation";
import type { RecurringExpenseRow } from "@/lib/recurring-expense/mappers";
import { toRecurrenceRule } from "@/lib/recurring-expense/mappers";
import { CalendarClient } from "./calendar-client";

// /plan/calendar — the recurring-expense calendar feature surface.
//
// Gated behind FEATURE_PLAN_CALENDAR. Mirrors /plan/categories: the
// route, the sidebar entry, and the dialog flow all share the same
// flag, so when the flag is false this returns 404 even on direct
// URL hits.
//
// Today's ISO is computed at request time (UTC) and threaded through
// to the calendar + summary cards so they stay in lock-step.

export const dynamic = "force-dynamic";

function todayIsoUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function PlanCalendarPage() {
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

  const rules = rulesRes.rules.map((r) => toRecurrenceRule(r as RecurringExpenseRow));

  const today = todayIsoUtc();

  return (
    <AppShell>
      <CalendarClient rules={rules} categories={categories} todayIso={today} />
    </AppShell>
  );
}
