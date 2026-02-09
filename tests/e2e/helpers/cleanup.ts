/**
 * Teardown helpers for E2E tests.
 *
 * Uses service_role client (bypasses RLS) to delete all data
 * belonging to a specific test user, then deletes the user itself.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase-client";

const TABLES = [
  "capital_units",
  "financial_products",
  "transactions",
  "transfers",
  "settings",
] as const;

/**
 * Delete all data owned by `userId` from every app table,
 * then delete the auth user.
 */
export async function cleanupUser(userId: string) {
  const service = createServiceClient();

  // Delete from all tables (order matters due to FK: units before products)
  for (const table of TABLES) {
    const col = table === "settings" ? "owner_id" : "user_id";
    await service.from(table).delete().eq(col, userId);
  }

  // Delete the auth user
  await service.auth.admin.deleteUser(userId);
}

/**
 * Delete data from specific tables for a user.
 */
export async function cleanupTables(
  service: SupabaseClient,
  userId: string,
  tables: readonly string[]
) {
  for (const table of tables) {
    const col = table === "settings" ? "owner_id" : "user_id";
    await service.from(table).delete().eq(col, userId);
  }
}
