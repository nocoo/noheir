/**
 * Zod validation schemas for Products, Units, and Contribution Logs.
 *
 * These enforce enum constraints that were previously DB-level CHECK constraints in Supabase.
 */

import { z } from "zod";
import {
  CHANNELS,
  PRODUCT_CATEGORIES,
  CURRENCIES,
  STRATEGIES,
  TACTICS,
  UNIT_STATUSES,
  CONTRIBUTION_OPERATION_TYPES,
  CONTRIBUTION_SOURCES,
} from "./enums";

// ── Products ──

export const createProductSchema = z.object({
  name: z.string().min(1, "name is required"),
  code: z.string().optional().nullable(),
  channel: z.enum(CHANNELS, {
    message: `channel must be one of: ${CHANNELS.join(", ")}`,
  }).optional().nullable(),
  category: z.enum(PRODUCT_CATEGORIES, {
    message: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}`,
  }).optional().nullable(),
  currency: z.enum(CURRENCIES).default("CNY"),
  lockPeriodDays: z.number().int().min(0).optional().nullable(),
  openDays: z.number().int().min(1).optional().nullable(),
  cycleDays: z.number().int().min(1).optional().nullable(),
  annualReturnRate: z.number().optional().nullable(),
  isArchived: z.boolean().default(false),
}).refine(
  (data) => {
    const hasOpen = data.openDays != null;
    const hasCycle = data.cycleDays != null;
    if (hasOpen !== hasCycle) return false;
    if (hasOpen && hasCycle && data.cycleDays! <= data.openDays!) return false;
    return true;
  },
  { message: "openDays and cycleDays must both be set, and cycleDays must be greater than openDays" },
);

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  channel: z.enum(CHANNELS, {
    message: `channel must be one of: ${CHANNELS.join(", ")}`,
  }).optional().nullable(),
  category: z.enum(PRODUCT_CATEGORIES, {
    message: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}`,
  }).optional().nullable(),
  currency: z.enum(CURRENCIES).optional(),
  lockPeriodDays: z.number().int().min(0).optional().nullable(),
  openDays: z.number().int().min(1).optional().nullable(),
  cycleDays: z.number().int().min(1).optional().nullable(),
  annualReturnRate: z.number().optional().nullable(),
  isArchived: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" },
).refine(
  (data) => {
    const hasOpen = data.openDays !== undefined;
    const hasCycle = data.cycleDays !== undefined;
    if (hasOpen !== hasCycle) return false;
    if (hasOpen && hasCycle && data.openDays != null && data.cycleDays != null && data.cycleDays <= data.openDays) return false;
    return true;
  },
  { message: "openDays and cycleDays must both be set, and cycleDays must be greater than openDays" },
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
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD").optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD").optional().nullable(),
  note: z.string().optional().nullable(),
});

export const updateUnitSchema = z.object({
  unitCode: z.string().min(1).optional(),
  amountCents: z.number().int().min(0).optional(),
  currency: z.enum(CURRENCIES).optional(),
  status: z.enum(UNIT_STATUSES).optional(),
  strategy: z.enum(STRATEGIES, {
    message: `strategy must be one of: ${STRATEGIES.join(", ")}`,
  }).optional(),
  tactics: z.enum(TACTICS, {
    message: `tactics must be one of: ${TACTICS.join(", ")}`,
  }).optional(),
  productId: z.string().uuid().optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD").optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD").optional().nullable(),
  note: z.string().optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" },
).refine(
  (data) => {
    // If productId is being updated, it must be the ONLY field
    if (data.productId !== undefined) {
      const otherFields = Object.keys(data).filter(k => k !== "productId");
      return otherFields.length === 0;
    }
    return true;
  },
  { message: "productId must be updated alone; cannot combine with other fields" },
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
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "operationDate must be YYYY-MM-DD"),
  source: z.enum(CONTRIBUTION_SOURCES).default("manual"),
  note: z.string().max(1000).optional().nullable(),
});

export const updateContributionLogSchema = z.object({
  operationType: z.enum(CONTRIBUTION_OPERATION_TYPES).optional(),
  amountCents: z.number().int().optional(),
  balanceAfterCents: z.number().int().optional().nullable(),
  operationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(1000).optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" },
);

export const searchContributionLogsSchema = z.object({
  unitId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  operationType: z.enum(CONTRIBUTION_OPERATION_TYPES).optional(),
  source: z.enum(CONTRIBUTION_SOURCES).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
