// Domain types + Zod schema for recurring expense rules.
// Spec: docs/002-recurring-expense-calendar.md § Data Model
//
// This layer is the contract between the Server Actions and the UI.
// It is intentionally stricter than the Worker-side schema in
// worker/db/validation.ts: colorToken here is bound to the actual
// CHART_TOKENS palette, while the worker only checks the regex shape
// (so worker tests don't need to import the palette).

import { z } from "zod";
import { CHART_TOKENS } from "@/lib/palette";

// CHART_TOKENS in palette.ts is `readonly string[]`. Zod needs a tuple
// of literals for `z.enum`; we narrow it here without touching the
// palette so it stays the single source of truth.
const chartTokenLiterals = CHART_TOKENS as readonly [string, ...string[]];

export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRING_EXPENSE_STATUSES = ["active", "paused", "ended"] as const;
export type RecurringExpenseStatus = (typeof RECURRING_EXPENSE_STATUSES)[number];

/** Derived display state shown on the rule list — `expired` is NEVER
 *  persisted; it's computed from `endDate < today` for active rules. */
export type RecurringExpenseDisplayStatus = RecurringExpenseStatus | "expired";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Domain RecurrenceRule — the canonical in-memory shape used by
 *  computeOccurrences and sumWindow. ISO date strings, amount in cents. */
export interface RecurrenceRule {
  id: string;
  userId: string;
  name: string;
  categoryId: string | null;
  amountCents: number;
  currency: string;
  account: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  weekday: number | null;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string | null;
  status: RecurringExpenseStatus;
  endedAt: string | null;
  note: string | null;
}

// ── Category Zod ──

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(50),
  colorToken: z.enum(chartTokenLiterals),
  sortOrder: z.number().int().optional(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

// ── Recurring expense Zod ──
//
// Form inputs use `amount` in **yuan** (decimal); Server Actions convert
// to `amountCents` before hitting the worker so cents stays the only
// unit on the wire and in the DB.

const recurringExpenseBaseShape = {
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.number().positive("amount must be > 0"),
  currency: z.string().min(1).max(8).default("CNY"),
  account: z.string().trim().max(100).nullable().optional(),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().min(1).default(1),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  startDate: z.string().regex(ISO_DATE_RE, "startDate must be YYYY-MM-DD"),
  endDate: z.string().regex(ISO_DATE_RE).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
} as const;

/** Create input — `status` / `endedAt` are intentionally excluded.
 *  They are only ever set by the pause/resume/end Server Actions. */
export const recurringExpenseInputSchema = z
  .object(recurringExpenseBaseShape)
  .superRefine((data, ctx) => {
    if (data.frequency === "weekly" && data.weekday == null) {
      ctx.addIssue({
        code: "custom",
        path: ["weekday"],
        message: "weekday is required for weekly rules",
      });
    }
    if (data.frequency === "monthly" && data.dayOfMonth == null) {
      ctx.addIssue({
        code: "custom",
        path: ["dayOfMonth"],
        message: "dayOfMonth is required for monthly rules",
      });
    }
    if (data.frequency === "yearly" && (data.monthOfYear == null || data.dayOfMonth == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["monthOfYear"],
        message: "monthOfYear and dayOfMonth are required for yearly rules",
      });
    }
    if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate must be ≥ startDate",
      });
    }
  });

export type RecurringExpenseInput = z.infer<typeof recurringExpenseInputSchema>;

/** Update input — same shape, all fields optional. Status / endedAt
 *  stay omitted so a CRUD update cannot mutate the state machine.
 *  Defaults from the create shape are dropped — partial updates only
 *  forward fields the caller actually provided. */
export const recurringExpenseUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(1).max(8).optional(),
  account: z.string().trim().max(100).nullable().optional(),
  frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
  interval: z.number().int().min(1).optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  startDate: z.string().regex(ISO_DATE_RE).optional(),
  endDate: z.string().regex(ISO_DATE_RE).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});
export type RecurringExpenseUpdateInput = z.infer<typeof recurringExpenseUpdateSchema>;
