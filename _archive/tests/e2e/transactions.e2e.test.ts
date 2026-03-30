/**
 * E2E: Transactions (9 scenarios)
 *
 * 10. select distinct years
 * 11. select all ordered
 * 12. select by year
 * 13. select count by year
 * 14. insert batch
 * 15. delete by year
 * 16. delete all
 * 17. select latest year
 * 18. select years excluding one
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import { makeTransaction } from "./helpers/seed";
import type { SupabaseClient, User } from "@supabase/supabase-js";

let client: SupabaseClient;
let user: User;

beforeAll(async () => {
  const auth = await createAuthenticatedClient("txn");
  client = auth.client;
  user = auth.user;
});

afterAll(async () => {
  if (user?.id) {
    await cleanupUser(user.id);
  }
});

describe("Transactions E2E", () => {
  // Seed data: transactions across 2025 and 2026
  const seed2025 = [
    makeTransaction({ year: 2025, month: 3, day: 10, date: "2025-03-10", amount: 100, primary_category: "餐饮" }),
    makeTransaction({ year: 2025, month: 6, day: 20, date: "2025-06-20", amount: 200, primary_category: "交通" }),
  ];
  const seed2026 = [
    makeTransaction({ year: 2026, month: 1, day: 5, date: "2026-01-05", amount: 50, primary_category: "餐饮" }),
    makeTransaction({ year: 2026, month: 2, day: 8, date: "2026-02-08", amount: 80, primary_category: "购物" }),
    makeTransaction({ year: 2026, month: 2, day: 9, date: "2026-02-09", amount: 120, type: "income", primary_category: "工资" }),
  ];

  it("insert batch inserts multiple transactions", async () => {
    const allRows = [...seed2025, ...seed2026];
    const { data, error } = await client
      .from("transactions")
      .insert(allRows)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(5);
  });

  it("select all ordered by date desc", async () => {
    const { data, error } = await client
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(5);
    // Verify descending order
    for (let i = 1; i < data!.length; i++) {
      expect(data![i - 1].date >= data![i].date).toBe(true);
    }
  });

  it("select distinct years", async () => {
    // Supabase doesn't have DISTINCT directly, but we can select year and deduplicate
    const { data, error } = await client
      .from("transactions")
      .select("year")
      .order("year", { ascending: false });

    expect(error).toBeNull();
    const years = [...new Set(data!.map((r: { year: number }) => r.year))];
    expect(years).toContain(2025);
    expect(years).toContain(2026);
  });

  it("select by year filters correctly", async () => {
    const { data, error } = await client
      .from("transactions")
      .select("*")
      .eq("year", 2026);

    expect(error).toBeNull();
    expect(data!.length).toBe(3);
    expect(data!.every((r: { year: number }) => r.year === 2026)).toBe(true);
  });

  it("select count by year", async () => {
    const { count, error } = await client
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("year", 2025);

    expect(error).toBeNull();
    expect(count).toBe(2);
  });

  it("select latest year (max year)", async () => {
    const { data, error } = await client
      .from("transactions")
      .select("year")
      .order("year", { ascending: false })
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(data!.year).toBe(2026);
  });

  it("select years excluding one", async () => {
    const { data, error } = await client
      .from("transactions")
      .select("*")
      .neq("year", 2025);

    expect(error).toBeNull();
    expect(data!.every((r: { year: number }) => r.year !== 2025)).toBe(true);
    expect(data!.length).toBe(3);
  });

  it("delete by year removes only that year", async () => {
    const { error } = await client
      .from("transactions")
      .delete()
      .eq("year", 2025);

    expect(error).toBeNull();

    // Verify 2025 is gone
    const { count } = await client
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("year", 2025);

    expect(count).toBe(0);

    // 2026 still present
    const { count: count2026 } = await client
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("year", 2026);

    expect(count2026).toBe(3);
  });

  it("delete all removes remaining transactions", async () => {
    const { error } = await client
      .from("transactions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

    expect(error).toBeNull();

    const { count } = await client
      .from("transactions")
      .select("*", { count: "exact", head: true });

    expect(count).toBe(0);
  });
});
