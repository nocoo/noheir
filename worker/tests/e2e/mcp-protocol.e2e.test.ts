/**
 * E2E Tests for MCP Protocol
 *
 * Tests the MCP endpoint behavior:
 * - Origin validation (allows null/loopback origins)
 * - Authentication (requires valid OAuth token)
 * - JSON-RPC error responses
 *
 * Note: Full protocol tests with valid tokens require:
 * 1. Creating a test client via /mcp/register
 * 2. Completing OAuth flow via browser
 * 3. Using the resulting access_token
 *
 * These tests focus on the endpoint behavior without a valid token.
 * See mcp-oauth.e2e.test.ts for OAuth flow tests.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { BASE_URL } from "./helpers/client";
import {
  generateCodeVerifier,
  generateCodeChallenge,
} from "@nocoo/base-mcp/auth";

const WORKER_BASE = BASE_URL;

// ============================================================================
// Helper: MCP Request without auth
// ============================================================================

interface McpRequestOptions {
  body: unknown;
  token?: string;
  origin?: string | null;
}

async function mcpFetch(opts: McpRequestOptions): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  // Only set Origin header if explicitly provided (not undefined)
  if (opts.origin !== undefined && opts.origin !== null) {
    headers["Origin"] = opts.origin;
  }

  return fetch(`${WORKER_BASE}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body),
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("E2E: MCP Protocol Endpoint", () => {
  describe("Origin Validation", () => {
    test("allows requests without Origin header (CLI clients)", async () => {
      // Requests without Origin header should pass origin validation
      // but fail on token validation
      const res = await mcpFetch({
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
      });

      // Should be 401 (no token), not 403 (forbidden origin)
      expect(res.status).toBe(401);
    });

    test("allows requests from loopback origin", async () => {
      const res = await mcpFetch({
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
        origin: "http://localhost:3000",
      });

      // Should be 401 (no token), not 403 (forbidden origin)
      expect(res.status).toBe(401);
    });

    test("allows requests from 127.0.0.1 origin", async () => {
      const res = await mcpFetch({
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
        origin: "http://127.0.0.1:9999",
      });

      // Should be 401 (no token), not 403 (forbidden origin)
      expect(res.status).toBe(401);
    });

    test("allows requests from app origin", async () => {
      const res = await mcpFetch({
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
        origin: "https://noheir.hexly.ai",
      });

      // Should be 401 (no token), not 403 (forbidden origin)
      expect(res.status).toBe(401);
    });

    test("rejects requests from unauthorized origin", async () => {
      const res = await mcpFetch({
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
        origin: "https://attacker.com",
      });

      // Should be 403 (forbidden origin)
      expect(res.status).toBe(403);
      const body = await res.json() as { error: string };
      expect(body.error).toContain("Origin");
    });
  });

  describe("Authentication", () => {
    test("returns 401 without Authorization header", async () => {
      const res = await mcpFetch({
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
      });

      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toContain("Authorization");
    });

    test("returns 401 with invalid token format", async () => {
      const res = await mcpFetch({
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
        token: "not_a_bearer_token",
      });

      expect(res.status).toBe(401);
    });

    test("returns 401 with non-existent token", async () => {
      const res = await mcpFetch({
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
        token: "mcp_nonexistent_token_12345",
      });

      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toContain("Invalid");
    });
  });

  describe("HTTP Methods", () => {
    test("GET /mcp returns 405 (SSE not supported)", async () => {
      const res = await fetch(`${WORKER_BASE}/mcp`);
      expect(res.status).toBe(405);

      const body = await res.json() as { error: string };
      expect(body.error).toContain("not supported");
    });

    test("DELETE /mcp returns 200 (session close no-op)", async () => {
      const res = await fetch(`${WORKER_BASE}/mcp`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const body = await res.json() as { closed: boolean };
      expect(body.closed).toBe(true);
    });
  });

  describe("Request Format", () => {
    test("handles malformed JSON gracefully", async () => {
      const res = await fetch(`${WORKER_BASE}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test_token",
        },
        body: "{ not valid json",
      });

      // Should return an error, either from JSON parsing or auth
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});

describe("E2E: MCP OAuth Integration", () => {
  let clientId: string;
  let codeVerifier: string;
  let codeChallenge: string;

  beforeAll(async () => {
    // Register a test client
    const res = await fetch(`${WORKER_BASE}/mcp/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_name: "MCP Protocol Test Client",
        redirect_uris: ["http://127.0.0.1:9999/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });

    const data = await res.json() as { client_id: string };
    clientId = data.client_id;

    // Generate PKCE values
    codeVerifier = generateCodeVerifier();
    codeChallenge = generateCodeChallenge(codeVerifier);
  });

  test("authorize endpoint redirects to login for new session", async () => {
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

    const res = await fetch(`${WORKER_BASE}/mcp/authorize?${params.toString()}`, {
      redirect: "manual",
    });

    // Should redirect to login page
    expect(res.status).toBe(302);
    const location = res.headers.get("Location");
    expect(location).toContain("/mcp-auth");
  });

  test("token endpoint requires valid authorization code", async () => {
    const res = await fetch(`${WORKER_BASE}/mcp/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: "invalid_code",
        client_id: clientId,
        code_verifier: codeVerifier,
        redirect_uri: "http://127.0.0.1:9999/callback",
      }).toString(),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_grant");
  });
});

