/**
 * NoHeir MCP Server — Entry point
 *
 * Exposes the user's financial data (transactions, transfers, summary)
 * as read-only MCP tools via stdio transport.
 *
 * Auth: Supabase refresh token via SUPABASE_REFRESH_TOKEN env var.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAuthConfig, createAuthenticatedSupabaseClient } from "./auth";
import { queryTransactions } from "./tools/queryTransactions";
import { queryTransfers } from "./tools/queryTransfers";
import { getSummary } from "./tools/getSummary";
import { getMonthlyReport } from "./tools/getMonthlyReport";

async function main() {
  // Authenticate
  const config = getAuthConfig();
  const client = await createAuthenticatedSupabaseClient(config);

  // Create MCP server
  const server = new McpServer({
    name: "noheir",
    version: "0.1.0",
  });

  // ---------------------------------------------------------------------------
  // Tool: query_transactions
  // ---------------------------------------------------------------------------
  server.tool(
    "query_transactions",
    `Search and filter personal financial transactions (income and expense records).

IMPORTANT: Call get_summary first to discover available filter values (categories, accounts, currencies, tags, years) before querying. Do not guess parameter values.

All parameters are optional and combine with AND logic — use multiple filters to narrow results progressively. When the user's request is vague, start broad (fewer filters) and refine based on results.

Keyword search is fuzzy (ILIKE) and matches across note, all 3 category levels, and account fields. The response includes a matched_field indicator ('note', 'category', 'secondary_category', 'tertiary_category', or 'account') showing which field the keyword matched.

Use year/month for period-based queries (e.g. "2025年6月"). Use start_date/end_date for arbitrary date ranges. Avoid combining both — they are redundant.`,
    {
      keyword: z.string().optional().describe("Fuzzy search keyword — matches note, all category levels, and account name via case-insensitive substring match"),
      type: z.enum(["income", "expense"]).optional().describe("Filter by transaction type: 'income' for earnings/revenue, 'expense' for spending/costs"),
      categories: z.array(z.string()).optional().describe("Filter by primary categories (e.g. ['餐饮', '交通']). Get valid values from get_summary().categories"),
      secondary_categories: z.array(z.string()).optional().describe("Filter by secondary categories (e.g. ['外卖', '出租车']). Get valid values from get_summary().secondary_categories"),
      tertiary_categories: z.array(z.string()).optional().describe("Filter by tertiary categories (e.g. ['午餐', '分红']). Get valid values from get_summary().tertiary_categories"),
      accounts: z.array(z.string()).optional().describe("Filter by account names (e.g. ['招商银行', '支付宝']). Get valid values from get_summary().accounts"),
      tags: z.array(z.string()).optional().describe("Filter by tags — matches if ANY tag in the array overlaps with the record's tags. Get valid values from get_summary().tags"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD) inclusive. Use for arbitrary date ranges. Prefer year/month for full-period queries"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD) inclusive. Use with start_date for date range filtering"),
      min_amount: z.number().optional().describe("Minimum transaction amount (inclusive)"),
      max_amount: z.number().optional().describe("Maximum transaction amount (inclusive)"),
      year: z.number().int().optional().describe("Filter by year (e.g. 2025). Get valid values from get_summary().years"),
      month: z.number().int().min(1).max(12).optional().describe("Filter by month (1-12). Typically used together with year"),
      currency: z.string().optional().describe("Filter by currency (e.g. '人民币', '美元', '港币'). Get valid values from get_summary().currencies"),
      limit: z.number().int().min(1).max(500).default(50).describe("Max results per request (default 50, max 500). Use with offset for pagination"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset. Use limit + offset to page through large result sets"),
    },
    async (params) => {
      const result = await queryTransactions(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: query_transfers
  // ---------------------------------------------------------------------------
  server.tool(
    "query_transfers",
    `Search and filter personal transfers (internal account-to-account movements, not income/expense).

IMPORTANT: Call get_summary first to discover available filter values before querying. Do not guess parameter values.

All parameters are optional and combine with AND logic. Amount filtering uses the larger of inflow/outflow amounts (GREATEST). Transfers have no primary/secondary/tertiary category filters — use query_transactions for categorized records.`,
    {
      keyword: z.string().optional().describe("Fuzzy search keyword — matches note, category, and account name via case-insensitive substring match"),
      accounts: z.array(z.string()).optional().describe("Filter by account names (e.g. ['招商银行']). Get valid values from get_summary().accounts"),
      transaction_type: z.string().optional().describe("Filter by transfer direction (e.g. '转入' for inbound, '转出' for outbound)"),
      tags: z.array(z.string()).optional().describe("Filter by tags — matches if ANY tag overlaps. Get valid values from get_summary().tags"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD) inclusive. Use for arbitrary date ranges. Prefer year/month for full-period queries"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD) inclusive. Use with start_date for date range filtering"),
      min_amount: z.number().optional().describe("Minimum amount (inclusive). Compared against GREATEST(inflow_amount, outflow_amount)"),
      max_amount: z.number().optional().describe("Maximum amount (inclusive). Compared against GREATEST(inflow_amount, outflow_amount)"),
      year: z.number().int().optional().describe("Filter by year (e.g. 2025). Get valid values from get_summary().years"),
      month: z.number().int().min(1).max(12).optional().describe("Filter by month (1-12). Typically used together with year"),
      currency: z.string().optional().describe("Filter by currency (e.g. '人民币', '港币'). Get valid values from get_summary().currencies"),
      limit: z.number().int().min(1).max(500).default(50).describe("Max results per request (default 50, max 500). Use with offset for pagination"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset. Use limit + offset to page through large result sets"),
    },
    async (params) => {
      const result = await queryTransfers(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: get_summary
  // ---------------------------------------------------------------------------
  server.tool(
    "get_summary",
    `Get metadata summary of the user's financial data. Returns all available filter values and record counts.

ALWAYS call this tool first before using query_transactions or query_transfers. The response tells you:
- years: which years have data (use for year parameter)
- accounts: available account names (use for accounts parameter)
- categories / secondary_categories / tertiary_categories: 3-level category hierarchy (use for category filters in query_transactions)
- currencies: available currencies (use for currency parameter)
- tags: available tags (use for tags parameter)
- transaction_count / transfer_count: total record counts

This ensures you pass valid filter values instead of guessing.`,
    {},
    async () => {
      const result = await getSummary(client);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: get_monthly_report
  // ---------------------------------------------------------------------------
  server.tool(
    "get_monthly_report",
    `Get aggregated financial report for a specific month. Returns income/expense totals, net amount, transfer flows, and category breakdowns.

Use this tool when the user asks about monthly spending, income, or financial overview for a specific period. For example: "2025年6月花了多少钱", "上个月收支情况", "1月各分类支出".

Call get_summary first to discover available years via get_summary().years. The response includes:
- total_income / total_expense / net_amount: aggregated amounts
- expense_by_category / income_by_category: breakdown with category name, total amount, and transaction count (sorted by amount descending)
- transfer_count / total_transfer_in / total_transfer_out: internal transfer summary
- currencies: all currencies involved in this month

Use the optional currency parameter to isolate a single currency when the user has multi-currency data.`,
    {
      year: z.number().int().describe("Year to report on (e.g. 2025). Required. Get valid values from get_summary().years"),
      month: z.number().int().min(1).max(12).describe("Month to report on (1-12). Required"),
      currency: z.string().optional().describe("Optional currency filter (e.g. '人民币'). When omitted, aggregates across all currencies"),
    },
    async (params) => {
      const result = await getMonthlyReport(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // Start serving via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
