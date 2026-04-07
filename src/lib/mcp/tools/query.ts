/**
 * MCP Query Tools
 *
 * Tools for querying transactions, transfers, and metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./types";
import { ok } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Filter undefined values from object for SQL params */
function filterDefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** Build WHERE conditions from search params */
function buildWhereConditions(
  params: Record<string, unknown>,
  fieldMappings: Record<string, string>,
): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  for (const [key, dbField] of Object.entries(fieldMappings)) {
    const value = params[key];
    if (value === undefined) continue;

    if (Array.isArray(value) && value.length > 0) {
      const placeholders = value.map(() => "?").join(", ");
      conditions.push(`${dbField} IN (${placeholders})`);
      values.push(...value);
    } else if (typeof value === "string" && key === "keyword") {
      conditions.push(`(note LIKE ? OR category LIKE ? OR secondary_category LIKE ? OR account LIKE ?)`);
      const like = `%${value}%`;
      values.push(like, like, like, like);
    } else if (typeof value === "number" || typeof value === "string") {
      if (key === "start_date") {
        conditions.push(`date >= ?`);
        values.push(value);
      } else if (key === "end_date") {
        conditions.push(`date <= ?`);
        values.push(value);
      } else if (key === "min_amount_cents") {
        conditions.push(`amount_cents >= ?`);
        values.push(value);
      } else if (key === "max_amount_cents") {
        conditions.push(`amount_cents <= ?`);
        values.push(value);
      } else if (key === "year") {
        conditions.push(`strftime('%Y', date) = ?`);
        values.push(String(value));
      } else if (key === "month") {
        conditions.push(`CAST(strftime('%m', date) AS INTEGER) = ?`);
        values.push(value);
      } else {
        conditions.push(`${dbField} = ?`);
        values.push(value);
      }
    }
  }

  return { conditions, values };
}

// ---------------------------------------------------------------------------
// Register Query Tools
// ---------------------------------------------------------------------------

