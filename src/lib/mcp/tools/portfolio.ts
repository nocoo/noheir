/**
 * MCP Portfolio Tools
 *
 * Relationship queries between products and units.
 * Provides complete views without requiring Agent-side pagination.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./types";
import { okWithCompleteness, error } from "./types";
import { resolveProduct } from "./resolver";
import { compact, round2, currencyCode } from "./compact";
import type { UnitWithProduct, UnitEnriched } from "./unit";
import { enrichWithAvailability, type ContributionLog } from "./unit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORTFOLIO_HARD_CAP = 1000;

// ---------------------------------------------------------------------------
// Register Portfolio Tools
// ---------------------------------------------------------------------------

export function registerPortfolioTools(server: McpServer, ctx: ToolContext): void {
  // ── get_product_portfolio ──
  server.tool(
    "get_product_portfolio",
    `Get a complete view of a financial product and all its linked capital units.

WHEN TO USE:
- When you need to answer "which units are under product X?"
- When you need the total amount, status distribution, or strategy breakdown for a product
- When you need to evaluate a product's portfolio composition

DO NOT USE FOR:
- Browsing all products (use list_products)
- Getting a single product's details without units (use get_product)

RETURNS:
- Product details
- All linked capital units (hard cap: 1000)
- Summary: total units, amounts by currency, status/strategy/tactics distribution
- Completeness indicator (truncated if >1000 units)`,
    {
      product_id: z.string().optional().describe("Product ID (full ULID or 8-char prefix)"),
      product_name: z.string().optional().describe("Product name (exact match; error if ambiguous)"),
      product_code: z.string().optional().describe("Product code (exact match; error if ambiguous)"),
      include_archived_units: z.boolean().optional().describe("Include units with status=已归档 (default: false)"),
    },
    async (args) => {
      const { db, userId } = ctx;

      // Resolve product
      const resolved = await resolveProduct(db, userId, {
        ...(args.product_id ? { product_id: args.product_id } : {}),
        ...(args.product_name ? { product_name: args.product_name } : {}),
        ...(args.product_code ? { product_code: args.product_code } : {}),
      });
      if (resolved.error) return error(resolved.error);
      if (!resolved.product) return error("Product not found");

      const product = resolved.product;

      // Query linked units (fetch one extra to detect truncation)
      const fetchLimit = PORTFOLIO_HARD_CAP + 1;
      const conditions = ["u.user_id = ?", "u.product_id = ?"];
      const values: unknown[] = [userId, product.id];

      if (!args.include_archived_units) {
        conditions.push("u.status != ?");
        values.push("已归档");
      }

      const unitsSql = `
        SELECT u.id, u.unit_code, u.amount_cents, u.currency, u.status,
               u.strategy, u.tactics, u.product_id, u.start_date, u.end_date, u.note,
               u.created_at, u.updated_at,
               p.name as product_name, p.lock_period_days as product_lock_period_days
        FROM capital_units u
        LEFT JOIN financial_products p ON u.product_id = p.id
        WHERE ${conditions.join(" AND ")}
        ORDER BY u.created_at DESC
        LIMIT ?
      `;

      const [unitsResult, countResult] = await Promise.all([
        db.query<UnitWithProduct>(unitsSql, [...values, fetchLimit]),
        db.firstOrNull<{ total: number }>(
          `SELECT COUNT(*) as total FROM capital_units u WHERE ${conditions.join(" AND ")}`,
          values,
        ),
      ]);

      const allUnits = unitsResult.results;
      const truncated = allUnits.length > PORTFOLIO_HARD_CAP;
      const units = truncated ? allUnits.slice(0, PORTFOLIO_HARD_CAP) : allUnits;
      const realTotal = countResult?.total ?? units.length;

      // Get latest invest logs for availability calculation
      let enrichedUnits: UnitEnriched[] = [];
      if (units.length > 0) {
        const unitIds = units.map((u) => u.id);
        const placeholders = unitIds.map(() => "?").join(", ");

        const logsSql = `
          SELECT cl.id, cl.unit_id, cl.operation_type, cl.operation_date
          FROM contribution_logs cl
          INNER JOIN (
            SELECT unit_id, MAX(operation_date) as max_date
            FROM contribution_logs
            WHERE unit_id IN (${placeholders}) AND operation_type = 'invest'
            GROUP BY unit_id
          ) latest ON cl.unit_id = latest.unit_id AND cl.operation_date = latest.max_date
          WHERE cl.operation_type = 'invest'
        `;

        const logsResult = await db.query<ContributionLog>(logsSql, unitIds);
        const logsMap = new Map(logsResult.results.map((log) => [log.unit_id, log]));

        enrichedUnits = units.map((unit) =>
          enrichWithAvailability(unit, logsMap.get(unit.id) ?? null),
        );
      }

      // Build summary
      const summary = buildSummary(units);

      // Build product response
      const productResponse = compact({
        id: product.id,
        name: product.name,
        code: product.code,
        channel: product.channel,
        category: product.category,
        currency: product.currency,
        lock_days: product.lock_period_days || null,
        return_rate: product.annual_return_rate,
        archived: product.is_archived === 1 ? true : null,
      });

      return okWithCompleteness(
        {
          product: productResponse,
          units: enrichedUnits,
          summary,
        },
        {
          complete: !truncated,
          truncated,
          total: realTotal,
          returned: enrichedUnits.length,
        },
        truncated ? { recommended: "narrow" } : undefined,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Summary Builder
// ---------------------------------------------------------------------------

interface PortfolioSummary {
  total_units: number;
  total_amount_by_currency: Record<string, number>;
  by_status: Record<string, number>;
  by_strategy: Record<string, number>;
  by_tactics: Record<string, number>;
}

function buildSummary(units: UnitWithProduct[]): PortfolioSummary {
  const summary: PortfolioSummary = {
    total_units: units.length,
    total_amount_by_currency: {},
    by_status: {},
    by_strategy: {},
    by_tactics: {},
  };

  for (const unit of units) {
    // Amount by currency
    const currency = currencyCode(unit.currency);
    const amount = round2(unit.amount_cents / 100);
    summary.total_amount_by_currency[currency] = round2(
      (summary.total_amount_by_currency[currency] ?? 0) + amount,
    );

    // Status distribution
    summary.by_status[unit.status] = (summary.by_status[unit.status] ?? 0) + 1;

    // Strategy distribution
    if (unit.strategy) {
      summary.by_strategy[unit.strategy] = (summary.by_strategy[unit.strategy] ?? 0) + 1;
    }

    // Tactics distribution
    if (unit.tactics) {
      summary.by_tactics[unit.tactics] = (summary.by_tactics[unit.tactics] ?? 0) + 1;
    }
  }

  return summary;
}
