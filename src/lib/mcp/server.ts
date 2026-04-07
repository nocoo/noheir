// ---------------------------------------------------------------------------
// MCP Server — entity-driven tool registration for noheir
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { APP_VERSION } from "@/lib/version";
// import type { Db } from "@/lib/db";

// TODO: Import entities and tools when migrating

/** Create a new McpServer instance with all tools registered. */
export function createMcpServer(_db: unknown, _userId: string): McpServer {
  const server = new McpServer({ name: "noheir", version: APP_VERSION });

  // Store context for tools (can be accessed via server.getRequestMeta())
  // For now, we'll pass context directly to handlers

  // TODO: Register entity tools (products, units)
  // registerEntityTools(server, productEntity, { repos: { products, userId } });
  // registerEntityTools(server, unitEntity, { repos: { units, products, contributionLogs, userId } });

  // TODO: Register custom tools (query, summary, delete)
  // registerQueryTools(server, { repos: { transactions, transfers, metadata, reports, userId } });
  // registerSummaryTools(server, { repos: { products, units, contributionLogs, userId } });
  // registerDeleteTools(server, { repos: { products, units, contributionLogs, userId } });

  return server;
}
