import { beforeEach, describe, expect, test } from "vitest";
import { getTestRepos, resetTestDb, seedUser } from "./setup";

describe("users.findByNormalizedEmail", () => {
  beforeEach(() => {
    resetTestDb();
  });

  test("matches Google-era id case-insensitively and does not create users", async () => {
    const id = seedUser("google-sub-original", "Owner@Example.com");
    const repos = getTestRepos();
    const rows = await repos.users.findByNormalizedEmail(" owner@example.com ");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(id);
    expect(rows[0]?.id).toBe("google-sub-original");
  });

  test("unknown email is empty; ambiguous normalized emails return both", async () => {
    seedUser("a", "user@example.com");
    seedUser("b", " User@example.com ");
    const repos = getTestRepos();
    expect(await repos.users.findByNormalizedEmail("missing@example.com")).toEqual([]);
    const both = await repos.users.findByNormalizedEmail("user@example.com");
    expect(both.map((row) => row.id).sort()).toEqual(["a", "b"]);
  });
});
