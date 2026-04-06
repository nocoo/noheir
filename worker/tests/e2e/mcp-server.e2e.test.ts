/**
 * E2E Tests for MCP Server Endpoint
 */

import { describe, test, expect } from "bun:test";
import { BASE_URL } from "./helpers/client";

const WORKER_BASE = BASE_URL;

describe("E2E: MCP Server", () => {
  describe("GET /mcp (SSE notifications)", () => {
    test("returns 405 Method Not Allowed", async () => {
      const res = await fetch(`${WORKER_BASE}/mcp`);
      expect(res.status).toBe(405);

      const body = await res.json() as { error: string };
      expect(body.error).toContain("not supported");
    });
  });

  describe("DELETE /mcp (session close)", () => {
    test("returns 200 with closed: true", async () => {
      const res = await fetch(`${WORKER_BASE}/mcp`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const body = await res.json() as { closed: boolean };
      expect(body.closed).toBe(true);
    });
  });

  describe("POST /mcp (main endpoint)", () => {
    test("returns 401 without Authorization header", async () => {
      const res = await fetch(`${WORKER_BASE}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });
      expect(res.status).toBe(401);
    });

    test("returns 401 with invalid token", async () => {
      const res = await fetch(`${WORKER_BASE}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid_token",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });
      expect(res.status).toBe(401);
    });

    // Note: Testing with valid token requires full OAuth flow setup
    // which is covered in mcp-oauth.e2e.test.ts
  });
});
