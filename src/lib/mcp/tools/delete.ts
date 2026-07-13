/**
 * MCP Delete Tools
 *
 * Custom delete operations with business logic:
 * - delete_product: Archives product
 * - delete_unit: Checks for contribution logs before delete
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./types";
import { ok, error } from "./types";

// ---------------------------------------------------------------------------
// Register Delete Tools
// ---------------------------------------------------------------------------

export function registerDeleteTools(server: McpServer, ctx: ToolContext): void {
  // ── delete_product ──
  server.tool(
    "delete_product",
    `Delete (archive) a financial product by ID.

BEHAVIOR:
- Product is archived (soft delete), not physically deleted
- Any units linked to this product will retain their product_id reference
- The product can be restored later via update_product(is_archived=false)

USE WHEN:
- User wants to remove a product they no longer use
- Product should no longer appear in active lists`,
    {
      id: z.string().describe("Product ID to delete"),
    },
    async (args) => {
      const { db, userId } = ctx;

      // Check if product exists
      const product = await db.firstOrNull<{ id: string; name: string; is_archived: number }>(
        "SELECT id, name, is_archived FROM financial_products WHERE id = ? AND user_id = ?",
        [args.id, userId],
      );

      if (!product) {
        return error(`Product not found: ${args.id}`);
      }

      if (product.is_archived === 1) {
        return error(`Product is already archived: ${args.id}`);
      }

      // Archive the product (soft delete)
      await db.execute(
        "UPDATE financial_products SET is_archived = 1, updated_at = ? WHERE id = ? AND user_id = ?",
        [new Date().toISOString(), args.id, userId],
      );

      return ok({
        success: true,
        message: `Product '${product.name}' has been archived`,
        product_id: args.id,
      });
    },
  );

  // ── delete_unit ──
  server.tool(
    "delete_unit",
    `Delete a capital unit by ID.

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
    {
      id: z.string().describe("Unit ID to delete"),
      force: z
        .boolean()
        .optional()
        .describe("Force delete even if contribution logs exist (default: false)"),
    },
    async (args) => {
      const { db, userId } = ctx;

      // Check if unit exists
      const unit = await db.firstOrNull<{ id: string; unit_code: string }>(
        "SELECT id, unit_code FROM capital_units WHERE id = ? AND user_id = ?",
        [args.id, userId],
      );

      if (!unit) {
        return error(`Unit not found: ${args.id}`);
      }

      // Check for contribution logs
      const logsResult = await db.firstOrNull<{ count: number }>(
        "SELECT COUNT(*) as count FROM contribution_logs WHERE unit_id = ?",
        [args.id],
      );

      const logCount = logsResult?.count ?? 0;

      if (logCount > 0 && !args.force) {
        return error(
          `Cannot delete unit '${unit.unit_code}' - it has ${logCount} contribution log(s). ` +
            `Use force=true to delete anyway (logs will be orphaned).`,
        );
      }

      // Delete the unit
      await db.execute("DELETE FROM capital_units WHERE id = ? AND user_id = ?", [args.id, userId]);

      return ok({
        success: true,
        message: `Unit '${unit.unit_code}' has been deleted`,
        unit_id: args.id,
        orphaned_logs: logCount,
      });
    },
  );
}
