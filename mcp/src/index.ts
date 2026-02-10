/**
 * NoHeir MCP Server — Entry point
 *
 * Exposes the user's financial data (transactions, transfers, summary)
 * and asset management (products, units) as MCP tools via stdio transport.
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
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct } from "./tools/products";
import { listUnits, getUnit, createUnit, updateUnit, deleteUnit } from "./tools/units";

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

  // ---------------------------------------------------------------------------
  // Tool: list_products
  // ---------------------------------------------------------------------------
  server.tool(
    "list_products",
    `List all financial products (理财产品) with optional filters.

Returns the user's product catalog — investment products available for capital unit deployment. Use this to discover products before creating or updating capital units.

Filter by channel (distribution platform), category (product type), or currency.`,
    {
      channel: z.string().optional().describe("Filter by distribution channel (e.g. '招商银行', '支付宝')"),
      category: z.string().optional().describe("Filter by product category (e.g. '债券基金', '定期存款', '货币基金')"),
      currency: z.string().optional().describe("Filter by currency: 'CNY', 'USD', or 'HKD'"),
    },
    async (params) => {
      const result = await listProducts(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: get_product
  // ---------------------------------------------------------------------------
  server.tool(
    "get_product",
    `Get a single financial product by ID.

Returns full product details including name, code, channel, category, currency, lock period, and annual return rate. Use list_products first to find the product ID.`,
    {
      id: z.string().uuid().describe("Product UUID"),
    },
    async (params) => {
      const result = await getProduct(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: create_product
  // ---------------------------------------------------------------------------
  server.tool(
    "create_product",
    `Create a new financial product.

Required fields: name, channel, category. Optional: code, currency (default CNY), lock_period_days (default 0), annual_return_rate.

Valid channels: '招商银行', '平安银行', '微众银行', '支付宝', '招银香港', '光大永明', '中信建投'.
Valid categories: '养老年金', '储蓄保险', '混债基金', '债券基金', '货币基金', '股票基金', '指数基金', '宽基指数', '私募基金', '定期存款', '理财产品', '现金+'.
Valid currencies: 'CNY', 'USD', 'HKD'.`,
    {
      name: z.string().describe("Product name (required)"),
      code: z.string().optional().describe("Optional product code"),
      channel: z.string().describe("Distribution channel (required)"),
      category: z.string().describe("Product category (required)"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("Currency (default: CNY)"),
      lock_period_days: z.number().int().min(0).optional().describe("Lock period in days (default: 0)"),
      annual_return_rate: z.number().optional().describe("Annual return rate as percentage (e.g. 3.5 for 3.5%)"),
    },
    async (params) => {
      const result = await createProduct(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: update_product
  // ---------------------------------------------------------------------------
  server.tool(
    "update_product",
    `Update an existing financial product. Provide the product ID and any fields to change.

Only provided fields are updated — omitted fields remain unchanged. See create_product for valid enum values.`,
    {
      id: z.string().uuid().describe("Product UUID (required)"),
      name: z.string().optional().describe("Updated product name"),
      code: z.string().optional().describe("Updated product code"),
      channel: z.string().optional().describe("Updated distribution channel"),
      category: z.string().optional().describe("Updated product category"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("Updated currency"),
      lock_period_days: z.number().int().min(0).optional().describe("Updated lock period in days"),
      annual_return_rate: z.number().optional().describe("Updated annual return rate"),
    },
    async (params) => {
      const result = await updateProduct(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: delete_product
  // ---------------------------------------------------------------------------
  server.tool(
    "delete_product",
    `Delete a financial product by ID.

WARNING: If any capital units reference this product, their product_id will be set to NULL (ON DELETE SET NULL). Use list_units with with_products=true to check for linked units before deleting.`,
    {
      id: z.string().uuid().describe("Product UUID to delete"),
    },
    async (params) => {
      const result = await deleteProduct(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: list_units
  // ---------------------------------------------------------------------------
  server.tool(
    "list_units",
    `List all capital units (资金单元) with optional filters.

Capital units represent chunks of capital identified by a code (e.g. "E01"). Each unit has an amount, strategy, tactics, and can be linked to a financial product.

Set with_products=true to include the linked product details in each unit. Filter by status, strategy, tactics, or currency.

Valid statuses: '已成立' (idle), '计划中' (planned), '筹集中' (raising), '已归档' (archived).`,
    {
      status: z.string().optional().describe("Filter by unit status (e.g. '已成立', '已归档')"),
      strategy: z.string().optional().describe("Filter by investment strategy (e.g. '短期理财', '长期理财')"),
      tactics: z.string().optional().describe("Filter by investment tactics (e.g. '债券基金', '定期存款')"),
      currency: z.string().optional().describe("Filter by currency: 'CNY', 'USD', or 'HKD'"),
      with_products: z.boolean().optional().describe("Include linked product details (default: false)"),
    },
    async (params) => {
      const result = await listUnits(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: get_unit
  // ---------------------------------------------------------------------------
  server.tool(
    "get_unit",
    `Get a single capital unit by ID.

Set with_product=true to include the linked financial product details. Use list_units first to find the unit ID.`,
    {
      id: z.string().uuid().describe("Unit UUID"),
      with_product: z.boolean().optional().describe("Include linked product details (default: false)"),
    },
    async (params) => {
      const result = await getUnit(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: create_unit
  // ---------------------------------------------------------------------------
  server.tool(
    "create_unit",
    `Create a new capital unit.

Required fields: unit_code, amount, strategy, tactics. Optional: currency (default CNY), status (default '已成立'), product_id, start_date, end_date, note.

Valid strategies: '远期理财', '美元资产', '36存单', '长期理财', '短期理财', '中期理财', '进攻计划', '麻麻理财'.
Valid tactics: '养老年金', '个人养老金', '定期存款', '理财产品', '现金产品', '债券基金', '偏股基金', '稳健理财', '增额寿险', '货币基金'.
Valid statuses: '已成立', '计划中', '筹集中', '已归档'.`,
    {
      unit_code: z.string().describe("Unit code (required, e.g. 'E01')"),
      amount: z.number().describe("Principal amount (required)"),
      strategy: z.string().describe("Investment strategy (required)"),
      tactics: z.string().describe("Investment tactics (required)"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("Currency (default: CNY)"),
      status: z.string().optional().describe("Unit status (default: '已成立')"),
      product_id: z.string().uuid().optional().describe("Link to a financial product by UUID"),
      start_date: z.string().optional().describe("Investment start date (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("Investment end date (YYYY-MM-DD)"),
      note: z.string().optional().describe("Optional note"),
    },
    async (params) => {
      const result = await createUnit(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: update_unit
  // ---------------------------------------------------------------------------
  server.tool(
    "update_unit",
    `Update an existing capital unit. Provide the unit ID and any fields to change.

Only provided fields are updated — omitted fields remain unchanged. Set product_id, start_date, end_date, or note to null to clear them. See create_unit for valid enum values.`,
    {
      id: z.string().uuid().describe("Unit UUID (required)"),
      unit_code: z.string().optional().describe("Updated unit code"),
      amount: z.number().optional().describe("Updated amount"),
      currency: z.enum(["CNY", "USD", "HKD"]).optional().describe("Updated currency"),
      status: z.string().optional().describe("Updated status"),
      strategy: z.string().optional().describe("Updated strategy"),
      tactics: z.string().optional().describe("Updated tactics"),
      product_id: z.string().uuid().nullable().optional().describe("Link/unlink product (null to clear)"),
      start_date: z.string().nullable().optional().describe("Updated start date (null to clear)"),
      end_date: z.string().nullable().optional().describe("Updated end date (null to clear)"),
      note: z.string().nullable().optional().describe("Updated note (null to clear)"),
    },
    async (params) => {
      const result = await updateUnit(client, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: delete_unit
  // ---------------------------------------------------------------------------
  server.tool(
    "delete_unit",
    `Delete a capital unit by ID.

This permanently removes the unit. The linked financial product (if any) is NOT deleted.`,
    {
      id: z.string().uuid().describe("Unit UUID to delete"),
    },
    async (params) => {
      const result = await deleteUnit(client, params);
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
