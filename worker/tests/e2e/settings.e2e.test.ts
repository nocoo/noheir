import { describe, test, expect, beforeEach } from "vitest";
import { api, TEST_USER_A } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";

const userId = TEST_USER_A;

describe("E2E: Settings", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  test("GET /api/settings returns null when no settings exist", async () => {
    const res = await api<{ settings: unknown }>({
      method: "GET",
      path: "/api/settings",
      userId,
    });
    expect(res.settings).toBeNull();
  });

  test("PUT /api/settings creates settings (upsert)", async () => {
    const res = await api<{ settings: Record<string, unknown> }>({
      method: "PUT",
      path: "/api/settings",
      userId,
      body: { siteName: "Test Site", settings: '{"theme":"dark"}' },
    });
    expect(res.settings).toBeDefined();
    expect(res.settings.siteName).toBe("Test Site");
  });

  test("PUT /api/settings updates existing settings", async () => {
    await api({
      method: "PUT",
      path: "/api/settings",
      userId,
      body: { siteName: "V1", settings: "{}" },
    });

    const res = await api<{ settings: Record<string, unknown> }>({
      method: "PUT",
      path: "/api/settings",
      userId,
      body: { siteName: "V2" },
    });
    expect(res.settings.siteName).toBe("V2");
  });

  test("GET /api/settings returns previously saved settings", async () => {
    await api({
      method: "PUT",
      path: "/api/settings",
      userId,
      body: { siteName: "Saved", settings: '{"lang":"zh"}' },
    });

    const res = await api<{ settings: Record<string, unknown> }>({
      method: "GET",
      path: "/api/settings",
      userId,
    });
    expect(res.settings.siteName).toBe("Saved");
  });
});
