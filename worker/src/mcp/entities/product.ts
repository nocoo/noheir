/**
 * Product Entity Definition for MCP
 *
 * Provides CRUD operations for financial products (理财产品).
 */

import { type EntityConfig } from "@nocoo/base-mcp";
import { z } from "zod";
import type { FinancialProduct } from "../../../db/types";
import type { AllRepos } from "../../../db/repositories";

// ============================================================================
// Types
// ============================================================================

// Context type is the TRepos generic for EntityConfig
// EntityContext<ProductRepos> = { repos: ProductRepos }
export interface ProductRepos {
  products: AllRepos["products"];
  userId: string;
}

// ============================================================================
// Entity Definition
// ============================================================================

export const productEntity: EntityConfig<FinancialProduct, ProductRepos> = {
  name: "product",
  display: "理财产品",
  plural: "products",

  dataLayer: {
    list: async (ctx, opts) => {
      const filters = {
        channel: opts?.channel as string | undefined,
        category: opts?.category as string | undefined,
        currency: opts?.currency as string | undefined,
        includeArchived: opts?.include_archived as boolean | undefined,
      };

      let products = await ctx.repos.products.findAll(ctx.repos.userId, filters);

      // Apply pagination
      const limit = Math.min((opts?.limit as number) ?? 50, 200);
      const offset = (opts?.offset as number) ?? 0;
      products = products.slice(offset, offset + limit);

      return products;
    },

    getById: async (ctx, id) => {
      return ctx.repos.products.findById(ctx.repos.userId, id);
    },

    getBySlug: async () => null, // Products don't have slugs

    create: async (ctx, input) => {
      return ctx.repos.products.create(ctx.repos.userId, {
        name: input.name as string,
        code: input.code as string | undefined,
        channel: input.channel as string | undefined,
        category: input.category as string | undefined,
        currency: input.currency as string | undefined,
        lockPeriodDays: input.lock_period_days as number | undefined,
        annualReturnRate: input.annual_return_rate as number | undefined,
      });
    },

    update: async (ctx, id, input) => {
      const updateData: Record<string, unknown> = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.code !== undefined) updateData.code = input.code;
      if (input.channel !== undefined) updateData.channel = input.channel;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.lock_period_days !== undefined) updateData.lockPeriodDays = input.lock_period_days;
      if (input.annual_return_rate !== undefined) updateData.annualReturnRate = input.annual_return_rate;
      if (input.is_archived !== undefined) updateData.isArchived = input.is_archived;

      return ctx.repos.products.update(ctx.repos.userId, id, updateData);
    },

    // Note: delete is handled by custom tool (delete_product) due to unlink logic
  },

  schemas: {
    list: {
      channel: z.string().optional().describe("Filter by channel"),
      category: z.string().optional().describe("Filter by category"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("Filter by currency"),
      include_archived: z.boolean().optional().describe("Include archived products (default: false)"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default: 50, max: 200)"),
      offset: z.number().int().min(0).optional().describe("Skip N results for pagination"),
    },
    create: {
      name: z.string().describe("产品名称 (必填)"),
      code: z.string().optional().describe("产品代码"),
      channel: z.string().optional().describe("渠道"),
      category: z.string().optional().describe("分类"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("货币 (default: CNY)"),
      lock_period_days: z.number().int().min(0).optional().describe("锁定期天数 (default: 0)"),
      annual_return_rate: z.number().optional().describe("年化收益率"),
    },
    update: {
      name: z.string().optional().describe("产品名称"),
      code: z.string().nullable().optional().describe("产品代码 (null to clear)"),
      channel: z.string().optional().describe("渠道"),
      category: z.string().optional().describe("分类"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("货币"),
      lock_period_days: z.number().int().min(0).optional().describe("锁定期天数"),
      annual_return_rate: z.number().nullable().optional().describe("年化收益率 (null to clear)"),
      is_archived: z.boolean().optional().describe("是否归档"),
    },
  },

  descriptions: {
    list: `Get a filtered list of financial products (理财产品).

WHEN TO USE:
- After calling get_products_summary to understand data shape
- When you need specific product records matching certain criteria

LIMITATIONS:
- Max 200 results per call; use offset for pagination
- By default, archived products are excluded`,
    get: "Get a single financial product by ID.",
    create: "Create a new financial product. Required: name.",
    update: "Update an existing financial product. Only provided fields are updated.",
  },

  projection: {
    omit: ["userId"],
    groups: {
      timestamps: ["createdAt", "updatedAt"],
    },
  },
};
