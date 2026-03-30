import { describe, test, expect, beforeEach } from "bun:test";
import { resetTestDb, getTestRepos, seedUser } from "./setup";

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
    expect(result!.siteName).toBe("Test Site");
  });

  test("upsert is user-isolated", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    await repos.settings.upsert(userId, { siteName: "User 1" });
    await repos.settings.upsert("other-user", { siteName: "User 2" });

    const s1 = await repos.settings.getByUserId(userId);
    const s2 = await repos.settings.getByUserId("other-user");
    expect(s1!.siteName).toBe("User 1");
    expect(s2!.siteName).toBe("User 2");
  });
});
