// raw row ↔ domain mappers for recurring expenses + categories.
// Spec: docs/002-recurring-expense-calendar.md § Data Model
//
// The Worker JSON wire shape matches Drizzle's row type (camelCase
// because Drizzle's `$inferSelect` already converts). These mappers
// exist so the rest of the web app consumes typed RecurrenceRule etc.
// instead of `Record<string, unknown>` from `client.list*`.

import type {
  RecurrenceFrequency,
  RecurrenceRule,
  RecurringExpenseStatus,
} from "./rule-types";

/** Wire shape sent by the Worker for a recurring expense rule
 *  (joined with category metadata on /api/recurring-expenses GET). */
export interface RecurringExpenseRow {
  id: string;
  userId: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  colorToken?: string | null;
  amountCents: number;
  currency: string;
  account: string | null;
  frequency: string;
  interval: number;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  weekday: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
  endedAt: string | null;
  note: string | null;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
}

const FREQUENCIES = new Set<RecurrenceFrequency>([
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);
const STATUSES = new Set<RecurringExpenseStatus>(["active", "paused", "ended"]);

function asFrequency(value: string): RecurrenceFrequency {
  if (FREQUENCIES.has(value as RecurrenceFrequency)) {
    return value as RecurrenceFrequency;
  }
  throw new Error(`unknown frequency: ${value}`);
}

function asStatus(value: string): RecurringExpenseStatus {
  if (STATUSES.has(value as RecurringExpenseStatus)) {
    return value as RecurringExpenseStatus;
  }
  throw new Error(`unknown status: ${value}`);
}

export function toRecurrenceRule(row: RecurringExpenseRow): RecurrenceRule {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    categoryId: row.categoryId,
    amountCents: row.amountCents,
    currency: row.currency,
    account: row.account,
    frequency: asFrequency(row.frequency),
    interval: row.interval,
    dayOfMonth: row.dayOfMonth,
    monthOfYear: row.monthOfYear,
    weekday: row.weekday,
    startDate: row.startDate,
    endDate: row.endDate,
    status: asStatus(row.status),
    endedAt: row.endedAt,
    note: row.note,
  };
}

export interface CategoryRow {
  id: string;
  userId: string;
  name: string;
  colorToken: string;
  sortOrder: number;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
}

export interface ExpenseCategory {
  id: string;
  userId: string;
  name: string;
  colorToken: string;
  sortOrder: number;
}

export function toCategory(row: CategoryRow): ExpenseCategory {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    colorToken: row.colorToken,
    sortOrder: row.sortOrder,
  };
}

/** Display-only view of a rule with its joined category metadata
 *  (used by the list/calendar UI). */
export interface RecurrenceRuleView extends RecurrenceRule {
  categoryName: string | null;
  colorToken: string | null;
}

export function toRecurrenceRuleView(row: RecurringExpenseRow): RecurrenceRuleView {
  return {
    ...toRecurrenceRule(row),
    categoryName: row.categoryName ?? null,
    colorToken: row.colorToken ?? null,
  };
}
