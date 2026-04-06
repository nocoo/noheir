/**
 * MCP Delete Tools
 *
 * Custom delete operations with business logic:
 * - delete_product: Archives product, unlinks associated units
 * - delete_unit: Checks for contribution logs before delete
 */

import { registerCustomTool, ok, error } from "@nocoo/base-mcp";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AllRepos } from "../../../db/repositories";

// ============================================================================
// Types
// ============================================================================

export interface DeleteToolsRepos {
  products: AllRepos["products"];
  units: AllRepos["units"];
  contributionLogs: AllRepos["contributionLogs"];
  userId: string;
}

// ============================================================================
// Register Delete Tools
// ============================================================================

export function registerDeleteTools(
  server: McpServer,
  ctx: { repos: DeleteToolsRepos }
) {
  // ── delete_product ──
  registerCustomTool(
    server,
    {
      name: "delete_product",
      description: `Delete (archive) a financial product by ID.

BEHAVIOR:
- Product is archived (soft delete), not physically deleted
- Any units linked to this product will have their product_id set to NULL
- The product can be restored later if needed

USE WHEN:
- User wants to remove a product they no longer use
- Product should no longer appear in active lists`,
      schema: z.object({
        id: z.string().uuid().describe("Product UUID to delete"),
      }),
      handler: async ({ repos }, args) => {
        const id = args.id as string;

        // Check if product exists
        const product = await repos.products.findById(repos.userId, id);
        if (!product) {
          return error(`Product not found: ${id}`);
        }

        // Archive the product (soft delete)
        const updated = await repos.products.update(repos.userId, id, {
          isArchived: true,
        });

        if (!updated) {
          return error(`Failed to archive product: ${id}`);
        }

        // Unlink all units from this product
        const unlinkedCount = await repos.units.unlinkProduct(repos.userId, id);

        return ok({
          success: true,
          message: `Product '${product.name}' has been archived`,
          product_id: id,
          unlinked_units: unlinkedCount,
        });
      },
    },
    ctx
  );

  // ── delete_unit ──
  registerCustomTool(
    server,
    {
      name: "delete_unit",
      description: `Delete a capital unit by ID.

BEHAVIOR:
- Checks for associated contribution logs before deletion
- If logs exist, deletion is blocked (use force=true to override)
- With force=true, unit is deleted and orphaned logs remain for audit

USE WHEN:
- User wants to permanently remove a unit
- Unit was created by mistake or is no longer needed

CAUTION:
- This is a permanent deletion, not an archive
- Associated contribution logs may become orphaned`,
      schema: z.object({
        id: z.string().uuid().describe("Unit UUID to delete"),
        force: z.boolean().optional().describe("Force delete even if contribution logs exist (default: false)"),
      }),
      handler: async ({ repos }, args) => {
        const id = args.id as string;
        const force = args.force as boolean | undefined;

        // Check if unit exists
        const unit = await repos.units.findById(repos.userId, id);
        if (!unit) {
          return error(`Unit not found: ${id}`);
        }

        // Check for contribution logs
        const logsResult = await repos.contributionLogs.search(repos.userId, {
          unitId: id,
          limit: 1,
        });

        const hasLogs = logsResult.total > 0;

        if (hasLogs && !force) {
          return error(
            `Cannot delete unit '${unit.unitCode}' - it has ${logsResult.total} contribution log(s). ` +
            `Use force=true to delete anyway (logs will be orphaned).`
          );
        }

        // Delete the unit
        const deleted = await repos.units.delete(repos.userId, id);

        if (!deleted) {
          return error(`Failed to delete unit: ${id}`);
        }

        return ok({
          success: true,
          message: `Unit '${unit.unitCode}' has been deleted`,
          unit_id: id,
          orphaned_logs: hasLogs ? logsResult.total : 0,
        });
      },
    },
    ctx
  );
}
