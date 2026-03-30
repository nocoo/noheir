/**
 * E2E: Settings (5 scenarios)
 *
 * 5. select by owner_id
 * 6. insert (create)
 * 7. update site_name
 * 8. update settings JSONB
 * 9. select returns null for new user
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import { makeSettings } from "./helpers/seed";
import type { SupabaseClient, User } from "@supabase/supabase-js";

let client: SupabaseClient;
let user: User;
let settingsId: number;

beforeAll(async () => {
  const auth = await createAuthenticatedClient("settings");
  client = auth.client;
  user = auth.user;
});

afterAll(async () => {
  if (user?.id) {
    await cleanupUser(user.id);
  }
});

describe("Settings E2E", () => {
  it("select returns empty for new user (no settings yet)", async () => {
    const { data, error } = await client
      .from("settings")
      .select("*")
      .eq("owner_id", user.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("insert creates a settings row", async () => {
    const payload = makeSettings({ owner_id: user.id });

    const { data, error } = await client
      .from("settings")
      .insert(payload)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.site_name).toBe("e2e-test");
    expect(data!.settings).toEqual({ theme: "dark", locale: "zh-CN" });
    expect(data!.owner_id).toBe(user.id);

    settingsId = data!.id;
  });

  it("select by owner_id fetches the settings", async () => {
    const { data, error } = await client
      .from("settings")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.id).toBe(settingsId);
    expect(data!.site_name).toBe("e2e-test");
  });

  it("update site_name", async () => {
    const { data, error } = await client
      .from("settings")
      .update({ site_name: "updated-name" })
      .eq("id", settingsId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.site_name).toBe("updated-name");
  });

  it("update settings JSONB merges correctly", async () => {
    const newSettings = { theme: "light", locale: "en-US", currency: "USD" };

    const { data, error } = await client
      .from("settings")
      .update({ settings: newSettings })
      .eq("id", settingsId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.settings).toEqual(newSettings);
  });
});
