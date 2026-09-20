import { beforeEach, describe, expect, test } from "vitest";
import { updateSettingsSchema } from "../db/validation";
import { getTestRepos, resetTestDb, seedUser } from "./setup";

describe("settings repo", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  test("getByUserId returns null when no settings", async () => {
    const repos = getTestRepos();
    const result = await repos.settings.getByUserId(userId);
    expect(result).toBeNull();
  });

  test("upsert creates new settings row", async () => {
    const repos = getTestRepos();
    const result = await repos.settings.upsert(userId, {
      siteName: "My Finance App",
      settings: '{"theme":"dark"}',
    });
    expect(result.ownerId).toBe(userId);
    expect(result.siteName).toBe("My Finance App");
    expect(result.settings).toBe('{"theme":"dark"}');
  });

  test("upsert updates existing settings", async () => {
    const repos = getTestRepos();
    await repos.settings.upsert(userId, { siteName: "Original" });
    const updated = await repos.settings.upsert(userId, { siteName: "Updated" });
    expect(updated.siteName).toBe("Updated");
  });

  test("getByUserId returns settings after upsert", async () => {
    const repos = getTestRepos();
    await repos.settings.upsert(userId, { siteName: "Test Site" });
    const result = await repos.settings.getByUserId(userId);
    expect(result).not.toBeNull();
    expect(result?.siteName).toBe("Test Site");
  });

  test("upsert is user-isolated", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    await repos.settings.upsert(userId, { siteName: "User 1" });
    await repos.settings.upsert("other-user", { siteName: "User 2" });

    const s1 = await repos.settings.getByUserId(userId);
    const s2 = await repos.settings.getByUserId("other-user");
    expect(s1?.siteName).toBe("User 1");
    expect(s2?.siteName).toBe("User 2");
  });

  test("upsert never accepts ownership or row identity from input", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    const input = { ownerId: "other-user", id: 9123, siteName: "Own settings" };
    const created = await repos.settings.upsert(userId, input);
    const updated = await repos.settings.upsert(userId, { ...input, siteName: "Updated" });
    expect(created.ownerId).toBe(userId);
    expect(created.id).not.toBe(input.id);
    expect(updated.id).toBe(created.id);
    expect(updated.ownerId).toBe(userId);
    expect(await repos.settings.getByUserId("other-user")).toBeNull();
  });

  test("settings payload strips identity and requires a typed writable field", () => {
    expect(updateSettingsSchema.parse({ ownerId: "other-user", siteName: "Own" })).toEqual({
      siteName: "Own",
    });
    for (const body of [null, {}, { ownerId: "other-user" }, { settings: {} }, { siteName: 3 }]) {
      expect(updateSettingsSchema.safeParse(body).success).toBe(false);
    }
  });
});
