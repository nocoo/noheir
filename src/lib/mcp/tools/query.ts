/**
 * MCP Query Tools
 *
 * Tools for querying transactions, transfers, and metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./types";
import { ok, okWithPage } from "./types";
import { compact, shortId, categoryPath, round2, currencyCode } from "./compact";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Filter undefined values from object for SQL params */
export function filterDefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Build WHERE conditions from search params */
export function buildWhereConditions(
  params: Record<string, unknown>,
  fieldMappings: Record<string, string>,
): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  for (const [key, dbField] of Object.entries(fieldMappings)) {
    const value = params[key];
    if (value === undefined) continue;

    if (Array.isArray(value) && value.length > 0) {
      if (key === "tags") {
        // Tags are stored as JSON strings (e.g. '["foo","bar"]').
        // Use LIKE patterns to match any of the requested tags. Covers both
        // normal JSON and double-encoded legacy migrations.
        const tagConditions = value.map(() => `(${dbField} LIKE ? OR ${dbField} LIKE ?)`);
        conditions.push(`(${tagConditions.join(" OR ")})`);
        for (const v of value) {
          values.push(`%"${v}"%`, `%\\"${v}\\"%`);
        }
      } else {
        const placeholders = value.map(() => "?").join(", ");
        conditions.push(`${dbField} IN (${placeholders})`);
        values.push(...value);
      }
    } else if (typeof value === "string" && key === "keyword") {
      conditions.push(
        `(note LIKE ? OR primary_category LIKE ? OR secondary_category LIKE ? OR account LIKE ?)`,
      );
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

WHEN TO USE:
- When searching for specific transactions by category, account, date range, or amount
- After calling get_summary to discover available filter values

DO NOT USE FOR:
- Getting aggregated totals or statistics (use get_summary, get_monthly_report)
- Querying internal transfers (use query_transfers)

LIMITATIONS:
- Max 500 results per call; use offset for pagination
- Call get_summary first to discover valid filter values (categories, accounts, etc.)
- Keyword search matches note, categories, and account fields`,
    {
      keyword: z
        .string()
        .optional()
        .describe("Fuzzy search keyword — matches note, categories, and account"),
      type: z.enum(["income", "expense"]).optional().describe("Filter by transaction type"),
      categories: z.array(z.string()).optional().describe("Filter by primary categories"),
      secondary_categories: z
        .array(z.string())
        .optional()
        .describe("Filter by secondary categories"),
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
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(50)
        .describe("Max results (default 50, max 500)"),
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
        min_amount_cents:
          args.min_amount !== undefined ? Math.round(args.min_amount * 100) : undefined,
        max_amount_cents:
          args.max_amount !== undefined ? Math.round(args.max_amount * 100) : undefined,
        year: args.year,
        month: args.month,
        currency: args.currency,
      });

      const { conditions, values } = buildWhereConditions(params, {
        type: "type",
        categories: "primary_category",
        secondary_categories: "secondary_category",
        tertiary_categories: "tertiary_category",
        accounts: "account",
        tags: "tags",
        currency: "currency",
        // Special fields handled by key-specific logic in buildWhereConditions
        keyword: "",
        start_date: "",
        end_date: "",
        min_amount_cents: "",
        max_amount_cents: "",
        year: "",
        month: "",
      });

      // Always filter by user
      conditions.unshift("user_id = ?");
      values.unshift(userId);

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;

      const sql = `
        SELECT id, date, type, amount_cents, currency, account, primary_category,
               secondary_category, tertiary_category, note, tags
        FROM transactions
        ${whereClause}
        ORDER BY date DESC, id DESC
        LIMIT ? OFFSET ?
      `;

      const [result, countResult] = await Promise.all([
        db.query<{
          id: string;
          date: string;
          type: string;
          amount_cents: number;
          currency: string;
          account: string;
          primary_category: string;
          secondary_category: string | null;
          tertiary_category: string | null;
          note: string | null;
          tags: string | null;
        }>(sql, [...values, limit, offset]),
        db.firstOrNull<{ total: number }>(
          `SELECT COUNT(*) as total FROM transactions ${whereClause}`,
          values,
        ),
      ]);

      const total = countResult?.total ?? 0;

      // Transform to compact format (P0: short ID, P1: omit nulls, P3: category path)
      const transactions = result.results.map((t) =>
        compact({
          id: shortId(t.id),
          date: t.date,
          type: t.type,
          amount: round2(t.amount_cents / 100),
          currency: currencyCode(t.currency),
          account: t.account,
          category: categoryPath(t.primary_category, t.secondary_category, t.tertiary_category),
          note: t.note,
          tags: t.tags ? JSON.parse(t.tags) : null,
        }),
      );

      const hasMore = offset + transactions.length < total;
      const nextArgs: Record<string, unknown> = { offset: offset + limit, limit };
      if (args.keyword) nextArgs.keyword = args.keyword;
      if (args.type) nextArgs.type = args.type;
      if (args.categories) nextArgs.categories = args.categories;
      if (args.secondary_categories) nextArgs.secondary_categories = args.secondary_categories;
      if (args.tertiary_categories) nextArgs.tertiary_categories = args.tertiary_categories;
      if (args.accounts) nextArgs.accounts = args.accounts;
      if (args.tags) nextArgs.tags = args.tags;
      if (args.start_date) nextArgs.start_date = args.start_date;
      if (args.end_date) nextArgs.end_date = args.end_date;
      if (args.min_amount !== undefined) nextArgs.min_amount = args.min_amount;
      if (args.max_amount !== undefined) nextArgs.max_amount = args.max_amount;
      if (args.year !== undefined) nextArgs.year = args.year;
      if (args.month !== undefined) nextArgs.month = args.month;
      if (args.currency) nextArgs.currency = args.currency;

      return okWithPage(
        { transactions },
        { returned: transactions.length, total, limit, offset, has_more: hasMore },
        hasMore
          ? { recommended: "paginate", tool: "query_transactions", args: nextArgs }
          : undefined,
      );
    },
  );

  // ── query_transfers ──
  server.tool(
    "query_transfers",
    `Search and filter internal transfers (account movements).

WHEN TO USE:
- When searching for transfers between accounts
- After calling get_summary to discover available filter values

DO NOT USE FOR:
- Querying income/expense transactions (use query_transactions)
- Getting aggregated totals (use get_summary, get_monthly_report)

LIMITATIONS:
- Max 500 results per call; use offset for pagination
- Call get_summary first to discover valid filter values`,
    {
      keyword: z.string().optional().describe("Fuzzy search keyword"),
      accounts: z.array(z.string()).optional().describe("Filter by account names"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD) inclusive"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD) inclusive"),
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
        conditions.push(`(note LIKE ? OR account LIKE ? OR primary_category LIKE ?)`);
        const like = `%${args.keyword}%`;
        values.push(like, like, like);
      }

      if (args.accounts && args.accounts.length > 0) {
        const placeholders = args.accounts.map(() => "?").join(", ");
        conditions.push(`account IN (${placeholders})`);
        values.push(...args.accounts);
      }

      if (args.start_date) {
        conditions.push(`date >= ?`);
        values.push(args.start_date);
      }

      if (args.end_date) {
        conditions.push(`date <= ?`);
        values.push(args.end_date);
      }

      if (args.year !== undefined) {
        conditions.push(`year = ?`);
        values.push(args.year);
      }

      if (args.month !== undefined) {
        conditions.push(`month = ?`);
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
        SELECT id, date, inflow_amount_cents, outflow_amount_cents, currency,
               account, primary_category, secondary_category, transaction_type, note, tags
        FROM transfers
        ${whereClause}
        ORDER BY date DESC, id DESC
        LIMIT ? OFFSET ?
      `;

      const [result, countResult] = await Promise.all([
        db.query<{
          id: string;
          date: string;
          inflow_amount_cents: number;
          outflow_amount_cents: number;
          currency: string;
          account: string;
          primary_category: string | null;
          secondary_category: string | null;
          transaction_type: string | null;
          note: string | null;
          tags: string | null;
        }>(sql, [...values, limit, offset]),
        db.firstOrNull<{ total: number }>(
          `SELECT COUNT(*) as total FROM transfers ${whereClause}`,
          values,
        ),
      ]);

      const total = countResult?.total ?? 0;

      const transfers = result.results.map((t) =>
        compact({
          id: shortId(t.id),
          date: t.date,
          inflow: t.inflow_amount_cents ? round2(t.inflow_amount_cents / 100) : null,
          outflow: t.outflow_amount_cents ? round2(t.outflow_amount_cents / 100) : null,
          currency: currencyCode(t.currency),
          account: t.account,
          category: categoryPath(t.primary_category, t.secondary_category),
          type: t.transaction_type,
          note: t.note,
          tags: t.tags ? JSON.parse(t.tags) : null,
        }),
      );

      const hasMore = offset + transfers.length < total;
      const nextArgs: Record<string, unknown> = { offset: offset + limit, limit };
      if (args.keyword) nextArgs.keyword = args.keyword;
      if (args.accounts) nextArgs.accounts = args.accounts;
      if (args.start_date) nextArgs.start_date = args.start_date;
      if (args.end_date) nextArgs.end_date = args.end_date;
      if (args.year !== undefined) nextArgs.year = args.year;
      if (args.month !== undefined) nextArgs.month = args.month;
      if (args.currency) nextArgs.currency = args.currency;

      return okWithPage(
        { transfers },
        { returned: transfers.length, total, limit, offset, has_more: hasMore },
        hasMore ? { recommended: "paginate", tool: "query_transfers", args: nextArgs } : undefined,
      );
    },
  );

  // ── get_summary ──
  server.tool(
    "get_summary",
    `Get metadata summary of the user's financial data.

WHEN TO USE:
- Before querying transactions or transfers to discover available filter values
- When you need an overview of data coverage (counts, years, accounts, categories)

DO NOT USE FOR:
- Detailed transaction queries (use query_transactions)
- Monthly financial reports (use get_monthly_report)

RETURNS:
- Transaction and transfer counts
- Optional: available years, accounts, categories, currencies (use 'include' parameter)`,
    {
      include: z
        .array(z.enum(["years", "accounts", "categories", "currencies"]))
        .optional()
        .describe("Optional: which filter options to include (default: none, only counts)"),
    },
    async (args) => {
      const { db, userId } = ctx;
      const include = new Set(args.include ?? []);

      // Always get counts (cheap query)
      const countResult = await db.firstOrNull<{
        transaction_count: number;
        transfer_count: number;
      }>(
        `SELECT
          (SELECT COUNT(*) FROM transactions WHERE user_id = ?) as transaction_count,
          (SELECT COUNT(*) FROM transfers WHERE user_id = ?) as transfer_count`,
        [userId, userId],
      );

      const result: Record<string, unknown> = {
        transaction_count: countResult?.transaction_count ?? 0,
        transfer_count: countResult?.transfer_count ?? 0,
      };

      // Only fetch requested filter options
      if (include.has("years")) {
        const yearsResult = await db.query<{ year: number }>(
          `SELECT DISTINCT year FROM transactions WHERE user_id = ? ORDER BY year DESC`,
          [userId],
        );
        result.years = yearsResult.results.map((r) => r.year);
      }

      if (include.has("accounts")) {
        const accountsResult = await db.query<{ account: string }>(
          `SELECT DISTINCT account FROM transactions WHERE user_id = ? ORDER BY account`,
          [userId],
        );
        result.accounts = accountsResult.results.map((r) => r.account);
      }

      if (include.has("categories")) {
        const categoriesResult = await db.query<{ primary_category: string }>(
          `SELECT DISTINCT primary_category FROM transactions WHERE user_id = ? ORDER BY primary_category`,
          [userId],
        );
        result.categories = categoriesResult.results.map((r) => r.primary_category);
      }

      if (include.has("currencies")) {
        const currenciesResult = await db.query<{ currency: string }>(
          `SELECT DISTINCT currency FROM transactions WHERE user_id = ? ORDER BY currency`,
          [userId],
        );
        result.currencies = currenciesResult.results.map((r) => r.currency);
      }

      return ok(result);
    },
  );

  // ── get_monthly_report ──
  server.tool(
    "get_monthly_report",
    `Get aggregated financial report for a specific month.

WHEN TO USE:
- When you need income/expense totals and category breakdowns for a specific month
- After calling get_summary to discover available years

DO NOT USE FOR:
- Querying individual transactions (use query_transactions)
- Cross-month analysis (use aggregate_transactions)

RETURNS:
- Income/expense totals and net amount
- Category breakdowns
- Currency-specific totals`,
    {
      year: z.number().int().describe("Year to report on (required)"),
      month: z.number().int().min(1).max(12).describe("Month to report on (1-12, required)"),
      currency: z.string().optional().describe("Optional currency filter"),
    },
    async (args) => {
      const { db, userId } = ctx;
      const { year, month, currency } = args;

      const currencyCondition = currency ? " AND currency = ?" : "";
      const currencyParams = currency ? [currency] : [];

      // Get totals using year/month columns
      const totalsResult = await db.firstOrNull<{
        income: number;
        expense: number;
      }>(
        `SELECT
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) as expense
        FROM transactions
        WHERE user_id = ? AND year = ? AND month = ?${currencyCondition}`,
        [userId, year, month, ...currencyParams],
      );

      // Get category breakdown
      const categoryResult = await db.query<{
        type: string;
        primary_category: string;
        total: number;
      }>(
        `SELECT type, primary_category, SUM(amount_cents) as total
        FROM transactions
        WHERE user_id = ? AND year = ? AND month = ?${currencyCondition}
        GROUP BY type, primary_category
        ORDER BY total DESC`,
        [userId, year, month, ...currencyParams],
      );

      const income = round2((totalsResult?.income ?? 0) / 100);
      const expense = round2((totalsResult?.expense ?? 0) / 100);

      return ok({
        year,
        month,
        currency: currency ?? "all",
        income,
        expense,
        net: round2(income - expense),
        categories: categoryResult.results.map((r) => ({
          type: r.type,
          category: r.primary_category,
          amount: round2(r.total / 100),
        })),
      });
    },
  );

  // ── aggregate_transactions ──
  server.tool(
    "aggregate_transactions",
    `Aggregate transactions by specified dimensions. Returns grouped totals.

WHEN TO USE:
- When you need summarized data grouped by category, account, month, or type
- More efficient than fetching raw records when you only need totals

DO NOT USE FOR:
- Getting raw transaction records (use query_transactions)
- Monthly reports with category breakdowns (use get_monthly_report)

LIMITATIONS:
- Max 3 group_by dimensions
- Returns totals only, no individual records`,
    {
      group_by: z
        .array(z.enum(["category", "account", "month", "type"]))
        .min(1)
        .max(3)
        .describe("Dimensions to group by (1-3)"),
      type: z.enum(["income", "expense"]).optional().describe("Filter by type"),
      year: z.number().int().optional().describe("Filter by year"),
      month: z.number().int().min(1).max(12).optional().describe("Filter by month"),
      currency: z.string().optional().describe("Filter by currency"),
    },
    async (args) => {
      const { db, userId } = ctx;

      const conditions: string[] = ["user_id = ?"];
      const values: unknown[] = [userId];

      if (args.type) {
        conditions.push("type = ?");
        values.push(args.type);
      }
      if (args.year) {
        conditions.push("year = ?");
        values.push(args.year);
      }
      if (args.month) {
        conditions.push("month = ?");
        values.push(args.month);
      }
      if (args.currency) {
        conditions.push("currency = ?");
        values.push(args.currency);
      }

      // Map group_by to SQL columns
      const columnMap: Record<string, string> = {
        category: "primary_category",
        account: "account",
        month: "month",
        type: "type",
      };

      const groupCols = args.group_by.map((g) => columnMap[g]);
      const selectCols = groupCols.map((col, i) => `${col} as dim${i + 1}`).join(", ");

      const sql = `
        SELECT ${selectCols}, SUM(amount_cents) as total, COUNT(*) as count
        FROM transactions
        WHERE ${conditions.join(" AND ")}
        GROUP BY ${groupCols.join(", ")}
        ORDER BY total DESC
        LIMIT 100
      `;

      const result = await db.query<Record<string, unknown>>(sql, values);

      // Transform to cleaner output
      const groups = result.results.map((r) => {
        const row: Record<string, unknown> = {};
        args.group_by.forEach((g, i) => {
          row[g] = r[`dim${i + 1}`];
        });
        row.total = round2((r.total as number) / 100);
        row.count = r.count;
        return row;
      });

      return ok({ groups, dimensions: args.group_by });
    },
  );
}
