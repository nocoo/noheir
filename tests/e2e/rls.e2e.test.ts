/**
 * E2E: RLS Security (5 scenarios)
 *
 * 44. anon cannot read any table
 * 45. user A cannot read user B's transactions
 * 46. user A cannot read user B's settings
 * 47. user A cannot read user B's products/units
 * 48. anon cannot call RPC functions
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import {
  createAnonClient,
  createAuthenticatedClient,
} from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import {
  makeTransaction,
  makeSettings,
  makeProduct,
  makeUnit,
} from "./helpers/seed";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Two authenticated users for cross-user isolation tests
let clientA: SupabaseClient;
let userA: User;
let clientB: SupabaseClient;
let userB: User;

// Data IDs inserted by user A
let txnIdA: string;
let settingsIdA: number;
let productIdA: string;
let unitIdA: string;

beforeAll(async () => {
  // Create two independent users
  const authA = await createAuthenticatedClient("rls-a");
  clientA = authA.client;
  userA = authA.user;

  const authB = await createAuthenticatedClient("rls-b");
  clientB = authB.client;
  userB = authB.user;

  // Seed data for user A
  const { data: txn } = await clientA
    .from("transactions")
    .insert(makeTransaction({ note: "userA secret transaction" }))
    .select()
    .single();
  txnIdA = txn!.id;

  const { data: settings } = await clientA
    .from("settings")
    .insert(makeSettings({ owner_id: userA.id, site_name: "userA-site" }))
    .select()
    .single();
  settingsIdA = settings!.id;

  const { data: product } = await clientA
    .from("financial_products")
    .insert(makeProduct({ name: "userA 基金" }))
    .select()
    .single();
  productIdA = product!.id;

  const { data: unit } = await clientA
    .from("capital_units")
    .insert(makeUnit({ unit_code: "RLS-A-001", product_id: productIdA }))
    .select()
    .single();
  unitIdA = unit!.id;
});

afterAll(async () => {
  if (userA?.id) await cleanupUser(userA.id);
  if (userB?.id) await cleanupUser(userB.id);
});

describe("RLS Security E2E", () => {
  // --- Anon tests ---

  it("anon cannot read any table", async () => {
    const anon = createAnonClient();
    const tables = [
      "transactions",
      "transfers",
      "financial_products",
      "capital_units",
      "settings",
    ];

    for (const table of tables) {
      const { data, error } = await anon.from(table).select("*");
      // RLS blocks: either error or empty array (depending on table grants)
      // Our schema grants NO access to anon, so we expect an error
      if (error) {
        // Permission denied or insufficient privilege
        expect(error.code).toBeDefined();
      } else {
        // Even if no error, data should be empty (RLS filters everything)
        expect(data).toEqual([]);
      }
    }
  });

  // --- Cross-user isolation ---

  it("user B cannot read user A's transactions", async () => {
    const { data, error } = await clientB
      .from("transactions")
      .select("*")
      .eq("id", txnIdA);

    expect(error).toBeNull();
    // RLS silently filters — returns empty, NOT an error
    expect(data).toEqual([]);
  });

  it("user B cannot read user A's settings", async () => {
    const { data, error } = await clientB
      .from("settings")
      .select("*")
      .eq("id", settingsIdA);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("user B cannot read user A's products/units", async () => {
    // Products
    const { data: products } = await clientB
      .from("financial_products")
      .select("*")
      .eq("id", productIdA);
    expect(products).toEqual([]);

    // Units
    const { data: units } = await clientB
      .from("capital_units")
      .select("*")
      .eq("id", unitIdA);
    expect(units).toEqual([]);
  });

  // --- Anon RPC ---

  it("anon cannot call RPC functions", async () => {
    const anon = createAnonClient();

    // get_units_with_products — should fail or return empty
    const { data: unitsData, error: unitsError } = await anon.rpc(
      "get_units_with_products"
    );

    if (unitsError) {
      expect(unitsError.code).toBeDefined();
    } else {
      // If no error, should be empty (no auth.uid() match)
      expect(unitsData).toEqual([]);
    }

    // search_transactions_fuzzy — should fail or return empty
    const { data: searchData, error: searchError } = await anon.rpc(
      "search_transactions_fuzzy",
      { p_keyword: "test" }
    );

    if (searchError) {
      expect(searchError.code).toBeDefined();
    } else {
      expect(searchData).toEqual([]);
    }
  });
});
