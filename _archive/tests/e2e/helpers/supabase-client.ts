/**
 * Supabase client helpers for E2E tests.
 *
 * All clients point at the LOCAL Supabase instance (supabase start).
 * Credentials are the well-known demo keys — safe to commit.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Local Supabase demo credentials (from `supabase start`)
// These are deterministic keys baked into the local dev container — NOT secrets.
// ---------------------------------------------------------------------------
const SUPABASE_URL = "http://127.0.0.1:54321";

const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/** Anonymous client — simulates unauthenticated browser requests. */
export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client — bypasses RLS, used for cleanup / seed. */
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Create a fresh test user and return an authenticated client.
 *
 * @param suffix  Optional suffix appended to the email to avoid collisions.
 * @returns `{ client, user, email, password }`
 */
export async function createAuthenticatedClient(suffix?: string) {
  const id = suffix ?? crypto.randomUUID().slice(0, 8);
  const email = `e2e-${id}@test.local`;
  const password = "Test1234!";

  const anon = createAnonClient();

  // Sign up
  const { data: signUpData, error: signUpError } = await anon.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    throw new Error(`signUp failed for ${email}: ${signUpError.message}`);
  }

  // Local Supabase auto-confirms email by default, so we can sign in immediately.
  const { data: signInData, error: signInError } =
    await anon.auth.signInWithPassword({ email, password });

  if (signInError) {
    throw new Error(`signIn failed for ${email}: ${signInError.message}`);
  }

  const session = signInData.session!;
  const user = signInData.user!;

  // Build a client that carries the session token
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  });

  return { client, user, email, password, session };
}
