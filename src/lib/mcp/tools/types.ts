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
// Envelope Metadata Types
// ---------------------------------------------------------------------------

/** Pagination metadata for browse tools */
export interface PageMeta {
  returned: number; // items in this page
  total: number; // total matching items in DB
  limit: number;
  offset: number;
  has_more: boolean; // offset + returned < total
}

/** Completeness indicator for detail/portfolio tools */
export interface CompletenessMeta {
  complete: boolean; // true = this is the full answer
  truncated: boolean; // true = data was cut off (hard cap)
  total?: number; // total available (if applicable)
  returned?: number; // actually returned (if applicable)
}

/** Navigation hint for Agent next-step guidance */
export interface NextHint {
  recommended: "answer" | "paginate" | "narrow" | "related_tool";
  tool?: string; // suggested next tool name
  args?: Record<string, unknown>; // suggested args
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

/**
 * Return successful result with pagination metadata.
 * Merges page/next into the existing top-level payload (no root wrapper).
 */
export function okWithPage<T extends Record<string, unknown>>(
  data: T,
  page: PageMeta,
  next?: NextHint,
): McpToolResult {
  const payload: Record<string, unknown> = { ...data, page };
  if (next) payload.next = next;
  return ok(payload);
}

/**
 * Return successful result with completeness metadata.
 * Merges completeness (and optional next) into the existing top-level payload.
 */
export function okWithCompleteness<T extends Record<string, unknown>>(
  data: T,
  completeness: CompletenessMeta,
  next?: NextHint,
): McpToolResult {
  const payload: Record<string, unknown> = { ...data, completeness };
  if (next) payload.next = next;
  return ok(payload);
}
