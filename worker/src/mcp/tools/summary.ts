/**
 * MCP Summary Tools
 *
 * Tools for getting aggregated statistics about products and units.
 */

import { registerCustomTool, ok } from "@nocoo/base-mcp";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AllRepos } from "../../../db/repositories";
import { buildProductsSummary } from "../../../lib/products-summary";
import { buildUnitsSummary } from "../../../lib/units-summary";

// ============================================================================
// Types
// ============================================================================

export interface SummaryToolsRepos {
  products: AllRepos["products"];
  units: AllRepos["units"];
  contributionLogs: AllRepos["contributionLogs"];
  userId: string;
}

// ============================================================================
// Register Summary Tools
// ============================================================================

export function registerSummaryTools(
  server: McpServer,
  ctx: { repos: SummaryToolsRepos }
) {
  // ── get_products_summary ──
  registerCustomTool(
    server,
    {
      name: "get_products_summary",
      description: `Get aggregated statistics about financial products without fetching individual records.

WHEN TO USE:
- First call before listing products, to understand data shape and totals
- When you need counts grouped by channel, category, or currency

RESPONSE INCLUDES:
- total_count: Number of active products (or all if include_archived=true)
- archived_count: Number of archived products
- by_channel, by_category, by_currency: Count breakdowns

LIMITATIONS:
- By default, only active (non-archived) products are counted in breakdowns
- Set include_archived=true to include archived products in all counts`,
      schema: z.object({
        include_archived: z.boolean().optional().describe("Include archived products in counts (default: false)"),
      }),
      handler: async ({ repos }, args) => {
        const includeArchived = args.include_archived as boolean | undefined;

        // Get products
        const products = await repos.products.findAll(repos.userId, { includeArchived });

        // Get archived count
        const archivedCount = await repos.products.countArchived(repos.userId);

        // Compute summary
        const summary = buildProductsSummary(products, archivedCount);

        return ok(summary);
      },
    },
    ctx
  );

  // ── get_units_summary ──
  registerCustomTool(
    server,
    {
      name: "get_units_summary",
      description: `Get aggregated statistics about capital units without fetching individual records.

WHEN TO USE:
- First call before listing units, to understand data shape and totals
- When you need counts/amounts grouped by strategy, status, or tactics
- To check upcoming availability without fetching all unit details

RESPONSE INCLUDES:
- total_count, total_amount_cents: Overall totals
- by_strategy, by_status, by_tactics: Breakdown with count and amount_cents
- availability: Categorized as available_now (≤0 days), available_30d (1-30 days), locked (>30 days), unknown (no data)

LIMITATIONS:
- Amounts are in cents (divide by 100 for display)
- Availability requires unit linked to product with lockPeriodDays AND at least one invest log`,
      schema: z.object({}),
      handler: async ({ repos }) => {
        // Get units with products
        const unitsWithProducts = await repos.units.findAllWithProducts(repos.userId);

        // Get latest invest logs for availability
        const unitIds = unitsWithProducts.map(u => u.id);
        const latestInvestLogs = await repos.contributionLogs.getLatestInvestLogs(repos.userId, unitIds);

        // Enrich with availability
        const enrichedUnits = repos.units.enrichWithAvailability(unitsWithProducts, latestInvestLogs);

        // Compute summary
        const summary = buildUnitsSummary(enrichedUnits);

        return ok(summary);
      },
    },
    ctx
  );
}
