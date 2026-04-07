import { NextResponse } from "next/server";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * https://datatracker.ietf.org/doc/html/rfc8414
 */
export function GET() {
  const issuer = process.env.NEXTAUTH_URL ?? "http://localhost:7004";

  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/authorize`,
    token_endpoint: `${issuer}/api/mcp/token`,
    registration_endpoint: `${issuer}/api/mcp/register`,
    revocation_endpoint: `${issuer}/api/mcp/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp:full"],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