export function registerQueryTools(server: McpServer, ctx: ToolContext): void {
  // ── query_transactions ──
  server.tool(
    "query_transactions",
    `Search and filter personal financial transactions (income and expense records).

IMPORTANT: Call get_summary first to discover available filter values (categories, accounts, currencies, tags, years) before querying. Do not guess parameter values.

All parameters are optional and combine with AND logic — use multiple filters to narrow results progressively. When the user's request is vague, start broad (fewer filters) and refine based on results.

Keyword search is fuzzy and matches across note, all category levels, and account fields.`,
    {
      keyword: z.string().optional().describe("Fuzzy search keyword — matches note, categories, and account"),
      type: z.enum(["income", "expense"]).optional().describe("Filter by transaction type"),
      categories: z.array(z.string()).optional().describe("Filter by primary categories"),
      secondary_categories: z.array(z.string()).optional().describe("Filter by secondary categories"),
      tertiary_categories: z.array(z.string()).optional().describe("Filter by tertiary categories"),
      accounts: z.array(z.string()).optional().describe("Filter by account names"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD) inclusive"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD) inclusive"),
      min_amount: z.number().optional().describe("Minimum transaction amount (inclusive)"),
      max_amount: z.number().optional().describe("Maximum transaction amount (inclusive)"),
      year: z.number().int().optional().describe("Filter by year"),
      month: z.number().int().min(1).max(12).optional().describe("Filter by month (1-12)"),
      currency: z.string().optional().describe("Filter by currency"),
      limit: z.number().int().min(1).max(500).default(50).describe("Max results (default 50, max 500)"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    async (args) => {
      const { db, userId } = ctx;

      const params = filterDefined({
        keyword: args.keyword,
        type: args.type,
        categories: args.categories,
        secondary_categories: args.secondary_categories,
        tertiary_categories: args.tertiary_categories,
        accounts: args.accounts,
        tags: args.tags,
        start_date: args.start_date,
        end_date: args.end_date,
        min_amount_cents: args.min_amount !== undefined ? Math.round(args.min_amount * 100) : undefined,
        max_amount_cents: args.max_amount !== undefined ? Math.round(args.max_amount * 100) : undefined,
        year: args.year,
        month: args.month,
        currency: args.currency,
      });

      const { conditions, values } = buildWhereConditions(params, {
        type: "type",
        categories: "category",
        secondary_categories: "secondary_category",
        tertiary_categories: "tertiary_category",
        accounts: "account",
        currency: "currency",
      });

      // Always filter by user
      conditions.unshift("user_id = ?");
      values.unshift(userId);

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;

      const sql = `
        SELECT id, date, type, amount_cents, currency, account, category,
               secondary_category, tertiary_category, note, tags
        FROM transactions
        ${whereClause}
        ORDER BY date DESC, id DESC
        LIMIT ? OFFSET ?
      `;

      const result = await db.query<{
        id: string;
        date: string;
        type: string;
        amount_cents: number;
        currency: string;
        account: string;
        category: string;
        secondary_category: string | null;
        tertiary_category: string | null;
        note: string | null;
        tags: string | null;
      }>(sql, [...values, limit, offset]);

      // Transform to user-friendly format
      const transactions = result.results.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        amount: t.amount_cents / 100,
        currency: t.currency,
        account: t.account,
        category: t.category,
        secondary_category: t.secondary_category,
        tertiary_category: t.tertiary_category,
        note: t.note,
        tags: t.tags ? JSON.parse(t.tags) : [],
      }));

      return ok({ transactions, count: transactions.length, limit, offset });
    },
  );

  // ── query_transfers ──
  server.tool(
    "query_transfers",
    `Search and filter internal transfers (account-to-account movements, not income/expense).

IMPORTANT: Call get_summary first to discover available filter values before querying.

All parameters are optional and combine with AND logic.`,
    {
      keyword: z.string().optional().describe("Fuzzy search keyword"),
      accounts: z.array(z.string()).optional().describe("Filter by account names (matches from or to)"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD) inclusive"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD) inclusive"),
      min_amount: z.number().optional().describe("Minimum amount (inclusive)"),
      max_amount: z.number().optional().describe("Maximum amount (inclusive)"),
      year: z.number().int().optional().describe("Filter by year"),
      month: z.number().int().min(1).max(12).optional().describe("Filter by month (1-12)"),
      currency: z.string().optional().describe("Filter by currency"),
      limit: z.number().int().min(1).max(500).default(50).describe("Max results"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    async (args) => {
      const { db, userId } = ctx;

      const conditions: string[] = ["user_id = ?"];
      const values: unknown[] = [userId];

      if (args.keyword) {
        conditions.push(`(note LIKE ? OR from_account LIKE ? OR to_account LIKE ?)`);
        const like = `%${args.keyword}%`;
        values.push(like, like, like);
      }

      if (args.accounts && args.accounts.length > 0) {
        const placeholders = args.accounts.map(() => "?").join(", ");
        conditions.push(`(from_account IN (${placeholders}) OR to_account IN (${placeholders}))`);
        values.push(...args.accounts, ...args.accounts);
      }

      if (args.start_date) {
        conditions.push(`date >= ?`);
        values.push(args.start_date);
      }

      if (args.end_date) {
        conditions.push(`date <= ?`);
        values.push(args.end_date);
      }

      if (args.min_amount !== undefined) {
        conditions.push(`amount_cents >= ?`);
        values.push(Math.round(args.min_amount * 100));
      }

      if (args.max_amount !== undefined) {
        conditions.push(`amount_cents <= ?`);
        values.push(Math.round(args.max_amount * 100));
      }

      if (args.year !== undefined) {
        conditions.push(`strftime('%Y', date) = ?`);
        values.push(String(args.year));
      }

      if (args.month !== undefined) {
        conditions.push(`CAST(strftime('%m', date) AS INTEGER) = ?`);
        values.push(args.month);
      }

      if (args.currency) {
        conditions.push(`currency = ?`);
        values.push(args.currency);
      }

      const whereClause = `WHERE ${conditions.join(" AND ")}`;
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;

      const sql = `
        SELECT id, date, amount_cents, currency, from_account, to_account, note, tags
        FROM transfers
        ${whereClause}
        ORDER BY date DESC, id DESC
        LIMIT ? OFFSET ?
      `;

      const result = await db.query<{
        id: string;
        date: string;
        amount_cents: number;
        currency: string;
        from_account: string;
        to_account: string;
        note: string | null;
        tags: string | null;
      }>(sql, [...values, limit, offset]);

      const transfers = result.results.map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount_cents / 100,
        currency: t.currency,
        from_account: t.from_account,
        to_account: t.to_account,
        note: t.note,
        tags: t.tags ? JSON.parse(t.tags) : [],
      }));

      return ok({ transfers, count: transfers.length, limit, offset });
    },
  );

  // ── get_summary ──
  server.tool(
    "get_summary",
    `Get metadata summary of the user's financial data. Returns all available filter values and record counts.

ALWAYS call this tool first before using query_transactions or query_transfers.`,
    {},
    async () => {
      const { db, userId } = ctx;

      // Get years
      const yearsResult = await db.query<{ year: string }>(
        `SELECT DISTINCT strftime('%Y', date) as year FROM transactions WHERE user_id = ? ORDER BY year DESC`,
        [userId],
      );

      // Get accounts
      const accountsResult = await db.query<{ account: string }>(
        `SELECT DISTINCT account FROM transactions WHERE user_id = ? ORDER BY account`,
        [userId],
      );

      // Get categories
      const categoriesResult = await db.query<{ category: string }>(
        `SELECT DISTINCT category FROM transactions WHERE user_id = ? ORDER BY category`,
        [userId],
      );

      // Get currencies
      const currenciesResult = await db.query<{ currency: string }>(
        `SELECT DISTINCT currency FROM transactions WHERE user_id = ? ORDER BY currency`,
        [userId],
      );

      // Get counts
      const countResult = await db.firstOrNull<{
        transaction_count: number;
        transfer_count: number;
      }>(
        `SELECT
          (SELECT COUNT(*) FROM transactions WHERE user_id = ?) as transaction_count,
          (SELECT COUNT(*) FROM transfers WHERE user_id = ?) as transfer_count`,
        [userId, userId],
      );

      return ok({
        years: yearsResult.results.map((r) => parseInt(r.year)),
        accounts: accountsResult.results.map((r) => r.account),
        categories: categoriesResult.results.map((r) => r.category),
        currencies: currenciesResult.results.map((r) => r.currency),
        transaction_count: countResult?.transaction_count ?? 0,
        transfer_count: countResult?.transfer_count ?? 0,
      });
    },
  );

  // ── get_monthly_report ──
  server.tool(
    "get_monthly_report",
    `Get aggregated financial report for a specific month. Returns income/expense totals, net amount, and category breakdowns.

Use year/month for the target period. Call get_summary first to discover available years.`,
    {
      year: z.number().int().describe("Year to report on (required)"),
      month: z.number().int().min(1).max(12).describe("Month to report on (1-12, required)"),
      currency: z.string().optional().describe("Optional currency filter"),
    },
    async (args) => {
      const { db, userId } = ctx;
      const { year, month, currency } = args;

      // Build date range
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      const currencyCondition = currency ? " AND currency = ?" : "";
      const currencyParams = currency ? [currency] : [];

      // Get totals
      const totalsResult = await db.firstOrNull<{
        income: number;
        expense: number;
      }>(
        `SELECT
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) as expense
        FROM transactions
        WHERE user_id = ? AND date >= ? AND date < ?${currencyCondition}`,
        [userId, startDate, endDate, ...currencyParams],
      );

      // Get category breakdown
      const categoryResult = await db.query<{
        type: string;
        category: string;
        total: number;
      }>(
        `SELECT type, category, SUM(amount_cents) as total
        FROM transactions
        WHERE user_id = ? AND date >= ? AND date < ?${currencyCondition}
        GROUP BY type, category
        ORDER BY total DESC`,
        [userId, startDate, endDate, ...currencyParams],
      );

      const income = (totalsResult?.income ?? 0) / 100;
      const expense = (totalsResult?.expense ?? 0) / 100;

      return ok({
        year,
        month,
        currency: currency ?? "all",
        income,
        expense,
        net: income - expense,
        categories: categoryResult.results.map((r) => ({
          type: r.type,
          category: r.category,
          amount: r.total / 100,
        })),
      });
    },
  );
}
