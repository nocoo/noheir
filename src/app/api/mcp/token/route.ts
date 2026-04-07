/**
 * MCP OAuth Token Endpoint
 *
 * Handles token exchange:
 * - authorization_code: Exchange code for access/refresh tokens
 * - refresh_token: Refresh access token
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPkceS256 } from "@nocoo/base-mcp/auth";
import { getAuthCodeByCode, consumeAuthCode } from "@/services/mcp-auth-codes";
import { getMcpClientByClientId } from "@/services/mcp-clients";
import {
  generateAccessToken,
  generateRefreshToken,
  sha256,
  createMcpToken,
  revokeTokensByClientAndUser,
  getValidTokenByRefreshHash,
  ACCESS_TOKEN_TTL,
} from "@/services/mcp-tokens";

function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

function oauthError(error: string, description: string): NextResponse {
  return NextResponse.json({ error, error_description: description }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    // Parse form-urlencoded body (OAuth spec)
    const body = await request.formData();
    const grantType = body.get("grant_type") as string | null;

    if (!grantType) {
      return oauthError("invalid_request", "grant_type is required");
    }

    if (grantType === "authorization_code") {
      return handleAuthorizationCode(body);
    }

    if (grantType === "refresh_token") {
      return handleRefreshToken(body);
    }

    return oauthError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
  } catch (error) {
    console.error("[mcp/token] Error:", error);
    return jsonResponse(
      { error: "server_error", error_description: error instanceof Error ? error.message : "Internal server error" },
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// Authorization Code Exchange
// ---------------------------------------------------------------------------

async function handleAuthorizationCode(body: FormData): Promise<NextResponse> {
  const code = body.get("code") as string | null;
  const redirectUri = body.get("redirect_uri") as string | null;
  const clientId = body.get("client_id") as string | null;
  const codeVerifier = body.get("code_verifier") as string | null;

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return oauthError("invalid_request", "Missing required fields: code, redirect_uri, client_id, code_verifier");
  }

  const db = getDb();

  // Step 1: Look up the auth code (valid, unconsumed, not expired)
  const authCode = await getAuthCodeByCode(db, code);
  if (!authCode) {
    return oauthError("invalid_grant", "Authorization code is invalid, expired, or already consumed");
  }

  // Step 2: Validate client_id matches (validate before consuming)
  if (authCode.client_id !== clientId) {
    return oauthError("invalid_grant", "client_id does not match");
  }

  // Step 3: Validate redirect_uri matches
  if (authCode.redirect_uri !== redirectUri) {
    return oauthError("invalid_grant", "redirect_uri does not match");
  }

  // Step 4: Verify PKCE S256
  const pkceValid = await verifyPkceS256(codeVerifier, authCode.code_challenge);
  if (!pkceValid) {
    return oauthError("invalid_grant", "PKCE verification failed");
  }

  // Step 5: Atomically consume the code (only after all checks pass)
  const consumed = await consumeAuthCode(db, code);
  if (!consumed) {
    return oauthError("invalid_grant", "Authorization code already consumed (race condition)");
  }

  // user_id is always set after callback upgrade
  const userId = authCode.user_id ?? "";
  if (!userId) {
    return oauthError("server_error", "Authorization code missing user ID");
  }

  // Step 6: Token rotation — revoke existing tokens for this client
  await revokeTokensByClientAndUser(db, clientId, userId);

  // Step 7: Generate and store new token pair
  return issueTokenPair(db, clientId, userId, authCode.scope);
}

// ---------------------------------------------------------------------------
// Refresh Token Exchange
// ---------------------------------------------------------------------------

async function handleRefreshToken(body: FormData): Promise<NextResponse> {
  const refreshToken = body.get("refresh_token") as string | null;
  const clientId = body.get("client_id") as string | null;

  if (!refreshToken || !clientId) {
    return oauthError("invalid_request", "Missing required fields: refresh_token, client_id");
  }

  const db = getDb();

  // Look up token by refresh hash
  const refreshHash = await sha256(refreshToken);
  const existingToken = await getValidTokenByRefreshHash(db, refreshHash);
  if (!existingToken) {
    return oauthError("invalid_grant", "Refresh token is invalid, expired, or revoked");
  }

  // Verify client_id matches
  if (existingToken.client_id !== clientId) {
    return oauthError("invalid_grant", "client_id does not match");
  }

  // Token rotation — revoke all tokens for this client
  await revokeTokensByClientAndUser(db, clientId, existingToken.user_id);

  // Issue new token pair
  return issueTokenPair(db, clientId, existingToken.user_id, existingToken.scope, existingToken.client_name);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function issueTokenPair(
  db: ReturnType<typeof getDb>,
  clientId: string,
  userId: string,
  scope: string,
  clientName?: string | null,
): Promise<NextResponse> {
  const accessToken = generateAccessToken();
  const refreshToken = generateRefreshToken();
  const accessHash = await sha256(accessToken);
  const refreshHash = await sha256(refreshToken);

  // Look up client name if not provided
  let resolvedClientName = clientName;
  if (!resolvedClientName) {
    const client = await getMcpClientByClientId(db, clientId);
    resolvedClientName = client?.client_name;
  }

  await createMcpToken(db, {
    access_token_hash: accessHash,
    access_token_preview: accessToken.slice(0, 16),
    refresh_token_hash: refreshHash,
    client_id: clientId,
    user_id: userId,
    scope,
    ...(resolvedClientName ? { client_name: resolvedClientName } : {}),
  });

  return jsonResponse({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refreshToken,
    scope,
  });
}
