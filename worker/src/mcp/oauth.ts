/**
 * MCP OAuth 2.1 Endpoints
 *
 * Implements:
 * - Dynamic Client Registration (POST /mcp/register)
 * - Authorization endpoint (GET /mcp/authorize)
 * - Callback endpoint (GET /mcp/callback)
 * - Token endpoint (POST /mcp/token)
 * - Token revocation (POST /mcp/revoke)
 */

import type { Context } from "hono";
import {
  verifyPkceS256,
  generateToken,
  hashToken,
  tokenPreview,
  isLoopbackRedirectUri,
  getOAuthMetadata,
} from "@nocoo/base-mcp/auth";
import type { McpOAuthRepo } from "../../db/repositories";

// ============================================================================
// Configuration
// ============================================================================

const AUTH_CODE_EXPIRY_SECONDS = 600; // 10 minutes
const ACCESS_TOKEN_EXPIRY_HOURS = 24;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// ============================================================================
// Types
// ============================================================================

interface OAuthEnv {
  SITE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

interface OAuthContext {
  repos: { mcpOAuth: McpOAuthRepo };
  env: OAuthEnv;
}

// ============================================================================
// Helpers
// ============================================================================

function generateClientId(): string {
  return `mcp_${generateToken(16)}`;
}

function getExpiresAt(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function getExpiresAtDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// ============================================================================
// OAuth Metadata
// ============================================================================

export function handleOAuthMetadata(c: Context) {
  const siteUrl = c.env?.SITE_URL || "https://noheir.hexly.ai";
  const metadata = getOAuthMetadata(siteUrl);
  return c.json(metadata);
}

// ============================================================================
// Dynamic Client Registration (RFC 7591)
// ============================================================================

interface RegisterRequest {
  client_name: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  software_id?: string;
  software_version?: string;
}

export async function handleRegister(
  c: Context,
  ctx: OAuthContext
): Promise<Response> {
  const body = await c.req.json<RegisterRequest>();

  // Validate required fields
  if (!body.client_name) {
    return c.json({ error: "invalid_client_metadata", error_description: "client_name is required" }, 400);
  }
  if (!body.redirect_uris || body.redirect_uris.length === 0) {
    return c.json({ error: "invalid_client_metadata", error_description: "redirect_uris is required" }, 400);
  }

  // Validate redirect URIs (only loopback allowed for public clients)
  for (const uri of body.redirect_uris) {
    if (!isLoopbackRedirectUri(uri)) {
      return c.json({
        error: "invalid_redirect_uri",
        error_description: `Only loopback redirect URIs are allowed. Got: ${uri}`,
      }, 400);
    }
  }

  // Generate client ID
  const clientId = generateClientId();

  // Create client record
  const client = await ctx.repos.mcpOAuth.clients.create({
    clientId,
    clientName: body.client_name,
    redirectUris: JSON.stringify(body.redirect_uris),
    grantTypes: JSON.stringify(body.grant_types || ["authorization_code", "refresh_token"]),
    responseTypes: JSON.stringify(body.response_types || ["code"]),
    tokenEndpointAuthMethod: body.token_endpoint_auth_method || "none",
    clientUri: body.client_uri,
    logoUri: body.logo_uri,
    scope: body.scope || "noheir:read noheir:write",
    contacts: body.contacts ? JSON.stringify(body.contacts) : null,
    tosUri: body.tos_uri,
    policyUri: body.policy_uri,
    softwareId: body.software_id,
    softwareVersion: body.software_version,
  });

  // Return registration response
  return c.json({
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: body.redirect_uris,
    grant_types: body.grant_types || ["authorization_code", "refresh_token"],
    response_types: body.response_types || ["code"],
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    scope: client.scope,
    client_id_issued_at: Math.floor(new Date(client.createdAt!).getTime() / 1000),
  }, 201);
}

// ============================================================================
// Authorization Endpoint
// ============================================================================

interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string | undefined;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  nonce: string | undefined;
}

export async function handleAuthorize(
  c: Context,
  ctx: OAuthContext
): Promise<Response> {
  const params: AuthorizeParams = {
    response_type: c.req.query("response_type") || "",
    client_id: c.req.query("client_id") || "",
    redirect_uri: c.req.query("redirect_uri") || "",
    scope: c.req.query("scope"),
    state: c.req.query("state") || "",
    code_challenge: c.req.query("code_challenge") || "",
    code_challenge_method: c.req.query("code_challenge_method") || "",
    nonce: c.req.query("nonce"),
  };

  // Validate required parameters
  if (params.response_type !== "code") {
    return c.json({ error: "unsupported_response_type" }, 400);
  }
  if (!params.client_id) {
    return c.json({ error: "invalid_request", error_description: "client_id is required" }, 400);
  }
  if (!params.redirect_uri) {
    return c.json({ error: "invalid_request", error_description: "redirect_uri is required" }, 400);
  }
  if (!params.state) {
    return c.json({ error: "invalid_request", error_description: "state is required" }, 400);
  }
  if (!params.code_challenge) {
    return c.json({ error: "invalid_request", error_description: "code_challenge is required (PKCE)" }, 400);
  }
  if (params.code_challenge_method !== "S256") {
    return c.json({ error: "invalid_request", error_description: "code_challenge_method must be S256" }, 400);
  }

  // Validate client
  const client = await ctx.repos.mcpOAuth.clients.findByClientId(params.client_id);
  if (!client) {
    return c.json({ error: "invalid_client" }, 400);
  }

  // Validate redirect URI
  const registeredUris: string[] = JSON.parse(client.redirectUris);
  if (!registeredUris.includes(params.redirect_uri)) {
    return c.json({ error: "invalid_redirect_uri" }, 400);
  }

  // Create auth session
  await ctx.repos.mcpOAuth.authSessions.create({
    state: params.state,
    clientId: params.client_id,
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge,
    codeChallengeMethod: params.code_challenge_method,
    scope: params.scope || client.scope || "noheir:read noheir:write",
    nonce: params.nonce,
    expiresAt: Math.floor(Date.now() / 1000) + AUTH_CODE_EXPIRY_SECONDS,
  });

  // Return success - Next.js frontend handles login check and redirect
  return c.json({ success: true, state: params.state }, 200);
}

// ============================================================================
// Callback Endpoint (after user login)
// ============================================================================

export async function handleCallback(
  c: Context,
  ctx: OAuthContext,
  userId: string
): Promise<Response> {
  const state = c.req.query("state");

  if (!state) {
    return c.html(errorHtml("Missing state parameter"), 400);
  }

  // Find auth session
  const session = await ctx.repos.mcpOAuth.authSessions.findByState(state);
  if (!session) {
    return c.html(errorHtml("Invalid or expired authorization session"), 400);
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt < now) {
    return c.html(errorHtml("Authorization session has expired. Please try again."), 400);
  }

  // Check if already consumed
  if (session.consumed) {
    return c.html(errorHtml("Authorization code has already been used."), 400);
  }

  // Generate authorization code
  const code = generateToken(32);

  // Update session with code and user_id
  await ctx.repos.mcpOAuth.authSessions.setCode(state, code, userId);

  // Redirect back to client with code
  const redirectUrl = new URL(session.redirectUri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", state);

  // Return success HTML that auto-redirects
  return c.html(successHtml(redirectUrl.toString()));
}

// ============================================================================
// Token Endpoint
// ============================================================================

interface TokenRequest {
  grant_type: string;
  code: string | undefined;
  redirect_uri: string | undefined;
  client_id: string | undefined;
  code_verifier: string | undefined;
  refresh_token: string | undefined;
}

export async function handleToken(
  c: Context,
  ctx: OAuthContext
): Promise<Response> {
  // Parse form-urlencoded body
  const contentType = c.req.header("content-type") || "";
  let body: TokenRequest;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await c.req.parseBody();
    body = {
      grant_type: String(formData.grant_type || ""),
      code: formData.code ? String(formData.code) : undefined,
      redirect_uri: formData.redirect_uri ? String(formData.redirect_uri) : undefined,
      client_id: formData.client_id ? String(formData.client_id) : undefined,
      code_verifier: formData.code_verifier ? String(formData.code_verifier) : undefined,
      refresh_token: formData.refresh_token ? String(formData.refresh_token) : undefined,
    };
  } else if (contentType.includes("application/json")) {
    body = await c.req.json<TokenRequest>();
  } else {
    return c.json({ error: "invalid_request", error_description: "Unsupported content type" }, 400);
  }

  if (body.grant_type === "authorization_code") {
    return handleAuthorizationCodeGrant(c, ctx, body);
  } else if (body.grant_type === "refresh_token") {
    return handleRefreshTokenGrant(c, ctx, body);
  } else {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }
}

async function handleAuthorizationCodeGrant(
  c: Context,
  ctx: OAuthContext,
  body: TokenRequest
): Promise<Response> {
  if (!body.code) {
    return c.json({ error: "invalid_request", error_description: "code is required" }, 400);
  }
  if (!body.client_id) {
    return c.json({ error: "invalid_request", error_description: "client_id is required" }, 400);
  }
  if (!body.code_verifier) {
    return c.json({ error: "invalid_request", error_description: "code_verifier is required" }, 400);
  }

  // Find auth session by code
  const session = await ctx.repos.mcpOAuth.authSessions.findByCode(body.code);
  if (!session) {
    return c.json({ error: "invalid_grant", error_description: "Invalid authorization code" }, 400);
  }

  // Verify client_id matches
  if (session.clientId !== body.client_id) {
    return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
  }

  // Verify redirect_uri matches (if provided)
  if (body.redirect_uri && body.redirect_uri !== session.redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt < now) {
    return c.json({ error: "invalid_grant", error_description: "Authorization code expired" }, 400);
  }

  // Check if already consumed
  if (session.consumed) {
    return c.json({ error: "invalid_grant", error_description: "Authorization code already used" }, 400);
  }

  // Verify PKCE
  const pkceValid = await verifyPkceS256(body.code_verifier, session.codeChallenge);
  if (!pkceValid) {
    return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
  }

  // Mark session as consumed
  await ctx.repos.mcpOAuth.authSessions.markConsumed(session.id);

  // Get client for token metadata
  const client = await ctx.repos.mcpOAuth.clients.findByClientId(session.clientId);

  // Generate tokens
  const accessToken = generateToken(32);
  const refreshToken = generateToken(32);

  // Store access token
  const tokenRecord = await ctx.repos.mcpOAuth.tokens.create({
    accessTokenHash: await hashToken(accessToken),
    accessTokenPreview: tokenPreview(accessToken),
    clientId: session.clientId,
    userId: session.userId!,
    scope: session.scope,
    clientName: client?.clientName,
    expiresAt: getExpiresAt(ACCESS_TOKEN_EXPIRY_HOURS),
  });

  // Store refresh token
  await ctx.repos.mcpOAuth.refreshTokens.create({
    refreshTokenHash: await hashToken(refreshToken),
    accessTokenId: tokenRecord.id,
    clientId: session.clientId,
    userId: session.userId!,
    scope: session.scope,
    expiresAt: getExpiresAtDays(REFRESH_TOKEN_EXPIRY_DAYS),
  });

  return c.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_EXPIRY_HOURS * 60 * 60,
    refresh_token: refreshToken,
    scope: session.scope,
  });
}

