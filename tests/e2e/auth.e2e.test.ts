/**
 * E2E: Auth (4 scenarios)
 *
 * 1. signUp creates a new user
 * 2. signInWithPassword returns a valid session
 * 3. getSession returns the current session
 * 4. signOut invalidates the session
 */

import { describe, it, expect, afterAll } from "bun:test";
import {
  createAnonClient,
  createAuthenticatedClient,
} from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";

const TEST_ID = `auth-${Date.now()}`;
const EMAIL = `e2e-${TEST_ID}@test.local`;
const PASSWORD = "Test1234!";

let userId: string | undefined;

afterAll(async () => {
  if (userId) {
    await cleanupUser(userId);
  }
});

describe("Auth E2E", () => {
  it("signUp creates a new user", async () => {
    const anon = createAnonClient();

    const { data, error } = await anon.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user!.email).toBe(EMAIL);
    expect(data.user!.id).toBeDefined();

    userId = data.user!.id;
  });

  it("signInWithPassword returns a valid session", async () => {
    const anon = createAnonClient();

    const { data, error } = await anon.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });

    expect(error).toBeNull();
    expect(data.session).toBeDefined();
    expect(data.session!.access_token).toBeDefined();
    expect(data.session!.refresh_token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user!.email).toBe(EMAIL);
  });

  it("getSession returns the current session after sign-in", async () => {
    const anon = createAnonClient();

    // Sign in first
    const { data: signInData } = await anon.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });

    expect(signInData.session).toBeDefined();

    // getSession should return the session
    const { data: sessionData, error } = await anon.auth.getSession();

    expect(error).toBeNull();
    expect(sessionData.session).toBeDefined();
    expect(sessionData.session!.user.email).toBe(EMAIL);
  });

  it("signOut invalidates the session", async () => {
    const anon = createAnonClient();

    // Sign in
    await anon.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });

    // Sign out
    const { error } = await anon.auth.signOut();
    expect(error).toBeNull();

    // After signOut, getSession should return null session
    const { data: sessionData } = await anon.auth.getSession();
    expect(sessionData.session).toBeNull();
  });
});
