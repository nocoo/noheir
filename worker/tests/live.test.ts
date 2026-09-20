import { describe, expect, test, vi } from "vitest";
import { liveHeaders, livePayload, liveStatus, resolveBuildSha } from "../lib/live";
import { APP_VERSION, COMPONENT_NAME } from "../lib/version";

describe("live payload", () => {
  test("connected probe is an uncached 200 with surety-standard body", () => {
    const payload = livePayload({
      connected: true,
      version: "2.6.4",
      buildSha: "abc123",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(liveStatus(true)).toBe(200);
    expect(liveHeaders()).toEqual({ "Cache-Control": "no-store" });
    expect(payload).toEqual({
      status: "ok",
      version: "2.6.4",
      component: COMPONENT_NAME,
      build_sha: "abc123",
      timestamp: "2026-01-01T00:00:00.000Z",
      database: { connected: true },
    });
    expect(payload).not.toHaveProperty("uptime");
    expect(JSON.stringify(payload)).not.toMatch(/private|WORKER_TOKEN|diagnostic/i);
  });

  test("failed probe is an uncached 503 without private diagnostics", () => {
    const payload = livePayload({ connected: false, buildSha: "deadbeef" });
    expect(liveStatus(false)).toBe(503);
    expect(payload.status).toBe("error");
    expect(payload.database).toEqual({ connected: false });
    expect(payload.version).toBe(APP_VERSION);
    expect(payload.component).toBe("noheir");
    expect(typeof payload.timestamp).toBe("string");
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    expect(JSON.stringify(payload)).not.toMatch(/private|test-only-token|stack/i);
  });

  test("resolveBuildSha uses fallback when the injected SHA is empty", () => {
    expect(resolveBuildSha("fallback-sha")).toBe("fallback-sha");
    expect(resolveBuildSha()).toBe("");
  });

  test("does not leak extra fields from the caller", () => {
    const payload = livePayload({
      connected: true,
      version: APP_VERSION,
      buildSha: "sha",
    });
    expect(Object.keys(payload).sort()).toEqual(
      ["build_sha", "component", "database", "status", "timestamp", "version"].sort(),
    );
  });
});

describe("live headers are stable", () => {
  test("always no-store", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
    expect(liveHeaders()["Cache-Control"]).toBe("no-store");
    vi.useRealTimers();
  });
});
