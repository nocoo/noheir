import { beforeEach, describe, expect, test } from "vitest";
import { cleanupUser } from "./helpers/cleanup";
import { api, rawFetch, TEST_USER_A, TEST_USER_B } from "./helpers/client";

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

  test("forged owner and row identity cannot redirect settings writes", async () => {
    await cleanupUser(TEST_USER_B);
    const body = { ownerId: TEST_USER_B, id: 9123, siteName: "Own settings", settings: "{}" };
    const created = await api<{ settings: { id: number; ownerId: string } }>({
      method: "PUT",
      path: "/api/settings",
      userId,
      body,
    });
    expect(created.settings.ownerId).toBe(userId);
    expect(created.settings.id).not.toBe(body.id);
    await api({ method: "PUT", path: "/api/settings", userId, body });
    expect(await api({ path: "/api/settings", userId: TEST_USER_B })).toEqual({ settings: null });
    const own = await api<{ settings: { id: number; ownerId: string } }>({
      path: "/api/settings",
      userId,
    });
    expect(own.settings.id).toBe(created.settings.id);
    expect(own.settings.ownerId).toBe(userId);
  });

  test("settings rejects identity-only and malformed field values", async () => {
    for (const body of [{ ownerId: TEST_USER_B }, { siteName: 7 }, { settings: {} }]) {
      expect((await rawFetch({ method: "PUT", path: "/api/settings", userId, body })).status).toBe(
        400,
      );
    }
    expect(await api({ path: "/api/settings", userId })).toEqual({ settings: null });
  });
});
