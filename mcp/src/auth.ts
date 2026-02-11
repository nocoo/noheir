/**
 * Supabase authentication for MCP server
 *
 * Creates an authenticated Supabase client using email/password login.
 * Unlike the previous refresh-token approach, passwords never expire,
 * so the MCP server can always start successfully regardless of how
 * long it has been idle.
 *
 * Uses setSession() + autoRefreshToken so the access token is
 * automatically refreshed before expiry (default JWT lifetime: 1h).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  email: string;
  password: string;
}

/**
 * Read auth config from environment variables.
 * Throws if any required variable is missing.
 */
export function getAuthConfig(): AuthConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const email = process.env.SUPABASE_EMAIL;
  const password = process.env.SUPABASE_PASSWORD;

  if (!supabaseUrl) throw new Error("SUPABASE_URL environment variable is required");
  if (!supabaseAnonKey) throw new Error("SUPABASE_ANON_KEY environment variable is required");
  if (!email) throw new Error("SUPABASE_EMAIL environment variable is required");
  if (!password) throw new Error("SUPABASE_PASSWORD environment variable is required");

  return { supabaseUrl, supabaseAnonKey, email, password };
}

/**
 * Create an authenticated Supabase client by signing in with email/password.
 * Uses setSession() so the client manages token refresh automatically.
 */
export async function createAuthenticatedSupabaseClient(
  config: AuthConfig,
): Promise<SupabaseClient> {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });

  if (error || !data.session) {
    throw new Error(
      `Failed to authenticate with email/password: ${error?.message ?? "no session returned"}`,
    );
  }

  return client;
}
