// ---------------------------------------------------------------------------
// MCP Server — entity-driven tool registration for noheir
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { APP_VERSION } from "@/lib/version";
import type { Db } from "@/lib/db";
import { registerQueryTools } from "./tools";

/** Create a new McpServer instance with all tools registered. */
export function createMcpServer(db: Db, userId: string): McpServer {
  const server = new McpServer({ name: "noheir", version: APP_VERSION });

  // Context for all tools
  const ctx = { db, userId };

  // Phase 1: Query Tools
  registerQueryTools(server, ctx);

  // TODO: Phase 2 - Product CRUD
  // TODO: Phase 3 - Unit CRUD
  // TODO: Phase 4 - Custom Tools (delete_product, delete_unit)
  // TODO: Phase 5 - Summary Tools

  return server;
}
