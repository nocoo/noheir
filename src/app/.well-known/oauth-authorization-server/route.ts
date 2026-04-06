import { NextResponse } from "next/server";

/**
 * OAuth 2.1 Authorization Server Metadata (RFC 8414)
 *
 * This endpoint returns the OAuth metadata for MCP clients to discover
 * authorization endpoints. All endpoints are on the main domain, proxied
 * to the Worker internally.
 *
 * NOTE: This route must NOT be protected by authentication.
 */
export async function GET() {
  // Use site URL - all OAuth endpoints are proxied through the main domain
  const siteUrl = process.env.NEXTAUTH_URL || "https://noheir.hexly.ai";

  const metadata = {
    issuer: siteUrl,
    authorization_endpoint: `${siteUrl}/api/mcp/authorize`,
    token_endpoint: `${siteUrl}/api/mcp/token`,
    registration_endpoint: `${siteUrl}/api/mcp/register`,
    revocation_endpoint: `${siteUrl}/api/mcp/revoke`,
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
