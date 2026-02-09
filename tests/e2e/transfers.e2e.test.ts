/**
 * E2E: Transfers (5 scenarios)
 *
 * 19. select all ordered
 * 20. insert batch
 * 21. delete by year
 * 22. delete all
 * 23. delete + re-insert (replace pattern)
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import { makeTransfer } from "./helpers/seed";
import type { SupabaseClient, User } from "@supabase/supabase-js";

let client: SupabaseClient;
let user: User;

beforeAll(async () => {
  const auth = await createAuthenticatedClient("xfer");
  client = auth.client;
  user = auth.user;
});

afterAll(async () => {
  if (user?.id) {
    await cleanupUser(user.id);
  }
});

describe("Transfers E2E", () => {
  const seed = [
    makeTransfer({ year: 2025, month: 6, day: 1, date: "2025-06-01", outflow_amount: 500, account: "招商银行" }),
    makeTransfer({ year: 2025, month: 12, day: 15, date: "2025-12-15", outflow_amount: 1000, account: "平安银行" }),
    makeTransfer({ year: 2026, month: 1, day: 10, date: "2026-01-10", inflow_amount: 2000, outflow_amount: 0, account: "微众银行", transaction_type: "转入" }),
  ];

  it("insert batch inserts multiple transfers", async () => {
    const { data, error } = await client
      .from("transfers")
      .insert(seed)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  it("select all ordered by date desc", async () => {
    const { data, error } = await client
      .from("transfers")
      .select("*")
      .order("date", { ascending: false });

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(3);
    // Verify descending order
    for (let i = 1; i < data!.length; i++) {
      expect(data![i - 1].date >= data![i].date).toBe(true);
    }
  });

  it("delete by year removes only that year", async () => {
    const { error } = await client
      .from("transfers")
      .delete()
      .eq("year", 2025);

    expect(error).toBeNull();

    const { count } = await client
      .from("transfers")
      .select("*", { count: "exact", head: true })
      .eq("year", 2025);

    expect(count).toBe(0);

    // 2026 still present
    const { count: count2026 } = await client
      .from("transfers")
      .select("*", { count: "exact", head: true })
      .eq("year", 2026);

    expect(count2026).toBe(1);
  });

  it("delete + re-insert (replace pattern)", async () => {
    // Delete all 2026 transfers
    await client.from("transfers").delete().eq("year", 2026);

    // Re-insert with different data
    const replacement = [
      makeTransfer({ year: 2026, month: 2, day: 1, date: "2026-02-01", outflow_amount: 3000, account: "招商银行" }),
      makeTransfer({ year: 2026, month: 2, day: 5, date: "2026-02-05", inflow_amount: 500, outflow_amount: 0, account: "支付宝", transaction_type: "转入" }),
    ];

    const { data, error } = await client
      .from("transfers")
      .insert(replacement)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    // Verify only the new records exist for 2026
    const { data: all2026 } = await client
      .from("transfers")
      .select("*")
      .eq("year", 2026);

    expect(all2026).toHaveLength(2);
    expect(all2026![0].account).toBeDefined();
  });

  it("delete all removes remaining transfers", async () => {
    const { error } = await client
      .from("transfers")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    expect(error).toBeNull();

    const { count } = await client
      .from("transfers")
      .select("*", { count: "exact", head: true });

    expect(count).toBe(0);
  });
});