async function handleRefreshTokenGrant(
  c: Context,
  ctx: OAuthContext,
  body: TokenRequest
): Promise<Response> {
  if (!body.refresh_token) {
    return c.json({ error: "invalid_request", error_description: "refresh_token is required" }, 400);
  }

  // Find refresh token
  const refreshTokenHash = await hashToken(body.refresh_token);
  const oldRefreshToken = await ctx.repos.mcpOAuth.refreshTokens.findByHash(refreshTokenHash);

  if (!oldRefreshToken) {
    return c.json({ error: "invalid_grant", error_description: "Invalid refresh token" }, 400);
  }

  // Check if revoked
  if (oldRefreshToken.revoked) {
    return c.json({ error: "invalid_grant", error_description: "Refresh token has been revoked" }, 400);
  }

  // Check expiration
  const now = new Date().toISOString();
  if (oldRefreshToken.expiresAt < now) {
    return c.json({ error: "invalid_grant", error_description: "Refresh token expired" }, 400);
  }

  // Verify client_id if provided
  if (body.client_id && body.client_id !== oldRefreshToken.clientId) {
    return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
  }

  // Get client for token metadata
  const client = await ctx.repos.mcpOAuth.clients.findByClientId(oldRefreshToken.clientId);

  // Generate new tokens
  const newAccessToken = generateToken(32);
  const newRefreshToken = generateToken(32);

  // Create new access token
  const newTokenRecord = await ctx.repos.mcpOAuth.tokens.create({
    accessTokenHash: await hashToken(newAccessToken),
    accessTokenPreview: tokenPreview(newAccessToken),
    clientId: oldRefreshToken.clientId,
    userId: oldRefreshToken.userId,
    scope: oldRefreshToken.scope,
    clientName: client?.clientName,
    expiresAt: getExpiresAt(ACCESS_TOKEN_EXPIRY_HOURS),
  });

  // Rotate refresh token (with reuse detection)
  const rotateResult = await ctx.repos.mcpOAuth.refreshTokens.rotate(
    refreshTokenHash,
    {
      refreshTokenHash: await hashToken(newRefreshToken),
      accessTokenId: newTokenRecord.id,
      clientId: oldRefreshToken.clientId,
      userId: oldRefreshToken.userId,
      scope: oldRefreshToken.scope,
      expiresAt: getExpiresAtDays(REFRESH_TOKEN_EXPIRY_DAYS),
    }
  );

  // If reuse detected, revoke entire token family (all access + refresh tokens for this user+client)
  if (rotateResult.reuseDetected) {
    // Revoke the access token we just created
    await ctx.repos.mcpOAuth.tokens.revoke(newTokenRecord.id);

    // Revoke entire token family for security
    await ctx.repos.mcpOAuth.tokens.revokeByUserAndClient(
      oldRefreshToken.userId,
      oldRefreshToken.clientId
    );
    await ctx.repos.mcpOAuth.refreshTokens.revokeByUserAndClient(
      oldRefreshToken.userId,
      oldRefreshToken.clientId
    );

    return c.json({
      error: "invalid_grant",
      error_description: "Refresh token reuse detected. All tokens for this client have been revoked.",
    }, 400);
  }

  return c.json({
    access_token: newAccessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_EXPIRY_HOURS * 60 * 60,
    refresh_token: newRefreshToken,
    scope: oldRefreshToken.scope,
  });
}

