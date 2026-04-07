/**
 * MCP Unit Tools
 *
 * CRUD operations for capital units (理财单元).
 * Includes availability enrichment based on product lock periods.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./types";
import { ok, error } from "./types";
import { ulid } from "ulid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Unit {
  id: string;
  unit_code: string;
  amount_cents: number;
  currency: string;
  status: string;
  strategy: string | null;
  tactics: string | null;
  product_id: string | null;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface UnitWithProduct extends Unit {
  product_name: string | null;
  product_lock_period_days: number | null;
}

interface ContributionLog {
  id: string;
  unit_id: string;
  action: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Availability Enrichment
// ---------------------------------------------------------------------------

interface UnitEnriched {
  id: string;
  unit_code: string;
  amount: number;
  currency: string;
  status: string;
  strategy: string | null;
  tactics: string | null;
  product_id: string | null;
  product_name: string | null;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  days_to_available: number | null;
  availability_status: "available" | "locked" | "unknown";
}

function enrichWithAvailability(
  unit: UnitWithProduct,
  latestInvestLog: ContributionLog | null,
): UnitEnriched {
  let daysToAvailable: number | null = null;
  let availabilityStatus: "available" | "locked" | "unknown" = "unknown";

  if (unit.product_lock_period_days !== null && latestInvestLog) {
    const investDate = new Date(latestInvestLog.created_at);
    const unlockDate = new Date(investDate);
    unlockDate.setDate(unlockDate.getDate() + unit.product_lock_period_days);

    const now = new Date();
    const diffMs = unlockDate.getTime() - now.getTime();
    daysToAvailable = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysToAvailable <= 0) {
      daysToAvailable = 0;
      availabilityStatus = "available";
    } else {
      availabilityStatus = "locked";
    }
  }

  return {
    id: unit.id,
    unit_code: unit.unit_code,
    amount: unit.amount_cents / 100,
    currency: unit.currency,
    status: unit.status,
    strategy: unit.strategy,
    tactics: unit.tactics,
    product_id: unit.product_id,
    product_name: unit.product_name,
    start_date: unit.start_date,
    end_date: unit.end_date,
    note: unit.note,
    days_to_available: daysToAvailable,
    availability_status: availabilityStatus,
  };
}

// ---------------------------------------------------------------------------
// Register Unit Tools
// ---------------------------------------------------------------------------

export function registerUnitTools(server: McpServer, ctx: ToolContext): void {
  // ── list_units ──
  server.tool(
    "list_units",
    `Get a filtered list of capital units (理财单元).

Each unit includes:
- Basic info: unit_code, amount, currency, status, strategy, tactics
- Product relation: product_id, product_name (if linked)
- Availability: days_to_available, availability_status (based on product lock period)

AVAILABILITY STATUS:
- "available": Funds can be withdrawn now (days_to_available = 0)
- "locked": Funds are still in lock period (days_to_available > 0)
- "unknown": No product linked or no invest log

LIMITATIONS:
- Max 200 results per call; use offset for pagination`,
    {
      status: z.string().optional().describe("Filter by status (e.g., 已成立, 已清算)"),
      strategy: z.string().optional().describe("Filter by strategy (e.g., 远期理财)"),
      tactics: z.string().optional().describe("Filter by tactics (e.g., 定期存款)"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("Filter by currency"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default: 50, max: 200)"),
      offset: z.number().int().min(0).optional().describe("Skip N results for pagination"),
    },
    async (args) => {
      const { db, userId } = ctx;

      const conditions: string[] = ["u.user_id = ?"];
      const values: unknown[] = [userId];

      if (args.status) {
        conditions.push("u.status = ?");
        values.push(args.status);
      }

      if (args.strategy) {
        conditions.push("u.strategy = ?");
        values.push(args.strategy);
      }

      if (args.tactics) {
        conditions.push("u.tactics = ?");
        values.push(args.tactics);
      }

      if (args.currency) {
        conditions.push("u.currency = ?");
        values.push(args.currency);
      }

      const limit = Math.min(args.limit ?? 50, 200);
      const offset = args.offset ?? 0;

      // Query units with products
      const unitsSql = `
        SELECT u.id, u.unit_code, u.amount_cents, u.currency, u.status,
               u.strategy, u.tactics, u.product_id, u.start_date, u.end_date, u.note,
               u.created_at, u.updated_at,
               p.name as product_name, p.lock_period_days as product_lock_period_days
        FROM capital_units u
        LEFT JOIN financial_products p ON u.product_id = p.id
        WHERE ${conditions.join(" AND ")}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const unitsResult = await db.query<UnitWithProduct>(unitsSql, [...values, limit, offset]);
      const units = unitsResult.results;

      if (units.length === 0) {
        return ok({ units: [], count: 0, limit, offset });
      }

      // Get latest invest logs for availability calculation
      const unitIds = units.map((u) => u.id);
      const placeholders = unitIds.map(() => "?").join(", ");

      const logsSql = `
        SELECT cl.id, cl.unit_id, cl.action, cl.created_at
        FROM contribution_logs cl
        INNER JOIN (
          SELECT unit_id, MAX(created_at) as max_created
          FROM contribution_logs
          WHERE unit_id IN (${placeholders}) AND action = 'invest'
          GROUP BY unit_id
        ) latest ON cl.unit_id = latest.unit_id AND cl.created_at = latest.max_created
        WHERE cl.action = 'invest'
      `;

      const logsResult = await db.query<ContributionLog>(logsSql, unitIds);
      const logsMap = new Map(logsResult.results.map((log) => [log.unit_id, log]));

      // Enrich units with availability
      const enrichedUnits = units.map((unit) =>
        enrichWithAvailability(unit, logsMap.get(unit.id) ?? null),
      );

      return ok({ units: enrichedUnits, count: enrichedUnits.length, limit, offset });
    },
  );

  // ── get_unit ──
  server.tool(
    "get_unit",
    "Get a single capital unit by ID with availability info.",
    {
      id: z.string().describe("Unit ID"),
    },
    async (args) => {
      const { db, userId } = ctx;

      const unitSql = `
        SELECT u.id, u.unit_code, u.amount_cents, u.currency, u.status,
               u.strategy, u.tactics, u.product_id, u.start_date, u.end_date, u.note,
               u.created_at, u.updated_at,
               p.name as product_name, p.lock_period_days as product_lock_period_days
        FROM capital_units u
        LEFT JOIN financial_products p ON u.product_id = p.id
        WHERE u.id = ? AND u.user_id = ?
      `;

      const unit = await db.firstOrNull<UnitWithProduct>(unitSql, [args.id, userId]);

      if (!unit) {
        return error(`Unit not found: ${args.id}`);
      }

      // Get latest invest log
      const logSql = `
        SELECT id, unit_id, action, created_at
        FROM contribution_logs
        WHERE unit_id = ? AND action = 'invest'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const log = await db.firstOrNull<ContributionLog>(logSql, [args.id]);

      const enriched = enrichWithAvailability(unit, log);

      return ok({
        ...enriched,
        created_at: unit.created_at,
        updated_at: unit.updated_at,
      });
    },
  );

  // ── create_unit ──
  server.tool(
    "create_unit",
    "Create a new capital unit. Required: unit_code, amount_cents.",
    {
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
    async (args) => {
      const { db, userId } = ctx;

      // Validate product_id if provided
      if (args.product_id) {
        const product = await db.firstOrNull<{ id: string }>(
          "SELECT id FROM financial_products WHERE id = ? AND user_id = ?",
          [args.product_id, userId],
        );
        if (!product) {
          return error(`Product not found: ${args.product_id}`);
        }
      }

      // Validate endDate invariant: status=已归档 requires endDate
      const status = args.status ?? "已成立";
      if (status === "已归档" && !args.end_date) {
        return error("Status '已归档' requires end_date");
      }
      if (status !== "已归档" && args.end_date) {
        return error("Only status '已归档' can have end_date");
      }

      const id = ulid();
      const now = new Date().toISOString();

      await db.execute(
        `INSERT INTO capital_units
           (id, user_id, unit_code, amount_cents, currency, status, strategy, tactics,
            product_id, start_date, end_date, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          args.unit_code,
          args.amount_cents,
          args.currency ?? "CNY",
          status,
          args.strategy ?? null,
          args.tactics ?? null,
          args.product_id ?? null,
          args.start_date ?? null,
          args.end_date ?? null,
          args.note ?? null,
          now,
          now,
        ],
      );

      return ok({
        id,
        unit_code: args.unit_code,
        amount: args.amount_cents / 100,
        currency: args.currency ?? "CNY",
        status,
        strategy: args.strategy ?? null,
        tactics: args.tactics ?? null,
        product_id: args.product_id ?? null,
        start_date: args.start_date ?? null,
        end_date: args.end_date ?? null,
        note: args.note ?? null,
        created_at: now,
        updated_at: now,
      });
    },
  );

  // ── update_unit ──
  server.tool(
    "update_unit",
    "Update an existing capital unit. Only provided fields are updated.",
    {
      id: z.string().describe("Unit ID"),
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
    async (args) => {
      const { db, userId } = ctx;

      // Check unit exists and get current state
      const existing = await db.firstOrNull<Unit>(
        `SELECT id, status, product_id, end_date FROM capital_units WHERE id = ? AND user_id = ?`,
        [args.id, userId],
      );

      if (!existing) {
        return error(`Unit not found: ${args.id}`);
      }

      // Validate product_id if provided
      if (args.product_id !== undefined && args.product_id !== null) {
        const product = await db.firstOrNull<{ id: string }>(
          "SELECT id FROM financial_products WHERE id = ? AND user_id = ?",
          [args.product_id, userId],
        );
        if (!product) {
          return error(`Product not found: ${args.product_id}`);
        }
      }

      // Determine final status and end_date
      const newStatus = args.status !== undefined ? args.status : existing.status;
      const newEndDate = args.end_date !== undefined ? args.end_date : existing.end_date;

      // Validate endDate invariant
      if (newStatus === "已归档" && !newEndDate) {
        return error("Status '已归档' requires end_date");
      }
      if (newStatus !== "已归档" && newEndDate) {
        return error("Only status '已归档' can have end_date");
      }

      // Build update fields
      const updates: string[] = [];
      const values: unknown[] = [];

      if (args.unit_code !== undefined) {
        updates.push("unit_code = ?");
        values.push(args.unit_code);
      }
      if (args.amount_cents !== undefined) {
        updates.push("amount_cents = ?");
        values.push(args.amount_cents);
      }
      if (args.currency !== undefined) {
        updates.push("currency = ?");
        values.push(args.currency);
      }
      if (args.status !== undefined) {
        updates.push("status = ?");
        values.push(args.status);
      }
      if (args.strategy !== undefined) {
        updates.push("strategy = ?");
        values.push(args.strategy);
      }
      if (args.tactics !== undefined) {
        updates.push("tactics = ?");
        values.push(args.tactics);
      }
      if (args.product_id !== undefined) {
        updates.push("product_id = ?");
        values.push(args.product_id);
      }
      if (args.start_date !== undefined) {
        updates.push("start_date = ?");
        values.push(args.start_date);
      }
      if (args.end_date !== undefined) {
        updates.push("end_date = ?");
        values.push(args.end_date);
      }
      if (args.note !== undefined) {
        updates.push("note = ?");
        values.push(args.note);
      }

      if (updates.length === 0) {
        return error("No fields to update");
      }

      updates.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(args.id, userId);

      await db.execute(
        `UPDATE capital_units SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
        values,
      );

      // If product_id changed, log contribution
      if (args.product_id !== undefined && args.product_id !== existing.product_id) {
        const logId = ulid();
        const logNow = new Date().toISOString();

        // Log withdraw from old product (if any)
        if (existing.product_id) {
          await db.execute(
            `INSERT INTO contribution_logs (id, user_id, unit_id, product_id, action, amount_cents, currency, created_at)
             SELECT ?, user_id, id, product_id, 'withdraw', amount_cents, currency, ?
             FROM capital_units WHERE id = ?`,
            [logId, logNow, args.id],
          );
        }

        // Log invest to new product (if any)
        if (args.product_id) {
          const investLogId = ulid();
          await db.execute(
            `INSERT INTO contribution_logs (id, user_id, unit_id, product_id, action, amount_cents, currency, created_at)
             SELECT ?, user_id, id, ?, 'invest', amount_cents, currency, ?
             FROM capital_units WHERE id = ?`,
            [investLogId, args.product_id, logNow, args.id],
          );
        }
      }

      // Fetch updated unit with product
      const unitSql = `
        SELECT u.id, u.unit_code, u.amount_cents, u.currency, u.status,
               u.strategy, u.tactics, u.product_id, u.start_date, u.end_date, u.note,
               u.created_at, u.updated_at,
               p.name as product_name, p.lock_period_days as product_lock_period_days
        FROM capital_units u
        LEFT JOIN financial_products p ON u.product_id = p.id
        WHERE u.id = ? AND u.user_id = ?
      `;

      const unit = await db.firstOrNull<UnitWithProduct>(unitSql, [args.id, userId]);

      if (!unit) {
        return error(`Unit not found after update: ${args.id}`);
      }

      // Get latest invest log
      const logSql = `
        SELECT id, unit_id, action, created_at
        FROM contribution_logs
        WHERE unit_id = ? AND action = 'invest'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const log = await db.firstOrNull<ContributionLog>(logSql, [args.id]);

      const enriched = enrichWithAvailability(unit, log);

      return ok({
        ...enriched,
        created_at: unit.created_at,
        updated_at: unit.updated_at,
      });
    },
  );
}
