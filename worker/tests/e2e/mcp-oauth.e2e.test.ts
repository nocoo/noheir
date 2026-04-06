/**
 * E2E Tests for MCP OAuth 2.1 Endpoints
 *
 * Tests the full OAuth 2.1 flow:
 * - Dynamic Client Registration
 * - Authorization endpoint
 * - Token endpoint (authorization_code grant)
 * - Token refresh (refresh_token grant)
 * - Token revocation
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { rawFetch, api, TEST_USER_A, BASE_URL, SECRET } from "./helpers/client";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  hashToken,
} from "@nocoo/base-mcp/auth";

const WORKER_BASE = BASE_URL;

// ============================================================================
// Helper: Raw OAuth fetch (no auth headers for public endpoints)
// ============================================================================

interface OAuthFetchOptions {
  method?: string;
  path: string;
  body?: unknown;
  contentType?: string;
}

async function oauthFetch(opts: OAuthFetchOptions): Promise<Response> {
  const headers: Record<string, string> = {};

  if (opts.body !== undefined) {
    headers["Content-Type"] = opts.contentType || "application/json";
  }

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
    redirect: "manual", // Don't follow redirects - we want to inspect them
  };

  if (opts.body !== undefined) {
    if (opts.contentType === "application/x-www-form-urlencoded") {
      init.body = new URLSearchParams(opts.body as Record<string, string>).toString();
    } else {
      init.body = JSON.stringify(opts.body);
    }
  }

  return fetch(`${WORKER_BASE}${opts.path}`, init);
}

// ============================================================================
// Tests
// ============================================================================

describe("E2E: MCP OAuth", () => {
  // Shared state for the OAuth flow
  let clientId: string;
  let codeVerifier: string;
  let codeChallenge: string;
  let authCode: string;
  let accessToken: string;
  let refreshToken: string;

  // Register a client before all tests
  beforeAll(async () => {
    // Create a client for use in subsequent tests
    const res = await oauthFetch({
      method: "POST",
      path: "/mcp/register",
      body: {
        client_name: "E2E Test Client Setup",
        redirect_uris: ["http://127.0.0.1:9999/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
    });
    const data = await res.json() as { client_id: string };
    clientId = data.client_id;

    // Generate PKCE values
    codeVerifier = generateCodeVerifier();
    codeChallenge = generateCodeChallenge(codeVerifier);
  });

  describe("OAuth Metadata Discovery", () => {
    test("GET /.well-known/oauth-authorization-server returns metadata", async () => {
      const res = await oauthFetch({
        path: "/.well-known/oauth-authorization-server",
      });

      expect(res.status).toBe(200);

      const metadata = await res.json() as Record<string, unknown>;
      expect(metadata.issuer).toBeDefined();
      expect(metadata.authorization_endpoint).toContain("/authorize");
      expect(metadata.token_endpoint).toContain("/token");
      expect(metadata.registration_endpoint).toContain("/register");
      // revocation_endpoint is optional in OAuth metadata
      expect(metadata.response_types_supported).toContain("code");
      expect(metadata.grant_types_supported).toContain("authorization_code");
      expect(metadata.grant_types_supported).toContain("refresh_token");
      expect(metadata.code_challenge_methods_supported).toContain("S256");
    });
  });

  describe("Dynamic Client Registration", () => {
    test("POST /mcp/register creates a new client", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/register",
        body: {
          client_name: "E2E Test Client",
          redirect_uris: ["http://127.0.0.1:9999/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
        },
      });

      expect(res.status).toBe(201);

      const data = await res.json() as {
        client_id: string;
        client_name: string;
        redirect_uris: string[];
        grant_types: string[];
      };

      expect(data.client_id).toMatch(/^mcp_/);
      expect(data.client_name).toBe("E2E Test Client");
      expect(data.redirect_uris).toContain("http://127.0.0.1:9999/callback");
    });

    test("POST /mcp/register requires client_name", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/register",
        body: {
          redirect_uris: ["http://127.0.0.1:9999/callback"],
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("invalid_client_metadata");
    });

    test("POST /mcp/register rejects non-loopback redirect URIs", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/register",
        body: {
          client_name: "Bad Client",
          redirect_uris: ["https://attacker.com/callback"],
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("invalid_redirect_uri");
    });
  });

  describe("Authorization Endpoint", () => {
    test("GET /mcp/authorize redirects to login page", async () => {
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

      const res = await oauthFetch({
        path: `/mcp/authorize?${params.toString()}`,
      });

      // Should redirect to login page
      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toContain("/mcp-auth");
      expect(location).toContain(`state=${state}`);
    });

    test("GET /mcp/authorize requires PKCE", async () => {
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: "http://127.0.0.1:9999/callback",
        state,
        // No code_challenge
      });

      const res = await oauthFetch({
        path: `/mcp/authorize?${params.toString()}`,
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("invalid_request");
    });

    test("GET /mcp/authorize validates client_id", async () => {
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        response_type: "code",
        client_id: "nonexistent_client",
        redirect_uri: "http://127.0.0.1:9999/callback",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      const res = await oauthFetch({
        path: `/mcp/authorize?${params.toString()}`,
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("invalid_client");
    });
  });

  describe("Token Endpoint - Authorization Code Grant", () => {
    // Note: We can't fully test the auth code flow in E2E without a browser,
    // but we can test the token endpoint error cases

    test("POST /mcp/token requires grant_type", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/token",
        contentType: "application/x-www-form-urlencoded",
        body: {
          code: "some_code",
          client_id: clientId,
          code_verifier: codeVerifier,
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("unsupported_grant_type");
    });

    test("POST /mcp/token rejects invalid authorization code", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/token",
        contentType: "application/x-www-form-urlencoded",
        body: {
          grant_type: "authorization_code",
          code: "invalid_code",
          client_id: clientId,
          code_verifier: codeVerifier,
          redirect_uri: "http://127.0.0.1:9999/callback",
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("invalid_grant");
    });
  });

  describe("Token Endpoint - Refresh Token Grant", () => {
    test("POST /mcp/token requires refresh_token for refresh grant", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/token",
        contentType: "application/x-www-form-urlencoded",
        body: {
          grant_type: "refresh_token",
          client_id: clientId,
          // No refresh_token
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string; error_description?: string };
      expect(data.error).toBe("invalid_request");
      expect(data.error_description).toContain("refresh_token");
    });

    test("POST /mcp/token rejects invalid refresh token", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/token",
        contentType: "application/x-www-form-urlencoded",
        body: {
          grant_type: "refresh_token",
          refresh_token: "invalid_refresh_token",
          client_id: clientId,
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("invalid_grant");
    });
  });

  describe("Token Revocation", () => {
    test("POST /mcp/revoke returns 200 for unknown token (RFC 7009)", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/revoke",
        contentType: "application/x-www-form-urlencoded",
        body: {
          token: "unknown_token_value",
        },
      });

      // RFC 7009 says revocation of unknown tokens should return 200
      expect(res.status).toBe(200);
    });

    test("POST /mcp/revoke returns 200 for empty token (RFC 7009)", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/revoke",
        contentType: "application/x-www-form-urlencoded",
        body: {
          token: "",
        },
      });

      // RFC 7009 says invalid tokens should return 200
      expect(res.status).toBe(200);
    });
  });

  describe("OAuth endpoints skip normal auth", () => {
    test("OAuth metadata endpoint works without Bearer token", async () => {
      const res = await fetch(`${WORKER_BASE}/.well-known/oauth-authorization-server`);
      expect(res.status).toBe(200);
    });

    test("/mcp/register works without Bearer token", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/register",
        body: {
          client_name: "Another Client",
          redirect_uris: ["http://localhost:8080/callback"],
        },
      });
      expect(res.status).toBe(201);
    });

    test("/mcp/token works without Bearer token", async () => {
      const res = await oauthFetch({
        method: "POST",
        path: "/mcp/token",
        contentType: "application/x-www-form-urlencoded",
        body: {
          grant_type: "authorization_code",
          code: "test",
        },
      });
      // Should fail on validation, not auth
      expect(res.status).toBe(400);
    });
  });
});
