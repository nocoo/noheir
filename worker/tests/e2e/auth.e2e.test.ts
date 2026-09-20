import { describe, expect, test } from "vitest";
import { api, rawFetch, TEST_USER_A, TEST_USER_B, TOKENS } from "./helpers/client";

describe("Access authentication over HTTP", () => {
  test("rejects unauthenticated API and static requests", async () => {
    for (const path of ["/api/reports/metadata", "/", "/assets/private.js"]) {
      const response = await rawFetch({ path, omitAuth: true });
      expect([401, 403]).toContain(response.status);
    }
  });
  test.each(["expired", "audience", "issuer", "unknown"])("rejects %s identity", async (key) => {
    const response = await rawFetch({ path: "/api/auth/me", token: TOKENS[key] ?? "invalid" });
    expect([401, 403]).toContain(response.status);
  });
  test("rejects malformed and forged JWTs", async () => {
    for (const token of ["", "invalid", `${TOKENS[TEST_USER_A]}tampered`]) {
      const response = await rawFetch({ path: "/api/auth/me", token });
      expect([401, 403]).toContain(response.status);
    }
  });
  test("preserves the Google-era owner id and ignores forged user headers", async () => {
    const result = await api<{ user: { id: string; email: string } }>({
      path: "/api/auth/me",
      userId: TEST_USER_A,
      headers: { "X-User-Id": TEST_USER_B, Authorization: "Bearer old-shared-secret" },
    });
    expect(result.user.id).toBe(TEST_USER_A);
    expect(result.user.email).toBe(`${TEST_USER_A}@test.local`);
  });
  test("rejects cross-origin mutations even with a valid JWT", async () => {
    const response = await rawFetch({
      path: "/api/products",
      method: "POST",
      userId: TEST_USER_A,
      headers: { Origin: "https://attacker.example" },
      body: { name: "unexpected" },
    });
    expect(response.status).toBe(403);
  });
  test("returns JSON 404 for unknown API and removes SQL gateway", async () => {
    for (const path of ["/api/nonexistent", "/api/v1/query", "/api/v1/execute"]) {
      const response = await rawFetch({ path, method: "POST", body: { sql: "SELECT 1" } });
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
    }
  });
});
