/**
 * MCP Product Tools
 *
 * CRUD operations for financial products (理财产品).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./types";
import { ok, error } from "./types";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  id: string;
  name: string;
  code: string | null;
  channel: string | null;
  category: string | null;
  currency: string;
  lock_period_days: number;
  annual_return_rate: number | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Register Product Tools
// ---------------------------------------------------------------------------

export function registerProductTools(server: McpServer, ctx: ToolContext): void {
  // ── list_products ──
  server.tool(
    "list_products",
    `Get a filtered list of financial products (理财产品).

WHEN TO USE:
- After calling get_products_summary to understand data shape
- When you need specific product records matching certain criteria

LIMITATIONS:
- Max 200 results per call; use offset for pagination
- By default, archived products are excluded`,
    {
      channel: z.string().optional().describe("Filter by channel"),
      category: z.string().optional().describe("Filter by category"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("Filter by currency"),
      include_archived: z.boolean().optional().describe("Include archived products (default: false)"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default: 50, max: 200)"),
      offset: z.number().int().min(0).optional().describe("Skip N results for pagination"),
    },
    async (args) => {
      const { db, userId } = ctx;

      const conditions: string[] = ["user_id = ?"];
      const values: unknown[] = [userId];

      if (!args.include_archived) {
        conditions.push("is_archived = 0");
      }

      if (args.channel) {
        conditions.push("channel = ?");
        values.push(args.channel);
      }

      if (args.category) {
        conditions.push("category = ?");
        values.push(args.category);
      }

      if (args.currency) {
        conditions.push("currency = ?");
        values.push(args.currency);
      }

      const limit = Math.min(args.limit ?? 50, 200);
      const offset = args.offset ?? 0;

      const sql = `
        SELECT id, name, code, channel, category, currency,
               lock_period_days, annual_return_rate, is_archived,
               created_at, updated_at
        FROM financial_products
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const result = await db.query<Product>(sql, [...values, limit, offset]);

      const products = result.results.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        channel: p.channel,
        category: p.category,
        currency: p.currency,
        lock_period_days: p.lock_period_days,
        annual_return_rate: p.annual_return_rate,
        is_archived: p.is_archived === 1,
      }));

      return ok({ products, count: products.length, limit, offset });
    },
  );

  // ── get_product ──
  server.tool(
    "get_product",
    "Get a single financial product by ID.",
    {
      id: z.string().describe("Product ID"),
    },
    async (args) => {
      const { db, userId } = ctx;

      const product = await db.firstOrNull<Product>(
        `SELECT id, name, code, channel, category, currency,
                lock_period_days, annual_return_rate, is_archived,
                created_at, updated_at
         FROM financial_products
         WHERE id = ? AND user_id = ?`,
        [args.id, userId],
      );

      if (!product) {
        return error(`Product not found: ${args.id}`);
      }

      return ok({
        id: product.id,
        name: product.name,
        code: product.code,
        channel: product.channel,
        category: product.category,
        currency: product.currency,
        lock_period_days: product.lock_period_days,
        annual_return_rate: product.annual_return_rate,
        is_archived: product.is_archived === 1,
        created_at: product.created_at,
        updated_at: product.updated_at,
      });
    },
  );

  // ── create_product ──
  server.tool(
    "create_product",
    "Create a new financial product. Required: name.",
    {
      name: z.string().describe("产品名称 (必填)"),
      code: z.string().optional().describe("产品代码"),
      channel: z.string().optional().describe("渠道"),
      category: z.string().optional().describe("分类"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("货币 (default: CNY)"),
      lock_period_days: z.number().int().min(0).optional().describe("锁定期天数 (default: 0)"),
      annual_return_rate: z.number().optional().describe("年化收益率"),
    },
    async (args) => {
      const { db, userId } = ctx;

      const id = ulid();
      const now = new Date().toISOString();

      await db.execute(
        `INSERT INTO financial_products
           (id, user_id, name, code, channel, category, currency, lock_period_days, annual_return_rate, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          args.name,
          args.code ?? null,
          args.channel ?? null,
          args.category ?? null,
          args.currency ?? "CNY",
          args.lock_period_days ?? 0,
          args.annual_return_rate ?? null,
          now,
          now,
        ],
      );

      return ok({
        id,
        name: args.name,
        code: args.code ?? null,
        channel: args.channel ?? null,
        category: args.category ?? null,
        currency: args.currency ?? "CNY",
        lock_period_days: args.lock_period_days ?? 0,
        annual_return_rate: args.annual_return_rate ?? null,
        is_archived: false,
        created_at: now,
        updated_at: now,
      });
    },
  );

  // ── update_product ──
  server.tool(
    "update_product",
    "Update an existing financial product. Only provided fields are updated.",
    {
      id: z.string().describe("Product ID"),
      name: z.string().optional().describe("产品名称"),
      code: z.string().nullable().optional().describe("产品代码 (null to clear)"),
      channel: z.string().optional().describe("渠道"),
      category: z.string().optional().describe("分类"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("货币"),
      lock_period_days: z.number().int().min(0).optional().describe("锁定期天数"),
      annual_return_rate: z.number().nullable().optional().describe("年化收益率 (null to clear)"),
      is_archived: z.boolean().optional().describe("是否归档"),
    },
    async (args) => {
      const { db, userId } = ctx;

      // Check product exists
      const existing = await db.firstOrNull<{ id: string }>(
        "SELECT id FROM financial_products WHERE id = ? AND user_id = ?",
        [args.id, userId],
      );

      if (!existing) {
        return error(`Product not found: ${args.id}`);
      }

      // Build update fields
      const updates: string[] = [];
      const values: unknown[] = [];

      if (args.name !== undefined) {
        updates.push("name = ?");
        values.push(args.name);
      }
      if (args.code !== undefined) {
        updates.push("code = ?");
        values.push(args.code);
      }
      if (args.channel !== undefined) {
        updates.push("channel = ?");
        values.push(args.channel);
      }
      if (args.category !== undefined) {
        updates.push("category = ?");
        values.push(args.category);
      }
      if (args.currency !== undefined) {
        updates.push("currency = ?");
        values.push(args.currency);
      }
      if (args.lock_period_days !== undefined) {
        updates.push("lock_period_days = ?");
        values.push(args.lock_period_days);
      }
      if (args.annual_return_rate !== undefined) {
        updates.push("annual_return_rate = ?");
        values.push(args.annual_return_rate);
      }
      if (args.is_archived !== undefined) {
        updates.push("is_archived = ?");
        values.push(args.is_archived ? 1 : 0);
      }

      if (updates.length === 0) {
        return error("No fields to update");
      }

      updates.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(args.id, userId);

      await db.execute(
        `UPDATE financial_products SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
        values,
      );

      // Fetch updated product
      const product = await db.firstOrNull<Product>(
        `SELECT id, name, code, channel, category, currency,
                lock_period_days, annual_return_rate, is_archived,
                created_at, updated_at
         FROM financial_products
         WHERE id = ? AND user_id = ?`,
        [args.id, userId],
      );

      if (!product) {
        return error(`Product not found after update: ${args.id}`);
      }

      return ok({
        id: product.id,
        name: product.name,
        code: product.code,
        channel: product.channel,
        category: product.category,
        currency: product.currency,
        lock_period_days: product.lock_period_days,
        annual_return_rate: product.annual_return_rate,
        is_archived: product.is_archived === 1,
        created_at: product.created_at,
        updated_at: product.updated_at,
      });
    },
  );
}
