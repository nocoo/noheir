/**
 * Zod validation schemas for Products, Units, and Contribution Logs.
 *
 * These enforce enum constraints that were previously DB-level CHECK constraints in Supabase.
 */

import { z } from "zod";
import {
  CHANNELS,
  CONTRIBUTION_OPERATION_TYPES,
  CONTRIBUTION_SOURCES,
  CURRENCIES,
  PRODUCT_CATEGORIES,
  STRATEGIES,
  TACTICS,
  UNIT_STATUSES,
} from "./enums";

/** YYYY-MM-DD that exists on the Gregorian calendar (rejects 2026-02-31). */
export function isRealCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const yyyy = String(parsed.getUTCFullYear()).padStart(4, "0");
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` === value;
}

const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine(isRealCalendarDay, { message: "must be a real calendar day" });

// ── Products ──

export const createProductSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    code: z.string().optional().nullable(),
    channel: z
      .enum(CHANNELS, {
        message: `channel must be one of: ${CHANNELS.join(", ")}`,
      })
      .optional()
      .nullable(),
    category: z
      .enum(PRODUCT_CATEGORIES, {
        message: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}`,
      })
      .optional()
      .nullable(),
    currency: z.enum(CURRENCIES).default("CNY"),
    lockPeriodDays: z.number().int().min(0).optional().nullable(),
    openDays: z.number().int().min(1).optional().nullable(),
    cycleDays: z.number().int().min(1).optional().nullable(),
    annualReturnRate: z.number().optional().nullable(),
    isArchived: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const { openDays, cycleDays } = data;
      const hasOpen = openDays != null;
      const hasCycle = cycleDays != null;
      if (hasOpen !== hasCycle) return false;
      if (hasOpen && hasCycle && cycleDays <= openDays) return false;
      return true;
    },
    {
      message:
        "openDays and cycleDays must both be set, and cycleDays must be greater than openDays",
    },
  );

