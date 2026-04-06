/**
 * MCP Query Tools
 *
 * Extra tools for querying transactions, transfers, and metadata.
 */

import { registerCustomTool, ok } from "@nocoo/base-mcp";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AllRepos } from "../../../db/repositories";
import type { TransactionSearchParams } from "../../../db/repositories/transactions";
import type { TransferSearchParams } from "../../../db/repositories/transfers";

// ============================================================================
// Types
// ============================================================================

export interface QueryToolsRepos {
  transactions: AllRepos["transactions"];
  transfers: AllRepos["transfers"];
  metadata: AllRepos["metadata"];
  reports: AllRepos["reports"];
  userId: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Filter out undefined values from an object to satisfy exactOptionalPropertyTypes.
 */
function filterUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

// ============================================================================
// Register Query Tools
// ============================================================================

export function registerQueryTools(
  server: McpServer,
  ctx: { repos: QueryToolsRepos }
) {
  // ── query_transactions ──
  registerCustomTool(
    server,
    {
      name: "query_transactions",
      description: `Search and filter personal financial transactions (income and expense records).

IMPORTANT: Call get_summary first to discover available filter values (categories, accounts, currencies, tags, years) before querying. Do not guess parameter values.

All parameters are optional and combine with AND logic — use multiple filters to narrow results progressively. When the user's request is vague, start broad (fewer filters) and refine based on results.

Keyword search is fuzzy and matches across note, all 3 category levels, and account fields.`,
      schema: z.object({
        keyword: z.string().optional().describe("Fuzzy search keyword — matches note, all category levels, and account name"),
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
      }),
      handler: async ({ repos }, args) => {
        const rawParams = {
          keyword: args.keyword as string | undefined,
          type: args.type as string | undefined,
          categories: args.categories as string[] | undefined,
          secondary_categories: args.secondary_categories as string[] | undefined,
          tertiary_categories: args.tertiary_categories as string[] | undefined,
          accounts: args.accounts as string[] | undefined,
          tags: args.tags as string[] | undefined,
          start_date: args.start_date as string | undefined,
          end_date: args.end_date as string | undefined,
          min_amount_cents: args.min_amount !== undefined ? Math.round((args.min_amount as number) * 100) : undefined,
          max_amount_cents: args.max_amount !== undefined ? Math.round((args.max_amount as number) * 100) : undefined,
          year: args.year as number | undefined,
          month: args.month as number | undefined,
          currency: args.currency as string | undefined,
          limit: (args.limit as number) ?? 50,
          offset: (args.offset as number) ?? 0,
        };

        const searchParams = filterUndefined(rawParams) as TransactionSearchParams;
        const result = await repos.transactions.search(repos.userId, searchParams);
        return ok(result);
      },
    },
    ctx
  );

  // ── query_transfers ──
  registerCustomTool(
    server,
    {
      name: "query_transfers",
      description: `Search and filter personal transfers (internal account-to-account movements, not income/expense).

IMPORTANT: Call get_summary first to discover available filter values before querying.

All parameters are optional and combine with AND logic.`,
      schema: z.object({
        keyword: z.string().optional().describe("Fuzzy search keyword"),
        accounts: z.array(z.string()).optional().describe("Filter by account names"),
        transaction_type: z.string().optional().describe("Filter by transfer direction"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
        start_date: z.string().optional().describe("Start date (YYYY-MM-DD) inclusive"),
        end_date: z.string().optional().describe("End date (YYYY-MM-DD) inclusive"),
        min_amount: z.number().optional().describe("Minimum amount (inclusive)"),
        max_amount: z.number().optional().describe("Maximum amount (inclusive)"),
        year: z.number().int().optional().describe("Filter by year"),
        month: z.number().int().min(1).max(12).optional().describe("Filter by month (1-12)"),
        currency: z.string().optional().describe("Filter by currency"),
        limit: z.number().int().min(1).max(500).default(50).describe("Max results"),
        offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      }),
      handler: async ({ repos }, args) => {
        const rawParams = {
          keyword: args.keyword as string | undefined,
          accounts: args.accounts as string[] | undefined,
          transaction_type: args.transaction_type as string | undefined,
          tags: args.tags as string[] | undefined,
          start_date: args.start_date as string | undefined,
          end_date: args.end_date as string | undefined,
          min_amount_cents: args.min_amount !== undefined ? Math.round((args.min_amount as number) * 100) : undefined,
          max_amount_cents: args.max_amount !== undefined ? Math.round((args.max_amount as number) * 100) : undefined,
          year: args.year as number | undefined,
          month: args.month as number | undefined,
          currency: args.currency as string | undefined,
          limit: (args.limit as number) ?? 50,
          offset: (args.offset as number) ?? 0,
        };

        const searchParams = filterUndefined(rawParams) as TransferSearchParams;
        const result = await repos.transfers.search(repos.userId, searchParams);
        return ok(result);
      },
    },
    ctx
  );

  // ── get_summary ──
  registerCustomTool(
    server,
    {
      name: "get_summary",
      description: `Get metadata summary of the user's financial data. Returns all available filter values and record counts.

ALWAYS call this tool first before using query_transactions or query_transfers.`,
      schema: z.object({}),
      handler: async ({ repos }) => {
        const result = await repos.metadata.getAll(repos.userId);
        return ok(result);
      },
    },
    ctx
  );

  // ── get_monthly_report ──
  registerCustomTool(
    server,
    {
      name: "get_monthly_report",
      description: `Get aggregated financial report for a specific month. Returns income/expense totals, net amount, transfer flows, and category breakdowns.

Use year/month for the target period. Call get_summary first to discover available years.`,
      schema: z.object({
        year: z.number().int().describe("Year to report on (required)"),
        month: z.number().int().min(1).max(12).describe("Month to report on (1-12, required)"),
        currency: z.string().optional().describe("Optional currency filter"),
      }),
      handler: async ({ repos }, args) => {
        const result = await repos.reports.monthly(
          repos.userId,
          args.year as number,
          args.month as number,
          args.currency as string | undefined
        );
        return ok(result);
      },
    },
    ctx
  );
}
