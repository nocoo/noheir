/**
 * E2E: RLS Security (13 scenarios)
 *
 * Anon access denial:
 *   1. anon cannot read any table
 *   2. anon cannot call any RPC function (all 5)
 *
 * Cross-user read isolation:
 *   3. user B cannot read user A's transactions
 *   4. user B cannot read user A's transfers
 *   5. user B cannot read user A's settings
 *   6. user B cannot read user A's products/units
 *
 * Cross-user write isolation:
 *   7. user B cannot UPDATE user A's transaction
 *   8. user B cannot DELETE user A's transaction
 *   9. user B cannot UPDATE user A's transfer
 *  10. user B cannot DELETE user A's transfer
 *
 * Cross-user RPC isolation:
 *  11. user B gets empty from search_transactions_fuzzy on user A's data
 *  12. user B gets empty from search_transfers_fuzzy on user A's data
 *  13. user B gets zero counts from get_financial_metadata / get_monthly_report
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import {
  createAnonClient,
  createAuthenticatedClient,
} from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import {
  makeTransaction,
  makeTransfer,
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
let transferIdA: string;
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

  const { data: transfer } = await clientA
    .from("transfers")
    .insert(makeTransfer({ note: "userA secret transfer" }))
    .select()
    .single();
  transferIdA = transfer!.id;

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
  // =========================================================================
  // Anon access denial
  // =========================================================================

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

  it("anon cannot call any RPC function", async () => {
    const anon = createAnonClient();

    // All 5 RPC functions should fail or return empty for anon
    const rpcs = [
      { name: "get_units_with_products", params: {} },
      { name: "search_transactions_fuzzy", params: { p_keyword: "test" } },
      { name: "search_transfers_fuzzy", params: { p_keyword: "test" } },
      { name: "get_financial_metadata", params: {} },
      { name: "get_monthly_report", params: { p_year: 2026, p_month: 1 } },
    ];

    for (const rpc of rpcs) {
      const { data, error } = await anon.rpc(rpc.name, rpc.params);

      if (error) {
        expect(error.code).toBeDefined();
      } else if (Array.isArray(data)) {
        expect(data).toEqual([]);
      } else if (data && typeof data === "object") {
        // get_monthly_report returns JSON — counts should be 0
        const d = data as Record<string, unknown>;
        if ("transaction_count" in d) {
          expect(d.transaction_count).toBe(0);
        }
      }
    }
  });

  // =========================================================================
  // Cross-user read isolation
  // =========================================================================

  it("user B cannot read user A's transactions", async () => {
    const { data, error } = await clientB
      .from("transactions")
      .select("*")
      .eq("id", txnIdA);

    expect(error).toBeNull();
    // RLS silently filters — returns empty, NOT an error
    expect(data).toEqual([]);
  });

  it("user B cannot read user A's transfers", async () => {
    const { data, error } = await clientB
      .from("transfers")
      .select("*")
      .eq("id", transferIdA);

    expect(error).toBeNull();
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

  // =========================================================================
  // Cross-user write isolation (UPDATE / DELETE)
  // =========================================================================

  it("user B cannot UPDATE user A's transaction", async () => {
    const { data, error } = await clientB
      .from("transactions")
      .update({ note: "hacked by B" })
      .eq("id", txnIdA)
      .select();

    // RLS silently filters — 0 rows matched, no error
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Verify user A's data is unchanged
    const { data: original } = await clientA
      .from("transactions")
      .select("note")
      .eq("id", txnIdA)
      .single();
    expect(original!.note).toBe("userA secret transaction");
  });

  it("user B cannot DELETE user A's transaction", async () => {
    const { error } = await clientB
      .from("transactions")
      .delete()
      .eq("id", txnIdA);

    expect(error).toBeNull();

    // Verify user A's data still exists
    const { data: still } = await clientA
      .from("transactions")
      .select("id")
      .eq("id", txnIdA);
    expect(still!.length).toBe(1);
  });

  it("user B cannot UPDATE user A's transfer", async () => {
    const { data, error } = await clientB
      .from("transfers")
      .update({ note: "hacked by B" })
      .eq("id", transferIdA)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Verify user A's data is unchanged
    const { data: original } = await clientA
      .from("transfers")
      .select("note")
      .eq("id", transferIdA)
      .single();
    expect(original!.note).toBe("userA secret transfer");
  });

  it("user B cannot DELETE user A's transfer", async () => {
    const { error } = await clientB
      .from("transfers")
      .delete()
      .eq("id", transferIdA);

    expect(error).toBeNull();

    // Verify user A's data still exists
    const { data: still } = await clientA
      .from("transfers")
      .select("id")
      .eq("id", transferIdA);
    expect(still!.length).toBe(1);
  });

  // =========================================================================
  // Cross-user RPC isolation
  // =========================================================================

  it("user B gets empty from search_transactions_fuzzy on user A's data", async () => {
    // User A's transaction has note "userA secret transaction"
    const { data, error } = await clientB.rpc("search_transactions_fuzzy", {
      p_keyword: "userA secret",
    });

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("user B gets empty from search_transfers_fuzzy on user A's data", async () => {
    // User A's transfer has note "userA secret transfer"
    const { data, error } = await clientB.rpc("search_transfers_fuzzy", {
      p_keyword: "userA secret",
    });

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("user B gets zero counts from get_financial_metadata and get_monthly_report", async () => {
    // get_financial_metadata — user B has no data
    const { data: meta, error: metaError } = await clientB.rpc(
      "get_financial_metadata"
    );
    expect(metaError).toBeNull();
    expect(meta.transaction_count).toBe(0);
    expect(meta.transfer_count).toBe(0);

    // get_monthly_report — same month as user A's seeded data
    const { data: report, error: reportError } = await clientB.rpc(
      "get_monthly_report",
      { p_year: 2026, p_month: 1 }
    );
    expect(reportError).toBeNull();
    expect(report.transaction_count).toBe(0);
    expect(report.transfer_count).toBe(0);
    expect(report.total_income).toBe(0);
    expect(report.total_expense).toBe(0);
  });
});
