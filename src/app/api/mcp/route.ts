/**
 * MCP Server Endpoint
 *
 * Handles MCP protocol requests using Streamable HTTP transport.
 * Validates OAuth tokens and dispatches to registered tools.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateMcpToken, validateOrigin } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";
// @modelcontextprotocol/sdk exposes the transport class only via the
// `./server/webStandardStreamableHttp.js` subpath, not a top-level barrel.
// import-x can't see it through the package's exports map; TS resolves fine.
// eslint-disable-next-line import-x/no-unresolved
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const siteUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Step 1: Validate Origin header (DNS rebinding prevention)
  const originError = validateOrigin(request.headers.get("origin"), siteUrl);
  if (originError) {
    return errorResponse(originError.error, originError.status);
  }

  // Step 2: Validate Bearer token
  const db = getDb();
  const authResult = await validateMcpToken(db, request.headers.get("authorization"));
  if (!authResult.valid) {
    return errorResponse(authResult.error, authResult.status);
  }

  // Step 3: Create MCP server and handle request via stateless transport
  const server = createMcpServer(db, authResult.token.user_id);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true, // JSON-only, no SSE — stateless Phase 1
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  }
}

/**
 * GET SSE stream is not supported in stateless mode.
 * Per MCP spec, return 405 so Streamable HTTP clients know to use POST only.
 * Clients must be configured with type "streamable-http" (not "sse").
 */
export function GET() {
  return errorResponse("SSE transport not supported. Use Streamable HTTP (POST).", 405);
}

export function DELETE() {
  return errorResponse("Session termination not supported in stateless mode.", 405);
}
