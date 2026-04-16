import { describe, test, expect } from "bun:test";
import { rawFetch } from "./helpers/client";

describe("E2E: /api/live (surety-standard live check)", () => {
  test("returns 200 with surety-standard body", async () => {
    const res = await rawFetch({ path: "/api/live", omitAuth: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      version: string;
      component: string;
      timestamp: string;
      uptime: number;
      database: { connected: boolean };
    };
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(body.component).toBe("noheir-worker");
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.database.connected).toBe(true);
  });

  test("does not require auth headers", async () => {
    const res = await rawFetch({ path: "/api/live", omitAuth: true });
    expect(res.status).toBe(200);
  });

  test("works even with auth headers present", async () => {
    const res = await rawFetch({
      path: "/api/live",
      userId: "anyone",
    });
    expect(res.status).toBe(200);
  });

  test("/api/health redirects to /api/live", async () => {
    const res = await rawFetch({
      path: "/api/health",
      omitAuth: true,
      redirect: "manual",
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toContain("/api/live");
  });
});