export const updateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z.string().optional().nullable(),
    channel: z
      .enum(CHANNELS, {
        message: `channel must be one of: ${CHANNELS.join(", ")}`,
      })
      .optional()
      .nullable(),
    category: z
      .enum(PRODUCT_CATEGORIES, {
        message: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}`,
      })
      .optional()
      .nullable(),
    currency: z.enum(CURRENCIES).optional(),
    lockPeriodDays: z.number().int().min(0).optional().nullable(),
    openDays: z.number().int().min(1).optional().nullable(),
    cycleDays: z.number().int().min(1).optional().nullable(),
    annualReturnRate: z.number().optional().nullable(),
    isArchived: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  })
  .refine(
    (data) => {
      const { openDays, cycleDays } = data;
      const hasOpen = openDays !== undefined;
      const hasCycle = cycleDays !== undefined;
      if (hasOpen !== hasCycle) return false;
      if (!hasOpen) return true;
      // Both present: must be both null or both non-null
      const openNull = openDays === null;
      const cycleNull = cycleDays === null;
      if (openNull !== cycleNull) return false;
      if (openDays != null && cycleDays != null && cycleDays <= openDays) return false;
      return true;
    },
    {
      message:
        "openDays and cycleDays must both be set, and cycleDays must be greater than openDays",
    },
  );

// ── Units ──

export const createUnitSchema = z.object({
  unitCode: z.string().min(1, "unitCode is required"),
  amountCents: z.number().int().min(0, "amountCents must be non-negative"),
  currency: z.enum(CURRENCIES).default("CNY"),
  status: z.enum(UNIT_STATUSES).default("已成立"),
  strategy: z.enum(STRATEGIES, {
    message: `strategy must be one of: ${STRATEGIES.join(", ")}`,
  }),
  tactics: z.enum(TACTICS, {
    message: `tactics must be one of: ${TACTICS.join(", ")}`,
  }),
  productId: z.string().uuid().optional().nullable(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
    .optional()
    .nullable(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
    .optional()
    .nullable(),
  note: z.string().optional().nullable(),
});

export const updateUnitSchema = z
  .object({
    unitCode: z.string().min(1).optional(),
    amountCents: z.number().int().min(0).optional(),
    currency: z.enum(CURRENCIES).optional(),
    status: z.enum(UNIT_STATUSES).optional(),
    strategy: z
      .enum(STRATEGIES, {
        message: `strategy must be one of: ${STRATEGIES.join(", ")}`,
      })
      .optional(),
    tactics: z
      .enum(TACTICS, {
        message: `tactics must be one of: ${TACTICS.join(", ")}`,
      })
      .optional(),
    productId: z.string().uuid().optional().nullable(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
      .optional()
      .nullable(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
      .optional()
      .nullable(),
    note: z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  })
  .refine(
    (data) => {
      // If productId is being updated, it must be the ONLY field
      if (data.productId !== undefined) {
        const otherFields = Object.keys(data).filter((k) => k !== "productId");
        return otherFields.length === 0;
      }
      return true;
    },
    { message: "productId must be updated alone; cannot combine with other fields" },
  );

// ── Unit Commit (docs/003) ──

/** Raw capital_units snapshot, mirroring the DB's nullability exactly. */
export const expectedUnitSchema = z.object({
  unitCode: z.string(),
  amountCents: z.number().int(),
  productId: z.string().uuid().nullable(),
  currency: z.string().nullable(),
  status: z.string().nullable(),
  strategy: z.string().nullable(),
  tactics: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  note: z.string().nullable(),
  availableDateOverride: z.string().nullable(),
});

const commitOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("swap_unit_code"),
    targetUnitId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("switch_product"),
    toProductId: z.string().uuid().nullable(),
    pnlCents: z.number().int().optional().nullable(),
  }),
  z.object({
    kind: z.literal("set_available_date"),
    availableDate: calendarDay.nullable(),
  }),
]);

/** Excludes productId (only expressible as an operation) and endDate (derived). */
const commitMetadataSchema = z
  .object({
    unitCode: z.string().min(1).optional(),
    amountCents: z.number().int().min(0).optional(),
    currency: z.enum(CURRENCIES).optional(),
    status: z.enum(UNIT_STATUSES).optional(),
    strategy: z.enum(STRATEGIES).optional(),
    tactics: z.enum(TACTICS).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
      .optional()
      .nullable(),
    unitNote: z.string().optional().nullable(),
  })
  .refine((m) => Object.keys(m).length > 0, { message: "metadata must not be empty" });

export const commitUnitSchema = z
  .object({
    metadata: commitMetadataSchema.optional(),
    operations: z.array(commitOperationSchema).max(3).default([]),
    operationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "operationDate must be YYYY-MM-DD")
      .optional(),
    commitNote: z.string().max(1000).optional().nullable(),
    expected: expectedUnitSchema,
  })
  .refine(
    (d) =>
      d.metadata !== undefined || d.operations.length > 0 || (d.commitNote ?? "").trim().length > 0,
    { message: "commit must contain metadata, operations, or a note" },
  )
  .refine((d) => new Set(d.operations.map((o) => o.kind)).size === d.operations.length, {
    message: "at most one operation of each kind per commit",
  })
  .refine(
    (d) =>
      !(
        d.metadata?.unitCode !== undefined && d.operations.some((o) => o.kind === "swap_unit_code")
      ),
    { message: "unitCode cannot be edited while a code swap is staged" },
  )
  .refine(
    (d) =>
      !(
        d.metadata?.amountCents !== undefined &&
        d.operations.some((o) => o.kind === "switch_product")
      ),
    { message: "amount cannot be edited while a product switch is staged" },
  );

// ── Contribution Logs ──

export const createContributionLogSchema = z.object({
  unitId: z.string().uuid("unitId must be a valid UUID"),
  productId: z.string().uuid().optional().nullable(),
  productName: z.string().optional().nullable(),
  operationType: z.enum(CONTRIBUTION_OPERATION_TYPES, {
    message: `operationType must be one of: ${CONTRIBUTION_OPERATION_TYPES.join(", ")}`,
  }),
  amountCents: z.number().int("amountCents must be an integer"),
  balanceAfterCents: z.number().int().optional().nullable(),
  pnlCents: z.number().int().optional().nullable(),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "operationDate must be YYYY-MM-DD"),
  source: z.enum(CONTRIBUTION_SOURCES).default("manual"),
  note: z.string().max(1000).optional().nullable(),
});

export const updateContributionLogSchema = z
  .object({
    operationType: z.enum(CONTRIBUTION_OPERATION_TYPES).optional(),
    amountCents: z.number().int().optional(),
    balanceAfterCents: z.number().int().optional().nullable(),
    pnlCents: z.number().int().optional().nullable(),
    operationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const searchContributionLogsSchema = z.object({
  unitId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  operationType: z.enum(CONTRIBUTION_OPERATION_TYPES).optional(),
  source: z.enum(CONTRIBUTION_SOURCES).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  includeDeleted: z.boolean().default(false),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
});

// Export types
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type CreateContributionLogInput = z.infer<typeof createContributionLogSchema>;
export type UpdateContributionLogInput = z.infer<typeof updateContributionLogSchema>;
export type SearchContributionLogsInput = z.infer<typeof searchContributionLogsSchema>;
export type CommitUnitInput = z.infer<typeof commitUnitSchema>;
export type ExpectedUnitInput = z.infer<typeof expectedUnitSchema>;

// ── Expense categories (002 spec) ──
// The colorToken / chart palette is defined in the web app; we keep a
// loose regex here so worker tests don't have to import the palette.
// Strict CHART_TOKENS enum validation lives in the Server Action layer.
const COLOR_TOKEN_RE = /^chart-(?:[1-9]|1\d|2[0-4])$/;

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, "name is required").max(50),
  colorToken: z.string().regex(COLOR_TOKEN_RE, "colorToken must match chart-1 .. chart-24"),
  sortOrder: z.number().int().optional(),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

// ── Recurring expenses (002 spec) ──
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;

const recurringExpenseShape = {
  name: z.string().min(1).max(200),
  categoryId: z.string().uuid().optional().nullable(),
  amountCents: z.number().int().positive(),
  currency: z.string().min(1).max(8).default("CNY"),
  account: z.string().max(100).optional().nullable(),
  frequency: z.enum(FREQUENCIES),
  interval: z.number().int().min(1).default(1),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  monthOfYear: z.number().int().min(1).max(12).optional().nullable(),
  weekday: z.number().int().min(0).max(6).optional().nullable(),
  startDate: z.string().regex(ISO_DATE_RE, "startDate must be YYYY-MM-DD"),
  endDate: z.string().regex(ISO_DATE_RE).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
} as const;

export const createRecurringExpenseSchema = z.object(recurringExpenseShape);

// `status` + `endedAt` are accepted on update for the state-machine
// actions; the endpoint layer (P1-C6) gates them with the
// X-Internal-Action header. The Server Action layer (P2-C8) strips
// them from public CRUD.
export const updateRecurringExpenseSchema = z
  .object({
    ...recurringExpenseShape,
    status: z.enum(["active", "paused", "ended"]).optional(),
    endedAt: z.string().regex(ISO_DATE_RE).optional().nullable(),
  })
  .partial();

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;
export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;
export type UpdateRecurringExpenseInput = z.infer<typeof updateRecurringExpenseSchema>;
