import { createHash, randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { api, BASE_URL, rawFetch, TEST_USER_A, TEST_USER_B } from "./helpers/client";

import { makeTransaction } from "./helpers/seed";

const redirectUri = "http://127.0.0.1:54321/callback";
const form = (path: string, fields: Record<string, string>) =>
  fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: new URLSearchParams(fields),
    redirect: "manual",
  });
async function registration() {
  const response = await fetch(`${BASE_URL}/api/mcp/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "isolated-mcp-test",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { client_id: string };
}
async function authorization(clientId: string) {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomUUID();
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  const authorize = await rawFetch({ path: `/api/mcp/authorize?${query}`, userId: TEST_USER_A });
  expect(authorize.status).toBe(302);
  const callback = new URL(authorize.headers.get("location") ?? "");
  expect(callback.pathname).toBe("/api/mcp/callback");
  const wrongOwner = await rawFetch({
    path: `${callback.pathname}${callback.search}`,
    userId: TEST_USER_B,
  });
  expect(wrongOwner.status).toBe(400);
  const result = await rawFetch({
    path: `${callback.pathname}${callback.search}`,
    userId: TEST_USER_A,
  });
  expect(result.status).toBe(302);
  const target = new URL(result.headers.get("location") ?? "");
  expect(target.origin).toBe(new URL(redirectUri).origin);
  expect(target.searchParams.get("state")).toBe(state);
  const code = target.searchParams.get("code");
  if (!code) throw new Error("Authorization code missing");
  expect(
    (await rawFetch({ path: `${callback.pathname}${callback.search}`, userId: TEST_USER_A }))
      .status,
  ).toBe(400);
  return { verifier, code };
}
async function mcp(token: string, method: string, params: unknown = {}) {
  return fetch(`${BASE_URL}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

describe("Native MCP OAuth without an Access machine session", () => {
  test("discovery is public while browser authorization remains protected", async () => {
    const metadata = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`, {
      redirect: "manual",
    });
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({
      issuer: "https://noheir.hexly.ai",
      code_challenge_methods_supported: ["S256"],
    });
    for (const path of ["/api/mcp/authorize", "/api/mcp/callback"]) {
      const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
      expect([401, 403]).toContain(response.status);
    }
    expect((await mcp("invalid", "tools/list")).status).toBe(401);
  });

  test("rejects non-loopback registration and unregistered redirects", async () => {
    const invalid = await fetch(`${BASE_URL}/api/mcp/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "invalid",
        redirect_uris: ["https://attacker.example/callback"],
      }),
    });
    expect(invalid.status).toBe(400);
    for (const body of [
      null,
      { client_name: "invalid", redirect_uris: [redirectUri], grant_types: "authorization_code" },
    ]) {
      const response = await fetch(`${BASE_URL}/api/mcp/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
    }
    const client = await registration();
    const query = new URLSearchParams({
      client_id: client.client_id,
      response_type: "code",
      redirect_uri: "http://127.0.0.1:54322/other",
      code_challenge: "A".repeat(43),
      code_challenge_method: "S256",
      state: crypto.randomUUID(),
    });
    expect((await rawFetch({ path: `/api/mcp/authorize?${query}` })).status).toBe(400);
  });

  test("revoking a refresh token invalidates its access token too", async () => {
    const client = await registration();
    const { code, verifier } = await authorization(client.client_id);
    const response = await form("/api/mcp/token", {
      grant_type: "authorization_code",
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    });
    expect(response.status).toBe(200);
    const tokens = (await response.json()) as { access_token: string; refresh_token: string };
    expect((await form("/api/mcp/revoke", { token: tokens.refresh_token })).status).toBe(200);
    expect((await mcp(tokens.access_token, "tools/list")).status).toBe(401);
    expect(
      (
        await form("/api/mcp/token", {
          grant_type: "refresh_token",
          client_id: client.client_id,
          refresh_token: tokens.refresh_token,
        })
      ).status,
    ).toBe(400);
  });

  test("PKCE, single-use code, refresh rotation and revocation survive the runtime move", async () => {
    const client = await registration();
    const { code, verifier } = await authorization(client.client_id);
    const fields = {
      grant_type: "authorization_code",
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    };
    expect(
      (await form("/api/mcp/token", { ...fields, code_verifier: "wrong-verifier" })).status,
    ).toBe(400);
    const attempts = await Promise.all([
      form("/api/mcp/token", fields),
      form("/api/mcp/token", fields),
    ]);
    expect(attempts.map((r) => r.status).sort()).toEqual([200, 400]);
    const success = attempts.find((r) => r.status === 200);
    if (!success) throw new Error("Token exchange missing");
    const tokens = (await success.json()) as { access_token: string; refresh_token: string };
    const initialize = await mcp(tokens.access_token, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(initialize.status).toBe(200);
    expect(await initialize.json()).toMatchObject({ result: { serverInfo: { name: "noheir" } } });
    const tools = await mcp(tokens.access_token, "tools/list");
    expect(tools.status).toBe(200);
    const result = (await tools.json()) as { result: { tools: { name: string }[] } };
    expect(result.result.tools.length).toBeGreaterThan(5);
    for (const owner of [TEST_USER_A, TEST_USER_B]) {
      await api({
        path: "/api/transactions",
        method: "POST",
        userId: owner,
        body: makeTransaction({ note: `mcp-isolation-${owner}` }),
      });
    }
    const query = await mcp(tokens.access_token, "tools/call", {
      name: "query_transactions",
      arguments: { keyword: "mcp-isolation" },
    });
    expect(query.status).toBe(200);
    const queryBody = await query.text();
    expect(queryBody).toContain(`mcp-isolation-${TEST_USER_A}`);
    expect(queryBody).not.toContain(`mcp-isolation-${TEST_USER_B}`);
    const refreshFields = {
      grant_type: "refresh_token",
      client_id: client.client_id,
      refresh_token: tokens.refresh_token,
    };
    expect(
      (
        await form("/api/mcp/token", {
          ...refreshFields,
          client_id: "wrong-client",
        })
      ).status,
    ).toBe(400);
    const refreshes = await Promise.all([
      form("/api/mcp/token", refreshFields),
      form("/api/mcp/token", refreshFields),
    ]);
    expect(refreshes.map((r) => r.status).sort()).toEqual([200, 400]);
    const refreshed = (await refreshes.find((r) => r.status === 200)?.json()) as {
      access_token: string;
      refresh_token: string;
    };
    expect((await mcp(tokens.access_token, "tools/list")).status).toBe(401);
    expect((await mcp(refreshed.access_token, "tools/list")).status).toBe(200);
    expect((await form("/api/mcp/revoke", { token: refreshed.access_token })).status).toBe(200);
    expect((await mcp(refreshed.access_token, "tools/list")).status).toBe(401);
    expect(
      (await form("/api/mcp/token", { ...refreshFields, refresh_token: refreshed.refresh_token }))
        .status,
    ).toBe(400);
  });
});
