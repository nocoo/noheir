/**
 * MCP Summary Tools
 *
 * Aggregated views of products and units.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./types";
import { ok } from "./types";
import { round2, currencyCode } from "./compact";

// ---------------------------------------------------------------------------
// Register Summary Tools
// ---------------------------------------------------------------------------

export function registerSummaryTools(server: McpServer, ctx: ToolContext): void {
  // ── get_products_summary ──
  server.tool(
    "get_products_summary",
    `Get aggregated summary of financial products.

Returns:
- Total products (active vs archived)
- Breakdown by channel, category, currency
- Lock period distribution

USE WHEN:
- Before listing products to understand data shape
- To provide an overview of the user's product portfolio`,
    {},
    async () => {
      const { db, userId } = ctx;

      // Get counts
      const countsResult = await db.firstOrNull<{
        total: number;
        active: number;
        archived: number;
      }>(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) as archived
        FROM financial_products
        WHERE user_id = ?`,
        [userId],
      );

      // Get channel breakdown
      const channelsResult = await db.query<{ channel: string | null; count: number }>(
        `SELECT channel, COUNT(*) as count
        FROM financial_products
        WHERE user_id = ? AND is_archived = 0
        GROUP BY channel
        ORDER BY count DESC`,
        [userId],
      );

      // Get category breakdown
      const categoriesResult = await db.query<{ category: string | null; count: number }>(
        `SELECT category, COUNT(*) as count
        FROM financial_products
        WHERE user_id = ? AND is_archived = 0
        GROUP BY category
        ORDER BY count DESC`,
        [userId],
      );

      // Get currency breakdown
      const currenciesResult = await db.query<{ currency: string; count: number }>(
        `SELECT currency, COUNT(*) as count
        FROM financial_products
        WHERE user_id = ? AND is_archived = 0
        GROUP BY currency
        ORDER BY count DESC`,
        [userId],
      );

      // Get lock period distribution
      const lockPeriodsResult = await db.query<{ lock_period_days: number; count: number }>(
        `SELECT lock_period_days, COUNT(*) as count
        FROM financial_products
        WHERE user_id = ? AND is_archived = 0
        GROUP BY lock_period_days
        ORDER BY lock_period_days`,
        [userId],
      );

      return ok({
        counts: {
          total: countsResult?.total ?? 0,
          active: countsResult?.active ?? 0,
          archived: countsResult?.archived ?? 0,
        },
        by_channel: channelsResult.results.map((r) => ({
          channel: r.channel ?? "(未设置)",
          count: r.count,
        })),
        by_category: categoriesResult.results.map((r) => ({
          category: r.category ?? "(未设置)",
          count: r.count,
        })),
        by_currency: currenciesResult.results.map((r) => ({
          currency: currencyCode(r.currency),
          count: r.count,
        })),
        lock_period_distribution: lockPeriodsResult.results.map((r) => ({
          days: r.lock_period_days,
          count: r.count,
        })),
      });
    },
  );

  // ── get_units_summary ──
  server.tool(
    "get_units_summary",
    `Get aggregated summary of capital units.

Returns:
- Total units by status
- Breakdown by strategy, tactics, currency
- Total amounts by currency
- Product linkage stats

USE WHEN:
- Before listing units to understand data shape
- To provide an overview of the user's capital allocation`,
    {},
    async () => {
      const { db, userId } = ctx;

      // Get counts by status
      const statusResult = await db.query<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count
        FROM capital_units
        WHERE user_id = ?
        GROUP BY status
        ORDER BY count DESC`,
        [userId],
      );

      // Get strategy breakdown
      const strategyResult = await db.query<{ strategy: string | null; count: number }>(
        `SELECT strategy, COUNT(*) as count
        FROM capital_units
        WHERE user_id = ?
        GROUP BY strategy
        ORDER BY count DESC`,
        [userId],
      );

      // Get tactics breakdown
      const tacticsResult = await db.query<{ tactics: string | null; count: number }>(
        `SELECT tactics, COUNT(*) as count
        FROM capital_units
        WHERE user_id = ?
        GROUP BY tactics
        ORDER BY count DESC`,
        [userId],
      );

      // Get currency totals
      const currencyTotalsResult = await db.query<{
        currency: string;
        count: number;
        total_cents: number;
      }>(
        `SELECT currency, COUNT(*) as count, SUM(amount_cents) as total_cents
        FROM capital_units
        WHERE user_id = ?
        GROUP BY currency
        ORDER BY total_cents DESC`,
        [userId],
      );

      // Get product linkage stats
      const linkageResult = await db.firstOrNull<{
        linked: number;
        unlinked: number;
      }>(
        `SELECT
          SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) as linked,
          SUM(CASE WHEN product_id IS NULL THEN 1 ELSE 0 END) as unlinked
        FROM capital_units
        WHERE user_id = ?`,
        [userId],
      );

      return ok({
        by_status: statusResult.results.map((r) => ({
          status: r.status,
          count: r.count,
        })),
        by_strategy: strategyResult.results.map((r) => ({
          strategy: r.strategy ?? "(未设置)",
          count: r.count,
        })),
        by_tactics: tacticsResult.results.map((r) => ({
          tactics: r.tactics ?? "(未设置)",
          count: r.count,
        })),
        by_currency: currencyTotalsResult.results.map((r) => ({
          currency: currencyCode(r.currency),
          count: r.count,
          total: round2(r.total_cents / 100),
        })),
        product_linkage: {
          linked: linkageResult?.linked ?? 0,
          unlinked: linkageResult?.unlinked ?? 0,
        },
      });
    },
  );
}
