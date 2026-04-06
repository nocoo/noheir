/**
 * MCP OAuth Test Helper
 *
 * Provides getMcpTestToken() to obtain valid OAuth tokens for MCP E2E tests.
 * Uses the /mcp/callback?user_id=xxx bypass to complete OAuth flow without browser.
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
} from "@nocoo/base-mcp/auth";
import { BASE_URL } from "./client";

// ============================================================================
// Constants
// ============================================================================

const TARGET_DB_HEADER = { "X-Target-DB": "test" };

// ============================================================================
// Types
// ============================================================================

export interface McpTokenResult {
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresIn: number;
}

interface RegisterResponse {
  client_id: string;
  client_name: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Register an OAuth client for testing.
 */
async function registerClient(clientName: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/mcp/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...TARGET_DB_HEADER,
    },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: ["http://127.0.0.1:9999/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to register client: ${res.status} ${text}`);
  }

  const data = (await res.json()) as RegisterResponse;
  return data.client_id;
}

/**
 * Start authorization flow and get the state parameter.
 * The authorize endpoint will redirect to login page with state.
 */
async function startAuthorization(
  clientId: string,
  codeChallenge: string
): Promise<string> {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: "http://127.0.0.1:9999/callback",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "noheir:read noheir:write",
  });

  const res = await fetch(`${BASE_URL}/mcp/authorize?${params.toString()}`, {
    headers: TARGET_DB_HEADER,
    redirect: "manual",
  });

  // Should redirect to login page
  if (res.status !== 302) {
    const text = await res.text();
    throw new Error(`Expected redirect, got ${res.status}: ${text}`);
  }

  return state;
}

/**
 * Complete the callback to get authorization code.
 * Uses the user_id parameter to bypass browser login.
 */
async function completeCallback(
  state: string,
  userId: string
): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/mcp/callback?state=${state}&user_id=${encodeURIComponent(userId)}`,
    {
      headers: TARGET_DB_HEADER,
      redirect: "manual",
    }
  );

  // Should redirect back to client with code
  if (res.status !== 302) {
    const text = await res.text();
    throw new Error(`Expected redirect, got ${res.status}: ${text}`);
  }

  const location = res.headers.get("Location");
  if (!location) {
    throw new Error("No Location header in callback response");
  }

  const url = new URL(location);
  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error(`No code in callback redirect: ${location}`);
  }

  return code;
}

/**
 * Exchange authorization code for tokens.
 */
async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  codeVerifier: string
): Promise<McpTokenResult> {
  const res = await fetch(`${BASE_URL}/mcp/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...TARGET_DB_HEADER,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      code_verifier: codeVerifier,
      redirect_uri: "http://127.0.0.1:9999/callback",
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to exchange code for tokens: ${res.status} ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    scope: data.scope,
    expiresIn: data.expires_in,
  };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Get a valid MCP OAuth token for testing.
 *
 * Performs the full OAuth 2.1 flow:
 * 1. Register a test client
 * 2. Generate PKCE values
 * 3. Start authorization (creates auth session)
 * 4. Complete callback with user_id (bypasses browser login)
 * 5. Exchange code for tokens
 *
 * @param userId - The user ID to associate with the token
 * @param clientName - Optional client name (default: "MCP E2E Test")
 * @returns Token result with access_token, refresh_token, etc.
 */
export async function getMcpTestToken(
  userId: string,
  clientName = "MCP E2E Test"
): Promise<McpTokenResult> {
  // 1. Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // 2. Register client
  const clientId = await registerClient(`${clientName} - ${Date.now()}`);

  // 3. Start authorization
  const state = await startAuthorization(clientId, codeChallenge);

  // 4. Complete callback with user_id
  const code = await completeCallback(state, userId);

  // 5. Exchange for tokens
  return exchangeCodeForTokens(code, clientId, codeVerifier);
}
