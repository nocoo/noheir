/**
 * Unit Entity Definition for MCP
 *
 * Provides CRUD operations for capital units (理财单元).
 * Includes availability enrichment based on product lock periods.
 *
 * Business constraints (matching REST API behavior):
 * - endDate invariant: status=已归档 requires endDate, others must have null
 * - productId changes require CAS and auto-generate contribution logs
 */

import { type EntityConfig } from "@nocoo/base-mcp";
import { z } from "zod";
import type { CapitalUnit } from "../../../db/types";
import type { AllRepos, UnitWithAvailability } from "../../../db/repositories";

// ============================================================================
// Types
// ============================================================================

// Context type is the TRepos generic for EntityConfig
// EntityContext<UnitRepos> = { repos: UnitRepos }
export interface UnitRepos {
  units: AllRepos["units"];
  products: AllRepos["products"];
  contributionLogs: AllRepos["contributionLogs"];
  userId: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get local date string in YYYY-MM-DD format (Asia/Shanghai timezone).
 */
function getLocalDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

/**
 * Enforce endDate invariant:
 * - status = 已归档: auto-set endDate if not provided
 * - status != 已归档: clear any endDate
 */
function applyEndDateInvariant(
  data: Record<string, unknown>,
  existingStatus?: string
): Record<string, unknown> {
  const result = { ...data };
  const effectiveStatus = (data.status ?? existingStatus) as string | undefined;

  if (effectiveStatus === "已归档") {
    if (!result.endDate) {
      result.endDate = getLocalDateString();
    }
  } else {
    // Non-archived units must not have endDate
    result.endDate = null;
  }

  return result;
}

// ============================================================================
// Entity Definition
// ============================================================================

export const unitEntity: EntityConfig<UnitWithAvailability | CapitalUnit, UnitRepos> = {
  name: "unit",
  display: "理财单元",
  plural: "units",

  dataLayer: {
    list: async (ctx, opts) => {
      // Build filters - only include defined values
      const filters: { status?: string; strategy?: string; tactics?: string; currency?: string } = {};
      if (opts?.status) filters.status = opts.status as string;
      if (opts?.strategy) filters.strategy = opts.strategy as string;
      if (opts?.tactics) filters.tactics = opts.tactics as string;
      if (opts?.currency) filters.currency = opts.currency as string;

      // Get units with products for availability calculation
      const unitsWithProducts = await ctx.repos.units.findAllWithProducts(ctx.repos.userId, filters);

      // Get latest invest logs for availability calculation
      const unitIds = unitsWithProducts.map((u: { id: string }) => u.id);
      const latestInvestLogs = await ctx.repos.contributionLogs.getLatestInvestLogs(ctx.repos.userId, unitIds);

      // Enrich with availability info
      let enrichedUnits = ctx.repos.units.enrichWithAvailability(unitsWithProducts, latestInvestLogs);

      // Apply pagination
      const limit = Math.min((opts?.limit as number) ?? 50, 200);
      const offset = (opts?.offset as number) ?? 0;
      enrichedUnits = enrichedUnits.slice(offset, offset + limit);

      return enrichedUnits;
    },

    getById: async (ctx, id) => {
      const unitWithProduct = await ctx.repos.units.findByIdWithProduct(ctx.repos.userId, id);
      if (!unitWithProduct) return null;

      // Get latest invest log for this unit
      const latestInvestLogs = await ctx.repos.contributionLogs.getLatestInvestLogs(ctx.repos.userId, [id]);

      // Enrich with availability info
      const enrichedUnits = ctx.repos.units.enrichWithAvailability([unitWithProduct], latestInvestLogs);
      return enrichedUnits[0] ?? null;
    },

    getBySlug: async () => null, // Units don't have slugs

    create: async (ctx, input) => {
      // Build create data
      const rawData = {
        unitCode: input.unit_code as string,
        amountCents: input.amount_cents as number,
        currency: input.currency as string | undefined,
        status: input.status as string | undefined,
        strategy: input.strategy as string | undefined,
        tactics: input.tactics as string | undefined,
        productId: input.product_id as string | undefined,
        startDate: input.start_date as string | undefined,
        endDate: input.end_date as string | undefined,
        note: input.note as string | undefined,
      };

      // Apply endDate invariant
      const createData = applyEndDateInvariant(rawData);

      return ctx.repos.units.create(ctx.repos.userId, createData as Parameters<typeof ctx.repos.units.create>[1]);
    },

    update: async (ctx, id, input) => {
      // Get original unit for CAS and invariant checks
      const original = await ctx.repos.units.findById(ctx.repos.userId, id);
      if (!original) return null;

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (input.unit_code !== undefined) updateData.unitCode = input.unit_code;
      if (input.amount_cents !== undefined) updateData.amountCents = input.amount_cents;
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.strategy !== undefined) updateData.strategy = input.strategy;
      if (input.tactics !== undefined) updateData.tactics = input.tactics;
      if (input.product_id !== undefined) updateData.productId = input.product_id;
      if (input.start_date !== undefined) updateData.startDate = input.start_date;
      if (input.end_date !== undefined) updateData.endDate = input.end_date;
      if (input.note !== undefined) updateData.note = input.note;

      // Apply endDate invariant
      const finalData = applyEndDateInvariant(updateData, original.status ?? undefined);

      // Check if productId is changing
      const productIdChanging = input.product_id !== undefined
        && original.productId !== input.product_id;

      if (productIdChanging) {
        // CAS check: re-fetch and verify no concurrent modification
        const current = await ctx.repos.units.findById(ctx.repos.userId, id);
        if (!current || current.productId !== original.productId) {
          // Concurrent modification detected - return null to trigger conflict error
          return null;
        }

        // Update the unit
        const updated = await ctx.repos.units.update(ctx.repos.userId, id, finalData);
        if (!updated) return null;

        // Create contribution logs for the product change
        const today = getLocalDateString();
        const newProductId = input.product_id as string | null;

        // Withdraw log for old product
        if (original.productId) {
          const oldProduct = await ctx.repos.products.findById(ctx.repos.userId, original.productId);
          await ctx.repos.contributionLogs.create(ctx.repos.userId, {
            unitId: id,
            productId: original.productId,
            productName: oldProduct?.name ?? null,
            operationType: "withdraw",
            amountCents: -original.amountCents,
            operationDate: today,
            source: "auto",
            note: `Auto: moved out to ${newProductId ? "another product" : "unassigned"}`,
          });
        }

        // Invest log for new product
        if (newProductId) {
          const newProduct = await ctx.repos.products.findById(ctx.repos.userId, newProductId);
          await ctx.repos.contributionLogs.create(ctx.repos.userId, {
            unitId: id,
            productId: newProductId,
            productName: newProduct?.name ?? null,
            operationType: "invest",
            amountCents: original.amountCents,
            operationDate: today,
            source: "auto",
            note: `Auto: moved in from ${original.productId ? "another product" : "unassigned"}`,
          });
        }

        return updated;
      }

      // No productId change - simple update
      return ctx.repos.units.update(ctx.repos.userId, id, finalData);
    },

    // Note: delete is handled by custom tool (delete_unit) due to relation checks
  },

