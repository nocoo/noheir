import { describe, test, expect } from "bun:test";
import { rawFetch } from "./helpers/client";

describe("E2E: /api/health (health check)", () => {
  test("returns 200 with status ok", async () => {
    const res = await rawFetch({ path: "/api/health", omitAuth: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: number };
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeGreaterThan(0);
  });

  test("does not require auth headers", async () => {
    const res = await rawFetch({ path: "/api/health", omitAuth: true });
    expect(res.status).toBe(200);
  });

  test("works even with auth headers present", async () => {
    const res = await rawFetch({
      path: "/api/health",
      userId: "anyone",
    });
    expect(res.status).toBe(200);
  });
});
