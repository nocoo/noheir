/**
 * MCP Client Test Helper
 *
 * Provides mcpCall() to make JSON-RPC calls to the MCP endpoint.
 */

import { BASE_URL } from "./client";

// ============================================================================
// Types
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse;

export interface McpToolResult<T = unknown> {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
  _parsed?: T;
}

export interface McpListToolsResult {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isErrorResponse(res: JsonRpcResponse): res is JsonRpcErrorResponse {
  return "error" in res;
}

/**
 * Parse the text content from MCP tool result as JSON.
 */
export function parseToolResult<T>(result: McpToolResult): T {
  if (result.content.length === 0) {
    throw new Error("Empty tool result");
  }

  const text = result.content[0].text;
  return JSON.parse(text) as T;
}

// ============================================================================
// Request ID Generator
// ============================================================================

let requestId = 0;
function nextRequestId(): number {
  return ++requestId;
}

// ============================================================================
// Main Exports
// ============================================================================

/**
 * Make a raw JSON-RPC request to the MCP endpoint.
 */
export async function mcpRequest<T>(
  token: string,
  method: string,
  params?: Record<string, unknown>
): Promise<JsonRpcResponse<T>> {
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method,
    params,
  };

  const res = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "X-Target-DB": "test",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP request failed: ${res.status} ${text}`);
  }

  return (await res.json()) as JsonRpcResponse<T>;
}

/**
 * Call an MCP tool and return the result.
 *
 * @param token - OAuth access token
 * @param toolName - Name of the tool to call
 * @param args - Tool arguments
 * @returns Tool result with parsed content
 * @throws Error if the call fails or returns an error
 */
export async function mcpCall<T = unknown>(
  token: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<McpToolResult<T>> {
  const response = await mcpRequest<McpToolResult>(token, "tools/call", {
    name: toolName,
    arguments: args,
  });

  if (isErrorResponse(response)) {
    throw new Error(`MCP tool call error: ${response.error.message}`);
  }

  const result = response.result;

  // Parse the text content as JSON for convenience
  if (result.content.length > 0 && result.content[0].type === "text") {
    try {
      result._parsed = JSON.parse(result.content[0].text);
    } catch {
      // Not JSON, leave as-is
    }
  }

  return result as McpToolResult<T>;
}

/**
 * List all available MCP tools.
 */
export async function mcpListTools(
  token: string
): Promise<McpListToolsResult> {
  const response = await mcpRequest<McpListToolsResult>(token, "tools/list");

  if (isErrorResponse(response)) {
    throw new Error(`MCP tools/list error: ${response.error.message}`);
  }

  return response.result;
}

/**
 * Initialize the MCP session.
 */
export async function mcpInitialize(token: string): Promise<void> {
  const response = await mcpRequest(token, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "e2e-test", version: "1.0.0" },
  });

  if (isErrorResponse(response)) {
    throw new Error(`MCP initialize error: ${response.error.message}`);
  }
}
