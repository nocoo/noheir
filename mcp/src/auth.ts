/**
 * Supabase authentication for MCP server
 *
 * Creates an authenticated Supabase client using a refresh token
 * passed via environment variable. The client carries the user's
 * session so that RLS policies enforce data isolation.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  refreshToken: string;
}

/**
 * Read auth config from environment variables.
 * Throws if any required variable is missing.
 */
export function getAuthConfig(): AuthConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const refreshToken = process.env.SUPABASE_REFRESH_TOKEN;

  if (!supabaseUrl) throw new Error("SUPABASE_URL environment variable is required");
  if (!supabaseAnonKey) throw new Error("SUPABASE_ANON_KEY environment variable is required");
  if (!refreshToken) throw new Error("SUPABASE_REFRESH_TOKEN environment variable is required");

  return { supabaseUrl, supabaseAnonKey, refreshToken };
}

/**
 * Create an authenticated Supabase client by exchanging the refresh token
 * for a fresh session.
 */
export async function createAuthenticatedSupabaseClient(
  config: AuthConfig,
): Promise<SupabaseClient> {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.refreshSession({
    refresh_token: config.refreshToken,
  });

  if (error || !data.session) {
    throw new Error(
      `Failed to authenticate with refresh token: ${error?.message ?? "no session returned"}`,
    );
  }

  // Return a new client with the access token baked in
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    },
  });
}