  schemas: {
    list: {
      status: z.string().optional().describe("Filter by status (e.g., 已成立, 已清算)"),
      strategy: z.string().optional().describe("Filter by strategy (e.g., 远期理财)"),
      tactics: z.string().optional().describe("Filter by tactics (e.g., 定期存款)"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("Filter by currency"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default: 50, max: 200)"),
      offset: z.number().int().min(0).optional().describe("Skip N results for pagination"),
    },
    create: {
      unit_code: z.string().describe("单元代码 (必填, e.g., C10, A01)"),
      amount_cents: z.number().int().describe("金额(分) (必填)"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("货币 (default: CNY)"),
      status: z.string().optional().describe("状态 (default: 已成立)"),
      strategy: z.string().optional().describe("策略"),
      tactics: z.string().optional().describe("战术"),
      product_id: z.string().optional().describe("关联产品ID"),
      start_date: z.string().optional().describe("开始日期 (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("结束日期 (YYYY-MM-DD)"),
      note: z.string().optional().describe("备注"),
    },
    update: {
      unit_code: z.string().optional().describe("单元代码"),
      amount_cents: z.number().int().optional().describe("金额(分)"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("货币"),
      status: z.string().optional().describe("状态"),
      strategy: z.string().optional().describe("策略"),
      tactics: z.string().optional().describe("战术"),
      product_id: z.string().nullable().optional().describe("关联产品ID (null to unlink)"),
      start_date: z.string().nullable().optional().describe("开始日期 (null to clear)"),
      end_date: z.string().nullable().optional().describe("结束日期 (null to clear)"),
      note: z.string().nullable().optional().describe("备注 (null to clear)"),
    },
  },

  descriptions: {
    list: `Get a filtered list of capital units (理财单元).

Each unit includes:
- Basic info: unit_code, amount_cents, currency, status, strategy, tactics
- Product relation: product (embedded object if linked)
- Availability: daysToAvailable, availabilityStatus (based on product lock period)

AVAILABILITY STATUS:
- "available": Funds can be withdrawn now
- "locked": Funds are still in lock period
- "unknown": No product linked or no invest log

LIMITATIONS:
- Max 200 results per call; use offset for pagination`,
    get: "Get a single capital unit by ID with availability info.",
    create: "Create a new capital unit. Required: unit_code, amount_cents.",
    update: `Update an existing capital unit. Only provided fields are updated.

IMPORTANT: Changing product_id will automatically create contribution logs
(withdraw from old product, invest to new product) for audit trail.`,
  },

  projection: {
    omit: ["userId"],
    groups: {
      timestamps: ["createdAt", "updatedAt"],
    },
  },
};