// ============================================================================
// Token Revocation (RFC 7009)
// ============================================================================

interface RevokeRequest {
  token: string;
  token_type_hint: "access_token" | "refresh_token" | undefined;
}

export async function handleRevoke(
  c: Context,
  ctx: OAuthContext
): Promise<Response> {
  const contentType = c.req.header("content-type") || "";
  let body: RevokeRequest;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await c.req.parseBody();
    body = {
      token: String(formData.token || ""),
      token_type_hint: formData.token_type_hint as "access_token" | "refresh_token" | undefined,
    };
  } else if (contentType.includes("application/json")) {
    body = await c.req.json<RevokeRequest>();
  } else {
    return c.json({ error: "invalid_request" }, 400);
  }

  if (!body.token) {
    // RFC 7009: invalid tokens should return 200 OK
    return c.json({}, 200);
  }

  const tokenHash = await hashToken(body.token);

  // Try to revoke as access token first
  const accessToken = await ctx.repos.mcpOAuth.tokens.findByHash(tokenHash);
  if (accessToken) {
    await ctx.repos.mcpOAuth.tokens.revoke(accessToken.id);
    // Also revoke associated refresh tokens
    await ctx.repos.mcpOAuth.refreshTokens.revokeByAccessTokenId(accessToken.id);
    return c.json({}, 200);
  }

  // Try as refresh token
  const refreshToken = await ctx.repos.mcpOAuth.refreshTokens.findByHash(tokenHash);
  if (refreshToken) {
    await ctx.repos.mcpOAuth.refreshTokens.revoke(refreshToken.id);
    return c.json({}, 200);
  }

  // RFC 7009: unknown tokens should return 200 OK
  return c.json({}, 200);
}

