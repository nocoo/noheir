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
    "Search and filter personal transactions (income/expense). Supports keyword search, primary/secondary/tertiary category filters, account/tag filters, amount range, date range, year/month, and currency filters.",
    {
      keyword: z.string().optional().describe("Fuzzy search keyword — matches note, category, account"),
      type: z.enum(["income", "expense"]).optional().describe("Transaction type filter"),
      categories: z.array(z.string()).optional().describe("Filter by primary categories"),
      secondary_categories: z.array(z.string()).optional().describe("Filter by secondary categories"),
      tertiary_categories: z.array(z.string()).optional().describe("Filter by tertiary categories"),
      accounts: z.array(z.string()).optional().describe("Filter by accounts"),
      tags: z.array(z.string()).optional().describe("Filter by tags (any match)"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD) inclusive"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD) inclusive"),
      min_amount: z.number().optional().describe("Minimum amount"),
      max_amount: z.number().optional().describe("Maximum amount"),
      year: z.number().int().optional().describe("Filter by year"),
      month: z.number().int().min(1).max(12).optional().describe("Filter by month (1-12)"),
      currency: z.string().optional().describe("Filter by currency (e.g. 人民币, 美元, 港币)"),
      limit: z.number().int().min(1).max(500).default(50).describe("Max results (default 50, max 500)"),
      offset: z.number().int().min(0).default(0).describe("Offset for pagination"),
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
    "Search and filter personal transfers (internal account-to-account movements). Supports keyword search, account/tag/transaction_type filters, amount range, date range, year/month, and currency filters.",
    {
      keyword: z.string().optional().describe("Fuzzy search keyword — matches note, category, account"),
      accounts: z.array(z.string()).optional().describe("Filter by accounts"),
      transaction_type: z.string().optional().describe("Filter by transaction type (e.g. 转入, 转出)"),
      tags: z.array(z.string()).optional().describe("Filter by tags (any match)"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD) inclusive"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD) inclusive"),
      min_amount: z.number().optional().describe("Minimum amount (matches GREATEST of inflow/outflow)"),
      max_amount: z.number().optional().describe("Maximum amount (matches GREATEST of inflow/outflow)"),
      year: z.number().int().optional().describe("Filter by year"),
      month: z.number().int().min(1).max(12).optional().describe("Filter by month (1-12)"),
      currency: z.string().optional().describe("Filter by currency (e.g. 人民币, 美元, 港币)"),
      limit: z.number().int().min(1).max(500).default(50).describe("Max results (default 50, max 500)"),
      offset: z.number().int().min(0).default(0).describe("Offset for pagination"),
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
    "Get metadata summary of the user's financial data: available years, accounts, categories, currencies, tags, and record counts. Useful for understanding what data is available before querying.",
    {},
    async () => {
      const result = await getSummary(client);
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
