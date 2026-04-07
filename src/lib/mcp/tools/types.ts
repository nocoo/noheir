/**
 * MCP Tools Types
 *
 * Common types for MCP tool implementations.
 */

import type { Db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Context passed to all tools
// ---------------------------------------------------------------------------

export interface ToolContext {
  db: Db;
  userId: string;
}

// ---------------------------------------------------------------------------
// MCP Tool Result Type (SDK-compatible)
// ---------------------------------------------------------------------------

// The SDK expects index signature for extra properties
export interface McpToolResult {
  [x: string]: unknown;
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Result Builders
// ---------------------------------------------------------------------------

/** Return successful JSON result */
export function ok<T>(data: T): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Return error result */
export function error(message: string): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}
