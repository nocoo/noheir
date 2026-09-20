import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { generateToken, isLoopbackRedirectUri, verifyPkceS256 } from "@nocoo/base-mcp/auth";
import type { Context } from "hono";
import { z } from "zod";
import type { Db } from "../../src/lib/db";
import { validateMcpToken, validateOrigin } from "../../src/lib/mcp/auth";
import { createMcpServer } from "../../src/lib/mcp/server";
import {
  AUTH_CODE_TTL,
  consumeAuthCode,
  createAuthSession,
  getAuthCodeByCode,
  getAuthSessionByState,
  upgradeAuthSession,
} from "../../src/services/mcp-auth-codes";
import { createMcpClient, getMcpClientByClientId } from "../../src/services/mcp-clients";
import {
  ACCESS_TOKEN_TTL,
  consumeRefreshToken,
  createMcpToken,
  generateAccessToken,
  generateRefreshToken,
  revokeToken,
  revokeTokensByClientAndUser,
  sha256,
} from "../../src/services/mcp-tokens";

import { MCP_ISSUER } from "../lib/request-policy";
import type { AppEnv } from "./index";

type McpBindings = AppEnv;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export async function handleWellKnown(): Promise<Response> {
  return Response.json(
    {
      issuer: MCP_ISSUER,
      authorization_endpoint: `${MCP_ISSUER}/api/mcp/authorize`,
      token_endpoint: `${MCP_ISSUER}/api/mcp/token`,
      registration_endpoint: `${MCP_ISSUER}/api/mcp/register`,
      revocation_endpoint: `${MCP_ISSUER}/api/mcp/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp:full"],
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

const registrationSchema = z.object({
  client_name: z.string().min(1).max(255),
  redirect_uris: z.array(z.string().refine(isLoopbackRedirectUri)).min(1),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .default(["authorization_code"]),
});

export async function handleMcpRegister(c: Context<McpBindings>): Promise<Response> {
  const parsed = registrationSchema.safeParse(await c.req.json());
  if (!parsed.success) return json({ error: "Invalid client registration" }, 400);
  const client = await createMcpClient(c.get("sqlDb"), parsed.data);
  return json(
    {
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: JSON.parse(client.redirect_uris),
      grant_types: JSON.parse(client.grant_types),
      token_endpoint_auth_method: "none",
    },
    201,
  );
}

export async function handleMcpAuthorize(c: Context<McpBindings>): Promise<Response> {
  const user = c.get("user");
  if (!user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(c.req.url);
  const params = url.searchParams;
  const responseType = params.get("response_type");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const state = params.get("state");
  const scope = params.get("scope") ?? "mcp:full";

  if (
    !responseType ||
    !clientId ||
    !redirectUri ||
    !codeChallenge ||
    !codeChallengeMethod ||
    !state
  ) {
    return json({ error: "Missing required parameters" }, 400);
  }
  if (responseType !== "code") return json({ error: "response_type must be 'code'" }, 400);
  if (codeChallengeMethod !== "S256") {
    return json({ error: "code_challenge_method must be 'S256'" }, 400);
  }

  const db = c.get("sqlDb");
  const client = await getMcpClientByClientId(db, clientId);
  if (!client) return json({ error: "Unknown client_id" }, 401);

  const registeredUris: string[] = JSON.parse(client.redirect_uris);
  if (!registeredUris.includes(redirectUri)) {
    return json({ error: "redirect_uri does not match any registered URIs" }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await createAuthSession(db, {
    state,
    user_id: user.id,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    scope,
    expires_at: now + AUTH_CODE_TTL,
  });

  return Response.redirect(
    `${MCP_ISSUER}/api/mcp/callback?state=${encodeURIComponent(state)}`,
    302,
  );
}

export async function handleMcpCallback(c: Context<McpBindings>): Promise<Response> {
  const user = c.get("user");
  if (!user) return json({ error: "Unauthorized" }, 401);

  const state = new URL(c.req.url).searchParams.get("state");
  if (!state) return json({ error: "Missing state parameter" }, 400);

  const db = c.get("sqlDb");
  const authSession = await getAuthSessionByState(db, state);
  if (!authSession || authSession.user_id !== user.id)
    return json({ error: "Invalid or expired authorization session" }, 400);

  const client = await getMcpClientByClientId(db, authSession.client_id);
  if (!client) return json({ error: "Unknown client_id" }, 401);
  const registeredUris: string[] = JSON.parse(client.redirect_uris);
  if (!registeredUris.includes(authSession.redirect_uri)) {
    return json({ error: "redirect_uri does not match any registered URIs" }, 400);
  }

  const code = generateToken(32);
  const upgraded = await upgradeAuthSession(db, state, code, user.id);
  if (!upgraded) return json({ error: "Authorization session already used or expired" }, 400);

  const redirectUrl = new URL(authSession.redirect_uri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", state);
  return Response.redirect(redirectUrl.toString(), 302);
}

export async function handleMcpToken(c: Context<McpBindings>): Promise<Response> {
  try {
    const body = await c.req.formData();
    const grantType = body.get("grant_type");
    if (!grantType) {
      return json({ error: "invalid_request", error_description: "grant_type is required" }, 400);
    }
    if (grantType === "authorization_code") {
      return handleAuthorizationCode(c.get("sqlDb"), body);
    }
    if (grantType === "refresh_token") {
      return handleRefreshToken(c.get("sqlDb"), body);
    }
    return json(
      {
        error: "unsupported_grant_type",
        error_description: `Unsupported grant_type: ${grantType}`,
      },
      400,
    );
  } catch {
    return json(
      {
        error: "server_error",
        error_description: "Internal server error",
      },
      500,
    );
  }
}

async function handleAuthorizationCode(db: Db, body: FormData): Promise<Response> {
  const code = body.get("code");
  const redirectUri = body.get("redirect_uri");
  const clientId = body.get("client_id");
  const codeVerifier = body.get("code_verifier");
  if (
    typeof code !== "string" ||
    typeof redirectUri !== "string" ||
    typeof clientId !== "string" ||
    typeof codeVerifier !== "string"
  ) {
    return json(
      {
        error: "invalid_request",
        error_description: "Missing required fields: code, redirect_uri, client_id, code_verifier",
      },
      400,
    );
  }

  const authCode = await getAuthCodeByCode(db, code);
  if (!authCode) {
    return json(
      {
        error: "invalid_grant",
        error_description: "Authorization code is invalid, expired, or already consumed",
      },
      400,
    );
  }
  if (authCode.client_id !== clientId) {
    return json({ error: "invalid_grant", error_description: "client_id does not match" }, 400);
  }
  if (authCode.redirect_uri !== redirectUri) {
    return json({ error: "invalid_grant", error_description: "redirect_uri does not match" }, 400);
  }
  if (!(await verifyPkceS256(codeVerifier, authCode.code_challenge))) {
    return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
  }
  const consumed = await consumeAuthCode(db, code, clientId);
  if (!consumed) {
    return json(
      { error: "invalid_grant", error_description: "Authorization code already consumed" },
      400,
    );
  }
  const userId = authCode.user_id ?? "";
  if (!userId) {
    return json(
      { error: "server_error", error_description: "Authorization code missing user ID" },
      500,
    );
  }
  await revokeTokensByClientAndUser(db, clientId, userId);
  return issueTokenPair(db, clientId, userId, authCode.scope);
}

async function handleRefreshToken(db: Db, body: FormData): Promise<Response> {
  const refreshToken = body.get("refresh_token");
  const clientId = body.get("client_id");
  if (typeof refreshToken !== "string" || typeof clientId !== "string") {
    return json(
      {
        error: "invalid_request",
        error_description: "Missing required fields: refresh_token, client_id",
      },
      400,
    );
  }
  const refreshHash = await sha256(refreshToken);
  const consumed = await consumeRefreshToken(db, refreshHash, clientId);
  if (!consumed) {
    return json(
      {
        error: "invalid_grant",
        error_description: "Refresh token is invalid, expired, or revoked",
      },
      400,
    );
  }
  if (consumed.client_id !== clientId) {
    return json({ error: "invalid_grant", error_description: "client_id does not match" }, 400);
  }
  await revokeTokensByClientAndUser(db, clientId, consumed.user_id);
  return issueTokenPair(db, clientId, consumed.user_id, consumed.scope);
}

async function issueTokenPair(
  db: Db,
  clientId: string,
  userId: string,
  scope: string,
): Promise<Response> {
  const accessToken = generateAccessToken();
  const refreshToken = generateRefreshToken();
  const client = await getMcpClientByClientId(db, clientId);
  await createMcpToken(db, {
    access_token_hash: await sha256(accessToken),
    access_token_preview: accessToken.slice(0, 16),
    refresh_token_hash: await sha256(refreshToken),
    client_id: clientId,
    user_id: userId,
    scope,
    ...(client?.client_name ? { client_name: client.client_name } : {}),
  });
  return json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refreshToken,
    scope,
  });
}

export async function handleMcpRevoke(c: Context<McpBindings>): Promise<Response> {
  try {
    const body = await c.req.formData();
    const token = body.get("token");
    if (typeof token !== "string") {
      return json({ error: "invalid_request", error_description: "token is required" }, 400);
    }
    const db = c.get("sqlDb");
    const hash = await sha256(token);
    const existing = await db.firstOrNull<{ id: string }>(
      `SELECT id FROM mcp_tokens WHERE access_token_hash = ?
       UNION SELECT access_token_id AS id FROM mcp_refresh_tokens WHERE refresh_token_hash = ?
       LIMIT 1`,
      [hash, hash],
    );
    if (existing) {
      await revokeToken(db, existing.id);
    }
    return new Response(null, { status: 200 });
  } catch {
    return json(
      {
        error: "server_error",
        error_description: "Internal server error",
      },
      500,
    );
  }
}

export async function handleMcpProtocol(c: Context<McpBindings>): Promise<Response> {
  const originError = validateOrigin(c.req.header("origin") ?? null, MCP_ISSUER);
  if (originError) {
    return json({ error: originError.error }, originError.status);
  }
  const db = c.get("sqlDb");
  const authResult = await validateMcpToken(db, c.req.header("authorization") ?? null);
  if (!authResult.valid) {
    return json({ error: authResult.error }, authResult.status);
  }

  const server = createMcpServer(db, authResult.token.user_id);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(c.req.raw);
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}
