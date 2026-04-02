/**
 * NoHeir MCP Server v2 — D1/Worker backend
 *
 * Exposes the user's financial data as MCP tools via stdio transport.
 * All data access goes through the Cloudflare Worker API.
 *
 * Auth: WORKER_URL + WORKER_TOKEN + USER_ID env vars.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { WorkerClient } from "./worker-client.js"

function getEnvConfig() {
  const workerUrl = process.env.WORKER_URL
  const workerToken = process.env.WORKER_TOKEN
  const userId = process.env.USER_ID

  if (!workerUrl) throw new Error("WORKER_URL env var is required")
  if (!workerToken) throw new Error("WORKER_TOKEN env var is required")
  if (!userId) throw new Error("USER_ID env var is required")

  return { workerUrl, workerToken, userId }
}

async function main() {
  const config = getEnvConfig()
  const client = new WorkerClient(config.workerUrl, config.workerToken, config.userId)

  const server = new McpServer({
    name: "noheir",
    version: "2.0.0",
  })

  // ── query_transactions ──────────────────────────────────────────────────────
  server.tool(
    "query_transactions",
    `Search and filter personal financial transactions (income and expense records).

IMPORTANT: Call get_summary first to discover available filter values (categories, accounts, currencies, tags, years) before querying. Do not guess parameter values.

All parameters are optional and combine with AND logic — use multiple filters to narrow results progressively. When the user's request is vague, start broad (fewer filters) and refine based on results.

Keyword search is fuzzy (ILIKE) and matches across note, all 3 category levels, and account fields. The response includes a matched_field indicator ('note', 'category', 'secondary_category', 'tertiary_category', or 'account') showing which field the keyword matched.

Use year/month for period-based queries (e.g. "2025年6月"). Use start_date/end_date for arbitrary date ranges. Avoid combining both — they are redundant.`,
    {
      keyword: z.string().optional().describe("Fuzzy search keyword — matches note, all category levels, and account name"),
      type: z.enum(["income", "expense"]).optional().describe("Filter by transaction type"),
      categories: z.array(z.string()).optional().describe("Filter by primary categories. Get valid values from get_summary().categories"),
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
    async (params) => {
      // Convert decimal amounts to cents for backend
      const searchParams = {
        ...params,
        min_amount_cents: params.min_amount !== undefined ? Math.round(params.min_amount * 100) : undefined,
        max_amount_cents: params.max_amount !== undefined ? Math.round(params.max_amount * 100) : undefined,
      }
      // Remove original decimal params to avoid confusion
      delete (searchParams as Record<string, unknown>).min_amount
      delete (searchParams as Record<string, unknown>).max_amount

      const result = await client.searchTransactions(searchParams)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── query_transfers ─────────────────────────────────────────────────────────
  server.tool(
    "query_transfers",
    `Search and filter personal transfers (internal account-to-account movements, not income/expense).

IMPORTANT: Call get_summary first to discover available filter values before querying.

All parameters are optional and combine with AND logic.`,
    {
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
    },
    async (params) => {
      // Convert decimal amounts to cents for backend
      const searchParams = {
        ...params,
        min_amount_cents: params.min_amount !== undefined ? Math.round(params.min_amount * 100) : undefined,
        max_amount_cents: params.max_amount !== undefined ? Math.round(params.max_amount * 100) : undefined,
      }
      // Remove original decimal params to avoid confusion
      delete (searchParams as Record<string, unknown>).min_amount
      delete (searchParams as Record<string, unknown>).max_amount

      const result = await client.searchTransfers(searchParams)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── get_summary ─────────────────────────────────────────────────────────────
  server.tool(
    "get_summary",
    `Get metadata summary of the user's financial data. Returns all available filter values and record counts.

ALWAYS call this tool first before using query_transactions or query_transfers.`,
    {},
    async () => {
      const result = await client.getMetadata()
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── get_monthly_report ──────────────────────────────────────────────────────
  server.tool(
    "get_monthly_report",
    `Get aggregated financial report for a specific month. Returns income/expense totals, net amount, transfer flows, and category breakdowns.

Use year/month for the target period. Call get_summary first to discover available years.`,
    {
      year: z.number().int().describe("Year to report on (required)"),
      month: z.number().int().min(1).max(12).describe("Month to report on (1-12, required)"),
      currency: z.string().optional().describe("Optional currency filter"),
    },
    async (params) => {
      const result = await client.getMonthlyReport(params.year, params.month, params.currency)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── list_products ───────────────────────────────────────────────────────────
  server.tool(
    "list_products",
    `List all financial products (理财产品) with optional filters.`,
    {
      channel: z.string().optional().describe("Filter by distribution channel"),
      category: z.string().optional().describe("Filter by product category"),
      currency: z.string().optional().describe("Filter by currency: 'CNY', 'USD', or 'HKD'"),
    },
    async (params) => {
      const result = await client.listProducts({
        channel: params.channel ?? undefined,
        category: params.category ?? undefined,
        currency: params.currency ?? undefined,
      })
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── get_product ─────────────────────────────────────────────────────────────
  server.tool(
    "get_product",
    `Get a single financial product by ID.`,
    {
      id: z.string().uuid().describe("Product UUID"),
    },
    async (params) => {
      const result = await client.getProduct(params.id)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── create_product ──────────────────────────────────────────────────────────
  server.tool(
    "create_product",
    `Create a new financial product.

Required fields: name, channel, category. Optional: code, currency (default CNY), lock_period_days (default 0), annual_return_rate.`,
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
      const result = await client.createProduct(params)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── update_product ──────────────────────────────────────────────────────────
  server.tool(
    "update_product",
    `Update an existing financial product. Only provided fields are updated.`,
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
      const { id, ...data } = params
      const result = await client.updateProduct(id, data)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── delete_product ──────────────────────────────────────────────────────────
  server.tool(
    "delete_product",
    `Delete a financial product by ID. Linked units get product_id set to NULL.`,
    {
      id: z.string().uuid().describe("Product UUID to delete"),
    },
    async (params) => {
      const result = await client.deleteProduct(params.id)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── list_units ──────────────────────────────────────────────────────────────
  server.tool(
    "list_units",
    `List all capital units (资金单元) with optional filters. Set with_products=true to include linked product details.`,
    {
      status: z.string().optional().describe("Filter by unit status"),
      strategy: z.string().optional().describe("Filter by investment strategy"),
      tactics: z.string().optional().describe("Filter by investment tactics"),
      currency: z.string().optional().describe("Filter by currency"),
      with_products: z.boolean().optional().describe("Include linked product details (default: false)"),
    },
    async (params) => {
      const result = await client.listUnits({
        status: params.status ?? undefined,
        strategy: params.strategy ?? undefined,
        tactics: params.tactics ?? undefined,
        currency: params.currency ?? undefined,
        with_products: params.with_products ?? undefined,
      })
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── get_unit ────────────────────────────────────────────────────────────────
  server.tool(
    "get_unit",
    `Get a single capital unit by ID. Set with_product=true to include linked product details.`,
    {
      id: z.string().uuid().describe("Unit UUID"),
      with_product: z.boolean().optional().describe("Include linked product details (default: false)"),
    },
    async (params) => {
      const result = await client.getUnit(params.id, params.with_product)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── create_unit ─────────────────────────────────────────────────────────────
  server.tool(
    "create_unit",
    `Create a new capital unit.

Required fields: unit_code, amount, strategy, tactics. Optional: currency (default CNY), status (default '已成立'), product_id, start_date, end_date, note.`,
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
      const result = await client.createUnit(params)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── update_unit ─────────────────────────────────────────────────────────────
  server.tool(
    "update_unit",
    `Update an existing capital unit. Only provided fields are updated.`,
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
      const { id, ...data } = params
      const result = await client.updateUnit(id, data)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // ── delete_unit ─────────────────────────────────────────────────────────────
  server.tool(
    "delete_unit",
    `Delete a capital unit by ID. The linked financial product (if any) is NOT deleted.`,
    {
      id: z.string().uuid().describe("Unit UUID to delete"),
    },
    async (params) => {
      const result = await client.deleteUnit(params.id)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      }
    },
  )

  // Start
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error("MCP server failed to start:", err)
  process.exit(1)
})
