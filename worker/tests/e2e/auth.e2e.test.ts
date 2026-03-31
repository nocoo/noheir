import { describe, test, expect } from "bun:test";
import { rawFetch, TEST_USER_A } from "./helpers/client";

describe("E2E: Auth middleware", () => {
  test("401 when no Authorization header", async () => {
    const res = await rawFetch({
      path: "/api/metadata",
      userId: TEST_USER_A,
      omitAuth: true,
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Authorization");
  });

  test("403 when invalid Bearer token", async () => {
    const res = await rawFetch({
      path: "/api/metadata",
      userId: TEST_USER_A,
      token: "wrong-token-value",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Invalid");
  });

  test("400 when missing X-User-Id header", async () => {
    const res = await rawFetch({
      path: "/api/metadata",
      // userId omitted
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("User-Id");
  });

  test("401 when token is empty string", async () => {
    const res = await rawFetch({
      path: "/api/metadata",
      userId: TEST_USER_A,
      token: "",
    });
    // "Bearer " with empty token → Headers trim trailing space → "Bearer" →
    // does not startsWith("Bearer ") → 401
    expect(res.status).toBe(401);
  });

  test("200 when valid auth headers are present", async () => {
    const res = await rawFetch({
      path: "/api/metadata",
      userId: TEST_USER_A,
    });
    expect(res.status).toBe(200);
  });

  test("404 for unknown routes with valid auth", async () => {
    const res = await rawFetch({
      path: "/api/nonexistent",
      userId: TEST_USER_A,
    });
    expect(res.status).toBe(404);
  });
});
