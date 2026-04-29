// ---------------------------------------------------------------------------
// MCP Server — entity-driven tool registration for noheir
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { APP_VERSION } from "@/lib/version";
import type { Db } from "@/lib/db";
import {
  registerQueryTools,
  registerProductTools,
  registerUnitTools,
  registerDeleteTools,
  registerSummaryTools,
  registerPortfolioTools,
} from "./tools";

/** Create a new McpServer instance with all tools registered. */
export function createMcpServer(db: Db, userId: string): McpServer {
  const server = new McpServer({ name: "noheir", version: APP_VERSION });

  // Context for all tools
  const ctx = { db, userId };

  // Phase 1: Query Tools
  registerQueryTools(server, ctx);

  // Phase 2: Product CRUD
  registerProductTools(server, ctx);

  // Phase 3: Unit CRUD
  registerUnitTools(server, ctx);

  // Phase 4: Delete Tools
  registerDeleteTools(server, ctx);

  // Phase 5: Summary Tools
  registerSummaryTools(server, ctx);

  // Phase 6: Portfolio Tools
  registerPortfolioTools(server, ctx);

  return server;
}