// ============================================================================
// HTML Templates (basalt design system with theme support)
// ============================================================================

const ACCENT_COLOR = "#10b981"; // emerald-500, noheir brand color

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function successHtml(redirectUrl: string): string {
  const safeUrl = escapeHtml(redirectUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="1;url=${safeUrl}">
  <title>Authorization Successful - noheir</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0a0a0a;
        --bg-secondary: #171717;
        --text: #fafafa;
        --text-muted: #a3a3a3;
        --text-hint: #525252;
      }
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #fafafa;
        --bg-secondary: #f5f5f5;
        --text: #0a0a0a;
        --text-muted: #525252;
        --text-hint: #a3a3a3;
      }
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 1.5rem;
      background: var(--bg-secondary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      color: ${ACCENT_COLOR};
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    p {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }
    .hint {
      font-size: 0.75rem;
      color: var(--text-hint);
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--text-hint);
      border-top-color: ${ACCENT_COLOR};
      border-radius: 50%;
      animation: spin 1s linear infinite;
      display: inline-block;
      vertical-align: middle;
      margin-right: 0.5rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1>Authorization Successful</h1>
    <p>You have authorized access to noheir.</p>
    <p class="hint"><span class="spinner"></span>Redirecting back to your client...</p>
  </div>
  <script>
    // Fallback redirect in case meta refresh fails
    setTimeout(function() {
      window.location.href = "${safeUrl}";
    }, 1000);
  </script>
</body>
</html>`;
}

function errorHtml(message: string): string {
  const escaped = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Failed - noheir</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0a0a0a;
        --bg-secondary: #171717;
        --text: #fafafa;
        --text-muted: #a3a3a3;
        --text-hint: #525252;
      }
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #fafafa;
        --bg-secondary: #f5f5f5;
        --text: #0a0a0a;
        --text-muted: #525252;
        --text-hint: #a3a3a3;
      }
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 1.5rem;
      background: var(--bg-secondary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      color: #ef4444;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    p {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }
    .hint {
      font-size: 0.75rem;
      color: var(--text-hint);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
    <h1>Authorization Failed</h1>
    <p>${escaped}</p>
    <p class="hint">Please close this window and try again.</p>
  </div>
</body>
</html>`;
}
