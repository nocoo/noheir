/**
 * Zod validation schemas for Products and Units.
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
  annualReturnRate: z.number().optional().nullable(),
});

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
  annualReturnRate: z.number().optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" },
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
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
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
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" },
);

// Export types
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
