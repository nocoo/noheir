import { NextResponse } from "next/server";

/**
 * OAuth 2.1 Authorization Server Metadata (RFC 8414)
 *
 * This endpoint returns the OAuth metadata for MCP clients to discover
 * authorization endpoints. It proxies to the Worker's OAuth metadata
 * with the frontend's URLs for authorization flow.
 *
 * NOTE: This route must NOT be protected by authentication.
 */
export async function GET() {
  // Derive URLs from environment or use production defaults
  const siteUrl = process.env.NEXTAUTH_URL || "https://noheir.hexly.ai";
  const workerUrl = process.env.WORKER_URL || "https://noheir.worker.hexly.ai";

  const metadata = {
    issuer: siteUrl,
    authorization_endpoint: `${workerUrl}/mcp/authorize`,
    token_endpoint: `${workerUrl}/mcp/token`,
    registration_endpoint: `${workerUrl}/mcp/register`,
    revocation_endpoint: `${workerUrl}/mcp/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["noheir:read", "noheir:write"],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
