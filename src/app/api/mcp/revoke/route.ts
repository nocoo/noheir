/**
 * MCP OAuth Token Revocation Endpoint
 *
 * Implements RFC 7009 Token Revocation.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sha256, revokeToken, getValidTokenByHash } from "@/services/mcp-tokens";

function oauthError(error: string, description: string, status = 400): NextResponse {
  return NextResponse.json({ error, error_description: description }, { status });
}

export async function POST(request: Request) {
  try {
    // Parse form-urlencoded body (OAuth spec)
    const body = await request.formData();
    const token = body.get("token") as string | null;

    if (!token) {
      return oauthError("invalid_request", "token is required");
    }

    const db = getDb();
    const tokenHash = await sha256(token);
    const existingToken = await getValidTokenByHash(db, tokenHash);

    if (existingToken) {
      await revokeToken(db, existingToken.id);
    }

    // RFC 7009: always return 200, even if token was invalid or already revoked
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[mcp/revoke] Error:", error);
    return oauthError(
      "server_error",
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
